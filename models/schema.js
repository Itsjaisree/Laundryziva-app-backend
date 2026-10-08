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
      created_at TEXT NOT NULL,
      mqtt_password TEXT
    );
  `);
  await run(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mqtt_password TEXT;`);

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
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      FOREIGN KEY (role_id) REFERENCES roles (id)
    );
  `);

  // Machines Table
  await run(`
    CREATE TABLE IF NOT EXISTS machines (
      device_id TEXT PRIMARY KEY,
      friendly_name TEXT NOT NULL,
      location TEXT,
      health_status TEXT DEFAULT 'OFFLINE',
      state TEXT DEFAULT 'IDLE',
      rssi INTEGER,
      uptime INTEGER,
      firmware_version TEXT,
      wash_remaining_seconds INTEGER DEFAULT 0,
      wash_total_seconds INTEGER DEFAULT 0,
      current_txn_id TEXT,
      relay1 INTEGER DEFAULT 0,
      relay2 INTEGER DEFAULT 0,
      gsm_signal INTEGER,
      net TEXT,
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

  // The notification service has always written org_id; the original table never had the column.
  await run(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS org_id TEXT;`);

  // Per-user switches for the notification types an owner may turn off (missing row = on)
  await run(`
    CREATE TABLE IF NOT EXISTS notification_prefs (
      user_id TEXT NOT NULL,
      pref_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, pref_key)
    );
  `);

  // Super admin broadcast messages, kept as a record of what was sent to whom
  await run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience TEXT NOT NULL,
      org_id TEXT,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      sent_by TEXT NOT NULL,
      sent_by_name TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Marks a scheduled job (like the daily summary) as done for a period so a restart never sends it twice
  await run(`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      job_key TEXT PRIMARY KEY,
      ran_at TEXT NOT NULL
    );
  `);
  await run(`ALTER TABLE technician_tasks ADD COLUMN IF NOT EXISTS reminder_sent INTEGER DEFAULT 0;`);
  // When the work was finished. Tasks completed before this column existed use their last update, which is when they
  // were completed because completed tasks are not edited afterwards.
  await run(`ALTER TABLE technician_tasks ADD COLUMN IF NOT EXISTS completed_at TEXT;`);
  await run(`UPDATE technician_tasks SET completed_at = updated_at WHERE status = 'Completed' AND completed_at IS NULL;`);
  await run(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS offline_alerted INTEGER DEFAULT 0;`);

  // Expo push tokens, one row per device
  await run(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);`);

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
      technician_id TEXT,
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
      before_photos TEXT,
      after_photos TEXT,
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

  await run(`CREATE INDEX IF NOT EXISTS idx_task_messages_task_created ON task_messages (task_id, created_at);`);

  // Per-user "last read" marker for each task chat, used for unread counts.
  await run(`
    CREATE TABLE IF NOT EXISTS task_chat_reads (
      user_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      last_read_at TEXT NOT NULL,
      PRIMARY KEY (user_id, task_id),
      FOREIGN KEY (task_id) REFERENCES technician_tasks (id) ON DELETE CASCADE
    );
  `);

  // Photos uploaded by technicians as arrival/completion evidence. Files live on disk under
  // UPLOADS_DIR (never served statically); this row is what authorizes and describes them.
  await run(`
    CREATE TABLE IF NOT EXISTS task_photos (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      captured_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES technician_tasks (id) ON DELETE CASCADE
    );
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_task_photos_task ON task_photos (task_id, kind, created_at);`);

  // Revoked Tokens Table (JWT logout / invalidation)
  await run(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL
    );
  `);

  console.log('Database Schemas Initialized.');
};

module.exports = { initSchema };
