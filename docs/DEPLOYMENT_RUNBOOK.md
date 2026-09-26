# Tondjassa - deployment and recovery runbook

This branch is a release candidate, not an authorization to open real payments.
Use one exact, reviewed commit after all three CI jobs are green. No workflow
in this repository deploys to production. Never deploy an unreviewed branch tip.

## Compatibility and required setup

- Node.js 24 is used in CI and both images. Run `npm ci` from each lockfile.
- The additive migration introduces email verification, scoped guest order access,
  item fulfillment/stock markers and a durable refund record.
- All old JWTs are intentionally rejected. Existing users, including administrators,
  must request an email verification link, prove ownership and choose a password.
  Test SMTP delivery and the administrator recovery path **before** the change.
- `SMTP_PASS` is the password variable. Configure authenticated SMTP, TLS, the From
  domain, SPF/DKIM/DMARC and a real support address. There is no production fake mail.
- Copy `env.production.example` into an untracked `.env.production` and replace
  every placeholder. Set `MANDEMARKET_CORS_ORIGIN`, `NEXT_PUBLIC_SITE_URL`,
  `BACKEND_URL`, database/Redis credentials, a strong `MANDEMARKET_JWT_SECRET`,
  Cloudinary, Paystack for Côte d'Ivoire (XOF) and Stripe for Europe. Both PSPs must be
  contracted and accepted in sandbox before any live key is installed.
- `TRUST_PROXY` is an explicit comma-separated list of proxy IPs/CIDRs. Discover
  the actual Traefik path; do not use `true`, a wildcard, or a hop count. Do not
  expose the backend port publicly. Test distinct client IPs behind Traefik.
- `CHECKOUT_COUNTRIES` is an explicit list such as `CI,FR`. Enable only countries
  for which shipping, tax, currency, returns and the payment contract are validated.
- The current Paystack adapter is deliberately restricted to `CI`: MandeMarket sends
  XOF and exposes the Côte d'Ivoire channels (card, MTN, Orange and Wave).
- The Compose stack uses existing external volumes named `root_mandemarket_*`
  and an existing `traefik_network`. Verify ownership and names before starting.
  Do not create empty replacements for an existing production database.
- Preserve the former image IDs and a verified backup. Record the commit, image
  digests and schema version for every release. Keep `SEED_DATA=false`.

## Repeatable commands (run from repository root)

Use this exact prefix for every Compose invocation:

```bash
dc() { docker compose --env-file .env.production -p mandemarket-prod -f docker-compose.prod.yml "$@"; }
```

1. Restore a copy of the current database into an isolated preproduction environment.
   Do not run integration tests on that copy if it contains personal data. Integration
   fixtures truncate only a database explicitly named `*_test` with `NODE_ENV=test`.
2. Reconcile historical stock and financial records **before** enabling writes.
   Existing incorrect balances are not rewritten automatically by the migration.
3. Put the live application and worker in maintenance; stop accepting new orders.
   Take a verified pre-change backup with the current database still running:

```bash
BACKUP_DIR=/secure/backups/tondjassa ./backend/scripts/backup-db.sh
dc build --pull mandemarket-backend mandemarket-frontend
# Migration is executed by the backend entrypoint, strictly with migrate deploy.
dc run --rm --no-deps mandemarket-backend node scripts/production-preflight.js
```

### One-time legacy migration baseline

Databases created by the historical migrations (before `0_init`) must be aligned
with the checked-in baseline before Prisma can mark it as applied. Never use
`db push`, never resolve `0_init` before the schema comparison is empty, and first
execute the complete procedure on a fresh restore of the production backup.

With the application and worker stopped, the one-time production sequence is:

```bash
docker exec -i mandemarket-db sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/scripts/controlled_migration.sql
docker exec -i mandemarket-db sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/scripts/reconcile-legacy-baseline.sql

dc run --rm --no-deps --entrypoint /app/node_modules/.bin/prisma \
  mandemarket-backend migrate resolve --applied 0_init
dc run --rm --no-deps --entrypoint /app/node_modules/.bin/prisma \
  mandemarket-backend migrate deploy
dc run --rm --no-deps --entrypoint /app/node_modules/.bin/prisma \
  mandemarket-backend migrate status

docker exec -i mandemarket-db sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/scripts/reconcile-legacy-inventory-reservations.sql
```

Both reconciliation scripts are idempotent. The first one creates the historical
phase-one structures that were consolidated into `0_init`. The second does not
mutate application rows and aborts if any of the six historical foreign keys has
orphan rows or an unexpected definition. It briefly locks the affected child
tables while replacing the legacy `RESTRICT`/`SET NULL` actions with the baseline
`CASCADE` actions and creating the 17 baseline indexes. Its 10-second lock timeout
intentionally fails the deployment instead of waiting indefinitely. Keep
maintenance enabled until `migrate status`, the final Prisma schema diff, the
preflight and the HTTP readiness smoke all pass.

The inventory reconciliation runs only after the hardening migration has added
the stock lifecycle markers. It derives reservations only from active `PENDING`,
`CONFIRMED` and `PROCESSING` orders, aborts if physical stock is insufficient,
never changes physical quantities, orders or payments, and records a non-PII
audit row. A second execution is a no-op apart from verification.

