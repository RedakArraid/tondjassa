const ROLE_PERMISSIONS = Object.freeze({
  manager: ['dashboard.read', 'catalog.read', 'catalog.write', 'orders.read', 'orders.write', 'finance.read', 'finance.write', 'settings.read', 'settings.write', 'team.manage'],
  catalog: ['dashboard.read', 'catalog.read', 'catalog.write'],
  orders: ['dashboard.read', 'orders.read', 'orders.write'],
  finance: ['dashboard.read', 'finance.read', 'finance.write'],
});

function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

function requiredPermission(req) {
  const path = req.path || '';
  const write = req.method !== 'GET';
  if (/\/team(?:\/|$)/.test(path)) return 'team.manage';
  if (/\/notification-preferences(?:\/|$)/.test(path)) return write ? 'settings.write' : 'settings.read';
  if (/\/profile(?:\/|$)/.test(path)) return write ? 'settings.write' : 'dashboard.read';
  if (/\/settings(?:\/|$)/.test(path)) return write ? 'settings.write' : 'settings.read';
  if (/\/(?:products|promotions)(?:\/|$)/.test(path)) return write ? 'catalog.write' : 'catalog.read';
  if (/\/orders(?:\/|$)/.test(path)) return write ? 'orders.write' : 'orders.read';
  if (/\/(?:customers|reviews|notifications|support|messages)(?:\/|$)/.test(path)) return write ? 'orders.write' : 'orders.read';
  if (/\/(?:balance|ledger|payouts|earnings)(?:\/|$)/.test(path)) return write ? 'finance.write' : 'finance.read';
  return 'dashboard.read';
}

module.exports = { ROLE_PERMISSIONS, permissionsForRole, requiredPermission };
