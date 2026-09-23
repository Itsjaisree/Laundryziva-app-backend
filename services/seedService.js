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
    {
      id: 'USR_TECH_DEMO',
      name: 'Arjun Kumar',
      email: 'technician@demo.com',
      phone: '9876543220',
      passHash: technicianPasswordHash,
      role_id: 'ROLE_FIELD_OPERATIONS',
      role_key: 'field_operations',
      role_name: 'Field Operations',
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

  // 8. Seed Sample Technician Tasks
  const dateOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const sampleTasks = [
    {
      id: 'TASK_DEMO_001',
      org_id: 'ORG_1637D16F',
      technician_id: 'USR_TECH_DEMO',
      technician_name: 'Arjun Kumar',
      type: 'Installation',
      title: 'Install new washer unit',
      description: 'Install and commission a new washing machine unit at ABC Hostel.',
      location: 'ABC Hostel, Room 101',
      machine_id: 'TITAN_1020BA01D418',
      machine_name: 'PG1 Washing Machine 1',
      scheduled_date: dateOffset(0),
      scheduled_time: '10:00 AM',
      priority: 'High',
      status: 'Assigned',
    },
    {
      id: 'TASK_DEMO_002',
      org_id: 'ORG_1637D16F',
      technician_id: 'USR_TECH_DEMO',
      technician_name: 'Arjun Kumar',
      type: 'Troubleshooting',
      title: 'Diagnose relay fault',
      description: 'Investigate intermittent relay1 fault reported on heavy duty washer.',
      location: 'XYZ Dorms, Block B',
      machine_id: 'WM_PG2_102',
      machine_name: 'PG2 Heavy Duty Washer',
      scheduled_date: dateOffset(0),
      scheduled_time: '2:00 PM',
      priority: 'Medium',
      status: 'In Progress',
    },
    {
      id: 'TASK_DEMO_003',
      org_id: 'ORG_1637D16F',
      technician_id: 'USR_TECH_DEMO',
      technician_name: 'Arjun Kumar',
      type: 'Maintenance',
      title: 'Routine inspection',
      description: 'PG3 Express Dryer requires routine inspection.',
      location: 'City Center PG, 1st Floor',
      machine_id: 'DR_PG3_103',
      machine_name: 'PG3 Express Dryer',
      scheduled_date: dateOffset(1),
      scheduled_time: '11:30 AM',
      priority: 'Low',
      status: 'Scheduled',
    },
    {
      id: 'TASK_DEMO_004',
      org_id: 'ORG_1637D16F',
      technician_id: 'USR_TECH_DEMO',
      technician_name: 'Arjun Kumar',
      type: 'Repair',
      title: 'Fix water inlet valve',
      description: 'Replace faulty water inlet valve on PG1 Washing Machine.',
      location: 'ABC Hostel, Room 101',
      machine_id: 'TITAN_1020BA01D418',
      machine_name: 'PG1 Washing Machine 1',
      scheduled_date: dateOffset(-1),
      scheduled_time: '9:00 AM',
      priority: 'High',
      status: 'Completed',
      verification_photo_url: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'TASK_DEMO_005',
      org_id: 'ORG_1637D16F',
      technician_id: 'USR_TECH_DEMO',
      technician_name: 'Arjun Kumar',
      type: 'Inspection',
      title: 'Quarterly safety inspection',
      description: 'Perform quarterly safety and compliance inspection on PG2 Heavy Duty Washer.',
      location: 'XYZ Dorms, Block B',
      machine_id: 'WM_PG2_102',
      machine_name: 'PG2 Heavy Duty Washer',
      scheduled_date: dateOffset(2),
      scheduled_time: '3:30 PM',
      priority: 'Medium',
      status: 'Pending Approval',
      change_request_type: 'Reschedule',
      change_request_reason: 'Site access restricted until 4 PM.',
      change_request_status: 'Pending',
    },
  ];

  for (const t of sampleTasks) {
    const existingTask = await get(`SELECT id FROM technician_tasks WHERE id = ?`, [t.id]);
    if (!existingTask) {
      const now = new Date().toISOString();
      await run(`
        INSERT INTO technician_tasks (
          id, org_id, technician_id, technician_name, type, title, description, location,
          machine_id, machine_name, scheduled_date, scheduled_time, priority, status,
          verification_photo_url, change_request_type, change_request_reason, change_request_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        t.id, t.org_id, t.technician_id, t.technician_name, t.type, t.title, t.description, t.location,
        t.machine_id, t.machine_name, t.scheduled_date, t.scheduled_time, t.priority, t.status,
        t.verification_photo_url || null, t.change_request_type || null, t.change_request_reason || null, t.change_request_status || null,
        now, now,
      ]);
    }
  }

  // 9. Seed Sample Task Messages
  const sampleTaskMessages = [
    {
      id: 'MSG_DEMO_001',
      task_id: 'TASK_DEMO_002',
      org_id: 'ORG_1637D16F',
      sender_id: null,
      sender_name: 'LaundryZiva Dispatch',
      sender_role: 'system',
      message: 'Welcome to LaundryZiva Customer Care. Let us know if you need anything for this job.',
      is_system: 1,
    },
    {
      id: 'MSG_DEMO_002',
      task_id: 'TASK_DEMO_002',
      org_id: 'ORG_1637D16F',
      sender_id: 'USR_TECH_DEMO',
      sender_name: 'Arjun Kumar',
      sender_role: 'technician',
      message: 'On site now, starting diagnosis on the relay fault.',
      is_system: 0,
    },
  ];

  for (const m of sampleTaskMessages) {
    const existingMsg = await get(`SELECT id FROM task_messages WHERE id = ?`, [m.id]);
    if (!existingMsg) {
      await run(`
        INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [m.id, m.task_id, m.org_id, m.sender_id, m.sender_name, m.sender_role, m.message, m.is_system, new Date().toISOString()]);
    }
  }

  console.log('Seeding Complete.');
};

module.exports = { seedDatabase };

