const { run, get, all } = require('../config/db');
const { createNotification } = require('../services/notificationService');

const getTransactions = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    const startDate = req.query.start_date || req.query.startDate;
    const endDate = req.query.end_date || req.query.endDate;

    let sql = `SELECT * FROM transactions`;
    const params = [];
    const conditions = [];

    if (orgId) {
      conditions.push(`(org_id = ? OR org_id IS NULL)`);
      params.push(orgId);
    }

    if (startDate) {
      const formattedStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
      conditions.push(`created_at >= ?`);
      params.push(formattedStart);
    }

    if (endDate) {
      const formattedEnd = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      conditions.push(`created_at <= ?`);
      params.push(formattedEnd);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
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
    const txnStatus = status || 'SUCCESS';

    await run(`
      INSERT INTO transactions (txn_id, machine_name, device_id, amount, status, razorpay_id, receipt_url, created_at, org_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [txnId, machine_name || 'Machine', device_id || 'UNKNOWN', Number(amount) || 0, txnStatus, razorpay_id || 'N/A', receipt_url || null, createdAt, txnOrgId]);

    const created = await get(`SELECT * FROM transactions WHERE txn_id = ?`, [txnId]);

    if (txnStatus === 'FAILED' || txnStatus === 'FAILURE') {
      await createNotification({
        org_id: txnOrgId,
        title: 'Payment Failed',
        message: `Payment of ₹${amount || 0} failed for machine ${machine_name || 'Machine'} (${device_id || 'N/A'}).`,
        type: 'transaction',
        category: 'error',
        icon: 'card-outline'
      });
    }

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

    await createNotification({
      org_id: txn.org_id || 'ORG_1637D16F',
      title: 'Refund Processed',
      message: `Refund of ₹${txn.amount} successfully processed for transaction ${id} (${txn.machine_name}).`,
      type: 'transaction',
      category: 'info',
      icon: 'cash-outline'
    });

    return res.json({ success: true, message: `Transaction ${id} refunded successfully` });
  } catch (err) {
    console.error('refundTransaction error:', err);
    return res.status(500).json({ error: 'Failed to refund transaction' });
  }
};

const exportTransactions = async (req, res) => {
  try {
    const analyticsController = require('./analyticsController');
    return analyticsController.exportAnalytics(req, res);
  } catch (err) {
    console.error('exportTransactions error:', err);
    return res.status(500).json({ error: 'Failed to export transactions' });
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  refundTransaction,
  exportTransactions,
};
