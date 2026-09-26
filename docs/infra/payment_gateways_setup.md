# Guide de Configuration et d'Exploitation des Passerelles de Paiement (MM-INF-040)

Ce document décrit l'architecture, la configuration et la politique d'exploitation sécurisée de Paystack pour la Côte d'Ivoire et de Stripe pour l'Europe.

---

## 1. Matrice des Prestataires & Périmètres

| Prestataire | Région Principale | Devises | Moyens de Paiement | Mode de Vérification |
|---|---|---|---|---|
| **Paystack** | Côte d'Ivoire | XOF multiplié par 100 pour l'API | Mobile Money (MTN, Wave, Orange), Cartes | Webhook HMAC SHA-512 + API `/transaction/verify/:ref` |
| **Stripe** | Europe & International | EUR, XOF | Carte bancaire (CB, Visa, Mastercard), SEPA | Webhook signature Stripe (`constructEvent`) |
| **Cash on Delivery** | Abidjan & villes couvertes | XOF | Espèces à la livraison | Transition `DELIVERED` par le livreur/gestionnaire |

---

## 2. Variables d'Environnement (Sandbox vs Production)

Les clés de test et de production doivent être strictement isolées :

```env
# ==========================================
# PAYSTACK
# ==========================================
# Test / Sandbox
PAYSTACK_SECRET_KEY="sk_test_..."
# Production (Live)
# PAYSTACK_SECRET_KEY="sk_live_..."

# ==========================================
# STRIPE
# ==========================================
# Test / Sandbox
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
# Production (Live)
# STRIPE_SECRET_KEY="sk_live_..."
# STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 3. Configuration des Webhooks Publics

Dans les tableaux de bord respectifs des prestataires, configurez les URLs de rappel vers le domaine de l'API MandeMarket :

### A. Stripe
- **URL** : `https://apimandemarket.soubadigital.com/api/payment/webhook/stripe`
- **Événements écoutés** :
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `refund.updated`
  - `charge.dispute.created`
  - `charge.dispute.funds_withdrawn`

### B. Paystack
- **URL** : `https://apimandemarket.soubadigital.com/api/payment/webhook/paystack`
- **Événements écoutés** :
  - `charge.success`
  - `charge.failed`
  - `refund.processed`
  - `charge.dispute.create`
  - `charge.dispute.remind`
  - `charge.dispute.resolve`

Les remboursements Paystack intégraux confirmés annulent atomiquement la commande,
le paiement et les écritures vendeur. Un remboursement partiel ou un litige est
enregistré avec le statut `REQUIRES_ACTION` pour rapprochement humain ; il n'est
jamais converti silencieusement en remboursement intégral.

---

## 4. Garde-Fous et Idempotence

1. **Dédoublonnage au niveau PostgreSQL (`PaymentEvent`)** :
   Chaque règlement, échec, remboursement ou alerte fournisseur reçoit une clé
   d'idempotence stable et unique. Toute réémission réseau est traitée sans double
   incrémentation des stocks, du chiffre d'affaires ou des soldes vendeurs.
2. **Contrôle d'intégrité du montant et de la devise** :
   Avant tout passage de commande à l'état `CONFIRMED`, le montant effectivement
   débité est comparé au `totalAmount` fixé par le serveur. Une incohérence empêche
   toute confirmation et force le prestataire à réémettre après rapprochement.
3. **Machine d'état stricte** :
   Une commande annulée ou déjà livrée ne peut pas être basculée vers un état incohérent lors d'une notification tardive.
