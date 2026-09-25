const nodemailer = require('nodemailer');

const isConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const createTransporter = () => {
  if (!isConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    requireTLS: process.env.NODE_ENV === 'production',
    connectionTimeout: 10000, socketTimeout: 15000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Strict TLS (rejectUnauthorized: false supprimé selon MM-BE-080)
  });
};

const FROM = process.env.EMAIL_FROM || 'MandeMarket <noreply@mandemarket.com>';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendEmail({ to, subject, html }, maxRetries = 3) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (!isConfigured()) {
        if (process.env.NODE_ENV === 'production') return { success: false, error: 'SMTP non configure' };
        console.log(`[Email] SMTP non configuré - Notification enregistrée: "${subject}" pour ${to}`);
        return { success: true, simulated: true };
      }
      const transporter = createTransporter();
      const info = await transporter.sendMail({ from: FROM, to, subject, html });
      console.log(`[Email] Envoyé avec succès (${attempt}/${maxRetries}): "${subject}" → ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      lastError = err;
      console.error(`[Email] Tentative ${attempt}/${maxRetries} échouée pour ${to}: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  return { success: false, error: lastError?.message };
}

// Template de base MandeMarket sécurisé
const baseTemplate = (content) => `
<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #faf8f5; margin: 0; padding: 20px; color: #1f2937; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #f3f0ea; }
  .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px 24px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { color: rgba(255,255,255,0.9); margin: 6px 0 0; font-size: 14px; }
  .body { padding: 32px 28px; }
  .badge { display: inline-block; padding: 6px 16px; border-radius: 9999px; font-weight: bold; font-size: 13px; }
  .badge-pending { background: #fef3c7; color: #92400e; }
  .badge-confirmed { background: #dbeafe; color: #1e40af; }
  .badge-shipped { background: #fed7aa; color: #c2410c; }
  .badge-delivered { background: #d1fae5; color: #065f46; }
  .badge-cancelled { background: #fee2e2; color: #991b1b; }
  .item-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .total-row { display: flex; justify-content: space-between; padding: 14px 0; font-weight: bold; font-size: 18px; color: #ea580c; border-top: 2px solid #f97316; }
  .btn { display: inline-block; background: #ea580c; color: white !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; }
  .footer { background: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #f3f4f6; }
</style></head><body>
<div class="container">
  <div class="header"><h1>MandeMarket</h1><p>Votre marketplace africaine de référence</p></div>
  <div class="body">${content}</div>
  <div class="footer">
    © ${new Date().getFullYear()} MandeMarket.<br>
    Ce message vous a été envoyé dans le cadre de votre utilisation de la plateforme.<br>
    Support : <a href="mailto:contact@mandemarket.com" style="color: #ea580c; text-decoration: none;">contact@mandemarket.com</a>
  </div>
</div></body></html>`;

const STATUS_LABELS = {
  PENDING: 'En attente', CONFIRMED: 'Confirmée', PROCESSING: 'En préparation',
  SHIPPED: 'Expédiée', DELIVERED: 'Livrée', CANCELLED: 'Annulée', REFUNDED: 'Remboursée'
};

// 1. Email: Confirmation de commande
async function sendOrderConfirmation(customer, order) {
  const safeName = escapeHtml(customer.firstName);
  const safeOrderId = escapeHtml(order.id.substring(0, 8).toUpperCase());
  const itemsHtml = (order.items || []).map((item) => `
    <div class="item-row">
      <span>${escapeHtml(item.product?.name || 'Produit')} × ${item.quantity}</span>
      <span>${Math.round(item.totalPrice / 100).toLocaleString('fr-FR')} FCFA</span>
    </div>
  `).join('');

  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Merci pour votre commande ! 🎉</h2>
    <p>Bonjour <strong>${safeName}</strong>,</p>
    <p>Nous avons bien reçu votre commande. Elle est en cours de traitement par nos marchands certifiés.</p>

    <div style="background: #fef8f3; border: 1px solid #ffedd5; border-radius: 12px; padding: 18px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 6px; color: #6b7280; font-size: 13px;">Référence de commande</p>
      <p style="margin: 0; font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: 2px;">#${safeOrderId}</p>
    </div>

    <h3 style="color: #374151; margin-top: 24px; font-size: 15px;">Récapitulatif de votre panier</h3>
    ${itemsHtml}
    <div class="total-row">
      <span>Total de la commande</span>
      <span>${Math.round(order.totalAmount / 100).toLocaleString('fr-FR')} FCFA</span>
    </div>

    <div style="margin-top: 30px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/commande/${order.id}#token=${require('./order-access.service').createOrderToken(order.id)}" class="btn">
        Suivre ma commande
      </a>
    </div>
  `);

  return sendEmail({ to: customer.email, subject: `Commande #${safeOrderId} confirmée - MandeMarket`, html });
}

