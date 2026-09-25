const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('./db');
const { requireAuth } = require('./middleware.auth');
const sessionService = require('./services/session.service');

// Schémas de validation Zod stricts
const verification = require('./services/verification.service');
const passwordRule = verification.passwordRule;

const signupSchema = z.object({
  email: z.string().email('Format email invalide').toLowerCase().trim(),
  password: passwordRule,
  name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').trim(),
  // Interdiction formelle d'injecter un rôle (MM-BE-022)
});

const signupSellerSchema = z.object({
  email: z.string().email('Format email invalide').toLowerCase().trim(),
  password: passwordRule,
  name: z.string().min(2).trim(),
  storeName: z.string().min(2).max(100).trim(),
  slug: z.string().min(2).max(50).optional(),
  description: z.string().max(500).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Mot de passe requis'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Jeton invalide'),
  newPassword: passwordRule,
});

// Customer registration never attaches an existing guest record before verification.
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body);
    res.status(202).json(await verification.registerCustomer({ email, password, firstName: name.split(' ')[0], lastName: name.split(' ').slice(1).join(' ') || '-' }));
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); }
});

// POST /api/auth/signup-seller
router.post('/signup-seller', async (req, res) => {
  try {
    const data = signupSellerSchema.parse(req.body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }

    const hash = await bcrypt.hash(data.password, 12);
    const slug = data.slug || data.storeName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    const slugExists = await db.seller.findUnique({ where: { slug } });
    if (slugExists) {
      return res.status(409).json({ error: 'Ce nom de boutique est déjà pris.' });
    }

    const { user } = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          password: hash,
          name: data.name,
          role: 'seller',
        },
      });

      const newSeller = await tx.seller.create({
        data: {
          userId: newUser.id,
          storeName: data.storeName,
          slug,
          description: data.description || null,
          status: 'pending',
        },
      });

      return { user: newUser, seller: newSeller };
    });

    await verification.sendVerification(user);
    res.status(202).json({ verificationRequired: true, message: 'Verifiez votre adresse email. La boutique necessite ensuite une approbation administrative.' });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: 'Validation échouée', details: err.errors });
    }
    console.error('Erreur signup-seller:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l’inscription vendeur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await db.user.findUnique({
      where: { email },
      include: {
        seller: {
          select: { id: true, storeName: true, slug: true, status: true },
        },
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    if (!user.emailVerifiedAt) return res.status(403).json({ error: 'Verifiez votre email depuis /compte/verifier-email', verificationRequired: true });
    const { accessToken } = await sessionService.issueSession(user, req, res);

    res.json({
      accessToken,
      token: accessToken, // Rétrocompatibilité frontend
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        seller: user.seller,
        customer: user.customer,
      },
    });
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: 'Données invalides', details: err.errors });
    }
    console.error('Erreur login:', err);
    res.status(400).json({ error: 'Erreur lors de la connexion' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    sessionService.checkBrowserOrigin(req);
    const result = await sessionService.rotateRefreshToken(sessionService.readRefreshCookie(req), req);
    sessionService.setRefreshCookie(res, result.user.role, result.refreshToken);
    res.json({ accessToken: result.accessToken, token: result.accessToken, user: result.user });
  } catch (error) { res.status(error.statusCode || 401).json({ error: 'Session invalide; reconnectez-vous' }); }
});
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await sessionService.revokeSessionById(req.user.sid, req.user.userId);
    res.clearCookie(req.user.role === 'customer' ? 'mm_refresh_customer' : 'mm_refresh_staff', { path: '/api/auth', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ success: true });
  } catch { res.status(503).json({ error: 'Deconnexion indisponible' }); }
});
router.post('/verify-email', async (req, res) => {
  try { res.json(await verification.verifyEmail(req.body.token, req.body.newPassword)); }
  catch (error) { res.status(error.statusCode || 400).json({ error: error.name === 'ZodError' ? 'Mot de passe trop court (12 caracteres minimum)' : error.message }); }
});
router.post('/resend-verification', async (req, res) => {
  try {
    const email = verification.emailRule.parse(req.body.email);
    const user = await db.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) await verification.sendVerification(user);
    res.json({ message: 'Si une verification est necessaire, un message a ete envoye.' });
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.statusCode === 503 ? error.message : 'Email invalide' }); }
});

// POST /api/auth/logout-all
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await sessionService.revokeAllUserSessions(req.user.userId);
    res.json({ message: 'Toutes les sessions ont été déconnectées' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la déconnexion globale' });
  }
});

// GET /api/auth/me & /api/auth/profile
router.get(['/me', '/profile', '/verify'], requireAuth, async (req, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        seller: {
          select: { id: true, storeName: true, slug: true, status: true, rating: true },
        },
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    res.json({ valid: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/sessions
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await sessionService.getUserSessions(req.user.userId);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer les sessions' });
  }
});

// DELETE /api/auth/sessions/:id
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    await sessionService.revokeSessionById(req.params.id, req.user.userId);
    res.json({ message: 'Session révoquée avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de révoquer la session' });
  }
});

// POST /api/auth/forgot-password (Réponse neutre sans énumération d'emails)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const resetInfo = await sessionService.createPasswordResetToken(email);

    if (resetInfo) {
      const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/compte/reinitialiser-mot-de-passe#token=${resetInfo.rawToken}`;
      const sent = await require('./services/email.service').sendPasswordResetEmail(resetInfo.email, url);
      if (!sent.success) return res.status(503).json({ error: 'Envoi temporairement indisponible' });
    }

    // Réponse toujours positive pour la sécurité (anti-énumération)
    res.json({
      message: 'Si cet email est associé à un compte, des instructions de réinitialisation ont été envoyées.',
    });
  } catch (err) {
    res.status(400).json({ error: 'Format email invalide' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await sessionService.resetPasswordWithToken(token, newPassword);
    res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lien invalide ou expiré' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !passwordRule.safeParse(newPassword).success) {
      return res.status(400).json({ error: 'L’ancien mot de passe et un nouveau mot de passe d’au moins 8 caractères sont requis.' });
    }

    const user = await db.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'L’ancien mot de passe est incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await sessionService.revokeAllUserSessions(user.id);
    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) {
    console.error('Erreur change-password:', err);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
  }
});

module.exports = router;
