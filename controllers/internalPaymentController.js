const { run, get } = require('../config/db');
const { notifyUsers, ownerUserIds } = require('../services/pushService');

// POST /api/internal/payments - called by the device server (guarded by requireDeviceServerKey) after a payment callback.
// Body: { txn_id, machine_id, amount, status, created_at? }. Safe to repeat: the txn_id is unique.
const ingestPayment = async (req, res) => {
  try {
    const { txn_id: txnId, machine_id: machineId, amount, status } = req.body || {};
    const amountNum = Number(amount);
    if (!txnId || !machineId || !Number.isFinite(amountNum) || amountNum < 0) {
      return res.status(400).json({ error: 'txn_id, machine_id and a valid amount are required' });
    }
    const machine = await get(`SELECT device_id, friendly_name, location, org_id FROM machines WHERE device_id = ?`, [machineId]);
    if (!machine) {
      return res.status(404).json({ error: 'Unknown machine' });
    }
    const txnStatus = String(status || 'SUCCESS').toUpperCase();
    const createdAt = req.body.created_at && !Number.isNaN(Date.parse(req.body.created_at))
      ? new Date(req.body.created_at).toISOString()
      : new Date().toISOString();

    const inserted = await run(
      `INSERT INTO transactions (txn_id, machine_name, device_id, amount, status, razorpay_id, created_at, org_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (txn_id) DO NOTHING`,
      [String(txnId), machine.friendly_name || machine.device_id, machine.device_id, amountNum, txnStatus, String(txnId), createdAt, machine.org_id]
    );

    if (inserted.changes > 0 && txnStatus === 'SUCCESS') {
      const where = [machine.friendly_name || machine.device_id, machine.location].filter(Boolean).join(', ');
      ownerUserIds(machine.org_id).then((ids) =>
        notifyUsers(ids, {
          title: 'Payment received · Wash started',
          body: `₹${amountNum.toLocaleString('en-IN', { maximumFractionDigits: 2 })} paid · wash started at ${where}`,
          data: { type: 'payment', deviceId: machine.device_id },
          orgId: machine.org_id,
          type: 'transaction',
          icon: 'cash-outline',
          prefKey: 'payment_wash',
        })
      );
    }
    return res.json({ ok: true, duplicate: inserted.changes === 0 });
  } catch (err) {
    console.error('ingestPayment error:', err);
    return res.status(500).json({ error: 'Failed to record the payment' });
  }
};

module.exports = { ingestPayment };
