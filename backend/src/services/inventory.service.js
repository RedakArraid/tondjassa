const { httpError } = require('./transaction');

async function project(tx, productId) {
  const inventory = await tx.inventory.findUnique({ where: { productId } });
  if (!inventory) throw httpError('Inventaire introuvable');
  await tx.product.update({ where: { id: productId }, data: { stock: inventory.available } });
}
async function reserve(tx, productId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw httpError('Quantite invalide', 400);
  const result = await tx.inventory.updateMany({
    where: { productId, available: { gte: quantity } },
    data: { reserved: { increment: quantity }, available: { decrement: quantity }, lastUpdated: new Date() },
  });
  if (result.count !== 1) throw httpError('Stock disponible insuffisant');
  await project(tx, productId);
}
async function release(tx, item) {
  if (item.stockCommittedAt || item.stockRestoredAt) return;
  const result = await tx.inventory.updateMany({
    where: { productId: item.productId, reserved: { gte: item.quantity } },
    data: { reserved: { decrement: item.quantity }, available: { increment: item.quantity }, lastUpdated: new Date() },
  });
  if (result.count !== 1) throw httpError('Reservation incoherente : rapprochement de stock requis');
  await tx.orderItem.update({ where: { id: item.id }, data: { stockRestoredAt: new Date() } });
  await project(tx, item.productId);
}
async function ship(tx, item) {
  if (item.stockCommittedAt) return;
  if (item.stockRestoredAt) throw httpError('Reservation deja liberee');
  const result = await tx.inventory.updateMany({
    where: { productId: item.productId, reserved: { gte: item.quantity }, quantity: { gte: item.quantity } },
    data: { reserved: { decrement: item.quantity }, quantity: { decrement: item.quantity }, lastUpdated: new Date() },
  });
  if (result.count !== 1) throw httpError('Reservation insuffisante pour expedition');
  await tx.orderItem.update({ where: { id: item.id }, data: { stockCommittedAt: new Date() } });
  await project(tx, item.productId);
}
async function restock(tx, item) {
  if (item.stockRestoredAt) return;
  if (!item.stockCommittedAt) return release(tx, item);
  await tx.inventory.update({
    where: { productId: item.productId },
    data: { quantity: { increment: item.quantity }, available: { increment: item.quantity }, lastUpdated: new Date() },
  });
  await tx.orderItem.update({ where: { id: item.id }, data: { stockRestoredAt: new Date() } });
  await project(tx, item.productId);
}
async function setPhysical(tx, productId, quantity, lowStockThreshold = 5) {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0) throw httpError('Stock invalide', 400);
  await tx.$queryRaw`SELECT "id" FROM "Inventory" WHERE "productId" = ${productId} FOR UPDATE`;
  const current = await tx.inventory.findUnique({ where: { productId } });
  const reserved = current?.reserved || 0;
  if (quantity < reserved) throw httpError('Le stock physique ne peut pas etre inferieur aux reservations');
  const result = await tx.inventory.upsert({ where: { productId },
    create: { productId, quantity, reserved: 0, available: quantity, lowStockThreshold },
    update: { quantity, available: quantity - reserved, lowStockThreshold, lastUpdated: new Date() } });
  await project(tx, productId);
  return result;
}
module.exports = { project, reserve, release, ship, restock, setPhysical };
