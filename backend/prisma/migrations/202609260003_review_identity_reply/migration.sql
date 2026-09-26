ALTER TABLE "Review"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "sellerReply" TEXT,
  ADD COLUMN "sellerReplyAt" TIMESTAMP(3);

CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");
CREATE UNIQUE INDEX "Review_customerId_productId_key" ON "Review"("customerId", "productId");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