// 2. Email: Mise à jour statut commande
async function sendOrderStatusUpdate(customer, order, newStatus) {
  const safeName = escapeHtml(customer.firstName);
  const safeOrderId = escapeHtml(order.id.substring(0, 8).toUpperCase());
  const label = STATUS_LABELS[newStatus] || newStatus;

  const messages = {
    CONFIRMED: 'Votre commande a été confirmée par le vendeur.',
    PROCESSING: 'Vos articles sont en cours d’emballage et de préparation.',
    SHIPPED: 'Votre colis a été expédié et est entre les mains du transporteur !',
    DELIVERED: 'Votre colis a été livré à votre adresse. Profitez bien de vos achats !',
    CANCELLED: 'Votre commande a été annulée. Votre compte a été mis à jour.',
    REFUNDED: 'Le remboursement correspondant à cette commande a été exécuté.',
  };

  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Mise à jour de votre commande</h2>
    <p>Bonjour <strong>${safeName}</strong>,</p>
    <p>Votre commande <strong>#${safeOrderId}</strong> a évolué :</p>

    <div style="text-align: center; margin: 24px 0;">
      <span class="badge badge-${newStatus.toLowerCase()}" style="font-size: 16px; padding: 10px 24px;">${label}</span>
    </div>

    <p style="color: #4b5563; font-size: 15px;">${messages[newStatus] || 'Le statut de votre commande a été actualisé.'}</p>

    ${order.shipping?.trackingCode ? `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
        📦 Numéro de suivi : <strong>${escapeHtml(order.shipping.trackingCode)}</strong>
      </div>
    ` : ''}

    <div style="margin-top: 28px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/commande/${order.id}#token=${require('./order-access.service').createOrderToken(order.id)}" class="btn">
        Consulter ma commande
      </a>
    </div>
  `);

  return sendEmail({ to: customer.email, subject: `Commande #${safeOrderId} : ${label} - MandeMarket`, html });
}

// 3. Email: Reçu de paiement sécurisé
async function sendPaymentReceiptEmail(customer, order, payment) {
  const safeName = escapeHtml(customer.firstName);
  const safeOrderId = escapeHtml(order.id.substring(0, 8).toUpperCase());
  const safeRef = escapeHtml(payment?.transactionRef || payment?.id || 'PAIEMENT');

  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Reçu de paiement MandeMarket</h2>
    <p>Bonjour <strong>${safeName}</strong>,</p>
    <p>Nous vous confirmons la bonne réception de votre règlement pour la commande <strong>#${safeOrderId}</strong>.</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 6px;"><strong>Montant réglé :</strong> ${Math.round(order.totalAmount / 100).toLocaleString('fr-FR')} FCFA</p>
      <p style="margin: 0 0 6px;"><strong>Moyen de paiement :</strong> ${escapeHtml(payment?.method || 'Carte / Mobile Money')}</p>
      <p style="margin: 0;"><strong>Référence de transaction :</strong> ${safeRef}</p>
    </div>
  `);

  return sendEmail({ to: customer.email, subject: `Reçu de paiement pour la commande #${safeOrderId}`, html });
}

// 4. Email: Statut de retour
async function sendReturnStatusEmail(customer, returnRequest, status) {
  const safeName = escapeHtml(customer.firstName);
  const safeId = escapeHtml(returnRequest.id.substring(0, 8).toUpperCase());

  const statusText = {
    approved: 'Votre demande de retour a été approuvée. Veuillez confier votre colis au transporteur.',
    rejected: 'Votre demande de retour n’a pas pu être acceptée.',
    completed: 'Votre retour a été réceptionné et le remboursement a été exécuté.',
  };

  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Mise à jour de votre retour #${safeId}</h2>
    <p>Bonjour <strong>${safeName}</strong>,</p>
    <p>${statusText[status] || 'Votre demande de retour a été mise à jour.'}</p>
  `);

  return sendEmail({ to: customer.email, subject: `Mise à jour de votre retour #${safeId}`, html });
}

