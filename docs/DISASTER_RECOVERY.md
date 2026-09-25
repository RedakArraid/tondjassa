# Disaster recovery

The authoritative procedure is [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md).
No RPO/RTO is certified by this repository. Measure them in an actual restore drill.
Backups require host scheduling, encrypted off-host copies, retention and alerts.
Never restore a stale dump over newer customer orders or payment events without a
reconciliation plan. Keep both the API and worker in maintenance during recovery.
