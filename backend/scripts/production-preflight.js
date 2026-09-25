require('../src/config/env');
const db = require('../src/db');
(async () => {
  const inventory = await db.$queryRaw`SELECT i."productId" FROM "Inventory" i JOIN "Product" p ON p.id=i."productId" WHERE i.quantity<0 OR i.reserved<0 OR i.reserved>i.quantity OR i.available<>i.quantity-i.reserved OR p.stock<>i.available`;
  const reservations = await db.$queryRaw`SELECT i."productId" FROM "Inventory" i LEFT JOIN (SELECT "productId", SUM(quantity) AS qty FROM "OrderItem" WHERE "stockCommittedAt" IS NULL AND "stockRestoredAt" IS NULL GROUP BY "productId") r ON r."productId"=i."productId" WHERE i.reserved<>COALESCE(r.qty,0)`;
  const duplicateSales = await db.$queryRaw`SELECT "sellerId", "orderId", COUNT(*) FROM "SellerLedgerEntry" WHERE type IN ('SALE_PENDING','SALE_AVAILABLE') GROUP BY "sellerId", "orderId" HAVING COUNT(*)>1`;
  const unresolvedRefunds = await db.refund.count({ where: { status: { not: 'COMPLETED' } } });
  const errors = { inconsistentInventory: inventory.length, inconsistentReservations: reservations.length, duplicateSales: duplicateSales.length, unresolvedRefunds };
  console.log(JSON.stringify(errors, null, 2));
  if (Object.values(errors).some((v) => v > 0)) process.exitCode = 1;
  else console.log('Data invariants pass. This is not a production authorization: provider, restore, privacy and operational acceptance are still required.');
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
