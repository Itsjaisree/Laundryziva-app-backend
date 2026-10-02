const { run, get, all } = require('../config/db');
const { notifyUsers } = require('../services/pushService');

const AUDIENCES = {
  all: { label: 'Everyone', where: `is_active = 1` },
  owners: { label: 'Owners', where: `is_active = 1 AND role_key = 'organization_owner'` },
  technicians: { label: 'Technicians', where: `is_active = 1 AND role_key = 'field_operations'` },
  support: { label: 'Customer Support', where: `is_active = 1 AND role_key = 'support_refund_agent'` },
};
const MAX_PER_HOUR = 5;

const recipientsFor = async (audience, orgId) => {
  const def = AUDIENCES[audience];
  if (!def) return null;
  // Narrowing to one organization only makes sense for owners.
  const scoped = audience === 'owners' && orgId;
  return all(`SELECT id FROM users WHERE ${def.where}${scoped ? ' AND org_id = ?' : ''}`, scoped ? [orgId] : []);
};

// GET /api/announcements/preview?audience=&org_id=
const preview = async (req, res) => {
  try {
    const rows = await recipientsFor(req.query.audience, req.query.org_id);
    if (!rows) return res.status(400).json({ error: 'Choose who to send to' });
    return res.json({ recipient_count: rows.length });
  } catch (err) {
    console.error('announcement preview error:', err);
    return res.status(500).json({ error: 'Failed to count recipients' });
  }
};

// POST /api/announcements { title, body, audience, org_id? }
const send = async (req, res) => {
  try {
    const title = (req.body?.title || '').toString().trim();
    const body = (req.body?.body || '').toString().trim();
    const { audience, org_id: orgId } = req.body || {};
    if (!title || title.length > 80) return res.status(400).json({ error: 'Title is required (max 80 characters)' });
    if (!body || body.length > 500) return res.status(400).json({ error: 'Message is required (max 500 characters)' });

    const recent = await get(`SELECT COUNT(*) AS n FROM announcements WHERE sent_by = ? AND created_at > ?`, [req.user.id, new Date(Date.now() - 3600 * 1000).toISOString()]);
    if (Number(recent.n) >= MAX_PER_HOUR) {
      return res.status(429).json({ error: `You can send at most ${MAX_PER_HOUR} announcements per hour` });
    }

    const rows = await recipientsFor(audience, orgId);
    if (!rows) return res.status(400).json({ error: 'Choose who to send to' });
    if (rows.length === 0) return res.status(400).json({ error: 'Nobody is in that audience' });

    const id = `ANN_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    await run(
      `INSERT INTO announcements (id, title, body, audience, org_id, recipient_count, sent_by, sent_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, body, audience, audience === 'owners' ? orgId || null : null, rows.length, req.user.id, req.user.name || null, new Date().toISOString()]
    );
    notifyUsers(rows.map((r) => r.id), { title, body, data: { type: 'announcement', announcementId: id }, type: 'announcement', icon: 'megaphone-outline' });
    return res.status(201).json({ message: 'Announcement sent', id, recipient_count: rows.length });
  } catch (err) {
    console.error('announcement send error:', err);
    return res.status(500).json({ error: 'Failed to send the announcement' });
  }
};

// GET /api/announcements
const history = async (req, res) => {
  try {
    const rows = await all(`SELECT id, title, body, audience, org_id, recipient_count, sent_by_name, created_at FROM announcements ORDER BY created_at DESC LIMIT 50`);
    return res.json({ announcements: rows.map((r) => ({ ...r, audience_label: AUDIENCES[r.audience]?.label || r.audience })) });
  } catch (err) {
    console.error('announcement history error:', err);
    return res.status(500).json({ error: 'Failed to load announcements' });
  }
};

module.exports = { preview, send, history };
