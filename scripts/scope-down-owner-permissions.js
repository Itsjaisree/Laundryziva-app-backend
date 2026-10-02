// One-time migration: removes permission rows that organization_owner used to have
// (role management, firmware, service logs) and downgrades view_organizations /
// view_users from 'write' to 'view', matching the updated OWNER_PERMISSIONS map in
// services/seedService.js. The seed loop only INSERTs missing rows, it never deletes
// or updates stale ones, so this has to run once against existing databases.
//
// Usage: node scripts/scope-down-owner-permissions.js
require('dotenv').config();
const { run } = require('../config/db');

const REMOVED_KEYS = ['role_management', 'edit_role_permissions', 'firmware_management', 'view_service_logs'];
const DOWNGRADED_TO_VIEW = ['view_organizations', 'view_users'];

const main = async () => {
  for (const key of REMOVED_KEYS) {
    await run(`DELETE FROM permissions WHERE role_id = 'ROLE_ORGANIZATION_OWNER' AND unit_key = ?`, [key]);
    console.log(`Removed permission '${key}' from organization_owner`);
  }

  for (const key of DOWNGRADED_TO_VIEW) {
    await run(`UPDATE permissions SET mode = 'view' WHERE role_id = 'ROLE_ORGANIZATION_OWNER' AND unit_key = ?`, [key]);
    console.log(`Downgraded '${key}' to view-only for organization_owner`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('scope-down-owner-permissions failed:', err);
    process.exit(1);
  });
