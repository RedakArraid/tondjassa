-- Align the known pre-baseline MandeMarket schema with prisma/migrations/0_init.
--
-- Run this script once, with the application and worker in maintenance, BEFORE:
--   prisma migrate resolve --applied 0_init
--   prisma migrate deploy
--
-- The operation is idempotent. It never changes or deletes application rows. It
-- creates the indexes required by the baseline and changes six legacy foreign
-- keys from RESTRICT/SET NULL to the CASCADE policy declared by 0_init.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';
SET LOCAL idle_in_transaction_session_timeout = '5min';

-- Close the race between the orphan checks and replacement of the constraints.
-- This mode still permits reads. Run in maintenance so writes do not delay it.
LOCK TABLE
  "Address",
  "Inventory",
  "Notification",
  "OrderItem",
  "Payment",
  "Shipping"
IN SHARE ROW EXCLUSIVE MODE;

DO $reconcile_fks$
DECLARE
  fk record;
  current_definition text;
  orphan_count bigint;
BEGIN
  FOR fk IN
    SELECT *
    FROM (VALUES
      ('Address',      'customerId', 'Customer', 'id', 'Address_customerId_fkey',  'RESTRICT'),
      ('Inventory',    'productId',  'Product',  'id', 'Inventory_productId_fkey', 'RESTRICT'),
      ('Notification', 'userId',     'User',     'id', 'Notification_userId_fkey', 'SET NULL'),
      ('OrderItem',    'orderId',    'Order',    'id', 'OrderItem_orderId_fkey',   'RESTRICT'),
      ('Payment',      'orderId',    'Order',    'id', 'Payment_orderId_fkey',     'RESTRICT'),
      ('Shipping',     'orderId',    'Order',    'id', 'Shipping_orderId_fkey',    'RESTRICT')
    ) AS expected(
      child_table,
      child_column,
      parent_table,
      parent_column,
      constraint_name,
      legacy_delete_action
    )
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I child LEFT JOIN %I parent ON parent.%I = child.%I WHERE child.%I IS NOT NULL AND parent.%I IS NULL',
      fk.child_table,
      fk.parent_table,
      fk.parent_column,
      fk.child_column,
      fk.child_column,
      fk.parent_column
    ) INTO orphan_count;

    IF orphan_count <> 0 THEN
      RAISE EXCEPTION
        'Cannot reconcile %: % orphan row(s) in %.%',
        fk.constraint_name,
        orphan_count,
        fk.child_table,
        fk.child_column;
    END IF;

    SELECT pg_get_constraintdef(c.oid)
      INTO current_definition
    FROM pg_constraint c
    WHERE c.conname = fk.constraint_name
      AND c.conrelid = format('%I', fk.child_table)::regclass;

    IF current_definition IS NOT NULL
       AND current_definition <> format(
         'FOREIGN KEY (%I) REFERENCES %I(%s) ON UPDATE CASCADE ON DELETE CASCADE',
         fk.child_column,
         fk.parent_table,
         fk.parent_column
       )
       AND current_definition <> format(
         'FOREIGN KEY (%I) REFERENCES %I(%s) ON UPDATE CASCADE ON DELETE %s',
         fk.child_column,
         fk.parent_table,
         fk.parent_column,
         fk.legacy_delete_action
       ) THEN
      RAISE EXCEPTION
        'Refusing unexpected definition for %: %',
        fk.constraint_name,
        current_definition;
    END IF;

    IF current_definition IS DISTINCT FROM format(
      'FOREIGN KEY (%I) REFERENCES %I(%s) ON UPDATE CASCADE ON DELETE CASCADE',
      fk.child_column,
      fk.parent_table,
      fk.parent_column
    ) THEN
      IF current_definition IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE %I DROP CONSTRAINT %I',
          fk.child_table,
          fk.constraint_name
        );
      END IF;

      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE CASCADE ON UPDATE CASCADE NOT VALID',
        fk.child_table,
        fk.constraint_name,
        fk.child_column,
        fk.parent_table,
        fk.parent_column
      );
      EXECUTE format(
        'ALTER TABLE %I VALIDATE CONSTRAINT %I',
        fk.child_table,
        fk.constraint_name
      );
    END IF;
  END LOOP;
END
$reconcile_fks$;

-- Indexes declared by the new baseline. Some intentionally overlap a unique
-- index on the legacy schema: their names and definitions must still match the
-- Prisma baseline exactly before it can safely be marked as applied.
CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer"("email");
CREATE INDEX IF NOT EXISTS "Inventory_productId_idx" ON "Inventory"("productId");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_transactionId_idx" ON "Payment"("transactionId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "Product_sellerId_idx" ON "Product"("sellerId");
CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product"("sku");
CREATE INDEX IF NOT EXISTS "Promotion_code_idx" ON "Promotion"("code");
CREATE INDEX IF NOT EXISTS "Promotion_isActive_idx" ON "Promotion"("isActive");
CREATE INDEX IF NOT EXISTS "Shipping_status_idx" ON "Shipping"("status");
CREATE INDEX IF NOT EXISTS "Shipping_trackingCode_idx" ON "Shipping"("trackingCode");

COMMIT;

-- Fail the command if any expected index or validated CASCADE constraint is
-- missing. This also makes a second run a useful no-op verification.
DO $verify_reconciliation$
DECLARE
  missing_indexes text[];
  invalid_constraints text[];
BEGIN
  SELECT array_agg(expected_name ORDER BY expected_name)
    INTO missing_indexes
  FROM unnest(ARRAY[
    'Customer_email_idx',
    'Inventory_productId_idx',
    'Notification_userId_isRead_idx',
    'Order_customerId_idx',
    'Order_userId_idx',
    'Order_status_idx',
    'OrderItem_orderId_idx',
    'OrderItem_productId_idx',
    'Payment_status_idx',
    'Payment_transactionId_idx',
    'Product_categoryId_idx',
    'Product_sellerId_idx',
    'Product_sku_idx',
    'Promotion_code_idx',
    'Promotion_isActive_idx',
    'Shipping_status_idx',
    'Shipping_trackingCode_idx'
  ]) AS expected(expected_name)
  WHERE to_regclass(format('public.%I', expected_name)) IS NULL;

  IF missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Missing baseline indexes: %', missing_indexes;
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
    INTO invalid_constraints
  FROM unnest(ARRAY[
    'Address_customerId_fkey',
    'Inventory_productId_fkey',
    'Notification_userId_fkey',
    'OrderItem_orderId_fkey',
    'Payment_orderId_fkey',
    'Shipping_orderId_fkey'
  ]) AS expected(expected_name)
  LEFT JOIN pg_constraint c
    ON c.conname = expected_name
   AND c.contype = 'f'
   AND c.confdeltype = 'c'
   AND c.confupdtype = 'c'
   AND c.convalidated
  WHERE c.oid IS NULL;

  IF invalid_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'Missing or invalid baseline constraints: %', invalid_constraints;
  END IF;
END
$verify_reconciliation$;
