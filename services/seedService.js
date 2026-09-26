const bcrypt = require('bcryptjs');
const { run, get, all } = require('../config/db');

const SEED_ROLES = [
  {
    id: 'ROLE_SUPER_ADMIN',
    name: 'Super Admin',
    display_name: 'Super Admin',
    role_key: 'super_admin',
    description: 'Platform Super Administrator',
    is_system_role: 1,
    scope: 'global',
    org_id: 'ORG_1637D16F',
  },
  {
    id: 'ROLE_ORGANIZATION_OWNER',
    name: 'Organization Owner',
    display_name: 'Organization Owner',
    role_key: 'organization_owner',
    description: 'Full administrative owner of organization',
    is_system_role: 1,
    scope: 'organization',
    org_id: 'ORG_1637D16F',
  },
  {
    id: 'ROLE_FIELD_OPERATIONS',
    name: 'Field Operations',
    display_name: 'Field Operations',
    role_key: 'field_operations',
    description: 'Field operations and machine maintenance manager',
    is_system_role: 1,
    scope: 'organization',
    org_id: 'ORG_1637D16F',
  },
  {
    id: 'ROLE_FINANCE_AUDITOR',
    name: 'Finance Auditor',
    display_name: 'Finance Auditor',
    role_key: 'finance_auditor',
    description: 'Financial auditor and ledger reviewer',
    is_system_role: 1,
    scope: 'organization',
    org_id: 'ORG_1637D16F',
  },
  {
    id: 'ROLE_SUPPORT_REFUND_AGENT',
    name: 'Support & Refund Agent',
    display_name: 'Support & Refund Agent',
    role_key: 'support_refund_agent',
    description: 'Customer support and refund processing agent',
    is_system_role: 1,
    scope: 'organization',
    org_id: 'ORG_1637D16F',
  },
];

const OWNER_PERMISSIONS = {
  view_dashboard: 'view',
  view_fleet_and_washing_button: 'view',
  view_analytics_overview: 'write',
  export_analytics_report: 'write',
  view_revenue_and_transactions_button: 'view',
  view_audit_log: 'write',
  view_fleet_status: 'view',
  add_machine_button: 'write',
  view_device_identity_metrics: 'view',
  view_relay_status: 'view',
  machine_controls: 'write',
  view_service_history: 'view',
  view_server_node_metrics: 'view',
  view_notifications: 'view',
  role_management: 'write',
  edit_role_permissions: 'write',
  view_organizations: 'write',
  view_users: 'write',
  firmware_management: 'write',
  view_service_logs: 'view',
};

const FIELD_OPERATIONS_PERMISSIONS = {
  view_dashboard: 'view',
  view_fleet_and_washing_button: 'view',
  view_fleet_status: 'view',
  view_device_identity_metrics: 'view',
  view_relay_status: 'view',
  view_service_history: 'view',
  view_notifications: 'view',
  view_service_logs: 'view',
  machine_controls: 'write',
  view_my_tasks: 'write',
  submit_task_verification: 'write',
};

const FIELD_OPERATIONS_NOTIFICATION_TYPES = ['task_assigned', 'task_updated', 'machine_offline', 'maintenance', 'system'];

