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
    let seller = await db.seller.findUnique({ where: { userId: req.user.userId } });
    let access = seller ? { isOwner: true, role: 'owner', permissions: ['*'] } : null;
    if (!seller) {
      const member = await db.sellerMember.findFirst({ where: { userId: req.user.userId, status: 'active' }, include: { seller: true } });
      seller = member?.seller;
      if (member) access = { isOwner: false, memberId: member.id, role: member.role, permissions: member.permissions };
    }
    if (!seller || seller.status !== 'approved') return res.status(403).json({ error: 'Boutique non approuvee' });
    const needed = require('./services/seller-access.service').requiredPermission(req);
    if (!access.isOwner && !access.permissions.includes(needed)) return res.status(403).json({ error: 'Permission vendeur insuffisante', permission: needed });
    req.seller = seller;
    req.sellerAccess = access;
    next();
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
