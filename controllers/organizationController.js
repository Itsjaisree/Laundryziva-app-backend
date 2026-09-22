const { run, get, all } = require('../config/db');

const getOrganizations = async (req, res) => {
  try {
    const orgs = await all(`SELECT * FROM organizations ORDER BY created_at DESC`);
    return res.json({ organizations: orgs });
  } catch (err) {
    console.error('getOrganizations error:', err);
    return res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

const createOrganization = async (req, res) => {
  try {
    const { name, city, contact_name, contact_email, contact_phone, logo_url, location_image_url } = req.body;

    const orgId = `ORG_${Date.now().toString(16).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const createdBy = req.user?.id || 'system';

    await run(`
      INSERT INTO organizations (id, name, city, contact_name, contact_email, contact_phone, is_active, logo_url, location_image_url, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?);
    `, [orgId, name || 'New Organization', city || '', contact_name || '', contact_email || '', contact_phone || '', logo_url || null, location_image_url || null, createdBy, createdAt]);

    const createdOrg = await get(`SELECT * FROM organizations WHERE id = ?`, [orgId]);
    return res.status(201).json(createdOrg);
  } catch (err) {
    console.error('createOrganization error:', err);
    return res.status(500).json({ error: 'Failed to create organization' });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await get(`SELECT id FROM organizations WHERE id = ?`, [id]);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await run(`DELETE FROM organizations WHERE id = ?`, [id]);
    return res.json({ message: 'Organization removed successfully' });
  } catch (err) {
    console.error('deleteOrganization error:', err);
    return res.status(500).json({ error: 'Failed to delete organization' });
  }
};

module.exports = {
  getOrganizations,
  createOrganization,
  deleteOrganization,
};
