const db = require('./db');
const session = require('./services/session.service');
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentification requise' });
  try { req.user = await session.authenticateToken(header.slice(7)); return next(); }
  catch (error) {
    if (error.code?.startsWith('P')) return res.status(503).json({ error: 'Authentification temporairement indisponible' });
    return res.status(401).json({ error: 'Session invalide ou expiree' });
  }
}
function requireRole(role) {
  return (req, res, next) => (Array.isArray(role) ? role : [role]).includes(req.user?.role)
    ? next() : res.status(403).json({ error: 'Acces refuse' });
}
const requireAdmin = requireRole('admin');
async function requireSeller(req, res, next) {
  try {
    const seller = await db.seller.findUnique({ where: { userId: req.user.userId } });
    if (!seller || seller.status !== 'approved') return res.status(403).json({ error: 'Boutique non approuvee' });
    req.seller = seller; next();
  } catch { res.status(503).json({ error: 'Service temporairement indisponible' }); }
}
function optionalAuth(req, res, next) {
  return req.headers.authorization ? requireAuth(req, res, next) : next();
}
async function requireCustomerAuth(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== 'customer' || !req.user.customerId) return res.status(403).json({ error: 'Compte client requis' });
    req.customerId = req.user.customerId; req.customerEmail = req.user.email; req.userId = req.user.userId;
    next();
  });
}
module.exports = { requireAuth, requireAdmin, requireRole, requireSeller, optionalAuth, requireCustomerAuth };
