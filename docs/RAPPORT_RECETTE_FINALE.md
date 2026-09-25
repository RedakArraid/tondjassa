# Production readiness - evidence, not a blanket GO

The former 13 September 2026 report was contradicted by its CI run and code audit.
Its GO decision is superseded. This document does not certify production readiness.

The hardening branch implements verified account linking, revocable access tokens
and rotating HttpOnly refresh cookies, scoped guest order access, serializable
order/stock/payment/ledger operations, one settlement per order, correct payout
arithmetic, provider-confirmed refunds, worker reconciliation, maintained dependency
versions, real syntax/type checks and separate PostgreSQL/Docker CI jobs.

Local validation during the 26 September hardening session:
- Backend: 59 unit tests passed in 10 suites.
- Frontend: 8 unit tests passed.
- Frontend generated route types and TypeScript checks: passed.
- Backend node --check: passed.
- Lint: no errors, existing warnings remain and are not a security certification.
- A local webpack build compiled and generated pages, but did not finish its trace
  phase within this environment. The CI build must establish a successful exit.
- PostgreSQL integration tests and Docker builds are defined in CI; consult the
  actual run on the final PR commit, not this prose, for their current outcome.

The new database suite covers overselling, checkout retries, repeated payment
notifications, rollback atomicity, amount/currency mismatch, cancellation, late
payment, concurrent withdrawals, payout arithmetic, refund idempotence, verified
email linking, revoked/legacy tokens and guest order privacy. These use synthetic
fixtures in an explicitly isolated test database, not real payment networks.

Release remains blocked until the final commit has all required CI jobs green,
manual review, real preproduction provider/SMTP/Traefik acceptance, historical-data
reconciliation, tested backups/restoration and operational alerts. No live secrets,
production database, real payment or load target was tested in this coding session.

See DEPLOYMENT_RUNBOOK.md for restricted launch features, manual CinetPay/offline
refund attestations, unsupported automatic labels, explicit country scope and
migration/rollback precautions. No merge or production deployment is automatic.
