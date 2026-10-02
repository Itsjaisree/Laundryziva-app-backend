// One-time: adds realistic sample maintenance tickets (varied status/priority/location)
// so the Owner's "Maintenance & Repair" screen has real data to test against, instead of
// the single bare test ticket created during API verification.
//
// Usage: node scripts/seed-sample-maintenance-tickets.js
require('dotenv').config();
const { run, get } = require('../config/db');

const REAL_MACHINE_ID = 'WASHER_1020BA01D418';
const REAL_MACHINE_LOCATION = 'AA Hostel';

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const SAMPLE_TICKETS = [
  {
    id: 'TICKET_SAMPLE_001',
    customer_name: 'Internal Maintenance',
    issue_title: 'Water leak from drum seal',
    issue_category: 'REPAIR',
    description: 'Technician found water pooling under the machine after every wash cycle — likely a worn drum door seal. Needs replacement part ordered.',
    machine_id: REAL_MACHINE_ID,
    machine_location: REAL_MACHINE_LOCATION,
    status: 'Open',
    priority: 'High',
    assigned_tech_id: null,
    assigned_tech_name: null,
    created_at: daysAgo(0),
  },
  {
    id: 'TICKET_SAMPLE_002',
    customer_name: 'Internal Maintenance',
    issue_title: 'Routine servicing & relay check',
    issue_category: 'MAINTENANCE',
    description: 'Scheduled quarterly servicing — relay contacts inspection, pressure sensor calibration, and drain hose check.',
    machine_id: REAL_MACHINE_ID,
    machine_location: REAL_MACHINE_LOCATION,
    status: 'In Progress',
    priority: 'Medium',
    assigned_tech_id: 'USR_TECH_DEMO',
    assigned_tech_name: 'Arjun Kumar',
    created_at: daysAgo(1),
  },
  {
    id: 'TICKET_SAMPLE_003',
    customer_name: 'Internal Maintenance',
    issue_title: 'Coin jam in payment slot',
    issue_category: 'REPAIR',
    description: 'Customer reported machine not starting after payment — coin/token mechanism jammed. Cleared manually, monitoring for recurrence.',
    machine_id: REAL_MACHINE_ID,
    machine_location: REAL_MACHINE_LOCATION,
    status: 'Resolved',
    priority: 'Low',
    assigned_tech_id: 'USR_TECH_DEMO',
    assigned_tech_name: 'Arjun Kumar',
    created_at: daysAgo(3),
  },
  {
    id: 'TICKET_SAMPLE_004',
    customer_name: 'Internal Maintenance',
    issue_title: 'Heating element inspection',
    issue_category: 'INSPECTION',
    description: 'Dryer running noticeably cooler than usual — inspecting heating element and thermostat for wear.',
    machine_id: 'DRYER_PG3_103',
    machine_location: 'Block C Hostel',
    status: 'Open',
    priority: 'Medium',
    assigned_tech_id: null,
    assigned_tech_name: null,
    created_at: daysAgo(0),
  },
];

const main = async () => {
  for (const t of SAMPLE_TICKETS) {
    const existing = await get(`SELECT id FROM customer_care_tickets WHERE id = ?`, [t.id]);
    if (existing) {
      console.log(`Skipping ${t.id} (already exists)`);
      continue;
    }
    const customerId = `CUST_${t.customer_name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    await run(
      `INSERT INTO customer_care_tickets (
        id, customer_id, customer_name, customer_phone, customer_email, customer_location,
        issue_title, issue_category, description, machine_id, machine_location,
        status, priority, assigned_tech_id, assigned_tech_name, created_at
      ) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, customerId, t.customer_name,
        t.issue_title, t.issue_category, t.description, t.machine_id, t.machine_location,
        t.status, t.priority, t.assigned_tech_id, t.assigned_tech_name, t.created_at,
      ]
    );
    console.log(`Created ${t.id}: ${t.issue_title} (${t.status})`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('seed-sample-maintenance-tickets failed:', err);
    process.exit(1);
  });
