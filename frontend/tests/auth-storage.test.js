const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..', 'app');
const sensitiveKeys = ['admin_token', 'mandemarket_customer_token', 'mm_order_access_'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

test('authentication and guest-order secrets are never persisted in localStorage', () => {
  const violations = [];
  for (const file of walk(APP)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const key of sensitiveKeys) {
      const pattern = new RegExp(`localStorage\\.(?:getItem|setItem|removeItem)\\([^\\n)]*${key}`, 'g');
      if (pattern.test(source)) violations.push(path.relative(APP, file) + ': ' + key);
    }
  }
  assert.deepEqual(violations, []);
});
