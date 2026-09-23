const { run, get, all } = require('../config/db');
const { createNotification } = require('../services/notificationService');

const getTickets = async (req, res) => {
  try {
    const tickets = await all(`SELECT * FROM customer_care_tickets ORDER BY created_at DESC`);
    return res.json({ tickets });
  } catch (err) {
    console.error('getTickets error:', err);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

const createTicket = async (req, res) => {
  try {
    const { issue_title, description, machine_id, priority, assigned_tech_id, assigned_tech_name } = req.body;
    const ticketId = `TCK_${Date.now()}`;
    const createdAt = new Date().toISOString();

    let targetOrgId = req.user?.org_id || 'ORG_1637D16F';
    if (machine_id) {
      const targetMachine = await get(`SELECT org_id FROM machines WHERE device_id = ?`, [machine_id]);
      if (targetMachine && targetMachine.org_id) {
        targetOrgId = targetMachine.org_id;
      }
    }

    await run(`
      INSERT INTO customer_care_tickets (
        id, customer_id, customer_name, issue_title, description, machine_id, priority, assigned_tech_id, assigned_tech_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticketId,
      req.user?.id || 'CUST_DEMO',
      req.user?.name || 'Customer',
      issue_title || 'Maintenance Request',
      description || 'Issue reported',
      machine_id || null,
      priority || 'Medium',
      assigned_tech_id || null,
      assigned_tech_name || null,
      createdAt
    ]);

    const created = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [ticketId]);

    await createNotification({
      org_id: targetOrgId,
      title: 'Maintenance Issue Reported',
      message: `New issue "${issue_title || 'Maintenance Request'}" reported for machine ${machine_id || 'N/A'}.`,
      type: 'maintenance',
      category: 'warning',
      icon: 'build-outline'
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('createTicket error:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
};

const reassignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { tech_id, tech_name } = req.body;

    const ticket = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    let targetOrgId = req.user?.org_id || 'ORG_1637D16F';
    if (ticket.machine_id) {
      const targetMachine = await get(`SELECT org_id FROM machines WHERE device_id = ?`, [ticket.machine_id]);
      if (targetMachine && targetMachine.org_id) {
        targetOrgId = targetMachine.org_id;
      }
    }

    await run(`UPDATE customer_care_tickets SET assigned_tech_id = ?, assigned_tech_name = ?, status = 'In Progress' WHERE id = ?`, [tech_id, tech_name, id]);

    await createNotification({
      org_id: targetOrgId,
      title: 'Technician Task Assigned',
      message: `Maintenance task #${id} assigned to technician ${tech_name || 'Technician'}.`,
      type: 'maintenance',
      category: 'info',
      icon: 'person-outline'
    });

    return res.json({ message: 'Ticket reassigned successfully' });
  } catch (err) {
    console.error('reassignTicket error:', err);
    return res.status(500).json({ error: 'Failed to reassign ticket' });
  }
};

const resolveTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await get(`SELECT * FROM customer_care_tickets WHERE id = ?`, [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    let targetOrgId = req.user?.org_id || 'ORG_1637D16F';
    if (ticket.machine_id) {
      const targetMachine = await get(`SELECT org_id FROM machines WHERE device_id = ?`, [ticket.machine_id]);
      if (targetMachine && targetMachine.org_id) {
        targetOrgId = targetMachine.org_id;
      }
    }

    await run(`UPDATE customer_care_tickets SET status = 'Resolved' WHERE id = ?`, [id]);

    await createNotification({
      org_id: targetOrgId,
      title: 'Maintenance Task Completed',
      message: `Maintenance task #${id} has been marked as resolved.`,
      type: 'maintenance',
      category: 'success',
      icon: 'checkmark-done-circle-outline'
    });

    return res.json({ message: 'Ticket marked as resolved' });
  } catch (err) {
    console.error('resolveTicket error:', err);
    return res.status(500).json({ error: 'Failed to resolve ticket' });
  }
};

module.exports = {
  getTickets,
  createTicket,
  reassignTicket,
  resolveTicket,
};
