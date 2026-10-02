// One-time: the machines table used to default rssi/uptime/net/firmware/gsm_signal to made-up
// values and health_status to ONLINE, so a machine that never reported looked healthy. Drops
// those defaults on an existing database (schema.js only affects fresh installs) and clears
// the invented gsm_signal values (the firmware does not report GSM signal at all).
//
// Usage: node scripts/clear-fake-telemetry-defaults.js
require('dotenv').config();
const { run } = require('../config/db');

const main = async () => {
  for (const col of ['rssi', 'uptime', 'net', 'firmware_version', 'gsm_signal']) {
    await run(`ALTER TABLE machines ALTER COLUMN ${col} DROP DEFAULT`);
    console.log(`Dropped default on machines.${col}`);
  }
  await run(`ALTER TABLE machines ALTER COLUMN health_status SET DEFAULT 'OFFLINE'`);
  console.log(`machines.health_status default is now 'OFFLINE'`);
  await run(`UPDATE machines SET gsm_signal = NULL`);
  console.log('Cleared made-up gsm_signal values');
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('clear-fake-telemetry-defaults failed:', err.message);
    process.exit(1);
  });
