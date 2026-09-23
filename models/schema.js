const { run } = require('../config/db');

const initSchema = async () => {
  console.log('Initializing Database Schemas...');

  // Organizations Table
  await run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      is_active INTEGER DEFAULT 1,
      logo_url TEXT,
      location_image_url TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Roles Table
  await run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      role_key TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system_role INTEGER DEFAULT 0,
      scope TEXT DEFAULT 'organization',
      org_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Role Permissions Table
  await run(`
    CREATE TABLE IF NOT EXISTS permissions (
      role_id TEXT NOT NULL,
      unit_key TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'view',
      is_granted INTEGER DEFAULT 1,
      PRIMARY KEY (role_id, unit_key),
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
    );
  `);

  // Role Notification Types Table
  await run(`
    CREATE TABLE IF NOT EXISTS notification_types (
      role_id TEXT NOT NULL,
      type_key TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      PRIMARY KEY (role_id, type_key),
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
    );
  `);

  // Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_key TEXT NOT NULL,
      role_name TEXT,
      org_id TEXT,
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (role_id) REFERENCES roles (id)
    );
  `);

  // Machines Table
  await run(`
    CREATE TABLE IF NOT EXISTS machines (
      device_id TEXT PRIMARY KEY,
      friendly_name TEXT NOT NULL,
      location TEXT,
      health_status TEXT DEFAULT 'ONLINE',
      state TEXT DEFAULT 'IDLE',
      rssi INTEGER DEFAULT -65,
      uptime INTEGER DEFAULT 3600,
      firmware_version TEXT DEFAULT 'v2.1.0',
      wash_remaining_seconds INTEGER DEFAULT 0,
      wash_total_seconds INTEGER DEFAULT 0,
      current_txn_id TEXT,
      relay1 INTEGER DEFAULT 0,
      relay2 INTEGER DEFAULT 0,
      gsm_signal INTEGER DEFAULT 28,
      net TEXT DEFAULT '4G',
      org_id TEXT NOT NULL,
      image_url TEXT,
      inspection_image_url TEXT,
      firmware_compliant INTEGER DEFAULT 1,
      last_seen_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Deployments / Firmware History Table
  await run(`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      firmware_version TEXT NOT NULL,
      previous_version TEXT,
      status TEXT DEFAULT 'success',
      deployed_at TEXT NOT NULL,
      completed_at TEXT,
      org_id TEXT NOT NULL
    );
  `);

  // Transactions Table
  await run(`
    CREATE TABLE IF NOT EXISTS transactions (
      txn_id TEXT PRIMARY KEY,
      machine_name TEXT NOT NULL,
      device_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      razorpay_id TEXT,
      receipt_url TEXT,
      created_at TEXT NOT NULL,
      org_id TEXT NOT NULL
    );
  `);

  // Notifications Table
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      category TEXT DEFAULT 'info',
      icon TEXT DEFAULT 'notifications',
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Customer Care Tickets Table
  await run(`
    CREATE TABLE IF NOT EXISTS customer_care_tickets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_email TEXT,
      customer_location TEXT,
      issue_title TEXT NOT NULL,
      issue_category TEXT,
      description TEXT,
      machine_id TEXT,
      machine_location TEXT,
      status TEXT DEFAULT 'Open',
      priority TEXT DEFAULT 'Medium',
      assigned_tech_id TEXT,
      assigned_tech_name TEXT,
      ai_summary TEXT,
      session_txn_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Technician Tasks Table (work orders: installation/maintenance/repair/inspection jobs,
  // distinct from customer_care_tickets which represent customer-reported complaints)
  await run(`
    CREATE TABLE IF NOT EXISTS technician_tasks (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      technician_id TEXT NOT NULL,
      technician_name TEXT,
      type TEXT NOT NULL DEFAULT 'Maintenance',
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      machine_id TEXT,
      machine_name TEXT,
      scheduled_date TEXT,
      scheduled_time TEXT,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Assigned',
      arrival_photo_url TEXT,
      verification_photo_url TEXT,
      change_request_type TEXT,
      change_request_reason TEXT,
      change_request_status TEXT,
      source_ticket_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (technician_id) REFERENCES users (id),
      FOREIGN KEY (machine_id) REFERENCES machines (device_id),
      FOREIGN KEY (source_ticket_id) REFERENCES customer_care_tickets (id)
    );
  `);

  // Task Messages Table (per-task chat thread between technician and dispatch/support)
  await run(`
    CREATE TABLE IF NOT EXISTS task_messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'technician',
      message TEXT,
      voice_url TEXT,
      photo_url TEXT,
      is_system INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES technician_tasks (id) ON DELETE CASCADE
    );
  `);

  console.log('Database Schemas Initialized.');
};

module.exports = { initSchema };