The preflight command is read-only after entrypoint migration and must succeed.
It checks inventory consistency, duplicate sales and unresolved refunds. Investigate
rather than silently discarding errors. Validate previously NOT VALID constraints
only after data reconciliation on a restored copy and an approved live plan.

```bash
dc up -d mandemarket-backend mandemarket-worker mandemarket-frontend
dc ps
dc logs --tail=100 mandemarket-backend mandemarket-worker
curl --fail --silent --show-error https://apimandemarket.soubadigital.com/health/ready
```

Replace the example domain when routing changes. Confirm the worker heartbeat,
not just HTTP liveness. Confirm payment callbacks are reachable with the correct
raw payload/signature handling; public checkout rate limits must not consume them.

## Acceptance before real customers

Retain a dated record of actual outcomes for: verified signup and existing account
recovery, guest order capability link, cross-account refusal, logout/revocation,
cart/checkout retries, limited stock under concurrency, provider successful/failed/
pending payments, duplicate callbacks, cancellation and a late payment after
cancellation, two sellers shipping independently, offline payment attestation,
refund confirmation and seller withdrawal reconciliation.

Stripe/Paystack online refunds are confirmed from provider responses, not from a
button click. Offline refunds require a real external refund and an administrator
attestation with an amount, currency and reference. A timeout remains
UNKNOWN and requires reconciliation; never blindly issue the payment/refund again.
The worker reconciles pending transactions/refunds and expires uninitiated or
failed card orders. Configure alerts for its errors and unresolved records.

Carrier labels are **not simulated**: automatic Boxtal booking is unavailable until
an actual integration is implemented and accepted. Use seller-scoped manual
tracking. The old unsafe direct admin order creation route is closed; use the
server-priced checkout workflow. Returns currently refund a complete order, not
individual lines. These are deliberate scope restrictions, not features claimed
as completed. Confirm these limitations suit the launch scope.

Important administrative endpoints (authenticated admin only):
- `GET /api/admin/refunds`: outstanding and recent refunds.
- `POST /api/admin/refunds/:id/reconcile`: recheck the provider without a blind replay.
- `POST /api/admin/refunds/:id/confirm-manual`: externally executed manual refund
  attestation; supply `confirmed:true`, exact internal `amount`, `currency:"XOF"`
  and the real `reference` (never for Stripe/Paystack).
- `POST /api/admin/orders/:id/confirm-payment`: attest money actually received for
  cash-on-delivery/bank transfer, with exact internal `amount`, `currency:"XOF"`
  and a unique real `reference`. This action does not transfer money.

Internal amounts are hundredths of XOF even for European orders; Stripe conversion
is explicit at its adapter. Never feed an EUR display amount into a ledger endpoint.

## Backup, restore and rollback

The backup script executes pg_dump inside the PostgreSQL container, writes a
custom-format dump with private permissions, validates its table of contents and
writes a SHA-256 checksum. Schedule it with your host scheduler. Implement encrypted
OFF-HOST replication, retention and failure alerts separately; they are not provided
by storing a script in Git. Measure recovery objectives from actual restore drills.

Create an isolated target database first, then explicitly confirm restoration:

```bash
RESTORE_DATABASE=tondjassa_restore_test \
RESTORE_CONFIRM=I_UNDERSTAND_DATA_LOSS \
./backend/scripts/restore-db.sh /secure/backups/tondjassa/mandemarket_TIMESTAMP.dump
```

The script fails on a checksum or SQL error and restores in one transaction.
Never restore over a live database while customers or the worker are writing.
A rollback of application images does not justify discarding payments/orders
received after a backup. Reconcile provider transactions and use a forward repair
where needed. Do not run down -v, db push, seed or demo reset against production.
Pin the old reviewed image explicitly for an application rollback; merely checking
out an old commit and running `up` does not change an already built image.

After restore/rollback: migrate as appropriate, run preflight, compare provider and
ledger records, verify accounts and health, and only then reopen traffic.


## Isolation des conteneurs applicatifs

Les services backend, worker et frontend doivent conserver les protections définies
dans `docker-compose.prod.yml` : utilisateur non-root, root filesystem en lecture
seule, `no-new-privileges`, suppression de toutes les capacités Linux et limite de
processus. Les seuls emplacements temporaires écrits par l'application sont montés
en `tmpfs`; les uploads et logs backend restent sur leurs volumes dédiés.

Avant une mise en ligne, ne retirez pas ces protections pour contourner une erreur.
Identifiez plutôt le chemin qui nécessite réellement une écriture et ajoutez un
montage dédié minimal. La CI vérifie explicitement que les trois conteneurs
applicatifs restent non-root, en lecture seule et sans capacités Linux.


## Test de charge borne en CI

Le job Docker exécute aussi `scripts/load-smoke.mjs` sur les images de production
déjà démarrées. Ce contrôle génère 60 requêtes avec une concurrence de 12 sur la
readiness, le catalogue, les catégories et le frontend. Le job échoue au premier
écart global si une requête retourne un statut non-2xx ou si la latence p95 dépasse
1500 ms sur le runner GitHub.

Le fichier `load-smoke.json` est conservé comme artefact pendant 14 jours. Ce test
sert à détecter une régression grossière (blocage event-loop, saturation immédiate,
5xx/429 sous faible concurrence). Il ne constitue pas une mesure de capacité de
production : les objectifs de dimensionnement doivent être refaits en préproduction
avec la topologie, la base, Redis et les volumes réels, sans trafic client.
