const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { transaction, lockKey, httpError } = require('./transaction');
const emailService = require('./email.service');
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const passwordRule = z.string().min(12, 'Utilisez au moins 12 caracteres').max(72, 'Maximum 72 caracteres');
const emailRule = z.string().trim().toLowerCase().email();
async function claimCustomer(user, tx) {
  if (user.role !== 'customer') return;
  const existing = await tx.customer.findUnique({ where: { email: user.email } });
  if (existing?.userId && existing.userId !== user.id) throw httpError('Compte deja rattache: contactez le support');
  if (existing?.status === 'deleted') throw httpError('Compte supprime: contactez le support', 403);
  await tx.customer.upsert({ where: { email: user.email }, update: { userId: user.id }, create: {
    userId: user.id, email: user.email, firstName: user.name?.split(' ')[0] || '', lastName: user.name?.split(' ').slice(1).join(' ') || '' } });
}
async function sendVerification(user) {
  if (user.emailVerifiedAt) return;
  const raw = crypto.randomBytes(32).toString('hex');
  await db.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 3600000) } });
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/compte/verifier-email#token=${raw}`;
  const result = await emailService.sendEmail({ to: user.email, subject: 'Verifiez votre adresse - MandeMarket',
    html: `<p>Confirmez votre adresse et choisissez votre mot de passe personnel.</p><p><a href="${url}">Verifier mon adresse</a></p><p>Ce lien expire dans une heure. Ignorez ce message si vous n'etes pas a l'origine de la demande.</p>` });
  if (!result.success) throw httpError('Envoi indisponible. Reessayez depuis la page de verification.', 503);
}
async function registerCustomer(input) {
  const data = z.object({ email: emailRule, password: passwordRule, firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100) }).parse(input);
  const password = await bcrypt.hash(data.password, 12);
  const user = await transaction(async (tx) => {
    await lockKey(tx, `register:${data.email}`);
    const existing = await tx.user.findUnique({ where: { email: data.email } });
    if (existing) return existing;
    // Do not touch Customer or guest orders before proof of email possession.
    return tx.user.create({ data: { email: data.email, password, name: `${data.firstName} ${data.lastName}`, role: 'customer' } });
  });
  if (user.role === 'customer') await sendVerification(user);
  return { verificationRequired: true, message: 'Consultez votre email pour terminer votre inscription. Si un compte existe deja, utilisez la connexion ou la recuperation du mot de passe.' };
}
async function verifyEmail(raw, newPassword) {
  passwordRule.parse(newPassword);
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw httpError('Jeton invalide', 400);
  const password = await bcrypt.hash(newPassword, 12);
  return transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hash(raw) }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.emailVerifiedAt) throw httpError('Lien invalide ou expire', 400);
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${record.userId} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: record.userId } });
    if (current.emailVerifiedAt) throw httpError('Adresse deja verifiee', 400);
    const user = await tx.user.update({ where: { id: current.id }, data: { password, emailVerifiedAt: new Date() } });
    await claimCustomer(user, tx);
    await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { action: 'EMAIL_VERIFIED', entity: 'User', entityId: user.id, userId: user.id } });
    return { success: true, message: 'Adresse verifiee. Connectez-vous avec votre nouveau mot de passe.' };
  });
}
module.exports = { registerCustomer, sendVerification, verifyEmail, claimCustomer, passwordRule, emailRule };
