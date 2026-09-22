const { run, get, all } = require('../config/db');

const getTransactions = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let sql = `SELECT * FROM transactions`;
    const params = [];

    if (orgId) {
      sql += ` WHERE org_id = ? OR org_id IS NULL`;
      params.push(orgId);
    }

    sql += ` ORDER BY created_at DESC`;
    const txns = await all(sql, params);

    return res.json({ transactions: txns });
  } catch (err) {
    console.error('getTransactions error:', err);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

const createTransaction = async (req, res) => {
  try {
    const { machine_name, device_id, amount, status, razorpay_id, receipt_url, org_id } = req.body;

    const txnId = `TXN_${Date.now()}`;
    const txnOrgId = org_id || req.user?.org_id || 'ORG_1637D16F';
    const createdAt = new Date().toISOString();

    await run(`
      INSERT INTO transactions (txn_id, machine_name, device_id, amount, status, razorpay_id, receipt_url, created_at, org_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [txnId, machine_name || 'Machine', device_id || 'UNKNOWN', Number(amount) || 0, status || 'SUCCESS', razorpay_id || 'N/A', receipt_url || null, createdAt, txnOrgId]);

    const created = await get(`SELECT * FROM transactions WHERE txn_id = ?`, [txnId]);
    return res.status(201).json(created);
  } catch (err) {
    console.error('createTransaction error:', err);
    return res.status(500).json({ error: 'Failed to create transaction' });
  }
};

const refundTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const txn = await get(`SELECT * FROM transactions WHERE txn_id = ?`, [id]);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await run(`UPDATE transactions SET status = 'REFUNDED' WHERE txn_id = ?`, [id]);
    return res.json({ success: true, message: `Transaction ${id} refunded successfully` });
  } catch (err) {
    console.error('refundTransaction error:', err);
    return res.status(500).json({ error: 'Failed to refund transaction' });
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  refundTransaction,
};
