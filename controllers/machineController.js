const { run, get, all } = require('../config/db');

const getMachines = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let sql = `SELECT * FROM machines`;
    const params = [];

    if (orgId) {
      sql += ` WHERE org_id = ? OR org_id IS NULL`;
      params.push(orgId);
    }

    sql += ` ORDER BY created_at DESC`;
    const machines = await all(sql, params);

    return res.json({ machines });
  } catch (err) {
    console.error('getMachines error:', err);
    return res.status(500).json({ error: 'Failed to fetch machines' });
  }
};

const getFleetSummary = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let sql = `SELECT * FROM machines`;
    const params = [];

    if (orgId) {
      sql += ` WHERE org_id = ? OR org_id IS NULL`;
      params.push(orgId);
    }

    const machines = await all(sql, params);

    const total_devices = machines.length;
    const online_devices = machines.filter(m => m.health_status === 'ONLINE').length;
    const offline_devices = machines.filter(m => m.health_status === 'OFFLINE').length;
    const stale_devices = machines.filter(m => m.health_status === 'STALE').length;
    const error_devices = machines.filter(m => m.health_status === 'ERROR' || m.state === 'FAULT').length;
    const firmware_compliant = machines.filter(m => m.firmware_compliant === 1).length;
    const firmware_outdated = total_devices - firmware_compliant;

    return res.json({
      total_devices,
      online_devices,
      offline_devices,
      stale_devices,
      error_devices,
      firmware_compliant,
      firmware_outdated,
    });
  } catch (err) {
    console.error('getFleetSummary error:', err);
    return res.status(500).json({ error: 'Failed to compute fleet summary' });
  }
};

const createMachine = async (req, res) => {
  try {
    const { device_id, deviceId, friendly_name, friendlyName, location, meta_location, org_id } = req.body;
    const id = device_id || deviceId || `WM_${Date.now().toString().slice(-4)}`;
    const name = friendly_name || friendlyName || 'Washing Machine';
    const loc = location || meta_location || 'Main Location';
    const machineOrgId = org_id || req.user?.org_id || 'ORG_1637D16F';
    const createdAt = new Date().toISOString();

    const existing = await get(`SELECT device_id FROM machines WHERE device_id = ?`, [id]);
    if (existing) {
      return res.status(400).json({ error: 'Machine with this device ID already exists' });
    }

    await run(`
      INSERT INTO machines (
        device_id, friendly_name, location, health_status, state,
        wash_remaining_seconds, wash_total_seconds, relay1, relay2,
        firmware_version, gsm_signal, org_id, created_at, last_seen_at
      ) VALUES (?, ?, ?, 'ONLINE', 'IDLE', 0, 0, 0, 0, 'v2.1.0', 30, ?, ?, ?);
    `, [id, name, loc, machineOrgId, createdAt, createdAt]);

    const created = await get(`SELECT * FROM machines WHERE device_id = ?`, [id]);
    return res.status(201).json(created);
  } catch (err) {
    console.error('createMachine error:', err);
    return res.status(500).json({ error: 'Failed to create machine' });
  }
};

const updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const { friendly_name, friendlyName, location, meta_location, health_status, state } = req.body;

    const machine = await get(`SELECT device_id FROM machines WHERE device_id = ?`, [id]);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    const name = friendly_name || friendlyName;
    const loc = location || meta_location;

    if (name !== undefined) {
      await run(`UPDATE machines SET friendly_name = ? WHERE device_id = ?`, [name, id]);
    }
    if (loc !== undefined) {
      await run(`UPDATE machines SET location = ? WHERE device_id = ?`, [loc, id]);
    }
    if (health_status !== undefined) {
      await run(`UPDATE machines SET health_status = ? WHERE device_id = ?`, [health_status, id]);
    }
    if (state !== undefined) {
      await run(`UPDATE machines SET state = ? WHERE device_id = ?`, [state, id]);
    }

    const updated = await get(`SELECT * FROM machines WHERE device_id = ?`, [id]);
    return res.json({ message: 'Machine updated successfully', machine: updated });
  } catch (err) {
    console.error('updateMachine error:', err);
    return res.status(500).json({ error: 'Failed to update machine' });
  }
};

const deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await get(`SELECT device_id FROM machines WHERE device_id = ?`, [id]);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    await run(`DELETE FROM machines WHERE device_id = ?`, [id]);
    return res.json({ success: true, message: 'Machine decommissioned successfully' });
  } catch (err) {
    console.error('deleteMachine error:', err);
    return res.status(500).json({ error: 'Failed to delete machine' });
  }
};

const startMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id } = req.body;

    await run(`
      UPDATE machines 
      SET state = 'WASHING', wash_total_seconds = 3540, wash_remaining_seconds = 3540, relay1 = 1, current_txn_id = ? 
      WHERE device_id = ?
    `, [transaction_id || null, id]);

    return res.json({ success: true, message: `Machine ${id} started successfully` });
  } catch (err) {
    console.error('startMachine error:', err);
    return res.status(500).json({ error: 'Failed to start machine' });
  }
};

const stopMachine = async (req, res) => {
  try {
    const { id } = req.params;

    await run(`
      UPDATE machines 
      SET state = 'IDLE', wash_total_seconds = 0, wash_remaining_seconds = 0, relay1 = 0, relay2 = 0, current_txn_id = NULL 
      WHERE device_id = ?
    `, [id]);

    return res.json({ success: true, message: `Machine ${id} stopped successfully` });
  } catch (err) {
    console.error('stopMachine error:', err);
    return res.status(500).json({ error: 'Failed to stop machine' });
  }
};

const rebootMachine = async (req, res) => {
  try {
    const { id } = req.params;

    await run(`UPDATE machines SET last_seen_at = ? WHERE device_id = ?`, [new Date().toISOString(), id]);
    return res.json({ success: true, message: `Machine ${id} reboot sequence initiated` });
  } catch (err) {
    console.error('rebootMachine error:', err);
    return res.status(500).json({ error: 'Failed to reboot machine' });
  }
};

const toggleRelay = async (req, res) => {
  try {
    const { id } = req.params;
    const { relay, action } = req.body;

    const relayCol = relay === 2 ? 'relay2' : 'relay1';
    const stateVal = action === 'ON' ? 1 : 0;

    await run(`UPDATE machines SET ${relayCol} = ? WHERE device_id = ?`, [stateVal, id]);

    return res.json({ success: true, message: `Relay ${relay} set to ${action}` });
  } catch (err) {
    console.error('toggleRelay error:', err);
    return res.status(500).json({ error: 'Failed to toggle relay' });
  }
};

module.exports = {
  getMachines,
  getFleetSummary,
  createMachine,
  updateMachine,
  deleteMachine,
  startMachine,
  stopMachine,
  rebootMachine,
  toggleRelay,
};
