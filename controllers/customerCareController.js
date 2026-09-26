const { run, get, all } = require('../config/db');

const getTickets = async (req, res) => {
  try {
    const tickets = await all(`SELECT * FROM customer_care_tickets ORDER BY created_at DESC`);
    return res.json({ tickets });
  } catch (err) {
    console.error('getTickets error:', err);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

const reassignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { tech_id, tech_name } = req.body;

    const ticket = await get(`SELECT id FROM customer_care_tickets WHERE id = ?`, [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await run(`UPDATE customer_care_tickets SET assigned_tech_id = ?, assigned_tech_name = ?, status = 'In Progress' WHERE id = ?`, [tech_id, tech_name, id]);
    return res.json({ message: 'Ticket reassigned successfully' });
  } catch (err) {
    console.error('reassignTicket error:', err);
    return res.status(500).json({ error: 'Failed to reassign ticket' });
  }
};

const resolveTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await get(`SELECT id FROM customer_care_tickets WHERE id = ?`, [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await run(`UPDATE customer_care_tickets SET status = 'Resolved' WHERE id = ?`, [id]);
    return res.json({ message: 'Ticket marked as resolved' });
  } catch (err) {
    console.error('resolveTicket error:', err);
    return res.status(500).json({ error: 'Failed to resolve ticket' });
  }
};

const createTicket = async (req, res) => {
  try {
    const { machine_id, machine_name, issue, priority, customer_name, customer_phone, org_id } = req.body;

    if (!issue) {
      return res.status(400).json({ error: 'Issue description is required' });
    }

    const ticketId = `TKT_${Date.now()}`;
    const createdAt = new Date().toISOString();

    await run(
      `INSERT INTO customer_care_tickets (id, machine_id, machine_name, issue, priority, customer_name, customer_phone, org_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)`,
      [ticketId, machine_id || null, machine_name || null, issue, priority || 'Medium',
       customer_name || null, customer_phone || null, org_id || req.user?.org_id || null, createdAt]
    );

    const ticket = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [ticketId]);
    return res.status(201).json({ ticket });
  } catch (err) {
    console.error('createTicket error:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
};

module.exports = {
  getTickets,
  createTicket,
  reassignTicket,
  resolveTicket,
};
