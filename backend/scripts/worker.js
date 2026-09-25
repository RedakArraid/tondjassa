require('../src/config/env');
const fs = require('node:fs');
const db = require('../src/db');
const { runJobs } = require('../src/services/jobs.service');
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
    for (let i = 0; i < 60 && !stopping; i++) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await db.$disconnect();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
