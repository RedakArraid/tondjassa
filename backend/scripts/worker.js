require('../src/config/env');
const fs = require('node:fs');
const db = require('../src/db');
const { runJobs } = require('../src/services/jobs.service');
const Emails = require('../src/services/email.service');
let stopping = false;
process.once('SIGTERM', () => { stopping = true; });
process.once('SIGINT', () => { stopping = true; });
(async () => {
  while (!stopping) {
    try {
      const result = await runJobs();
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'WORKER_CYCLE', ...result }));
      fs.writeFileSync('/app/tmp/worker-heartbeat', String(Date.now()));
    } catch (error) { console.error(JSON.stringify({ event: 'WORKER_FAILED', error: error.message })); }
    // Payment/refund reconciliation stays on a one-minute cadence, while
    // transactional email should leave the durable outbox within a few seconds.
    for (let i = 0; i < 12 && !stopping; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (stopping) break;
      try {
        const emailResult = await Emails.processOutboxBatch();
        if (emailResult.claimed) console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'EMAIL_OUTBOX_CYCLE', ...emailResult }));
      } catch (error) {
        console.error(JSON.stringify({ event: 'EMAIL_OUTBOX_FAILED', error: error.message }));
      }
      fs.writeFileSync('/app/tmp/worker-heartbeat', String(Date.now()));
    }
  }
  await db.$disconnect();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
