const { all } = require('../config/db');

const getDeploymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const orgId = req.query.org_id || req.user?.org_id;
    let sql = `SELECT * FROM deployments`;
    const params = [];

    if (orgId) {
      sql += ` WHERE org_id = ? OR org_id IS NULL`;
      params.push(orgId);
    }

    sql += ` ORDER BY deployed_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const deployments = await all(sql, params);

    return res.json({ deployments });
  } catch (err) {
    console.error('getDeploymentHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch deployment history' });
  }
};

const createDeployment = async (req, res) => {
  try {
    const { run, get } = require('../config/db');
    const { createNotification } = require('../services/notificationService');

    const { device_id, firmware_version, previous_version, status, org_id } = req.body;
    const depId = `DEP_${Date.now()}`;
    const targetOrgId = org_id || req.user?.org_id || 'ORG_1637D16F';
    const createdAt = new Date().toISOString();
    const devId = device_id || 'ALL_DEVICES';
    const version = firmware_version || 'v2.2.0';

    await run(`
      INSERT INTO deployments (id, device_id, firmware_version, previous_version, status, deployed_at, completed_at, org_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [depId, devId, version, previous_version || 'v2.1.0', status || 'success', createdAt, createdAt, targetOrgId]);

    await createNotification({
      org_id: targetOrgId,
      title: 'Firmware Update Completed',
      message: `Firmware version ${version} deployment completed successfully for device ${devId}.`,
      type: 'firmware',
      category: 'success',
      icon: 'cloud-done-outline'
    });

    const created = await get(`SELECT * FROM deployments WHERE id = ?`, [depId]);
    return res.status(201).json(created);
  } catch (err) {
    console.error('createDeployment error:', err);
    return res.status(500).json({ error: 'Failed to create deployment' });
  }
};

module.exports = {
  getDeploymentHistory,
  createDeployment,
};
