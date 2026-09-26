# MandeMarket — Credentials de test

> **Documentation** : revue **1ᵉʳ mai 2026**. Les mots de passe correspondent au script de seed (`backend/scripts/seed.js`) et aux variables `SEED_*` dans `backend/.env.docker` si vous utilisez Docker.

> **Note :** Ces identifiants sont générés pour l'environnement de développement/test. Ne jamais les réutiliser en production.

---

## Types d'utilisateurs

MandeMarket distingue **deux systèmes d'authentification parallèles** :

- **Système backoffice** (admin, seller, manager, support) → JWT `{userId, role}` → login via `/api/auth/login`
- **Système client** (customer) → JWT `{type:"customer", customerId, userId, email}` → login via `/api/account/login`

---

## 1. Administrateur

| Champ | Valeur |
|-------|--------|
| Email | `admin@mandemarket.com` |
| Mot de passe | `Admin@2024!` |
| Rôle | `admin` |
| Interface | `/admin` (dashboard admin) |
| API login | `POST /api/auth/login` |

**Capacités :**
- Accès complet à toutes les ressources
- Gérer les vendeurs (approuver/suspendre)
- Gérer les produits, commandes, catégories
- Voir les métriques et statistiques
- Configurer les paramètres de la plateforme

---

## 2. Manager

| Champ | Valeur |
|-------|--------|
| Email | `manager@mandemarket.com` |
| Mot de passe | `Manager@2024!` |
| Rôle | `manager` |
| Interface | `/admin` (accès limité) |
| API login | `POST /api/auth/login` |

**Capacités :**
- Accès au backoffice en lecture/écriture sur les opérations courantes
- Gérer les commandes et le suivi des livraisons
- Modérer les produits et les avis
- Consulter les vendeurs et les demandes de versement sans pouvoir les approuver, rejeter ou modifier
- Pas d'accès aux paramètres système ni aux actions financières sensibles

---

## 3. Support

| Champ | Valeur |
|-------|--------|
| Email | `support@mandemarket.com` |
| Mot de passe | `Support@2024!` |
| Rôle | `support` |
| Interface | `/support/login` |
| API login | `POST /api/auth/login` |

**Capacités :**
- Consulter, rechercher et filtrer tous les tickets de support
- Répondre et modifier le statut ou la priorité d'un ticket
- S'assigner ou assigner un ticket à un autre agent support actif
- Aucun accès aux opérations d'administration, de paiement ou de gestion vendeur

---

## 4. Vendeur

| Champ | Valeur |
|-------|--------|
| Email | `vendeur@mandemarket.com` |
| Mot de passe | `Vendeur@2024!` |
| Rôle | `seller` |
| Boutique | **Boutique Aminata** (`/boutique-aminata`) |
| Statut boutique | `approved` |
| Commission | 10 % |
| Interface | `/vendeur/dashboard` |
| API login | `POST /api/auth/login` |

**Capacités :**
- Gérer ses propres produits (ajouter, modifier, supprimer)
- Voir ses commandes et ses revenus
- Accéder à son tableau de bord vendeur
- Demander des versements de gains

**Produits de démo créés :**
- Sac tissé wax africain — 15 000 FCFA
- Pochette brodée cérémonie — 9 000 FCFA
- Porte-monnaie bogolan — 3 500 FCFA

---

## 5. Client — Côte d'Ivoire

| Champ | Valeur |
|-------|--------|
| Email | `client@mandemarket.com` |
| Mot de passe | `Client@2024!` |
| Nom | Fatoumata Diallo |
| Téléphone | +225 01 02 03 04 05 |
| Adresse | 12 Rue du Commerce, Plateau, Abidjan (CI) |
| Interface | `/compte/login` |
| API login | `POST /api/account/login` |

**Capacités :**
- Parcourir la boutique et ajouter au panier
- Commander avec paiement Mobile Money (Paystack) ou à la livraison
- Suivre ses commandes dans `/compte/commandes`
- Gérer son profil et son adresse

---

## 6. Client — France

| Champ | Valeur |
|-------|--------|
| Email | `client.fr@mandemarket.com` |
| Mot de passe | `ClientFR@2024!` |
| Nom | Sophie Martin |
| Téléphone | +33 6 12 34 56 78 |
| Adresse | 42 Avenue des Champs-Élysées, Paris 75008 (FR) |
| Interface | `/compte/login` |
| API login | `POST /api/account/login` |

**Capacités :**
- Parcourir la boutique et ajouter au panier
- Commander avec paiement par carte / SEPA (Stripe)
- Livraison via Colissimo, Point Relais, Chronopost
- Suivre ses commandes dans `/compte/commandes`

---

## Récapitulatif rapide

| Type | Email | Mot de passe | Interface |
|------|-------|-------------|-----------|
| Admin | admin@mandemarket.com | `Admin@2024!` | `/admin` |
| Manager | manager@mandemarket.com | `Manager@2024!` | `/admin` |
| Support | support@mandemarket.com | `Support@2024!` | `/support/login` |
| Vendeur | vendeur@mandemarket.com | `Vendeur@2024!` | `/vendeur/dashboard` |
| Client CI | client@mandemarket.com | `Client@2024!` | `/compte/login` |
| Client FR | client.fr@mandemarket.com | `ClientFR@2024!` | `/compte/login` |

---

## Relancer le seed

Pour réinitialiser la base et re-jouer le seed :

```bash
# Avec Docker (recommandé)
docker compose down -v && docker compose up -d --build

# Sans Docker (développement local)
cd backend
npm run seed
```

---

## Clés de test (paiement)

| Service | Environnement |
|---------|--------------|
| Paystack | Test (`sk_test_...`) — carte test : 4084 0840 8408 4081, CVV: 408, expiration future |
| Stripe | Test (`sk_test_...`) — carte test : 4242 4242 4242 4242, CVV: any, exp: any future |

> Les clés réelles doivent être renseignées dans un fichier d'environnement local non versionné.
