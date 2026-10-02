const { run, get, all } = require('../config/db');
const { notifyUsers, supportUserIds } = require('../services/pushService');

const MAX_MESSAGE_LENGTH = 2000;
const INITIAL_PAGE = 200;

// Chat is per task. A technician only reaches the chats of tasks assigned to them; support reaches any.
const loadAccessibleTask = async (req, res) => {
  const task = await get(`SELECT * FROM technician_tasks WHERE id = ?`, [req.params.id]);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return null;
  }
  if (req.user.role_key === 'field_operations' && task.technician_id !== req.user.id) {
    res.status(403).json({ error: 'This task is not assigned to you' });
    return null;
  }
  return task;
};

const markRead = (userId, taskId, at) =>
  run(
    `INSERT INTO task_chat_reads (user_id, task_id, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, task_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
    [userId, taskId, at]
  );

// GET /api/chat/conversations
const getConversations = async (req, res) => {
  try {
    const me = req.user.id;
    const isTechnician = req.user.role_key === 'field_operations';
    // Support sees every assigned task that is still active, plus any finished task that has a chat.
    const scope = isTechnician
      ? `t.technician_id = ?`
      : `(t.technician_id IS NOT NULL AND (t.status <> 'Completed' OR EXISTS (SELECT 1 FROM task_messages x WHERE x.task_id = t.id AND x.is_system = 0)))`;
    const params = isTechnician ? [me, me, me] : [me, me];

    const rows = await all(
      `SELECT t.id AS task_id, t.title, t.machine_id,
              (SELECT friendly_name FROM machines WHERE device_id = t.machine_id) AS machine_label, t.location, t.status, t.technician_id, t.technician_name,
              t.scheduled_date, t.scheduled_time,
              lm.message AS last_message, lm.sender_role AS last_sender_role, lm.created_at AS last_message_at,
              (SELECT COUNT(*) FROM task_messages m
                WHERE m.task_id = t.id AND m.is_system = 0 AND m.sender_id <> ?
                  AND m.created_at > COALESCE((SELECT r.last_read_at FROM task_chat_reads r WHERE r.task_id = t.id AND r.user_id = ?), '')) AS unread
         FROM technician_tasks t
         LEFT JOIN LATERAL (
           SELECT message, sender_role, created_at FROM task_messages
            WHERE task_id = t.id AND is_system = 0 ORDER BY created_at DESC LIMIT 1
         ) lm ON true
        WHERE ${scope}
        ORDER BY COALESCE(lm.created_at, t.updated_at) DESC`,
      params
    );

    const conversations = rows.map((r) => ({ ...r, unread: Number(r.unread) || 0 }));
    return res.json({
      conversations,
      total_unread: conversations.reduce((sum, c) => sum + c.unread, 0),
    });
  } catch (err) {
    console.error('getConversations error:', err);
    return res.status(500).json({ error: 'Failed to load conversations' });
  }
};

// GET /api/chat/tasks/:id/messages[?after=<ISO time>] — opening a thread marks it read for the caller
const getMessages = async (req, res) => {
  try {
    const task = await loadAccessibleTask(req, res);
    if (!task) return;

    const { after } = req.query;
    let messages;
    if (after) {
      if (Number.isNaN(Date.parse(after))) {
        return res.status(400).json({ error: 'after must be an ISO timestamp' });
      }
      // >= so two messages in the same millisecond can't be skipped; the client de-duplicates by id.
      messages = await all(
        `SELECT id, task_id, sender_id, sender_name, sender_role, message, is_system, created_at
           FROM task_messages WHERE task_id = ? AND created_at >= ? ORDER BY created_at ASC`,
        [task.id, after]
      );
    } else {
      messages = await all(
        `SELECT * FROM (
           SELECT id, task_id, sender_id, sender_name, sender_role, message, is_system, created_at
             FROM task_messages WHERE task_id = ? ORDER BY created_at DESC LIMIT ${INITIAL_PAGE}
         ) recent ORDER BY created_at ASC`,
        [task.id]
      );
    }

    await markRead(req.user.id, task.id, new Date().toISOString());
    return res.json({
      messages,
      task: {
        id: task.id,
        title: task.title,
        machine_id: task.machine_id,
        location: task.location,
        status: task.status,
        technician_name: task.technician_name,
      },
    });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
};

// POST /api/chat/tasks/:id/messages
const postMessage = async (req, res) => {
  try {
    const task = await loadAccessibleTask(req, res);
    if (!task) return;

    const text = (req.body?.message || '').toString().trim();
    if (!text) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });
    }

    const now = new Date().toISOString();
    const id = `MSG_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 100000)}`;
    const senderRole = req.user.role_key === 'field_operations' ? 'technician' : 'support';

    await run(
      `INSERT INTO task_messages (id, task_id, org_id, sender_id, sender_name, sender_role, message, is_system, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, task.id, task.org_id, req.user.id, req.user.name || 'User', senderRole, text, now]
    );
    await markRead(req.user.id, task.id, now);

    const created = await get(
      `SELECT id, task_id, sender_id, sender_name, sender_role, message, is_system, created_at FROM task_messages WHERE id = ?`,
      [id]
    );
    // Alert the other side: support if the technician wrote, the assigned technician if support wrote.
    const recipients = senderRole === 'technician' ? await supportUserIds() : [task.technician_id];
    notifyUsers(recipients.filter((uid) => uid !== req.user.id), {
      title: `${req.user.name || 'New message'} · ${task.title}`,
      body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
      data: { type: 'chat', taskId: task.id },
      orgId: task.org_id,
      icon: 'chatbubble-ellipses-outline',
    });

    return res.status(201).json({ message: created });
  } catch (err) {
    console.error('postMessage error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

module.exports = { getConversations, getMessages, postMessage };
