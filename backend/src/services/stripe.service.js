const { xofCentimesToEurCents } = require('../utils/region');

function isConfigured() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return /^sk_(?:test|live)_[A-Za-z0-9]+$/.test(key) && !/VOTRE|CHANGEZ|xxxx|SECRET$/i.test(key);
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!isConfigured()) {
    throw new Error('Stripe non configuré : renseignez STRIPE_SECRET_KEY (clé sk_test_… réelle) dans .env');
  }
  return require('stripe')(key);
}

// currency: 'xof' (Afrique) ou 'eur' (Europe)
async function createCheckoutSession({ orderId, amount, customer, successUrl, cancelUrl, currency = 'xof', idempotencyKey }) {
  const stripe = getStripe();

  let unitAmount;
  let displayCurrency;
  let paymentMethods;

  if (currency === 'eur') {
    // Europe : convertir XOF centimes → EUR cents
    unitAmount = xofCentimesToEurCents(amount);
    displayCurrency = 'eur';
    paymentMethods = ['card', 'sepa_debit'];
  } else {
    // Afrique : XOF zero-decimal → FCFA (diviser par 100)
    unitAmount = Math.round(amount / 100);
    displayCurrency = 'xof';
    paymentMethods = ['card'];
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: paymentMethods,
    line_items: [{
      price_data: {
        currency: displayCurrency,
        product_data: {
          name: `Commande MandeMarket #${orderId.substring(0, 8).toUpperCase()}`,
          description: 'Commande sur MandeMarket.com',
        },
        unit_amount: unitAmount,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: orderId,
    customer_email: customer.email,
    metadata: { orderId, currency: displayCurrency },
    payment_intent_data: { metadata: { orderId, checkoutSessionPurpose: 'mandemarket_order' } },
  }, { idempotencyKey: idempotencyKey || `checkout-${orderId}` });

  return { paymentUrl: session.url, sessionId: session.id };
}

async function constructWebhookEvent(body, signature) {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
}

module.exports = { createCheckoutSession, constructWebhookEvent, getStripe, isConfigured };
