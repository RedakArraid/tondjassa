'use strict';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function recalculateSellerRating(db, sellerId) {
  if (!sellerId) return;
  const reviews = await db.review.findMany({
    where: { product: { sellerId }, status: 'approved' },
    select: { rating: true },
  });
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  await db.seller.update({
    where: { id: sellerId },
    data: { rating: Number(average.toFixed(2)), reviewCount: reviews.length },
  });
}

async function createReview(db, input, actor) {
  const product = await db.product.findFirst({
    where: { id: input.productId, status: 'active' },
    include: { seller: true },
  });
  if (!product) throw httpError(404, 'Produit non trouvé');

  let customer = null;
  if (actor) {
    if (actor.role !== 'customer' || !actor.customerId) {
      throw httpError(403, 'Un compte client est requis pour publier un avis authentifié.');
    }
    customer = await db.customer.findUnique({ where: { id: actor.customerId } });
    if (!customer || customer.status === 'deleted') throw httpError(403, 'Compte client indisponible');
  }

  const customerName = customer
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : String(input.customerName || '').trim();
  const customerEmail = customer
    ? customer.email.toLowerCase()
    : (input.customerEmail ? input.customerEmail.toLowerCase().trim() : null);

  if (!customerName) throw httpError(400, 'Nom requis');

  const existing = customer
    ? await db.review.findFirst({ where: { productId: input.productId, customerId: customer.id } })
    : customerEmail
      ? await db.review.findFirst({ where: { productId: input.productId, customerId: null, customerEmail } })
      : null;
  if (existing) throw httpError(409, 'Vous avez déjà évalué ce produit.');

  let isVerified = false;
  if (customer) {
    isVerified = Boolean(await db.order.findFirst({
      where: {
        customerId: customer.id,
        status: { in: ['DELIVERED', 'SHIPPED'] },
        items: { some: { productId: input.productId } },
      },
      select: { id: true },
    }));
  }

  const review = await db.review.create({
    data: {
      productId: input.productId,
      customerId: customer?.id || null,
      customerName,
      customerEmail,
      rating: input.rating,
      title: input.title ? input.title.trim() : null,
      comment: input.comment.trim(),
      isVerified,
      status: isVerified ? 'approved' : 'pending',
    },
  });

  if (review.status === 'approved') await recalculateSellerRating(db, product.sellerId);

  return {
    review,
    message: isVerified
      ? 'Votre avis vérifié a été publié immédiatement.'
      : 'Votre avis a été soumis et sera validé par notre équipe après modération.',
  };
}

async function replyToReview(db, { sellerId, reviewId, reply }) {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: { product: { select: { sellerId: true } } },
  });
  if (!review || review.product?.sellerId !== sellerId) throw httpError(404, 'Avis introuvable');
  if (review.status !== 'approved') throw httpError(409, 'Seul un avis approuvé peut recevoir une réponse publique.');

  return db.review.update({
    where: { id: reviewId },
    data: { sellerReply: reply.trim(), sellerReplyAt: new Date() },
  });
}

module.exports = { createReview, replyToReview, recalculateSellerRating };
