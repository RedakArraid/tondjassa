ALTER TABLE "Promotion" ADD COLUMN "sellerId" TEXT;

CREATE INDEX "Promotion_sellerId_isActive_idx"
  ON "Promotion"("sellerId", "isActive");

ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
