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

module.exports = {
  getDeploymentHistory,
};