const seedDatabase = async () => {
  console.log('Seeding initial data...');

  // 1. Seed Default Organization
  const existingOrg = await get(`SELECT * FROM organizations WHERE id = 'ORG_1637D16F'`);
  if (!existingOrg) {
    await run(`
      INSERT INTO organizations (id, name, city, contact_name, contact_email, contact_phone, is_active, created_at)
      VALUES ('ORG_1637D16F', 'Laundryziva', 'Headquarters', 'Somu Sundaram', 'owner.somu@laundryziva.com', '9876543215', 1, ?);
    `, [new Date().toISOString()]);
  }

  // 2. Seed Roles & Permissions
  for (const role of SEED_ROLES) {
    const existingRole = await get(`SELECT * FROM roles WHERE id = ? OR role_key = ?`, [role.id, role.role_key]);
    if (!existingRole) {
      await run(`
        INSERT INTO roles (id, name, display_name, role_key, description, is_system_role, scope, org_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [role.id, role.name, role.display_name, role.role_key, role.description, role.is_system_role, role.scope, role.org_id, new Date().toISOString()]);
    }
  }

  // Seed Owner Permissions
  for (const [key, mode] of Object.entries(OWNER_PERMISSIONS)) {
    const existingPerm = await get(`SELECT * FROM permissions WHERE role_id = 'ROLE_ORGANIZATION_OWNER' AND unit_key = ?`, [key]);
    if (!existingPerm) {
      await run(`
        INSERT INTO permissions (role_id, unit_key, mode, is_granted)
        VALUES ('ROLE_ORGANIZATION_OWNER', ?, ?, 1);
      `, [key, mode]);
    }
  }

  // Seed Field Operations (Technician) Permissions
  for (const [key, mode] of Object.entries(FIELD_OPERATIONS_PERMISSIONS)) {
    const existingPerm = await get(`SELECT * FROM permissions WHERE role_id = 'ROLE_FIELD_OPERATIONS' AND unit_key = ?`, [key]);
    if (!existingPerm) {
      await run(`
        INSERT INTO permissions (role_id, unit_key, mode, is_granted)
        VALUES ('ROLE_FIELD_OPERATIONS', ?, ?, 1);
      `, [key, mode]);
    }
  }

  // Seed Field Operations (Technician) Notification Type Preferences
  for (const typeKey of FIELD_OPERATIONS_NOTIFICATION_TYPES) {
    const existingType = await get(`SELECT * FROM notification_types WHERE role_id = 'ROLE_FIELD_OPERATIONS' AND type_key = ?`, [typeKey]);
    if (!existingType) {
      await run(`
        INSERT INTO notification_types (role_id, type_key, is_enabled)
        VALUES ('ROLE_FIELD_OPERATIONS', ?, 1);
      `, [typeKey]);
    }
  }

  // 3. Seed Users
  const passwordHash = await bcrypt.hash('Owner@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const technicianPasswordHash = await bcrypt.hash('Technician@123', 10);

  const customerCarePasswordHash = await bcrypt.hash('CustomerCare@123', 10);

  const initialUsers = [
    {
      id: 'USR_28550797',
      name: 'Super Admin',
      email: 'admin@laundryziva.com',
      phone: '9876543210',
      passHash: adminPasswordHash,
      role_id: 'ROLE_SUPER_ADMIN',
      role_key: 'super_admin',
      role_name: 'Super Admin',
      org_id: 'ORG_1637D16F',
    },
    {
      id: 'USR_7E9B9136',
      name: 'Somu Sundaram',
      email: 'owner.somu@laundryziva.com',
      phone: '9876543215',
      passHash: passwordHash,
      role_id: 'ROLE_ORGANIZATION_OWNER',
      role_key: 'organization_owner',
      role_name: 'Organization Owner',
      org_id: 'ORG_1637D16F',
    },
    // NOTE: Demo users (owner@demo.com, technician@demo.com, customercare@demo.com) have been removed.
    // Only real system users are seeded here.
  ];

  for (const u of initialUsers) {
    const existingUser = await get(`SELECT * FROM users WHERE email = ?`, [u.email]);
    if (!existingUser) {
      await run(`
        INSERT INTO users (id, name, email, phone, password_hash, role_id, role_key, role_name, org_id, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
      `, [u.id, u.name, u.email, u.phone, u.passHash, u.role_id, u.role_key, u.role_name, u.org_id, new Date().toISOString()]);
    }
  }


  // 4. Seed Real Machine (TITAN_1020BA01D418 only — registered on Device Server)
  // NOTE: WM_PG2_102 and DR_PG3_103 were demo/sample machines and have been removed.
  // Only the real registered machine is seeded here.
  const realMachines = [
    {
      device_id: 'TITAN_1020BA01D418',
      friendly_name: 'PG1 Washing Machine 1',
      location: 'ABC Hostel, Room 101',
      health_status: 'OFFLINE',
      state: 'IDLE',
      wash_remaining_seconds: 0,
      wash_total_seconds: 0,
      relay1: 0,
      relay2: 0,
      firmware_version: '5.3.2',
      gsm_signal: 0,
      org_id: 'ORG_1637D16F',
    },
  ];

  for (const m of realMachines) {
    const existingMachine = await get(`SELECT * FROM machines WHERE device_id = ?`, [m.device_id]);
    if (!existingMachine) {
      await run(`
        INSERT INTO machines (
          device_id, friendly_name, location, health_status, state,
          wash_remaining_seconds, wash_total_seconds, relay1, relay2,
          firmware_version, gsm_signal, org_id, created_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        m.device_id, m.friendly_name, m.location, m.health_status, m.state,
        m.wash_remaining_seconds, m.wash_total_seconds, m.relay1, m.relay2,
        m.firmware_version, m.gsm_signal, m.org_id, new Date().toISOString(), new Date().toISOString()
      ]);
    }
  }

  // 5. Transactions: NOT seeded — transactions are created by real payment events only.
  // No demo/sample transactions should appear in the application.


  // 6. Seed Real Machine Deployments
  const sampleDeployments = [
    {
      id: 'DEP-1092',
      device_id: 'TITAN_1020BA01D418',
      firmware_version: '5.3.2',
      previous_version: '4.8.2',
      status: 'success',
      org_id: 'ORG_1637D16F',
    },
  ];

  for (const d of sampleDeployments) {
    const existingDep = await get(`SELECT * FROM deployments WHERE id = ?`, [d.id]);
    if (!existingDep) {
      await run(`
        INSERT INTO deployments (id, device_id, firmware_version, previous_version, status, org_id, deployed_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `, [d.id, d.device_id, d.firmware_version, d.previous_version, d.status, d.org_id, new Date().toISOString(), new Date().toISOString()]);
    }
  }

  // 7. Notifications: NOT seeded — notifications are generated by real system events only.
  // No demo/sample notifications should appear in the application.

  // 8. Technician Tasks: NOT seeded — tasks are created by real workflow assignments only.
  // No demo/sample tasks should appear in the application.

  // 9. Task Messages: NOT seeded — task messages are created by real user interactions only.
  // No demo/sample task messages should appear in the application.

  console.log('Seeding Complete.');
};

module.exports = { seedDatabase };

