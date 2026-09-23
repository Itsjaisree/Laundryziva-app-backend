const { run, get, all } = require('../config/db');

// GET /api/technician/tasks
const getTasks = async (req, res) => {
  try {
    const { status, date, from_date, to_date, all: allFlag } = req.query;
    const orgId = req.query.org_id || req.user?.org_id;
    const technicianId = req.query.technician_id || (allFlag === 'true' ? null : req.user?.id);

    let sql = `SELECT * FROM technician_tasks WHERE 1=1`;
    const params = [];

    if (technicianId) {
      sql += ` AND technician_id = ?`;
      params.push(technicianId);
    } else if (orgId) {
      sql += ` AND (org_id = ? OR org_id IS NULL)`;
      params.push(orgId);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (date) {
      sql += ` AND scheduled_date = ?`;
      params.push(date);
    }
    if (from_date) {
      sql += ` AND scheduled_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      sql += ` AND scheduled_date <= ?`;
      params.push(to_date);
    }

    sql += ` ORDER BY scheduled_date ASC, scheduled_time ASC`;
    const tasks = await all(sql, params);

    return res.json({ tasks });
  } catch (err) {
    console.error('getTasks error:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// GET /api/technician/tasks/:id
const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json({ task });
  } catch (err) {
    console.error('getTask error:', err);
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
};

// POST /api/technician/tasks
const createTask = async (req, res) => {
  try {
    const {
      technician_id, technician_name, type, title, description, location,
      machine_id, machine_name, scheduled_date, scheduled_time, priority,
      source_ticket_id, org_id,
    } = req.body;

    if (!technician_id || !title) {
      return res.status(400).json({ error: 'technician_id and title are required' });
    }

    const id = `TASK_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    const taskOrgId = org_id || req.user?.org_id || 'ORG_1637D16F';
    const now = new Date().toISOString();

    await run(`
      INSERT INTO technician_tasks (
        id, org_id, technician_id, technician_name, type, title, description, location,
        machine_id, machine_name, scheduled_date, scheduled_time, priority, status,
        source_ticket_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?);
    `, [
      id, taskOrgId, technician_id, technician_name || null, type || 'Maintenance', title, description || null, location || null,
      machine_id || null, machine_name || null, scheduled_date || null, scheduled_time || null, priority || 'Medium',
      source_ticket_id || null, req.user?.id || null, now, now,
    ]);

    const created = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    return res.status(201).json({ message: 'Task created successfully', task_id: id, task: created });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ error: 'Failed to create task' });
  }
};

// POST /api/technician/tasks/:id/start
const startTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await get(`SELECT id FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await run(`UPDATE technician_tasks SET status = 'In Progress', updated_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
    const updated = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    return res.json({ message: 'Task started', task: updated });
  } catch (err) {
    console.error('startTask error:', err);
    return res.status(500).json({ error: 'Failed to start task' });
  }
};

// POST /api/technician/tasks/:id/complete
const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_photo_url } = req.body;

    const task = await get(`SELECT id FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await run(`
      UPDATE technician_tasks SET status = 'Completed', verification_photo_url = ?, updated_at = ? WHERE id = ?
    `, [verification_photo_url || null, new Date().toISOString(), id]);

    const updated = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    return res.json({ message: 'Task marked completed', task: updated });
  } catch (err) {
    console.error('completeTask error:', err);
    return res.status(500).json({ error: 'Failed to complete task' });
  }
};

// POST /api/technician/tasks/:id/change-request
const requestTaskChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, reason } = req.body;

    if (!type || !reason) {
      return res.status(400).json({ error: 'type and reason are required' });
    }

    const task = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date().toISOString();
    await run(`
      UPDATE technician_tasks
      SET status = 'Pending Approval', change_request_type = ?, change_request_reason = ?, change_request_status = 'Pending', updated_at = ?
      WHERE id = ?
    `, [type, reason, now, id]);

    // Log the request + an automatic receipt acknowledgement in the task's chat thread,
    // mirroring the frontend mock's requestTaskChange (tech message + auto system reply)
    const reqMsgId = `MSG_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    await run(`
      INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, 'technician', ?, 0, ?);
    `, [reqMsgId, id, task.org_id, req.user?.id || task.technician_id, task.technician_name || 'Technician', `Change request submitted: ${type} — ${reason}`, now]);

    const replyMsgId = `MSG_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000) + 1}`;
    await run(`
      INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, is_system, created_at)
      VALUES (?, ?, ?, NULL, 'LaundryZiva Dispatch', 'system', ?, 1, ?);
    `, [replyMsgId, id, task.org_id, `Your ${type} request has been received and is pending review.`, now]);

    const updated = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    return res.json({ message: 'Change request submitted', task: updated });
  } catch (err) {
    console.error('requestTaskChange error:', err);
    return res.status(500).json({ error: 'Failed to submit change request' });
  }
};

// GET /api/technician/tasks/:id/messages
const getTaskMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await all(`SELECT * FROM task_messages WHERE task_id = ? ORDER BY created_at ASC`, [id]);
    return res.json({ messages });
  } catch (err) {
    console.error('getTaskMessages error:', err);
    return res.status(500).json({ error: 'Failed to fetch task messages' });
  }
};

// POST /api/technician/tasks/:id/messages
const postTaskMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, voice_url, photo_url } = req.body;

    const task = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!message && !voice_url && !photo_url) {
      return res.status(400).json({ error: 'message, voice_url, or photo_url is required' });
    }

    const now = new Date().toISOString();
    const msgId = `MSG_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    const senderId = req.user?.id || task.technician_id;
    const senderName = req.user?.name || task.technician_name || 'Technician';

    await run(`
      INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, voice_url, photo_url, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, 'technician', ?, ?, ?, 0, ?);
    `, [msgId, id, task.org_id, senderId, senderName, message || null, voice_url || null, photo_url || null, now]);

    const created = await get(`SELECT * FROM task_messages WHERE id = ?`, [msgId]);

    // Auto-reply for full parity with the frontend mock's sendMessage, which always
    // appends a canned acknowledgement alongside every technician-authored message.
    const replyId = `MSG_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000) + 1}`;
    const replyNow = new Date().toISOString();
    await run(`
      INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, is_system, created_at)
      VALUES (?, ?, ?, NULL, 'LaundryZiva Dispatch', 'system', ?, 1, ?);
    `, [replyId, id, task.org_id, 'An agent will review your message shortly.', replyNow]);

    return res.status(201).json({ message: 'Message sent', task_message: created });
  } catch (err) {
    console.error('postTaskMessage error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

module.exports = {
  getTasks,
  getTask,
  createTask,
  startTask,
  completeTask,
  requestTaskChange,
  getTaskMessages,
  postTaskMessage,
};
