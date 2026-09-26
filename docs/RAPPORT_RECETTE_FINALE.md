# Production readiness - evidence, not a blanket GO

The former 13 September 2026 report was contradicted by its CI run and code audit.
Its GO decision is superseded. This document does not certify production readiness.

The hardening branch implements verified account linking, revocable access tokens
and rotating HttpOnly refresh cookies, scoped guest order access, serializable
order/stock/payment/ledger operations, one settlement per order, correct payout
arithmetic, provider-confirmed refunds, worker reconciliation, maintained dependency
versions, real syntax/type checks and separate PostgreSQL/Docker CI jobs.

Local validation during the 26 September hardening session:
- Backend: 79 unit tests passed in 14 suites.
- Frontend: 14 unit tests passed.
- Frontend generated route types and TypeScript checks: passed.
- Backend node --check: passed.
- Lint: no errors, existing warnings remain and are not a security certification.
- The local Next.js production build completed successfully, including all 80 pages.
- All six migrations applied to an isolated PostgreSQL 16 database and a second
  `migrate deploy` was a no-op. The 18-test integration suite passed locally.
- Backend and frontend Node 24 production images built and started read-only; local
  Trivy scans found no fixable HIGH/CRITICAL issue, npm audits found no vulnerability,
  and Gitleaks scanned all 81 commits without an unreviewed finding. Hosted-browser
  acceptance remains governed by CI.

The new database suite covers overselling, checkout retries, repeated payment
notifications, rollback atomicity, amount/currency mismatch, cancellation, late
payment, concurrent withdrawals, payout arithmetic, provider refund idempotence,
seller invitations/RBAC, verified email linking, revoked/legacy tokens and guest
order privacy. These use synthetic
fixtures in an explicitly isolated test database, not real payment networks.

Release remains blocked until the final commit has all required CI jobs green,
manual review, real preproduction provider/SMTP/Traefik acceptance, historical-data
reconciliation, tested backups/restoration and operational alerts. No live secrets,
production database, real payment or load target was tested in this coding session.

See DEPLOYMENT_RUNBOOK.md for restricted launch features, manual offline refund
attestations, unsupported automatic labels, explicit country scope and
migration/rollback precautions. No merge or production deployment is automatic.
