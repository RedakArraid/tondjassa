# 📊 Analyse Complète du Projet MandeMarket

**Date d'analyse** : 2026-09-26
**Version du projet** : 2.1.0  
**Type** : Marketplace e-commerce full-stack

---

## 🎯 Vue d'Ensemble

**MandeMarket** est une plateforme e-commerce / marketplace (catalogue multi-vendeurs, commissions, versements). Le dépôt est structuré en monorepo (**frontend** Next.js, **backend** Express + Prisma) et prévoit un déploiement Docker (local + production avec Traefik).

### Caractéristiques principales

- ✅ Monorepo **frontend / backend** avec Docker local (`docker-compose.yml`)
- ✅ Marketplace (**Seller**, commissions, **SellerPayout**)
- ✅ Frontend Next.js 14 avec TypeScript ; backend Express avec Prisma
- ✅ PostgreSQL + Redis ; images **Cloudinary**
- ✅ Espace client (`/api/account`), paiements (**Paystack** en Côte d'Ivoire, XOF / **Stripe** en Europe selon `.env`)
- ✅ Administration, espace vendeur, avis produits (`Review`)

---

## 🏗️ Architecture Technique

### Stack Technologique

#### Frontend
- **Framework** : Next.js 16.3.6 (React 19.2)
- **Language** : TypeScript 5.9
- **Styling** : Tailwind CSS 3.4
- **Gestion d'état** : React Context API
- **Requêtes** : @tanstack/react-query
- **Visualisation** : Chart.js, Recharts
- **Icons** : @heroicons/react

#### Backend
- **Framework** : Express.js 4.21
- **Language** : JavaScript (Node.js 24)
- **ORM** : Prisma 6.19
- **Base de données** : PostgreSQL
- **Validation** : Zod 3.22
- **Authentification** : JWT (jsonwebtoken)
- **Sécurité** : Helmet, CORS, express-rate-limit
- **Upload** : Multer + Cloudinary
- **Compression** : compression

#### Infrastructure
- **Containerisation** : Docker + Docker Compose
- **Services (docker compose du dépôt)** :
  - Frontend — port hôte **3000**
  - Backend — port hôte **4002**
  - PostgreSQL — port hôte **5433** (5432 dans le réseau Docker)
  - Redis — port hôte **6380** (6379 dans le réseau Docker)
  - Adminer — port hôte **8080**
- **Stockage images** : Cloudinary CDN

---

## 📁 Structure du Projet

```
mandemarket/
├── frontend/                 # Next.js 14 (App Router)
│   ├── app/
│   │   ├── page.tsx          # Accueil
│   │   ├── boutique/         # Catalogue & fiche produit
│   │   ├── panier/, checkout/
│   │   ├── compte/           # Espace client (login, commandes…)
│   │   ├── vendeur/          # Espace vendeur + profil public [slug]
│   │   ├── devenir-vendeur/
│   │   ├── admin/            # Admin (dashboard, login)
│   │   ├── components/, contexts/, config/
│   │   └── …                 # blog, contact, CGV, mentions légales, etc.
│   ├── public/
│   ├── types/
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  # API Express
│   ├── src/
│   │   ├── app.js            # Point d’entrée, montage des routes /api/*
│   │   ├── routes.*.js       # product, category, auth, orders, customers,
│   │   │                     # promotions, dashboard, reviews, sellers,
│   │   │                     # account, payment, shipping
│   │   ├── middleware.auth.js
│   │   └── services/         # cloudinary.service.js, …
│   ├── prisma/
│   ├── scripts/              # migrate.js, seed.js, …
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml        # Dev local (ports hôtes : 3000, 4002, 5433, 6380, 8080)
├── docker-compose.prod.yml   # Prod (Traefik) — voir skill infra
├── backend/.env.docker.example
├── frontend/.env.docker.example
├── package.json              # Scripts racine (dev, docker, db, lint)
├── README.md
├── MARKETPLACE.md
├── ANALYSE_PROJET.md
├── CREDENTIALS.md
├── CLOUDINARY_GUIDE.md
└── BOUTIQUE_MODERNE.md
```

---

## 🗄️ Modèle de Données (Prisma)

### Entités Principales

#### 1. **Category** (Catégories)
- Support hiérarchique (parent/enfants)
- Slug unique pour URLs SEO
- Statut actif/inactif
- Ordre d'affichage
- Relations : produits

#### 2. **Product** (Produits)
- Attributs détaillés (matériau, dimensions, couleurs, etc.)
- Gestion du stock
- Statut actif/inactif
- SKU unique
- Relations : catégorie, commandes, inventaire

#### 3. **Customer** (Clients)
- Informations personnelles
- Adresse de livraison
- Points de fidélité
- Total dépensé
- Relations : commandes, adresse

#### 4. **Order** (Commandes)
- Statuts multiples (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, etc.)
- Calculs automatiques (taxes, frais de port, réductions)
- Codes promotionnels
- Relations : client, items, paiement, livraison

#### 5. **OrderItem** (Éléments de commande)
- Quantité, prix unitaire, prix total
- Relations : commande, produit

#### 6. **Payment** (Paiements)
- Méthodes multiples (CARD, PAYPAL, BANK_TRANSFER, CASH_ON_DELIVERY)
- Statuts (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED)
- Transaction ID
- Métadonnées JSON

#### 7. **Shipping** (Livraisons)
- Méthodes (STANDARD, EXPRESS, PICKUP)
- Numéro de suivi
- Dates estimées/réelles
- Relations : commande

#### 8. **Promotion** (Promotions)
- Types : PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING
- Limites (montant minimum, utilisations max)
- Dates de validité
- Compteur d'utilisations

#### 9. **Inventory** (Inventaire)
- Quantité disponible
- Quantité réservée
- Seuil d'alerte stock faible
- Relations : produit

#### 10. **User** (comptes back-office)
- Authentification email/password (bcrypt)
- Rôles : `user`, `admin`, `seller` (selon `schema.prisma`)
- Relation optionnelle **Seller** pour les comptes vendeurs
- Relations : commandes, notifications

#### 11. **Notification** (Notifications)
- Types multiples (ORDER_STATUS, STOCK_ALERT, PAYMENT, etc.)
- Statut lu/non lu
- Métadonnées JSON

#### 12. **Seller** / **SellerPayout** / **ReturnRequest** / **Review**
- Voir [MARKETPLACE.md](./MARKETPLACE.md) pour le périmètre vendeurs
- **ReturnRequest** : demandes de retour liées client + commande
- **Review** : avis produits (modération par statut)

---

## 🔌 API Endpoints

Toutes les routes ci-dessous sont montées sous le préfixe indiqué (ex. `/api/products`). Les protections (`requireAuth`, rôles `admin` / `manager` / vendeur) sont celles définies dans les fichiers `routes.*.js`.

### Produits (`/api/products`)
- `GET /` — Liste (filtres query possibles, ex. vendeur)
- `GET /:id` — Détail
- `POST /` — Création (auth + droits rédaction produits)
- `PUT /:id` — Mise à jour
- `DELETE /:id` — Suppression
- `POST /upload` — Upload média (Cloudinary)

### Catégories (`/api/categories`)
- `GET /` — Liste
- `GET /:id` — Détail
- `POST /`, `PUT /:id`, `DELETE /:id` — CRUD (rôles admin/manager selon opération)

### Authentification back-office (`/api/auth`)
- `GET /verify` — Vérification token
- `POST /signup`, `POST /signup-seller` — Inscriptions
- `POST /login`, `POST /logout`
- `GET /profile` — Profil utilisateur (JWT User)

### Espace client (`/api/account`)
- `POST /register`, `POST /login`
- `GET /me`, `GET /orders`, `GET /orders/:id`
- `POST /orders/:id/return-request`
- `GET /orders/:id/invoice`
- `POST /wishlist/products` — Wishlist

### Commandes (`/api/orders`)
- `POST /checkout` — Checkout public / création de commande
- `GET /`, `GET /:id`, `POST /`, `PUT /:id` — Gestion (admin/manager)
- `GET /stats/overview` — Statistiques commandes (admin/manager)

### Clients (`/api/customers`)
- CRUD + `GET /:id/analytics`, `GET /analytics/segmentation` (admin/manager)

### Promotions (`/api/promotions`)
- CRUD, `POST /validate`, `GET /analytics/overview`, `GET /analytics/expiring` (auth selon route)

### Tableau de bord (`/api/dashboard`)
- `GET /overview`, `GET /alerts`, `GET /stats/detailed` (admin/manager)

**Écart front / back (corrigé 2026-09-06) :** `AnalyticsService` pointe vers `/api/dashboard/*` (plus `/api/analytics/...`).

### Avis (`/api/reviews`)
- `GET /:productId`, `POST /`, `PUT /:id/helpful`, `GET /:productId/stats`

### Vendeurs (`/api/sellers`)
- Public : liste, `GET /slug/:slug`, `GET /:id`
- Vendeur : `POST /register`, `/me/*` (profil, produits, commandes, gains, payouts)
- Admin : `/admin/all`, `/admin/payouts`, mises à jour statut / versements

### Paiement (`/api/payment`)
- `POST /initiate`, webhooks Paystack / Stripe, `GET /status/:orderId`, etc.

### Livraison (`/api/shipping`)
- `GET /options`, `POST /rates`, `GET /track/:trackingNumber`, `POST /create/:orderId` (admin pour création)

### Santé & utilitaires
- `GET /health`, `GET /api/db-test` — Contrôle API et base

---

## 🎨 Frontend - Pages et Composants

### Pages Principales

#### 1. **Page d'Accueil** (`/`)
- Hero section avec gradient
- Section produits vedettes
- Section avantages
- Navigation vers boutique

#### 2. **Boutique** (`/boutique`)
**Fonctionnalités avancées** :
- ✅ Recherche en temps réel
- ✅ Filtres multiples :
  - Par catégorie (avec icônes)
  - Par prix (slider interactif)
  - Par couleur (multi-sélection)
  - Par matériau (multi-sélection)
- ✅ Tri intelligent (5 options)
- ✅ Vues multiples (grille/liste)
- ✅ Badges produits (nouveau, stock)
- ✅ Animations et transitions
- ✅ Responsive complet

#### 3. **Espaces admin & marketplace**
- **Admin** : `/admin`, `/admin/login`, `/admin/dashboard`
- **Vendeur** : `/vendeur`, `/devenir-vendeur`, `/vendeur/dashboard`, `/vendeur/[slug]`
- **Client** : `/compte/*` (login, commandes, etc.)

### Composants Clés

#### StoreContext
- Gestion d'état globale
- Synchronisation avec API
- Fallback données locales
- Actions CRUD produits/catégories
- Calculs automatiques (stats, totaux)

#### Composants Réutilisables
- `PublicHeader` : Navigation principale
- `PublicFooter` : Footer avec liens
- Composants de formulaires
- Modales de confirmation
- Badges et indicateurs

---

## 🐳 Infrastructure Docker

### Services Docker

1. **Frontend** (`mandemarket-frontend`)
   - Port **hôte** : **3000** (mapping `3000:3000`)
   - Healthcheck : requête HTTP sur la racine du site

2. **Backend** (`mandemarket-backend`)
   - Port **hôte** : **4002**
   - Dépend de PostgreSQL et Redis
   - Healthcheck : `GET /health`

3. **PostgreSQL** (`mandemarket-postgres`)
   - Image `postgres:16-alpine`
   - Port **hôte** : **5433** → `5432` dans le conteneur
   - Volume : `postgres_data`, base `mandemarket`

4. **Redis** (`mandemarket-redis`)
   - Port **hôte** : **6380** → `6379` dans le conteneur
   - Authentification par mot de passe (voir `docker-compose.yml`)

5. **Adminer** (`mandemarket-adminer`)
   - Port **hôte** : **8080**

### Scripts Docker Disponibles

```bash
# Développement
npm run dev              # Lancer frontend + backend
npm run docker:up        # Démarrer tous les services
npm run docker:down      # Arrêter tous les services
npm run docker:logs      # Voir les logs

# Build et déploiement
npm run docker:build     # Construire les images
npm run docker:reset     # Réinitialiser complètement
npm run setup:docker     # Setup complet automatique

# Base de données
npm run db:migrate       # Exécuter les migrations
npm run db:studio        # Ouvrir Prisma Studio
npm run db:backup        # Sauvegarder la BDD
```

---

## 🔐 Sécurité

### Implémentations

1. **Authentification**
   - JWT avec expiration
   - Hashage bcrypt pour mots de passe
   - Middleware de protection des routes

2. **Validation**
   - Zod pour validation des données
   - Validation côté serveur strict
   - Sanitization des inputs

3. **Sécurité HTTP**
   - Helmet.js (headers sécurisés)
   - CORS configuré
   - Rate limiting (express-rate-limit)
   - Compression gzip

4. **Sécurité Docker**
   - Utilisateurs non-root
   - Permissions minimales
   - Healthchecks

---

## 📊 Fonctionnalités Métier

### E-commerce

✅ **Catalogue Produits**
- Affichage avec filtres avancés
- Détails produits complets
- Gestion des images (Cloudinary)
- Stock en temps réel

✅ **Panier d'Achat**
- Ajout/suppression produits
- Calcul automatique des totaux
- Gestion des quantités
- Persistance locale

✅ **Commandes**
- Création de commandes
- Suivi des statuts
- Gestion des paiements
- Gestion des livraisons

✅ **Promotions**
- Codes promo
- Réductions % ou montant fixe
- Frais de port offerts
- Limites d'utilisation

✅ **Clients**
- Profils clients
- Historique d'achats
- Points de fidélité
- Segmentation

### Administration

✅ **Dashboard**
- Statistiques en temps réel
- Graphiques de ventes
- Top produits/clients
- Alertes automatiques

✅ **Gestion Produits**
- CRUD complet
- Upload images Cloudinary
- Gestion du stock
- Activation/désactivation

✅ **Gestion Catégories**
- Hiérarchie (parent/enfants)
- Slug automatique
- Comptage produits
- Réorganisation

✅ **Gestion Commandes**
- Suivi des statuts
- Mise à jour manuelle
- Historique complet
- Export possible

---

## 🎨 Design et UX

### Palette de Couleurs
- **Orange** : Couleur principale (#f97316)
- **Gris foncé** : Textes (#111827)
- **Blanc/Crème** : Backgrounds (#fffbf5)
- **Couleurs d'état** : Vert/Jaune/Rouge

### Principes UX
- Design moderne avec gradients
- Animations fluides (300-500ms)
- Responsive mobile-first
- Accessibilité (contraste AA)
- Feedback visuel immédiat
- Navigation intuitive

### Composants UI
- Badges colorés (statut, stock)
- Cards avec hover effects
- Modales de confirmation
- Formulaires validés
- Loading states
- Error handling

---

## 🚀 Déploiement

### Environnements

#### Développement local

- Ports applicatifs : **3000** (frontend), **4002** (backend)
- Avec le `docker-compose.yml` du dépôt : PostgreSQL sur **5433**, Redis sur **6380**, Adminer sur **8080**
- Hot reload activé (hors conteneur ou selon config)
- Prisma Studio : `npm run db:studio` avec `DATABASE_URL` pointant vers la base accessible depuis l’hôte

#### Production
- URLs : 
  - Frontend : `https://mandemarket.soubadigital.com`
  - Backend : `https://apimandemarket.soubadigital.com`
- Docker Compose
- Variables d'environnement sécurisées
- CDN Cloudinary

### Variables d'Environnement

**Backend** :
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=4002
NODE_ENV=production
```

**Frontend** :
```env
NEXT_PUBLIC_API_URL=https://apimandemarket.soubadigital.com
NEXT_PUBLIC_SITE_URL=https://mandemarket.soubadigital.com
```

---

## 📈 Points Forts du Projet

### Architecture
✅ Architecture modulaire et scalable  
✅ Séparation claire frontend/backend  
✅ API RESTful bien structurée  
✅ Docker pour la portabilité  
✅ Multi-stage builds optimisés  

### Code Quality
✅ TypeScript pour le frontend  
✅ Validation Zod côté backend  
✅ Gestion d'erreurs robuste  
✅ Logs structurés  
✅ Healthchecks Docker  

### Fonctionnalités
✅ E-commerce complet (panier, commandes, paiements)  
✅ Admin dashboard avec statistiques  
✅ Filtres avancés et recherche  
✅ Gestion des promotions  
✅ Système de notifications  

### UX/UI
✅ Design moderne et professionnel  
✅ Animations fluides  
✅ Responsive complet  
✅ Accessibilité  
✅ Performance optimisée  

---

## 🔧 Points d'Amélioration Potentiels

### Court Terme
1. **Tests**
   - Ajouter tests unitaires (Jest)
   - Tests d'intégration API
   - Tests E2E (Playwright/Cypress)

2. **Documentation API**
   - Swagger/OpenAPI
   - Postman collection
   - Exemples de requêtes

3. **Monitoring**
   - Logs centralisés (ELK, Loki)
   - Monitoring APM (New Relic, Datadog)
   - Alertes automatiques

### Moyen Terme
1. **Performance**
   - Cache Redis pour requêtes fréquentes
   - Pagination côté serveur
   - Lazy loading images
   - CDN pour assets statiques

2. **Sécurité**
   - HTTPS strict
   - CSP headers
   - Audit de sécurité
   - Rate limiting plus granulaire

3. **Fonctionnalités**
   - Recherche full-text (Elasticsearch)
   - Recommandations produits
   - Reviews et ratings
   - Wishlist

### Long Terme
1. **Scalabilité**
   - Load balancing
   - Microservices plus granulaires
   - Queue system (RabbitMQ, Bull)
   - Cache distribué

2. **Internationalisation**
   - Multi-langues (i18n)
   - Multi-devises
   - Régionalisation

3. **Analytics**
   - Google Analytics
   - Analytics e-commerce
   - A/B testing
   - User behavior tracking

---

## 📚 Documentation disponible

| Fichier | Contenu |
|---------|---------|
| [README.md](./README.md) | Démarrage, structure, liens |
| [MARKETPLACE.md](./MARKETPLACE.md) | Vendeurs, commissions, API `/api/sellers` |
| [ANALYSE_PROJET.md](./ANALYSE_PROJET.md) | Vue technique (ce document) |
| [CREDENTIALS.md](./CREDENTIALS.md) | Comptes de test (seed) |
| [CLOUDINARY_GUIDE.md](./CLOUDINARY_GUIDE.md) | Variables et usage Cloudinary |
| [BOUTIQUE_MODERNE.md](./BOUTIQUE_MODERNE.md) | UX boutique `/boutique` |
| [README-WINDOWS.md](./README-WINDOWS.md) | Installation Windows |
| [AGENTS.md](./AGENTS.md) | Agents Cursor |

---

## 🎯 Conclusion

**MandeMarket** est un projet e-commerce **professionnel et complet** avec :

- ✅ Architecture moderne et scalable
- ✅ Stack technologique à jour
- ✅ Fonctionnalités e-commerce complètes
- ✅ Interface d'administration robuste
- ✅ Design moderne et UX soignée
- ⚠️ Infrastructure Docker durcie, soumise aux gates de recette et d'exploitation
- ✅ Sécurité implémentée
- ✅ Documentation détaillée

Le projet reste un **candidat de release**. La mise en production est bloquée tant que les gates CI, la recette sandbox Paystack/Stripe, la validation SMTP/Traefik, les alertes et un exercice de restauration externe ne sont pas prouvés sur le SHA livré.

**Recommandation** : utiliser `docs/RELEASE_GATES.md` et `docs/DEPLOYMENT_RUNBOOK.md` comme autorité avant toute ouverture client.

---

**Date de la présente révision** : 2026-05-01 (sync dépôt + écart `/api/analytics`)  
**Version projet** : 2.1.0 (racine `package.json`)
