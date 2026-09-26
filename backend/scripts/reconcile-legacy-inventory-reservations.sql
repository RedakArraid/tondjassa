-- Rebuild inventory reservations for active legacy orders after Prisma migrations.
--
-- Preconditions:
--   * the application and worker are stopped;
--   * all Prisma migrations, including production_hardening, are applied;
--   * the schema baseline reconciliation completed successfully.
--
-- This script never changes physical quantities, orders or payments. It derives
-- the reservation of every product exclusively from active, uncommitted order
-- items and updates Product.stock to the canonical available-stock projection.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';
SET LOCAL idle_in_transaction_session_timeout = '5min';

-- Close the race with checkout, order transitions and manual inventory updates.
-- Reads remain available; writes must already be disabled by maintenance mode.
LOCK TABLE
  "Order",
  "OrderItem",
  "Inventory",
  "Product",
  "AuditLog"
IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE legacy_expected_reservations
ON COMMIT DROP
AS
SELECT
  oi."productId",
  SUM(oi.quantity)::integer AS required
FROM "OrderItem" oi
JOIN "Order" o ON o.id = oi."orderId"
WHERE o.status IN ('PENDING', 'CONFIRMED', 'PROCESSING')
  AND oi."stockCommittedAt" IS NULL
  AND oi."stockRestoredAt" IS NULL
GROUP BY oi."productId";

DO $validate_legacy_reservations$
DECLARE
  invalid_item_count bigint;
  missing_inventory_count bigint;
  insufficient_stock_count bigint;
  inactive_unmarked_count bigint;
BEGIN
  SELECT count(*)
    INTO invalid_item_count
  FROM "OrderItem" oi
  JOIN "Order" o ON o.id = oi."orderId"
  WHERE o.status IN ('PENDING', 'CONFIRMED', 'PROCESSING')
    AND oi."stockCommittedAt" IS NULL
    AND oi."stockRestoredAt" IS NULL
    AND oi.quantity <= 0;

  IF invalid_item_count <> 0 THEN
    RAISE EXCEPTION
      'Reservation reconciliation refused: % active order item(s) have a non-positive quantity',
      invalid_item_count;
  END IF;

  SELECT count(*)
    INTO missing_inventory_count
  FROM legacy_expected_reservations expected
  LEFT JOIN "Inventory" inventory
    ON inventory."productId" = expected."productId"
  WHERE inventory.id IS NULL;

  IF missing_inventory_count <> 0 THEN
    RAISE EXCEPTION
      'Reservation reconciliation refused: % active product(s) have no inventory row',
      missing_inventory_count;
  END IF;

  SELECT count(*)
    INTO insufficient_stock_count
  FROM legacy_expected_reservations expected
  JOIN "Inventory" inventory
    ON inventory."productId" = expected."productId"
  WHERE inventory.quantity < expected.required;

  IF insufficient_stock_count <> 0 THEN
    RAISE EXCEPTION
      'Reservation reconciliation refused: % product(s) have insufficient physical stock',
      insufficient_stock_count;
  END IF;

  -- The hardening migration must have marked every terminal or shipped line.
  -- Reserving one of those lines would incorrectly put sold/restored stock on hold.
  SELECT count(*)
    INTO inactive_unmarked_count
  FROM "OrderItem" oi
  JOIN "Order" o ON o.id = oi."orderId"
  WHERE o.status IN ('SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')
    AND oi."stockCommittedAt" IS NULL
    AND oi."stockRestoredAt" IS NULL;

  IF inactive_unmarked_count <> 0 THEN
    RAISE EXCEPTION
      'Reservation reconciliation refused: % inactive order item(s) have no stock marker',
      inactive_unmarked_count;
  END IF;
END
$validate_legacy_reservations$;

DO $apply_legacy_reservations$
DECLARE
  changed_inventory_rows integer;
  changed_product_rows integer;
  active_product_count integer;
  reserved_unit_count integer;
BEGIN
  WITH desired AS (
    SELECT
      inventory."productId",
      COALESCE(expected.required, 0) AS required
    FROM "Inventory" inventory
    LEFT JOIN legacy_expected_reservations expected
      ON expected."productId" = inventory."productId"
  )
  UPDATE "Inventory" inventory
  SET
    reserved = desired.required,
    available = inventory.quantity - desired.required,
    "lastUpdated" = CURRENT_TIMESTAMP
  FROM desired
  WHERE inventory."productId" = desired."productId"
    AND (
      inventory.reserved IS DISTINCT FROM desired.required
      OR inventory.available IS DISTINCT FROM inventory.quantity - desired.required
    );
  GET DIAGNOSTICS changed_inventory_rows = ROW_COUNT;

  UPDATE "Product" product
  SET
    stock = inventory.available,
    "updatedAt" = CURRENT_TIMESTAMP
  FROM "Inventory" inventory
  WHERE inventory."productId" = product.id
    AND product.stock IS DISTINCT FROM inventory.available;
  GET DIAGNOSTICS changed_product_rows = ROW_COUNT;

  SELECT count(*), COALESCE(sum(required), 0)
    INTO active_product_count, reserved_unit_count
  FROM legacy_expected_reservations;

  INSERT INTO "AuditLog" (
    id,
    "userId",
    action,
    entity,
    "entityId",
    details,
    "createdAt"
  ) VALUES (
    'legacy-inventory-reservation-backfill-v1',
    NULL,
    'LEGACY_INVENTORY_RESERVATION_BACKFILL',
    'InventoryReconciliation',
    'v1',
    jsonb_build_object(
      'activeProducts', active_product_count,
      'reservedUnits', reserved_unit_count,
      'changedInventoryRows', changed_inventory_rows,
      'changedProductRows', changed_product_rows
    ),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO NOTHING;
END
$apply_legacy_reservations$;

DO $verify_legacy_reservations$
DECLARE
  invariant_error_count bigint;
  reservation_mismatch_count bigint;
BEGIN
  SELECT count(*)
    INTO invariant_error_count
  FROM "Inventory" inventory
  JOIN "Product" product ON product.id = inventory."productId"
  WHERE inventory.quantity < 0
     OR inventory.reserved < 0
     OR inventory.reserved > inventory.quantity
     OR inventory.available <> inventory.quantity - inventory.reserved
     OR product.stock <> inventory.available;

  IF invariant_error_count <> 0 THEN
    RAISE EXCEPTION
      'Reservation reconciliation failed: % inventory invariant error(s)',
      invariant_error_count;
  END IF;

  SELECT count(*)
    INTO reservation_mismatch_count
  FROM "Inventory" inventory
  LEFT JOIN (
    SELECT oi."productId", SUM(oi.quantity)::integer AS required
    FROM "OrderItem" oi
    WHERE oi."stockCommittedAt" IS NULL
      AND oi."stockRestoredAt" IS NULL
    GROUP BY oi."productId"
  ) expected ON expected."productId" = inventory."productId"
  WHERE inventory.reserved <> COALESCE(expected.required, 0);

  IF reservation_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'Reservation reconciliation failed: % reservation mismatch(es) remain',
      reservation_mismatch_count;
  END IF;
END
$verify_legacy_reservations$;

COMMIT;

SELECT details
FROM "AuditLog"
WHERE id = 'legacy-inventory-reservation-backfill-v1';
