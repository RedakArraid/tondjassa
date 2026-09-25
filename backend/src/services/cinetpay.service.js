const crypto = require('crypto');

const CINETPAY_API = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_CHECK_API = 'https://api-checkout.cinetpay.com/v2/payment/check';

function isConfigured() {
  return !!(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
}

async function initiatePayment({ orderId, amount, customer, returnUrl, notifyUrl }) {
  if (!isConfigured()) {
    throw new Error('CinetPay non configuré. Définissez CINETPAY_API_KEY et CINETPAY_SITE_ID');
  }
  // amount est en centimes XOF → diviser par 100 pour FCFA
  const amountFCFA = Math.round(amount / 100);

  const payload = {
    apikey: process.env.CINETPAY_API_KEY,
    site_id: process.env.CINETPAY_SITE_ID,
    transaction_id: orderId,
    amount: amountFCFA,
    currency: 'XOF',
    description: `Commande MandeMarket #${orderId.substring(0, 8).toUpperCase()}`,
    return_url: returnUrl,
    notify_url: notifyUrl,
    lang: 'fr',
    channels: 'ALL',
    customer_name: `${customer.firstName} ${customer.lastName}`,
    customer_email: customer.email,
    customer_phone_number: customer.phone || '',
    customer_address: customer.address?.street || 'Abidjan',
    customer_city: customer.address?.city || 'Abidjan',
    customer_country: 'CI',
    customer_state: 'CI',
    customer_zip_code: customer.address?.postalCode || '00225',
    metadata: JSON.stringify({ orderId }),
  };

  const response = await fetch(CINETPAY_API, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (data.code === '201') {
    return {
      paymentUrl: data.data.payment_url,
      transactionId: data.data.transaction_id || orderId,
    };
  }
  throw new Error(data.message || `Erreur CinetPay code ${data.code}`);
}

/**
 * Vérification serveur-à-serveur infalsifiable auprès de CinetPay (MM-BE-041)
 * Ne fait jamais confiance à cpm_result seul.
 */
async function checkPaymentStatus(transactionId) {
  if (!isConfigured()) return null;

  const response = await fetch(CINETPAY_CHECK_API, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: transactionId,
    }),
  });

  const data = await response.json();

  // Seul le statut "ACCEPTED" et code "00" de l'API check officielle prouve le paiement
  const isAccepted = data.code === '00' && data.data?.status === 'ACCEPTED';
  const amountFCFA = data.data ? Number(data.data.amount) : null;
  const amountCentimes = amountFCFA !== null ? Math.round(amountFCFA * 100) : null;

  return {
    isSuccess: isAccepted,
    status: data.data?.status || 'UNKNOWN',
    amount: amountCentimes,
    amountFCFA,
    currency: data.data?.currency || null,
    operatorId: data.data?.operator_id,
    paymentMethod: data.data?.payment_method,
    paymentDate: data.data?.payment_date,
    rawData: data,
  };
}

/**
 * Vérifie le token HMAC (x-token) fourni par CinetPay lors de la notification
 */
function verifyNotificationToken(token, rawBody) {
  const secret = process.env.CINETPAY_SECRET_KEY || process.env.CINETPAY_API_KEY;
  if (!secret || !token) return true; // Si pas de secret défini, fallback sur checkPaymentStatus

  try {
    const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return hash.toLowerCase() === token.toLowerCase();
  } catch (err) {
    return false;
  }
}

module.exports = {
  isConfigured,
  initiatePayment,
  verifyPayment: checkPaymentStatus,
  checkPaymentStatus,
  verifyNotificationToken,
};
