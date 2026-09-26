const PAYSTACK_BASE = 'https://api.paystack.co';

function isConfigured() {
  const key = process.env.PAYSTACK_SECRET_KEY || '';
  return /^sk_(?:test|live)_[A-Za-z0-9_-]{8,}$/.test(key) && !/VOTRE|CHANGEZ|xxxx/i.test(key);
}

function getHeaders() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY non configuré. Inscrivez-vous sur https://paystack.com');
  }
  return {
    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Mapper les opérateurs mandemarket → slug Paystack mobile money
const OPERATOR_SLUG = { mtn_momo: 'mtn', orange_money: 'orange', wave: 'wave' }; // Paystack official CIV provider codes.

/**
 * Initialiser une transaction Paystack.
 * @param {object} params
 * @param {string} params.orderId
 * @param {number} params.amount       — centimes XOF (stockage DB)
 * @param {string} params.email
 * @param {string} params.callbackUrl
 * @param {string} [params.mobilePhone]     — numéro Mobile Money (optionnel)
 * @param {string} [params.operatorGateway] — 'mtn_momo' | 'orange_money' | 'wave'
 */
async function initializeTransaction({ orderId, amount, email, callbackUrl, operatorGateway, reference }) {
  if (!isConfigured() || /VOTRE|CHANGEZ|xxxx/i.test(process.env.PAYSTACK_SECRET_KEY || '')) {
    throw new Error('Paystack non configuré : renseignez PAYSTACK_SECRET_KEY (clé sk_test_… réelle) dans .env');
  }
  reference = reference || `MM-${orderId}`;
  const providerSlug = OPERATOR_SLUG[operatorGateway] ?? null;

  const body = {
    email,
    amount,         // centimes XOF = format Paystack XOF
    currency: 'XOF',
    reference,
    callback_url: callbackUrl,
    metadata: { orderId, source: 'mandemarket', operator: operatorGateway ?? 'paystack' },
    channels: providerSlug ? ['mobile_money'] : ['mobile_money', 'card'],
  };

  // Hosted checkout selects the operator; mobile_money belongs to Charge API, not initialize.

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Erreur Paystack initialize');

  return {
    paymentUrl:  data.data.authorization_url,
    reference:   data.data.reference,
    accessCode:  data.data.access_code,
  };
}

async function verifyTransaction(reference) {
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: getHeaders(), signal: AbortSignal.timeout(15000) }
  );
  return await response.json();
}

function verifyWebhookSignature(rawBody, signature) {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return typeof signature === 'string' && /^[0-9a-f]{128}$/i.test(signature) &&
    crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signature, 'hex'));
}

module.exports = {
  isConfigured,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  OPERATOR_SLUG,
};
