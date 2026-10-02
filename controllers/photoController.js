const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run, get } = require('../config/db');

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));
const MAX_PHOTOS_PER_KIND = 10;
const KINDS = ['arrival', 'completion'];
const SAFE_ID = /^[A-Za-z0-9_]+$/;

// Decide the type from the file's own bytes — the Content-Type header and file name are client-controlled.
const detectImageType = (buf) => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(pngSig)) return { mime: 'image/png', ext: 'png' };
  return null;
};

const parseCoordinate = (value, limit) => {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

const insideUploadsDir = (absPath) => absPath.startsWith(UPLOADS_DIR + path.sep);

// POST /api/technician/tasks/:id/photo?kind=arrival|completion&lat=&lng=&captured_at=
const uploadTaskPhoto = async (req, res) => {
  try {
    const task = await get(`SELECT id, technician_id, status FROM technician_tasks WHERE id = ?`, [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (task.technician_id !== req.user.id) {
      return res.status(403).json({ error: 'This task is not assigned to you' });
    }

    const { kind } = req.query;
    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: 'kind must be arrival or completion' });
    }
    if (kind === 'arrival' && !['Assigned', 'Scheduled'].includes(task.status)) {
      return res.status(409).json({ error: 'An arrival photo can only be uploaded before the task is started' });
    }
    if (kind === 'completion' && task.status !== 'In Progress') {
      return res.status(409).json({ error: 'A completion photo can only be uploaded while the task is in progress' });
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(415).json({ error: 'Send the photo as a JPEG or PNG image' });
    }
    const type = detectImageType(body);
    if (!type) {
      return res.status(415).json({ error: 'The file is not a valid JPEG or PNG image' });
    }
    if (!SAFE_ID.test(task.id)) {
      return res.status(400).json({ error: 'Invalid task' });
    }

    const existing = await get(`SELECT COUNT(*) AS n FROM task_photos WHERE task_id = ? AND kind = ?`, [task.id, kind]);
    if (Number(existing.n) >= MAX_PHOTOS_PER_KIND) {
      return res.status(409).json({ error: `You can upload at most ${MAX_PHOTOS_PER_KIND} ${kind} photos for a task` });
    }

    const capturedAt = req.query.captured_at && !Number.isNaN(Date.parse(req.query.captured_at))
      ? new Date(req.query.captured_at).toISOString()
      : null;
    const latitude = parseCoordinate(req.query.lat, 90);
    const longitude = parseCoordinate(req.query.lng, 180);

    // The file name is generated here; nothing from the client ever reaches the file system path.
    const id = `PHOTO_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const relPath = path.join('tasks', task.id, `${kind}-${id}.${type.ext}`);
    const absPath = path.join(UPLOADS_DIR, relPath);
    if (!insideUploadsDir(absPath)) {
      return res.status(400).json({ error: 'Invalid upload path' });
    }

    await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
    await fs.promises.writeFile(absPath, body, { flag: 'wx', mode: 0o640 });

    const createdAt = new Date().toISOString();
    await run(
      `INSERT INTO task_photos (id, task_id, kind, file_path, mime, size_bytes, uploaded_by, latitude, longitude, captured_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, task.id, kind, relPath, type.mime, body.length, req.user.id, latitude, longitude, capturedAt, createdAt]
    );

    return res.status(201).json({
      photo: { id, kind, url: `/api/photos/${id}`, latitude, longitude, captured_at: capturedAt, created_at: createdAt },
    });
  } catch (err) {
    console.error('uploadTaskPhoto error:', err);
    return res.status(500).json({ error: 'Failed to save the photo' });
  }
};

// GET /api/photos/:id — only people with a legitimate reason to see this task's evidence
const getPhoto = async (req, res) => {
  try {
    const photo = await get(
      `SELECT p.id, p.file_path, p.mime, t.technician_id, t.org_id AS task_org_id
         FROM task_photos p JOIN technician_tasks t ON t.id = p.task_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const { role_key: role, id: userId, org_id: orgId } = req.user;
    const allowed =
      role === 'super_admin' ||
      role === 'support_refund_agent' ||
      (role === 'field_operations' && photo.technician_id === userId) ||
      (role === 'organization_owner' && photo.task_org_id === orgId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this photo' });
    }

    const absPath = path.resolve(UPLOADS_DIR, photo.file_path);
    if (!insideUploadsDir(absPath)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.set({
      'Content-Type': photo.mime,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.sendFile(absPath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'Photo file not found' });
      }
    });
  } catch (err) {
    console.error('getPhoto error:', err);
    return res.status(500).json({ error: 'Failed to load the photo' });
  }
};

module.exports = { uploadTaskPhoto, getPhoto };
