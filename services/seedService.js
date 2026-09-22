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

  // 3. Seed Users
  const passwordHash = await bcrypt.hash('Owner@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

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
    {
      id: 'USR_ORG_OWNER_DEMO',
      name: 'Demo Owner',
      email: 'owner@demo.com',
      phone: '9876543210',
      passHash: passwordHash,
      role_id: 'ROLE_ORGANIZATION_OWNER',
      role_key: 'organization_owner',
      role_name: 'Organization Owner',
      org_id: 'ORG_1637D16F',
    },
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

  // 4. Seed Sample Machines
  const sampleMachines = [
    {
      device_id: 'TITAN_1020BA01D418',
      friendly_name: 'PG1 Washing Machine 1',
      location: 'ABC Hostel, Room 101',
      health_status: 'ONLINE',
      state: 'WASHING',
      wash_remaining_seconds: 1200,
      wash_total_seconds: 3540,
      relay1: 1,
      relay2: 0,
      firmware_version: 'v2.1.0',
      gsm_signal: 31,
      org_id: 'ORG_1637D16F',
    },
    {
      device_id: 'WM_PG2_102',
      friendly_name: 'PG2 Heavy Duty Washer',
      location: 'XYZ Dorms, Block B',
      health_status: 'ONLINE',
      state: 'IDLE',
      wash_remaining_seconds: 0,
      wash_total_seconds: 0,
      relay1: 0,
      relay2: 0,
      firmware_version: 'v2.1.0',
      gsm_signal: 28,
      org_id: 'ORG_1637D16F',
    },
    {
      device_id: 'DR_PG3_103',
      friendly_name: 'PG3 Express Dryer',
      location: 'City Center PG, 1st Floor',
      health_status: 'OFFLINE',
      state: 'MAINTENANCE',
      wash_remaining_seconds: 0,
      wash_total_seconds: 0,
      relay1: 0,
      relay2: 0,
      firmware_version: 'v1.9.4',
      gsm_signal: 12,
      org_id: 'ORG_1637D16F',
    },
  ];

  for (const m of sampleMachines) {
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

  // 5. Seed Sample Transactions
  const sampleTxns = [
    {
      txn_id: 'TXN_9874101',
      machine_name: 'PG1 Washing Machine 1',
      device_id: 'TITAN_1020BA01D418',
      amount: 97,
      status: 'SUCCESS',
      razorpay_id: 'pay_P9874101',
      org_id: 'ORG_1637D16F',
    },
    {
      txn_id: 'TXN_9874102',
      machine_name: 'PG2 Heavy Duty Washer',
      device_id: 'WM_PG2_102',
      amount: 120,
      status: 'SUCCESS',
      razorpay_id: 'pay_P9874102',
      org_id: 'ORG_1637D16F',
    },
    {
      txn_id: 'TXN_9874103',
      machine_name: 'PG3 Express Dryer',
      device_id: 'DR_PG3_103',
      amount: 60,
      status: 'FAILED',
      razorpay_id: 'pay_P9874103',
      org_id: 'ORG_1637D16F',
    },
  ];

  for (const t of sampleTxns) {
    const existingTxn = await get(`SELECT * FROM transactions WHERE txn_id = ?`, [t.txn_id]);
    if (!existingTxn) {
      await run(`
        INSERT INTO transactions (txn_id, machine_name, device_id, amount, status, razorpay_id, org_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `, [t.txn_id, t.machine_name, t.device_id, t.amount, t.status, t.razorpay_id, t.org_id, new Date().toISOString()]);
    }
  }

  // 6. Seed Sample Deployments
  const sampleDeployments = [
    {
      id: 'DEP-1092',
      device_id: 'TITAN_1020BA01D418',
      firmware_version: '5.0.0',
      previous_version: '4.8.2',
      status: 'success',
      org_id: 'ORG_1637D16F',
    },
    {
      id: 'DEP-1091',
      device_id: 'TITAN_1020BA01D419',
      firmware_version: '5.0.0',
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

  // 7. Seed Sample Notifications
  const sampleNotifications = [
    {
      id: 'NOTIF_1001',
      user_id: null,
      title: 'Machine Offline Alert',
      message: 'PG2 Washing Machine went offline at ABC Hostel, Room 101.',
      type: 'offline',
      category: 'warning',
      icon: 'alert-circle',
      is_read: 0,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: 'NOTIF_1002',
      user_id: null,
      title: 'Payment Received',
      message: '₹97 received successfully from PG1 Washing Machine.',
      type: 'payment',
      category: 'info',
      icon: 'cash',
      is_read: 0,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'NOTIF_1003',
      user_id: null,
      title: 'Technician Added',
      message: 'Arjun Kumar has been registered as a Technician.',
      type: 'user',
      category: 'info',
      icon: 'person-add',
      is_read: 1,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'NOTIF_1004',
      user_id: null,
      title: 'Maintenance Required',
      message: 'PG3 Express Dryer requires routine inspection.',
      type: 'maintenance',
      category: 'warning',
      icon: 'build',
      is_read: 1,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'NOTIF_1005',
      user_id: null,
      title: 'System Update',
      message: 'The organization portal was updated successfully.',
      type: 'system',
      category: 'info',
      icon: 'information-circle',
      is_read: 1,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const n of sampleNotifications) {
    const existingNotif = await get(`SELECT * FROM notifications WHERE id = ?`, [n.id]);
    if (!existingNotif) {
      await run(`
        INSERT INTO notifications (id, user_id, title, message, type, category, icon, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [n.id, n.user_id, n.title, n.message, n.type, n.category, n.icon, n.is_read, n.created_at]);
    }
  }

  console.log('Seeding Complete.');
};

module.exports = { seedDatabase };

