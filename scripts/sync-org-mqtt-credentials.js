// Run as root on the app server (has mosquitto installed locally).
// For every organization missing an mqtt_password, generates one and saves it.
// Then re-applies every organization's current password into mosquitto's
// password file (username = org_id) and reloads the broker.
//
// Usage: node scripts/sync-org-mqtt-credentials.js
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { all, run } = require('../config/db');

const PASSWD_FILE = '/etc/mosquitto/passwd';

const main = async () => {
  const orgs = await all(`SELECT id, mqtt_password FROM organizations`);

  for (const org of orgs) {
    if (!org.mqtt_password) {
      const generated = crypto.randomBytes(16).toString('hex');
      await run(`UPDATE organizations SET mqtt_password = ? WHERE id = ?`, [generated, org.id]);
      org.mqtt_password = generated;
      console.log(`Generated new MQTT password for ${org.id}`);
    }

    execFileSync('mosquitto_passwd', ['-b', PASSWD_FILE, org.id, org.mqtt_password]);
    console.log(`Synced MQTT credential for ${org.id}`);
  }

  execFileSync('systemctl', ['reload', 'mosquitto']);
  console.log('Mosquitto reloaded.');
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('sync-org-mqtt-credentials failed:', err);
    process.exit(1);
  });
