const AFRICA_CODES = new Set([
  'CI','SN','ML','BF','TG','BJ','GH','NG','CM','GN','GW','NE','CD','CG','GA',
  'CF','TD','MR','MG','KE','TZ','UG','RW','ET','ZA','EG','MA','TN','DZ','SL',
  'LR','GM','CV','GQ','ST','KM','MZ','ZM','ZW','BW','NA','AO','BI','MW','LS',
  'SZ','DJ','SO','SD','ER','SS','MU','SC','RE','YT',
]);

const EUROPE_CODES = new Set([
  'FR','BE','CH','LU','DE','IT','ES','PT','NL','GB','AT','IE','PL','CZ','SK',
  'HU','RO','BG','HR','SI','RS','GR','FI','SE','NO','DK','IS','LT','LV','EE',
  'MT','CY','MC','SM','LI','AD','AL','BA','MK','ME','XK',
]);

const COUNTRY_NAME_MAP = {
  "côte d'ivoire": 'CI', "cote d'ivoire": 'CI', "ivory coast": 'CI', 'ci': 'CI',
  'sénégal': 'SN', 'senegal': 'SN', 'mali': 'ML', 'burkina faso': 'BF', 'burkina': 'BF',
  'togo': 'TG', 'bénin': 'BJ', 'benin': 'BJ', 'guinée': 'GN', 'guinee': 'GN', 'guinea': 'GN',
  'ghana': 'GH', 'nigeria': 'NG', 'niger': 'NE', 'cameroun': 'CM', 'cameroon': 'CM',
  'congo': 'CG', 'rdc': 'CD', 'rd congo': 'CD', 'maroc': 'MA', 'morocco': 'MA',
  'france': 'FR', 'belgique': 'BE', 'belgium': 'BE', 'suisse': 'CH', 'switzerland': 'CH',
  'luxembourg': 'LU', 'allemagne': 'DE', 'germany': 'DE', 'italie': 'IT', 'italy': 'IT',
  'espagne': 'ES', 'spain': 'ES', 'portugal': 'PT', 'pays-bas': 'NL', 'netherlands': 'NL',
  'royaume-uni': 'GB', 'united kingdom': 'GB', 'uk': 'GB', 'autriche': 'AT', 'austria': 'AT',
  'irlande': 'IE', 'ireland': 'IE',
};

// Parité légale fixe CFA : 1 EUR = 655.957 XOF
const EUR_XOF_RATE = 655.957;
const DEFAULT_CHECKOUT_COUNTRIES = ['CI', 'FR'];

function resolveCountryCode(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_NAME_MAP[trimmed.toLowerCase()] || null;
}

function detectRegion(countryInput) {
  const code = resolveCountryCode(countryInput);
  if (!code) return 'africa';
  if (EUROPE_CODES.has(code)) return 'europe';
  return 'africa';
}

function isKnownCountryCode(countryInput) {
  const code = resolveCountryCode(countryInput);
  return Boolean(code && (AFRICA_CODES.has(code) || EUROPE_CODES.has(code)));
}

function isCheckoutCountrySupported(countryInput) {
  const code = resolveCountryCode(countryInput);
  return Boolean(code && (code === 'CI' || EUROPE_CODES.has(code)));
}

function getCheckoutCountries() {
  const configured = process.env.CHECKOUT_COUNTRIES || DEFAULT_CHECKOUT_COUNTRIES.join(',');
  return [...new Set(configured
    .split(',')
    .map((country) => resolveCountryCode(country))
    .filter((country) => country && isCheckoutCountrySupported(country)))];
}

function isCheckoutCountryEnabled(countryInput) {
  const code = resolveCountryCode(countryInput);
  return Boolean(code && getCheckoutCountries().includes(code));
}

// DB centimes XOF → EUR cents (pour Stripe)
function xofCentimesToEurCents(centimesXOF) {
  return Math.max(1, Math.round((centimesXOF / 100 / EUR_XOF_RATE) * 100));
}

// EUR cents → DB centimes XOF
function eurCentsToXofCentimes(eurCents) {
  return Math.round((eurCents / 100) * EUR_XOF_RATE * 100);
}

module.exports = {
  AFRICA_CODES,
  EUROPE_CODES,
  EUR_XOF_RATE,
  DEFAULT_CHECKOUT_COUNTRIES,
  resolveCountryCode,
  detectRegion,
  isKnownCountryCode,
  isCheckoutCountrySupported,
  getCheckoutCountries,
  isCheckoutCountryEnabled,
  xofCentimesToEurCents,
  eurCentsToXofCentimes,
};
