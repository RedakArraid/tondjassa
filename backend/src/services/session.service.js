const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { JWT_SECRET } = require('../config/env');
const { transaction, httpError } = require('./transaction');
const TOKEN_OPTIONS = { issuer: 'tondjassa', audience: 'access', algorithm: 'HS256' };
function hashToken(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
function generateAccessToken(user, sessionId) {
  if (!sessionId) throw httpError('Session requise', 401);
  return jwt.sign({ userId: user.id, role: user.role, email: user.email, sid: sessionId }, JWT_SECRET, { ...TOKEN_OPTIONS, expiresIn: '15m' });
}
function ensureUserActive(user) {
  if (!user?.emailVerifiedAt || user.customer?.status === 'deleted' || user.seller?.status === 'suspended') {
    throw httpError('Compte non verifie ou suspendu', 401);
  }
}
async function createSession(userId, req, tx = db) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const session = await tx.session.create({ data: { userId, tokenHash: hashToken(refreshToken), expiresAt,
    ipAddress: String(req.ip || req.socket?.remoteAddress || '').slice(0, 45),
    userAgent: String(req.headers?.['user-agent'] || '').slice(0, 255) } });
  return { sessionId: session.id, refreshToken, expiresAt };
}
async function authenticateToken(token) {
  const payload = jwt.verify(token, JWT_SECRET, { issuer: TOKEN_OPTIONS.issuer, audience: TOKEN_OPTIONS.audience, algorithms: ['HS256'] });
  if (!payload.sid || !payload.userId) throw httpError('Ancienne session: reconnectez-vous', 401);
  const session = await db.session.findUnique({ where: { id: payload.sid }, include: { user: { include: { customer: true, seller: true } } } });
  if (!session || session.userId !== payload.userId || session.revokedAt || session.expiresAt <= new Date()) throw httpError('Session revoquee ou expiree', 401);
  ensureUserActive(session.user);
  return { userId: session.userId, sid: session.id, role: session.user.role, email: session.user.email,
    customerId: session.user.customer?.id || null };
}
async function issueSession(user, req, res, portal) {
  ensureUserActive(user);
  const session = await createSession(user.id, req);
  setRefreshCookie(res, portal === 'staff' ? 'seller' : user.role, session.refreshToken);
  const accessToken = generateAccessToken(user, session.sessionId);
  return { accessToken, token: accessToken };
}
function cookieName(role) { return role === 'customer' ? 'mm_refresh_customer' : 'mm_refresh_staff'; }
function setRefreshCookie(res, role, token) {
  res.cookie(cookieName(role), token, { httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/api/auth', maxAge: 7 * 86400000 });
  res.setHeader('Cache-Control', 'no-store');
}
function readRefreshCookie(req) {
  const portal = req.body?.portal === 'customer' ? 'customer' : 'staff';
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('='); return i < 0 ? [] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
  }).filter((c) => c.length === 2));
  return cookies[cookieName(portal)] || null;
}
function checkBrowserOrigin(req) {
  const allowed = new Set([process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    ...(process.env.CORS_ORIGIN || '').split(',')].map((s) => s.trim()).filter(Boolean));
  if (!req.headers.origin || !allowed.has(req.headers.origin)) throw httpError('Origine non autorisee', 403);
}
async function rotateRefreshToken(raw, req) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{80}$/.test(raw)) throw httpError('Session manquante', 401);
  const result = await transaction(async (tx) => {
    const previous = await tx.session.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: { include: { customer: true, seller: true } } } });
    if (!previous || previous.expiresAt <= new Date()) throw httpError('Session expiree', 401);
    ensureUserActive(previous.user);
    if (previous.revokedAt) {
      // Commit replay revocation before returning an error to the caller.
      await tx.session.updateMany({ where: { userId: previous.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return { replay: true };
    }
    const changed = await tx.session.updateMany({ where: { id: previous.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (changed.count !== 1) throw httpError('Session deja renouvelee', 401);
    const next = await createSession(previous.userId, req, tx);
    return { ...next, accessToken: generateAccessToken(previous.user, next.sessionId), user: {
      id: previous.user.id, email: previous.user.email, name: previous.user.name, role: previous.user.role } };
  });
  if (result.replay) throw httpError('Rejeu detecte: reconnectez-vous', 401);
  return result;
}
async function revokeSessionByToken(raw) {
  if (typeof raw !== 'string') return;
  return db.session.updateMany({ where: { tokenHash: hashToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
}
async function revokeSessionById(id, userId) {
  return db.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
async function revokeAllUserSessions(userId) {
  return db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
async function getUserSessions(userId) {
  return db.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } });
}
async function createPasswordResetToken(email) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return null;
  const rawToken = crypto.randomBytes(32).toString('hex');
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 3600000) } });
  return { rawToken, email: user.email, name: user.name };
}
async function resetPasswordWithToken(raw, newPassword) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw httpError('Jeton invalide', 400);
  const password = await bcrypt.hash(newPassword, 12);
  return transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw httpError('Lien invalide ou expire', 400);
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${record.userId} FOR UPDATE`;
    const used = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw httpError('Jeton deja utilise', 400);
    const user = await tx.user.update({ where: { id: record.userId }, data: { password, emailVerifiedAt: new Date() } });
    await require('./verification.service').claimCustomer(user, tx);
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { action: 'PASSWORD_RESET', entity: 'User', entityId: user.id, userId: user.id } });
    return { success: true };
  });
}
module.exports = { hashToken, generateAccessToken, ensureUserActive, authenticateToken, issueSession,
  createSession, rotateRefreshToken, revokeSessionByToken, revokeSessionById, revokeAllUserSessions,
  getUserSessions, createPasswordResetToken, resetPasswordWithToken, setRefreshCookie, readRefreshCookie, checkBrowserOrigin };
