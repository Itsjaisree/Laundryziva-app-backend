const { all } = require('../config/db');
const { rangeBounds, summarize, buildPayoutCsv } = require('../services/payoutService');

// An owner only ever sees their own organization's payouts. A super admin sees every organization unless they ask for one.
const resolveOrgId = (req) => (req.user?.role_key === 'super_admin' ? req.query.org_id : req.user?.org_id);

const findPayouts = async (req) => {
  const bounds = rangeBounds(req.query.from, req.query.to);
  if (bounds.error) return { error: bounds.error };
  const orgId = resolveOrgId(req);
  if (req.user?.role_key !== 'super_admin' && !orgId) return { rows: [] };

  let sql = `SELECT * FROM payouts WHERE 1=1`;
  const params = [];
  if (orgId) {
    sql += ` AND org_id = ?`;
    params.push(orgId);
  }
  if (bounds.start) {
    sql += ` AND transferred_at >= ?`;
    params.push(bounds.start);
  }
  if (bounds.end) {
    sql += ` AND transferred_at < ?`;
    params.push(bounds.end);
  }
  sql += ` ORDER BY transferred_at DESC`;
  return { rows: await all(sql, params) };
};

// GET /api/payouts?from=YYYY-MM-DD&to=YYYY-MM-DD  (days are India time and refer to when the money was transferred)
const getPayouts = async (req, res) => {
  try {
    const found = await findPayouts(req);
    if (found.error) return res.status(400).json({ error: found.error });
    return res.json({ payouts: found.rows, summary: summarize(found.rows) });
  } catch (err) {
    console.error('getPayouts error:', err);
    return res.status(500).json({ error: 'Failed to fetch payouts' });
  }
};

// GET /api/payouts/export  -> CSV
const exportPayouts = async (req, res) => {
  try {
    const found = await findPayouts(req);
    if (found.error) return res.status(400).json({ error: found.error });
    const orgs = await all(`SELECT id, name FROM organizations`);
    const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
    const csv = buildPayoutCsv(found.rows, { orgNames, from: req.query.from, to: req.query.to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="laundryziva_payout_report.csv"');
    return res.send(csv);
  } catch (err) {
    console.error('exportPayouts error:', err);
    return res.status(500).json({ error: 'Failed to export payouts' });
  }
};

module.exports = { getPayouts, exportPayouts };
