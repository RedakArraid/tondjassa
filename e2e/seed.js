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
  await db.category.create({ data: { name: 'QA Cachée', slug: 'qa-cachee', description: 'Inactive synthetic category', status: 'inactive' } });
  const product = await db.product.create({ data: { name: 'Article recette QA', description: 'Article fictif pour les tests navigateur, jamais expedie.',
    categoryId: category.id, sellerId: seller.seller.id, price: 2000000, stock: 20, images: [], styles: [], features: [], colors: [],
    inventory: { create: { quantity: 20, reserved: 0, available: 20 } } } });
  await db.product.create({ data: { name: 'Brouillon privé QA', description: 'Ne doit jamais être visible publiquement.',
    categoryId: category.id, sellerId: seller.seller.id, price: 300000, stock: 2, status: 'draft',
    images: [], styles: [], features: [], colors: [],
    inventory: { create: { quantity: 2, reserved: 0, available: 2 } } } });
  const buyer = await db.user.create({
    data: {
      email: 'qa-buyer@test.invalid', name: 'QA Buyer', password, role: 'customer', emailVerifiedAt: new Date(),
      customer: { create: { email: 'qa-buyer@test.invalid', firstName: 'QA', lastName: 'Buyer', status: 'active' } },
    },
    include: { customer: true },
  });
  await db.order.create({
    data: {
      orderNumber: 'QA-REVIEW-SHIPPED',
      customerId: buyer.customer.id,
      userId: buyer.id,
      status: 'SHIPPED',
      subtotalAmount: 2000000,
      shippingCost: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 2000000,
      items: {
        create: {
          productId: product.id,
          sellerId: seller.seller.id,
          quantity: 1,
          unitPrice: 2000000,
          totalPrice: 2000000,
          commissionRate: 10,
          commissionAmount: 200000,
          sellerEarnings: 1800000,
          fulfillmentStatus: 'SHIPPED',
          stockCommittedAt: new Date(),
        },
      },
    },
  });
  const returnOrder = await db.order.create({
    data: {
      orderNumber: 'QA-RETURN-DELIVERED',
      customerId: buyer.customer.id,
      userId: buyer.id,
      status: 'DELIVERED',
      subtotalAmount: 2000000,
      shippingCost: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 2000000,
      items: {
        create: {
          productId: product.id,
          sellerId: seller.seller.id,
          quantity: 1,
          unitPrice: 2000000,
          totalPrice: 2000000,
          commissionRate: 10,
          commissionAmount: 200000,
          sellerEarnings: 1800000,
          fulfillmentStatus: 'DELIVERED',
          stockCommittedAt: new Date(),
        },
      },
      payment: {
        create: {
          amount: 2000000,
          method: 'BANK_TRANSFER',
          status: 'COMPLETED',
          gateway: 'manual',
          transactionId: 'qa-return-manual-payment',
        },
      },
      shipping: {
        create: {
          method: 'STANDARD',
          status: 'DELIVERED',
          actualDelivery: new Date(),
        },
      },
    },
    include: { payment: true },
  });
  await db.paymentEvent.create({
    data: {
      orderId: returnOrder.id,
      paymentId: returnOrder.payment.id,
      gateway: 'manual',
      eventType: 'MANUAL_PAYMENT_CONFIRMED',
      idempotencyKey: `settlement:${returnOrder.id}`,
      payload: { credited: true },
      status: 'PROCESSED',
    },
  });
  await db.sellerLedgerEntry.create({
    data: {
      sellerId: seller.seller.id,
      orderId: returnOrder.id,
      type: 'SALE_AVAILABLE',
      amount: 2000000,
      feeAmount: 200000,
      netAmount: 1800000,
      status: 'AVAILABLE',
      availableAt: new Date(),
      description: 'Vente fictive livrée pour recette retour',
    },
  });
  await db.seller.update({
    where: { id: seller.seller.id },
    data: { totalSales: 2000000, totalEarnings: 1800000 },
  });
  await db.customer.update({
    where: { id: buyer.customer.id },
    data: { totalSpent: 2000000 },
  });
  await db.inventory.update({ where: { productId: product.id }, data: { quantity: 18, available: 18 } });
  await db.product.update({ where: { id: product.id }, data: { stock: 18 } });
  console.log('Created isolated browser fixtures. No payment provider was contacted.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
