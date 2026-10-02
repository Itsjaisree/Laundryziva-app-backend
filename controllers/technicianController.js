const { run, get, all } = require('../config/db');
const { releaseMachineControl } = require('../services/machineControlService');

// GET /api/technician/tasks
const getTasks = async (req, res) => {
  try {
    const { status, date, from_date, to_date, all: allFlag } = req.query;
    // super_admin's own org_id is only a seed placeholder, so don't scope them unless they ask to.
    const orgId = req.user?.role_key === 'super_admin' ? req.query.org_id : (req.query.org_id || req.user?.org_id);
    // Technicians only ever see their own tasks; owners and support may list everyone's.
    const isTechnician = req.user?.role_key === 'field_operations';
    const technicianId = isTechnician
      ? req.user.id
      : (req.query.technician_id || (allFlag === 'true' ? null : req.user?.id));

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
    const photos = await all(
      `SELECT id, kind, latitude, longitude, captured_at, created_at FROM task_photos WHERE task_id = ? ORDER BY created_at ASC`,
      [id]
    );
    return res.json({ task, photos });
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

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const id = `TASK_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    // Company-wide support agents have no org of their own, so fall back to the machine's org.
    let taskOrgId = org_id || req.user?.org_id;
    if (!taskOrgId && machine_id) {
      const machine = await get(`SELECT org_id FROM machines WHERE device_id = ?`, [machine_id]);
      taskOrgId = machine?.org_id;
    }
    taskOrgId = taskOrgId || 'ORG_1637D16F';
    const now = new Date().toISOString();
    const initialStatus = technician_id ? 'Assigned' : 'Unassigned';

    await run(`
      INSERT INTO technician_tasks (
        id, org_id, technician_id, technician_name, type, title, description, location,
        machine_id, machine_name, scheduled_date, scheduled_time, priority, status,
        source_ticket_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      id, taskOrgId, technician_id || null, technician_name || null, type || 'Maintenance', title, description || null, location || null,
      machine_id || null, machine_name || null, scheduled_date || null, scheduled_time || null, priority || 'Medium', initialStatus,
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
    const { arrival_photo_id } = req.body || {};

    const task = await get(`SELECT id, status, technician_id FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    // Machine control is granted by a started task, so only the assigned technician may start it.
    if (req.user?.role_key === 'field_operations' && task.technician_id !== req.user.id) {
      return res.status(403).json({ error: 'This task is not assigned to you' });
    }
    if (task.status === 'In Progress') {
      // Idempotent: a retry after a lost response must not fail.
      const current = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
      return res.json({ message: 'Task already started', task: current });
    }
    if (!['Assigned', 'Scheduled'].includes(task.status)) {
      return res.status(409).json({ error: `A ${task.status} task cannot be started` });
    }

    // The photo must already be uploaded by this technician for this task — never trust a client-supplied URL.
    const photo = arrival_photo_id
      ? await get(
          `SELECT id FROM task_photos WHERE id = ? AND task_id = ? AND kind = 'arrival' AND uploaded_by = ?`,
          [arrival_photo_id, id, req.user.id]
        )
      : null;
    if (!photo) {
      return res.status(400).json({ error: 'Upload an arrival photo before starting the task' });
    }
    const photoUrl = `/api/photos/${photo.id}`;

    await run(`
      UPDATE technician_tasks
      SET status = 'In Progress', arrival_photo_url = ?, before_photos = ?, updated_at = ?
      WHERE id = ?
    `, [photoUrl, JSON.stringify([photoUrl]), new Date().toISOString(), id]);

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
    const { completion_photo_id } = req.body || {};

    const task = await get(`SELECT id, machine_id, status, technician_id FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (req.user?.role_key === 'field_operations' && task.technician_id !== req.user.id) {
      return res.status(403).json({ error: 'This task is not assigned to you' });
    }
    if (task.status !== 'In Progress') {
      return res.status(409).json({ error: 'Start the task with an arrival photo before completing it' });
    }

    const photo = completion_photo_id
      ? await get(
          `SELECT id FROM task_photos WHERE id = ? AND task_id = ? AND kind = 'completion' AND uploaded_by = ?`,
          [completion_photo_id, id, req.user.id]
        )
      : null;
    if (!photo) {
      return res.status(400).json({ error: 'Upload a completion photo before completing the task' });
    }
    const photoUrl = `/api/photos/${photo.id}`;

    await run(`
      UPDATE technician_tasks
      SET status = 'Completed', verification_photo_url = ?, after_photos = ?, updated_at = ?
      WHERE id = ?
    `, [photoUrl, JSON.stringify([photoUrl]), new Date().toISOString(), id]);

    // Work is over: the technician's control of this machine ends and any forced relay is released.
    releaseMachineControl(task.machine_id).catch((e) => console.warn('release after complete failed:', e.message));

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

    releaseMachineControl(task.machine_id).catch((e) => console.warn('release after change request failed:', e.message));

    const updated = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    return res.json({ message: 'Change request submitted', task: updated });
  } catch (err) {
    console.error('requestTaskChange error:', err);
    return res.status(500).json({ error: 'Failed to submit change request' });
  }
};

const EDIT_PRIORITIES = ['Low', 'Medium', 'High'];

const addDispatchMessage = async (task, text, now) => {
  const msgId = `MSG_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
  await run(`
    INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, is_system, created_at)
    VALUES (?, ?, ?, NULL, 'LaundryZiva Dispatch', 'system', ?, 1, ?);
  `, [msgId, task.id, task.org_id, text, now]);
};

// PUT /api/technician/tasks/:id — support edits details, reschedules, or reassigns
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const task = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (task.status === 'Completed') {
      return res.status(409).json({ error: 'Completed tasks cannot be edited' });
    }

    const updates = {};
    const has = (f) => Object.prototype.hasOwnProperty.call(body, f);

    if (has('title')) {
      if (!(body.title || '').toString().trim()) {
        return res.status(400).json({ error: 'title cannot be empty' });
      }
      updates.title = body.title.toString().trim();
    }
    ['description', 'location', 'type', 'machine_name'].forEach((f) => {
      if (has(f)) updates[f] = body[f] === null ? null : body[f].toString().trim();
    });
    if (has('type') && !updates.type) {
      return res.status(400).json({ error: 'type cannot be empty' });
    }
    if (has('priority')) {
      if (!EDIT_PRIORITIES.includes(body.priority)) {
        return res.status(400).json({ error: 'priority must be Low, Medium or High' });
      }
      updates.priority = body.priority;
    }
    if (has('scheduled_date')) {
      const d = body.scheduled_date;
      if (d) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(`${d}T00:00:00Z`).getTime())) {
          return res.status(400).json({ error: 'scheduled_date must be a valid YYYY-MM-DD date' });
        }
      }
      updates.scheduled_date = d || null;
    }
    if (has('scheduled_time')) {
      updates.scheduled_time = (body.scheduled_time || '').toString().trim() || null;
    }

    if (has('machine_id')) {
      const machineId = (body.machine_id || '').toString().trim() || null;
      updates.machine_id = machineId;
      if (machineId) {
        const machine = await get(`SELECT org_id FROM machines WHERE device_id = ?`, [machineId]);
        if (machine?.org_id) updates.org_id = machine.org_id;
      }
    }

    let technicianChanged = false;
    if (has('technician_id')) {
      const techId = body.technician_id || null;
      if (techId) {
        const tech = await get(`SELECT id, name, role_key, is_active FROM users WHERE id = ?`, [techId]);
        if (!tech || tech.role_key !== 'field_operations' || tech.is_active !== 1) {
          return res.status(400).json({ error: 'Selected technician is not valid' });
        }
        updates.technician_id = tech.id;
        updates.technician_name = tech.name;
      } else {
        updates.technician_id = null;
        updates.technician_name = null;
      }
      technicianChanged = (updates.technician_id || null) !== (task.technician_id || null);
      // A different technician starts the task fresh.
      if (technicianChanged) {
        updates.status = updates.technician_id ? 'Assigned' : 'Unassigned';
      } else if (updates.technician_id && task.status === 'Unassigned') {
        updates.status = 'Assigned';
      }
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const now = new Date().toISOString();
    updates.updated_at = now;
    const cols = Object.keys(updates);
    await run(
      `UPDATE technician_tasks SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...cols.map((c) => updates[c]), id]
    );

    if (technicianChanged) {
      await addDispatchMessage(
        task,
        updates.technician_id ? `This task has been assigned to ${updates.technician_name}.` : 'This task is no longer assigned to a technician.',
        now
      );
    }
    const rescheduled =
      (has('scheduled_date') && (updates.scheduled_date || null) !== (task.scheduled_date || null)) ||
      (has('scheduled_time') && (updates.scheduled_time || null) !== (task.scheduled_time || null));
    if (rescheduled) {
      const when = [updates.scheduled_date ?? task.scheduled_date, updates.scheduled_time ?? task.scheduled_time].filter(Boolean).join(' ');
      await addDispatchMessage(task, `This task was rescheduled${when ? ` to ${when}` : ''}.`, now);
    }

    // If support moved a started task away from this technician or machine, their control ends.
    const leftInProgress = task.status === 'In Progress' && updates.status && updates.status !== 'In Progress';
    const machineChanged = task.status === 'In Progress' && updates.machine_id !== undefined && updates.machine_id !== task.machine_id;
    if (leftInProgress || machineChanged) {
      releaseMachineControl(task.machine_id).catch((e) => console.warn('release after edit failed:', e.message));
    }

    const updated = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [id]);
    return res.json({ message: 'Task updated', task: updated });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ error: 'Failed to update task' });
  }
};
module.exports = {
  getTasks,
  updateTask,
  getTask,
  createTask,
  startTask,
  completeTask,
  requestTaskChange,
};
