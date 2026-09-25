-- Additive migration. Do not rewrite historical stock or financial balances.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "checkoutSecretHash" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "fulfillmentStatus" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "stockCommittedAt" TIMESTAMP(3), ADD COLUMN "stockRestoredAt" TIMESTAMP(3),
  ADD COLUMN "carrier" TEXT, ADD COLUMN "trackingCode" TEXT;
-- Derive fulfillment progress only, not inventory quantities, from existing orders.
UPDATE "OrderItem" i SET "fulfillmentStatus"=o.status FROM "Order" o WHERE o.id=i."orderId";
UPDATE "OrderItem" i SET "stockCommittedAt"=o."updatedAt" FROM "Order" o
 WHERE o.id=i."orderId" AND o.status IN ('SHIPPED','DELIVERED','REFUNDED');
UPDATE "OrderItem" i SET "stockRestoredAt"=o."updatedAt" FROM "Order" o
 WHERE o.id=i."orderId" AND o.status IN ('CANCELLED','REFUNDED');
CREATE TABLE "EmailVerificationToken" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE TABLE "Refund" (
 "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "gateway" TEXT NOT NULL,
 "transactionId" TEXT, "amount" INTEGER NOT NULL, "currency" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'REQUESTED', "providerReference" TEXT, "reason" TEXT, "error" TEXT,
 "submittedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Refund_orderId_key" ON "Refund"("orderId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
-- NOT VALID avoids silently rewriting old data. New writes must obey invariants.
-- Validate after the preproduction data reconciliation described in the runbook.
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_nonnegative_consistent"
 CHECK (quantity >= 0 AND reserved >= 0 AND reserved <= quantity AND available = quantity - reserved) NOT VALID;
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_positive" CHECK (amount > 0) NOT VALID;

ALTER TABLE "Refund" ADD COLUMN "restockRequested" BOOLEAN NOT NULL DEFAULT false;
