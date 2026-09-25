const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function check(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, item.name);
    if (item.isDirectory()) check(filename);
    else if (filename.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
check(path.join(__dirname, '../src'));
check(__dirname);
console.log('All backend JavaScript files passed node --check.');
