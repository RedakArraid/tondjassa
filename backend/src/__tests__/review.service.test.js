const ReviewService = require('../services/review.service');

function makeDb() {
  return {
    product: { findFirst: jest.fn() },
    customer: { findUnique: jest.fn() },
    order: { findFirst: jest.fn() },
    review: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    seller: { update: jest.fn() },
  };
}

describe('review identity and verification', () => {
  test('a guest cannot obtain verified status by typing a buyer email', async () => {
    const db = makeDb();
    db.product.findFirst.mockResolvedValue({ id: 1, sellerId: null });
    db.review.findFirst.mockResolvedValue(null);
    db.review.create.mockImplementation(({ data }) => Promise.resolve({ id: 'guest', ...data }));

    const result = await ReviewService.createReview(db, {
      productId: 1,
      customerName: 'Guest',
      customerEmail: 'buyer@test.invalid',
      rating: 5,
      comment: 'Tentative',
    }, null);

    expect(result.review.isVerified).toBe(false);
    expect(result.review.status).toBe('pending');
    expect(result.review.customerId).toBeNull();
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });

  test('authenticated customer identity overrides submitted identity and verifies own shipped purchase', async () => {
    const db = makeDb();
    db.product.findFirst.mockResolvedValue({ id: 1, sellerId: 'seller-1' });
    db.customer.findUnique.mockResolvedValue({
      id: 'customer-1', email: 'real@test.invalid', firstName: 'Real', lastName: 'Buyer', status: 'active',
    });
    db.review.findFirst.mockResolvedValue(null);
    db.order.findFirst.mockResolvedValue({ id: 'order-1' });
    db.review.create.mockImplementation(({ data }) => Promise.resolve({ id: 'review-1', ...data }));
    db.review.findMany.mockResolvedValue([{ rating: 5 }]);

    const result = await ReviewService.createReview(db, {
      productId: 1,
      customerName: 'Spoofed',
      customerEmail: 'attacker@test.invalid',
      rating: 5,
      comment: 'Livré',
    }, { role: 'customer', customerId: 'customer-1' });

    expect(result.review.customerId).toBe('customer-1');
    expect(result.review.customerName).toBe('Real Buyer');
    expect(result.review.customerEmail).toBe('real@test.invalid');
    expect(result.review.isVerified).toBe(true);
    expect(result.review.status).toBe('approved');
    expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ customerId: 'customer-1' }),
    }));
    expect(db.seller.update).toHaveBeenCalled();
  });

  test('staff token cannot be used as a verified customer identity', async () => {
    const db = makeDb();
    db.product.findFirst.mockResolvedValue({ id: 1, sellerId: null });
    await expect(ReviewService.createReview(db, {
      productId: 1, customerName: 'Seller', rating: 5, comment: 'Nope',
    }, { role: 'seller', customerId: null })).rejects.toMatchObject({ statusCode: 403 });
  });

  test('seller reply is stored separately and only on an approved review owned by the seller', async () => {
    const db = makeDb();
    db.review.findUnique.mockResolvedValue({
      id: 'review-1', status: 'approved', product: { sellerId: 'seller-1' },
    });
    db.review.update.mockImplementation(({ data }) => Promise.resolve({ id: 'review-1', ...data }));

    const updated = await ReviewService.replyToReview(db, {
      sellerId: 'seller-1', reviewId: 'review-1', reply: 'Merci',
    });

    expect(updated.sellerReply).toBe('Merci');
    expect(db.review.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sellerReply: 'Merci', sellerReplyAt: expect.any(Date) }),
    }));
  });
});
