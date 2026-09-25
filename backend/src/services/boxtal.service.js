const https = require('https');
const http = require('http');

const BOXTAL_ENV = process.env.BOXTAL_ENV || 'test'; // 'test' ou 'production'
const BOXTAL_BASE = BOXTAL_ENV === 'production'
  ? 'https://www.boxtal.com'
  : 'https://test.boxtal.com';

function isConfigured() {
  return !!(process.env.BOXTAL_LOGIN && process.env.BOXTAL_PASSWORD);
}

function getAuthHeader() {
  const credentials = Buffer.from(`${process.env.BOXTAL_LOGIN}:${process.env.BOXTAL_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

// Requête HTTP vers Boxtal API
async function boxtalRequest(path, params = {}) {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BOXTAL_BASE}/api/v1${path}${queryString ? '?' + queryString : ''}`;
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Delai Boxtal depasse')));
    req.on('error', reject);
    req.end();
  });
}

// Obtenir les tarifs d'expédition
async function getShippingRates({ weight, width, height, depth, collectionCountry = 'CI', deliveryCountry = 'CI', collectionDate }) {
  if (!isConfigured()) {
    // Mode démo: retourner des tarifs simulés
    return getDemoRates();
  }

  try {
    const params = {
      'shipper[reclosable]': 0,
      'package[weight]': weight || 0.5,
      'package[width]': width || 20,
      'package[height]': height || 15,
      'package[depth]': depth || 10,
      'collection_country': collectionCountry,
      'delivery_country': deliveryCountry,
      'collection_date': collectionDate || new Date().toISOString().split('T')[0]
    };
    return await boxtalRequest('/simulation/offer', params);
  } catch (err) {
    console.error('[Boxtal] Erreur tarifs:', err.message);
    return getDemoRates();
  }
}

// Tarifs de démonstration (quand Boxtal non configuré)
function getDemoRates() {
  return {
    demo: true,
    offers: [
      { carrier: 'STANDARD', service: 'Livraison standard Abidjan', price: 0, currency: 'XOF', delay: '48-72h', description: 'Livraison à domicile sous 48-72h dans Abidjan' },
      { carrier: 'EXPRESS', service: 'Livraison express Abidjan', price: 500000, currency: 'XOF', delay: '24h', description: 'Livraison en moins de 24h dans Abidjan' },
      { carrier: 'PICKUP', service: 'Retrait en point relais', price: 0, currency: 'XOF', delay: 'Disponible sous 48h', description: 'Retrait dans l\'un de nos points relais partenaires' }
    ]
  };
}

// Créer un envoi (après confirmation commande)
async function createShipment() {
  throw Object.assign(new Error('Creation automatique d etiquette non activee. Utilisez un bordereau reel et saisissez le suivi dans les commandes vendeur.'), { statusCode: 503 });
}

module.exports = { isConfigured, getShippingRates, createShipment, getDemoRates };
