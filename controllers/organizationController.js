const { run, get, all } = require('../config/db');

const ORG_SAFE_COLUMNS = `id, name, city, contact_name, contact_email, contact_phone, is_active, logo_url, location_image_url, created_by, created_at`;

const getOrganizations = async (req, res) => {
  try {
    // req.user is absent on the internal (device-server) call, which needs the full
    // list for the pairing dropdown. A logged-in organization_owner only sees their own org.
    const scopeToOwnOrg = req.user && req.user.role_key !== 'super_admin';
    const orgs = scopeToOwnOrg
      ? await all(`SELECT ${ORG_SAFE_COLUMNS} FROM organizations WHERE id = ? ORDER BY created_at DESC`, [req.user.org_id])
      : await all(`SELECT ${ORG_SAFE_COLUMNS} FROM organizations ORDER BY created_at DESC`);
    return res.json({ organizations: orgs });
  } catch (err) {
    console.error('getOrganizations error:', err);
    return res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

const createOrganization = async (req, res) => {
  try {
    const { name, city, contact_name, contact_email, contact_phone, logo_url, location_image_url } = req.body;

    if (!name || !city || !contact_name || !contact_email || !contact_phone) {
      return res.status(400).json({ error: 'name, city, contact_name, contact_email, and contact_phone are all required' });
    }

    const orgId = `ORG_${Date.now().toString(16).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const createdBy = req.user?.id || 'system';

    await run(`
      INSERT INTO organizations (id, name, city, contact_name, contact_email, contact_phone, is_active, logo_url, location_image_url, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?);
    `, [orgId, name, city, contact_name, contact_email, contact_phone, logo_url || null, location_image_url || null, createdBy, createdAt]);

    const createdOrg = await get(`SELECT ${ORG_SAFE_COLUMNS} FROM organizations WHERE id = ?`, [orgId]);
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
