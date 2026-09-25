const db = require('../db');

// Prisma maps ORM conflicts to P2034, but raw SELECT ... FOR UPDATE failures
// are P2010 with PostgreSQL's SQLSTATE in meta.code. Retry the whole transaction.
function isRetryableConflict(error) {
  return error?.code === 'P2034' ||
    (error?.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code));
}
// Never perform network calls inside work: a retry must not repeat external effects.
async function transaction(work, existingTx) {
  if (existingTx) return work(existingTx);
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 });
    } catch (error) {
      if (!isRetryableConflict(error) || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}
function httpError(message, statusCode = 409) {
  return Object.assign(new Error(message), { statusCode });
}
async function lockOrder(tx, id) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
}
async function lockSeller(tx, id) {
  await tx.$queryRaw`SELECT "id" FROM "Seller" WHERE "id" = ${id} FOR UPDATE`;
}
async function lockKey(tx, key) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}
module.exports = { transaction, httpError, lockOrder, lockSeller, lockKey };
