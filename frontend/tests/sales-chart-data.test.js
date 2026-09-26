const assert = require('node:assert/strict');
const test = require('node:test');

const {
  formatChartDate,
  normalizeSalesSeries,
} = require('../app/admin/components/sales-chart-data');

test('normalise les périodes mensuelles renvoyées sous date ou month', () => {
  assert.deepEqual(
    normalizeSalesSeries([
      { date: '2026-09-01', revenue: 120000, orders: 4 },
      { month: '2026-08', revenue: 90000, orders: 3 },
    ]),
    [
      { date: '2026-09-01', revenue: 120000, orders: 4 },
      { month: '2026-08', date: '2026-08', revenue: 90000, orders: 3 },
    ],
  );
});

test('sécurise les séries et le formatage en cas de données inattendues', () => {
  assert.deepEqual(normalizeSalesSeries([{ revenue: 'invalide', orders: undefined }]), [
    { date: 'Période 1', revenue: 0, orders: 0 },
  ]);
  assert.equal(formatChartDate(undefined), 'Date inconnue');
  assert.equal(formatChartDate('Période 1'), 'Période 1');
  assert.doesNotThrow(() => formatChartDate('2026-09-01'));
});
