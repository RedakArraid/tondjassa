> **Release candidate:** see [production evidence](docs/RAPPORT_RECETTE_FINALE.md) and [runbook](docs/DEPLOYMENT_RUNBOOK.md). All CI and external acceptance gates must pass before live payments.

# MandeMarket

Marketplace e-commerce **full-stack** : catalogue multi-vendeurs, panier, checkout, paiements (selon configuration), espace client, administration et espace vendeur.  
**Frontend** : Next.js 14 (App Router), TypeScript, Tailwind. **Backend** : Express, Prisma, PostgreSQL, Redis. **Images** : Cloudinary.

## Fonctionnalités (aperçu)

| Zone | Contenu principal |
|------|-------------------|
| **Public** | Accueil (`/`), boutique (`/boutique`), fiche produit (`/boutique/[id]`), panier, checkout, pages légales, blog, contact |
| **Client** | Inscription / connexion (`/compte/*`), commandes, demandes de retour |
| **Vendeur** | Présentation (`/vendeur`), inscription (`/devenir-vendeur`), tableau de bord (`/vendeur/dashboard`), profil public (`/vendeur/[slug]`) |
| **Admin** | Tableau de bord (`/admin`, `/admin/dashboard`), login (`/admin/login`) |

Détail marketplace : voir [MARKETPLACE.md](./MARKETPLACE.md).  
Comptes de test (seed) : voir [CREDENTIALS.md](./CREDENTIALS.md).

## Prérequis

- Node.js **≥ 18**, npm **≥ 8**
- Docker **≥ 20** et Docker Compose **v2** (recommandé pour PostgreSQL, Redis, Adminer)

## Installation

```bash
git clone https://github.com/RedakArraid/mandemarket.git
cd mandemarket
npm run install:all
```

### Variables d’environnement

- **Backend** : copier `backend/.env.example` → `backend/.env` (développement hors Docker sur la machine hôte).
- **Frontend** : copier `frontend/.env.example` → `frontend/.env.local`.
- **Docker** : copier `backend/.env.docker.example` → `backend/.env.docker` et `frontend/.env.docker.example` → `frontend/.env.docker`, puis renseigner les secrets (Paystack, Stripe, Cloudinary, etc.). Ces fichiers `.env.docker` réels ne doivent pas être versionnés.

*(Les `.env.example` / `.env.docker.example` du repo servent de modèles documentés.)*

Voir aussi [CLOUDINARY_GUIDE.md](./CLOUDINARY_GUIDE.md) pour les clés médias.

## Lancer avec Docker (recommandé)

Expose notamment : frontend **3000**, API **4002**, PostgreSQL **5433** → 5432 dans le conteneur, Redis **6380** → 6379, boîte email locale Mailpit **8025**, Adminer **8080**. Le backend applique automatiquement les migrations avec `prisma migrate deploy`; le worker traite ensuite l'outbox d'e-mails et les tâches différées.

```bash
docker compose up -d --build
# Contrôle explicite de l'état des migrations (facultatif)
npm run docker:migrate
```

- Site : http://localhost:3000  
- API : http://localhost:4002  
- Santé API : http://localhost:4002/health  
- Emails de développement : http://localhost:8025
- Adminer : http://localhost:8080  

Scripts racine utiles : `npm run docker:logs`, `npm run docker:down`, `npm run db:studio` (Prisma Studio hors conteneur, avec `DATABASE_URL` adapté).

## Lancer en développement local (Node)

1. Démarrer au moins PostgreSQL et Redis (par exemple `docker compose up -d postgres redis`).
2. Renseigner `backend/.env` : `DATABASE_URL` pointant vers l’hôte (ex. port **5433** si vous utilisez le `docker-compose.yml` du repo), `REDIS_URL` vers **6380** avec le mot de passe configuré dans Compose.
3. Migrations Prisma :

```bash
cd backend && npx prisma migrate deploy && cd ..
```

4. Démarrer les deux services :

```bash
npm run dev
```

- Frontend : http://localhost:3000  
- Backend : http://localhost:4002  

## Structure du dépôt

```
mandemarket/
├── frontend/          # Next.js 14 — app/, composants, contextes
├── backend/           # Express — src/routes.*.js, Prisma, scripts/
├── docker-compose.yml # Stack locale (postgres, redis, mailpit, backend, worker, frontend, adminer)
├── docker-compose.prod.yml  # Déploiement (Traefik, etc.) — voir skill infra
├── package.json       # Scripts orchestration (dev, docker, db, lint, test)
├── backend/.env.docker.example
├── frontend/.env.docker.example
├── AGENTS.md          # Organisation des agents Cursor
├── MARKETPLACE.md     # Modèle marketplace & API vendeurs
├── ANALYSE_PROJET.md  # Vue technique détaillée
├── CREDENTIALS.md     # Identifiants de test (seed)
├── BOUTIQUE_MODERNE.md    # UX / filtres boutique
├── README-WINDOWS.md      # Installation sous Windows + Docker
└── CLOUDINARY_GUIDE.md    # Configuration Cloudinary
```

## API (préfixe `/api`)

Aperçu des montages dans `backend/src/app.js` :

- `/products`, `/categories`, `/auth`, `/dashboard`, `/orders`, `/customers`, `/promotions`, `/reviews`, `/sellers`, `/account`, `/payment`, `/shipping`

Le tableau de bord admin s’appuie surtout sur **`/api/dashboard/*`** (voir `routes.dashboard.js`). Le fichier `frontend/app/config/analytics.ts` expose un client qui vise des URLs **`/api/analytics/*`** : elles ne sont **pas** montées dans Express aujourd’hui (préparation / code à brancher ou à aligner sur `/api/dashboard`).

Détail des routes et du schéma Prisma : [ANALYSE_PROJET.md](./ANALYSE_PROJET.md).

## Qualité & build

```bash
npm run lint          # frontend + backend
npm run type-check    # frontend TypeScript
npm run build         # build frontend + backend (selon scripts package)
```

## Déploiement production

Variables et Traefik : voir `.cursor/skills/mandemarket-infra/SKILL.md` et `docker-compose.prod.yml`. Ne pas committer `.env.production`.

---

**MandeMarket** — documentation revue **1ᵉʳ mai 2026**.
