// One-time: machine controls are technician-only now, so drop the machine_controls permission
// from the organization owner role on an existing database (the seed only inserts, never deletes).
//
// Usage: node scripts/remove-owner-machine-controls.js
require('dotenv').config();
const { run } = require('../config/db');

run(`DELETE FROM permissions WHERE role_id = 'ROLE_ORGANIZATION_OWNER' AND unit_key = 'machine_controls'`)
  .then(() => {
    console.log("Removed machine_controls from organization_owner");
    process.exit(0);
  })
  .catch((err) => {
    console.error('remove-owner-machine-controls failed:', err.message);
    process.exit(1);
  });