// 5. Email: Statut versement vendeur (Payout)
async function sendPayoutStatusEmail(seller, payout, status) {
  const safeStore = escapeHtml(seller.storeName);
  const safeAmount = Math.round(payout.amount / 100).toLocaleString('fr-FR');

  const statusText = {
    completed: `Votre virement de ${safeAmount} FCFA a été exécuté sur votre compte enregistré.`,
    rejected: `Votre demande de versement de ${safeAmount} FCFA a été rejetée. Vos fonds restent disponibles sur votre solde vendeur.`,
  };

  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Notification de versement vendeur</h2>
    <p>Bonjour boutique <strong>${safeStore}</strong>,</p>
    <p>${statusText[status] || 'Votre demande de retrait a été actualisée.'}</p>
  `);

  return sendEmail({ to: seller.user?.email || seller.email, subject: `Versement MandeMarket : ${safeAmount} FCFA`, html });
}

// 6. Email: Bienvenue nouveau client
async function sendWelcomeEmail(customer) {
  const safeName = escapeHtml(customer.firstName);
  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Bienvenue sur MandeMarket ! 🎉</h2>
    <p>Bonjour <strong>${safeName}</strong>,</p>
    <p>Votre compte client a été créé avec succès sur MandeMarket.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/boutique" class="btn">
        Découvrir les boutiques
      </a>
    </div>
  `);
  return sendEmail({ to: customer.email, subject: 'Bienvenue sur MandeMarket !', html });
}

// 7. Email: Approbation vendeur
async function sendSellerApproval(sellerEmail, sellerName, storeName) {
  const safeStore = escapeHtml(storeName);
  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Votre boutique est validée ! 🎊</h2>
    <p>Bonjour <strong>${escapeHtml(sellerName)}</strong>,</p>
    <p>Votre boutique <strong>${safeStore}</strong> a été validée par notre équipe de modération. Vous pouvez désormais publier vos créations et vendre en ligne.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/vendeur/dashboard" class="btn">
        Accéder à mon espace vendeur
      </a>
    </div>
  `);
  return sendEmail({ to: sellerEmail, subject: `Votre boutique ${safeStore} est en ligne ! - MandeMarket`, html });
}

// 8. Email: Réinitialisation de mot de passe
async function sendPasswordResetEmail(email, resetUrl) {
  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Réinitialisation de votre mot de passe</h2>
    <p>Vous avez demandé la réinitialisation de votre mot de passe sur MandeMarket.</p>
    <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe sécurisé (ce lien expire sous 1 heure) :</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${escapeHtml(resetUrl)}" class="btn">
        Réinitialiser mon mot de passe
      </a>
    </div>
    <p style="font-size: 12px; color: #9ca3af;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
  `);
  return sendEmail({ to: email, subject: 'Réinitialisation de votre mot de passe - MandeMarket', html });
}

// 9. Notification nouveau message de contact
async function sendContactMessageNotification(data) {
  const adminEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || 'contact@mandemarket.com';
  const html = baseTemplate(`
    <h2 style="color: #111827; margin-top: 0;">Nouveau message de contact support</h2>
    <p><strong>De :</strong> ${escapeHtml(data.name)} (${escapeHtml(data.email)})</p>
    ${data.phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(data.phone)}</p>` : ''}
    <p><strong>Sujet :</strong> ${escapeHtml(data.subject)}</p>
    <div style="background: #f9fafb; border-left: 4px solid #f97316; padding: 16px; margin: 20px 0;">
      ${escapeHtml(data.message).replace(/\n/g, '<br>')}
    </div>
  `);
  return sendEmail({ to: adminEmail, subject: `[Contact Support] ${escapeHtml(data.subject)} - ${escapeHtml(data.name)}`, html });
}

module.exports = {
  sendEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendPaymentReceiptEmail,
  sendReturnStatusEmail,
  sendPayoutStatusEmail,
  sendWelcomeEmail,
  sendSellerApproval,
  sendPasswordResetEmail,
  sendContactMessageNotification,
};
