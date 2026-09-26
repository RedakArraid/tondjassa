const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { z } = require('zod');
const db = require('./db');
const emailService = require('./services/email.service');

// Schéma contact
const contactSchema = z.object({
  name: z.string().min(2, 'Le nom est requis (au moins 2 caractères)'),
  email: z.string().email('Adresse email invalide'),
  phone: z.string().optional().nullable(),
  subject: z.string().min(3, 'Le sujet est requis'),
  message: z.string().min(10, 'Le message doit contenir au moins 10 caractères'),
  honeypot: z.string().optional(), // Anti-spam bot trap
});

// POST /api/contact - Envoi d'un message au support
router.post('/', async (req, res) => {
  try {
    const data = contactSchema.parse(req.body);

    // Protection anti-spam honeypot
    if (data.honeypot && data.honeypot.trim() !== '') {
      console.warn('[Contact] Spam bot détecté via honeypot');
      return res.status(200).json({ success: true, message: 'Message reçu' });
    }

    const sent = await emailService.sendContactMessageNotification({
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
    });
    if (!sent.success) {
      console.error('[Contact] Livraison SMTP impossible:', sent.error || 'erreur inconnue');
      return res.status(503).json({ error: 'Support temporairement indisponible. Réessayez plus tard.' });
    }

    // L'audit opérationnel ne conserve ni message, ni téléphone, ni email en clair.
    try {
      await db.auditLog.create({
        data: {
          action: 'CONTACT_MESSAGE_DELIVERED',
          entity: 'Contact',
          entityId: crypto.createHash('sha256').update(data.email.trim().toLowerCase()).digest('hex'),
          details: { subject: data.subject, hasPhone: Boolean(data.phone), messageId: sent.messageId || null },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
        },
      });
    } catch (auditError) {
      console.warn('[Contact] Email livré mais audit indisponible:', auditError.message);
    }

    res.json({
      success: true,
      message: 'Votre message a bien été envoyé. Notre équipe vous répondra dans les plus brefs délais.',
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: err.errors });
    }
    console.error('[Contact] Erreur traitement:', err);
    res.status(500).json({ error: 'Erreur lors de l’envoi de votre message' });
  }
});

// Newsletter : consentement durable et désinscription idempotente.
const newsletterSchema = z.object({
  email: z.string().email('Adresse email invalide'),
});

async function subscribeNewsletter(req, res) {
  try {
    const { email } = newsletterSchema.parse(req.body);
    const cleanEmail = email.trim().toLowerCase();
    const now = new Date();
    const subscriber = await db.newsletterSubscriber.upsert({
      where: { email: cleanEmail },
      create: { email: cleanEmail, status: 'active', source: 'website', consentedAt: now },
      update: { status: 'active', source: 'website', consentedAt: now, unsubscribedAt: null },
    });
    await db.auditLog.create({
      data: {
        action: 'NEWSLETTER_SUBSCRIBED',
        entity: 'NewsletterSubscriber',
        entityId: subscriber.id,
        details: { status: 'active', source: subscriber.source },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
      },
    });
    res.json({
      success: true,
      message: 'Merci ! Votre inscription à la newsletter MandeMarket a été prise en compte.',
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Adresse email invalide' });
    console.error('[Newsletter] Erreur inscription:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’inscription' });
  }
}

async function unsubscribeNewsletter(req, res) {
  try {
    const { email } = newsletterSchema.parse(req.body);
    const cleanEmail = email.trim().toLowerCase();
    const subscriber = await db.newsletterSubscriber.findUnique({ where: { email: cleanEmail } });
    if (subscriber) {
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: 'unsubscribed', unsubscribedAt: new Date() },
      });
      await db.auditLog.create({
        data: {
          action: 'NEWSLETTER_UNSUBSCRIBED',
          entity: 'NewsletterSubscriber',
          entityId: subscriber.id,
          details: { status: 'unsubscribed' },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
        },
      });
    }
    // Réponse neutre : ne révèle pas si l'adresse était inscrite.
    res.json({
      success: true,
      message: 'Si cette adresse était inscrite, elle a été retirée de notre liste de diffusion.',
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Adresse email invalide' });
    console.error('[Newsletter] Erreur désinscription:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la désinscription' });
  }
}

// L'ancien montage /api/contact/newsletter/* reste accepté, tandis que le frontend
// utilise /api/newsletter/subscribe et /api/newsletter/unsubscribe.
router.post(['/subscribe', '/newsletter/subscribe'], subscribeNewsletter);
router.post(['/unsubscribe', '/newsletter/unsubscribe'], unsubscribeNewsletter);

module.exports = router;
