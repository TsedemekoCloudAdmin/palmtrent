require('dotenv').config();
const { spawnSync } = require('child_process');
const path = require('path');

async function run() {
  const scripts = ['seedReferenceData.js', 'seedPricingConfig.js'];
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
      stdio: 'inherit',
      env: process.env
    });
    if (result.status !== 0) {
      throw new Error(`${script} failed with exit code ${result.status}`);
    }
  }
  console.log('Seed completed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
