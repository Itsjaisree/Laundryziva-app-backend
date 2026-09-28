const { run, get, all } = require('../config/db');

const getTickets = async (req, res) => {
  try {
    const { status, priority, escalated } = req.query;
    let sql = `SELECT * FROM customer_care_tickets WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (priority) {
      sql += ` AND priority = ?`;
      params.push(priority);
    }
    if (escalated === 'true') {
      sql += ` AND priority = 'High' AND status != 'Resolved'`;
    }

    sql += ` ORDER BY created_at DESC`;
    const tickets = await all(sql, params);
    return res.json({ tickets });
  } catch (err) {
    console.error('getTickets error:', err);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// GET /tickets/:id
const getTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    return res.json({ ticket });
  } catch (err) {
    console.error('getTicket error:', err);
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
};

// GET /tickets/customer/:customerId — a customer's full ticket history
const getCustomerHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    const tickets = await all(
      `SELECT * FROM customer_care_tickets WHERE customer_id = ? ORDER BY created_at DESC`,
      [customerId]
    );
    return res.json({ tickets });
  } catch (err) {
    console.error('getCustomerHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch customer history' });
  }
};

// POST /tickets/:id/take-ownership — a support agent claims an escalated ticket as theirs
const takeOwnershipTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await get(`SELECT id FROM customer_care_tickets WHERE id = ?`, [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await run(`UPDATE customer_care_tickets SET status = 'In Progress' WHERE id = ?`, [id]);
    const updated = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [id]);
    return res.json({ message: 'Ticket ownership taken', ticket: updated });
  } catch (err) {
    console.error('takeOwnershipTicket error:', err);
    return res.status(500).json({ error: 'Failed to take ownership of ticket' });
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
    const updated = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [id]);
    return res.json({ message: 'Ticket reassigned successfully', ticket: updated });
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
    const updated = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [id]);
    return res.json({ message: 'Ticket marked as resolved', ticket: updated });
  } catch (err) {
    console.error('resolveTicket error:', err);
    return res.status(500).json({ error: 'Failed to resolve ticket' });
  }
};

const createTicket = async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_email, customer_location,
      issue_title, issue_category, description, machine_id, machine_location, priority,
    } = req.body;

    if (!customer_name || !issue_title) {
      return res.status(400).json({ error: 'customer_name and issue_title are required' });
    }

    const ticketId = `TICKET_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    const customerId = `CUST_${customer_name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    const createdAt = new Date().toISOString();

    await run(
      `INSERT INTO customer_care_tickets (
        id, customer_id, customer_name, customer_phone, customer_email, customer_location,
        issue_title, issue_category, description, machine_id, machine_location,
        status, priority, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      [
        ticketId, customerId, customer_name, customer_phone || null, customer_email || null, customer_location || null,
        issue_title, issue_category || null, description || null, machine_id || null, machine_location || null,
        priority || 'Medium', createdAt,
      ]
    );

    const ticket = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [ticketId]);
    return res.status(201).json({ message: 'Ticket created successfully', ticket });
  } catch (err) {
    console.error('createTicket error:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
};

module.exports = {
  getTickets,
  getTicket,
  getCustomerHistory,
  takeOwnershipTicket,
  createTicket,
  reassignTicket,
  resolveTicket,
};
