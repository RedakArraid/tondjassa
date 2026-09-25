// Deliberately refuses any non-empty or non-ephemeral database.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const url = new URL(process.env.DATABASE_URL || 'file:///invalid');
if (process.env.E2E_FIXTURES !== 'true' || url.hostname !== 'postgres' || url.pathname !== '/tondjassa_smoke_test') {
  throw new Error('Browser fixtures require the isolated Compose database and explicit E2E_FIXTURES=true');
}
const db = new PrismaClient();
(async () => {
  if ((await db.user.count()) || (await db.customer.count()) || (await db.order.count()) || (await db.product.count())) {
    throw new Error('Refusing to seed a non-empty database');
  }
  const secret = process.env.E2E_PASSWORD;
  if (!secret || secret.length < 16) throw new Error('E2E_PASSWORD must be generated for this run');
  const password = await bcrypt.hash(secret, 12);
  await db.user.create({ data: { email: 'qa-admin@test.invalid', name: 'QA Admin', password, role: 'admin', emailVerifiedAt: new Date() } });
  const seller = await db.user.create({ data: { email: 'qa-seller@test.invalid', name: 'QA Seller', password, role: 'seller', emailVerifiedAt: new Date(),
    seller: { create: { storeName: 'QA Boutique', slug: 'qa-boutique', status: 'approved' } } }, include: { seller: true } });
  const category = await db.category.create({ data: { name: 'QA Collection', slug: 'qa-collection', description: 'Synthetic browser test data' } });
  await db.product.create({ data: { name: 'Article recette QA', description: 'Article fictif pour les tests navigateur, jamais expedie.',
    categoryId: category.id, sellerId: seller.seller.id, price: 2000000, stock: 20, images: [], styles: [], features: [], colors: [],
    inventory: { create: { quantity: 20, reserved: 0, available: 20 } } } });
  console.log('Created isolated browser fixtures. No payment provider was contacted.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
