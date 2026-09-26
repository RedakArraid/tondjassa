/**
 * Normalize les séries de ventes afin que Recharts et l'export CSV utilisent
 * toujours la même clé, quelle que soit la forme renvoyée par l'API.
 *
 * @param {unknown} rows
 * @returns {Array<{date: string, revenue: number, orders: number}>}
 */
function normalizeSalesSeries(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row, index) => {
    const item = row && typeof row === 'object' ? row : {};
    const period = item.month ?? item.date ?? item.label;
    const revenue = Number(item.revenue);
    const orders = Number(item.orders);

    return {
      ...item,
      date: period == null || period === '' ? `Période ${index + 1}` : String(period),
      revenue: Number.isFinite(revenue) ? revenue : 0,
      orders: Number.isFinite(orders) ? orders : 0,
    };
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatChartDate(value) {
  if (value == null || value === '') return 'Date inconnue';

  const raw = String(value).trim();
  const isIsoLike = /^\d{4}-\d{2}(?:-\d{2})?(?:T.*)?$/.test(raw);
  if (!(value instanceof Date) && typeof value !== 'number' && !isIsoLike) return raw;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

module.exports = { formatChartDate, normalizeSalesSeries };
