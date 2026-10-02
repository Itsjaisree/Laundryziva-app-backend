const { run, get, all } = require('../config/db');
const { syncLiveDeviceStates } = require('../services/deviceServerService');
const { isValidAction, performControl } = require('../services/machineControlService');

const getMachines = async (req, res) => {
  try {
    await syncLiveDeviceStates();
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
    await syncLiveDeviceStates();
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

const getMachineById = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'WASHER_1020BA01D418') {
      await syncLiveDeviceStates();
    }
    const machine = await get(`SELECT * FROM machines WHERE device_id = ?`, [id]);
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    return res.json({ machine });
  } catch (err) {
    console.error('getMachineById error:', err);
    return res.status(500).json({ error: 'Failed to fetch machine' });
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
        org_id, created_at
      ) VALUES (?, ?, ?, 'OFFLINE', 'OFFLINE', 0, 0, 0, 0, ?, ?);
    `, [id, name, loc, machineOrgId, createdAt]);

    const created = await get(`SELECT * FROM machines WHERE device_id = ?`, [id]);
    return res.status(201).json(created);
  } catch (err) {
    console.error('createMachine error:', err);
    return res.status(500).json({ error: 'Failed to create machine' });
  }
};

// Called by the device server when a device is paired on its dashboard. Unlike
// createMachine (used by the super_admin's manual "Add Machine" screen, which should
// reject a duplicate ID), this is idempotent — re-pairing an already-known device
// (e.g. moving it to a different org) updates it instead of failing.
const registerPairedMachine = async (req, res) => {
  try {
    const { device_id, friendly_name, location, org_id } = req.body;
    if (!device_id || !org_id || !friendly_name || !location) {
      return res.status(400).json({ error: 'device_id, org_id, friendly_name, and location are all required' });
    }

    const existing = await get(`SELECT device_id FROM machines WHERE device_id = ?`, [device_id]);
    if (existing) {
      await run(`
        UPDATE machines SET friendly_name = ?, location = ?, org_id = ? WHERE device_id = ?
      `, [friendly_name, location, org_id, device_id]);
    } else {
      const now = new Date().toISOString();
      await run(`
        INSERT INTO machines (
          device_id, friendly_name, location, health_status, state,
          wash_remaining_seconds, wash_total_seconds, relay1, relay2,
          org_id, created_at
        ) VALUES (?, ?, ?, 'OFFLINE', 'OFFLINE', 0, 0, 0, 0, ?, ?);
      `, [device_id, friendly_name, location, org_id, now]);
    }

    const result = await get(`SELECT * FROM machines WHERE device_id = ?`, [device_id]);
    return res.status(200).json(result);
  } catch (err) {
    console.error('registerPairedMachine error:', err);
    return res.status(500).json({ error: 'Failed to register paired machine' });
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

// Real machine control — technicians only, and only while they have a started task for this machine.
const controlMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};

    if (!isValidAction(action)) {
      return res.status(400).json({ error: 'Unknown control action' });
    }

    const task = await get(
      `SELECT id FROM technician_tasks WHERE technician_id = ? AND machine_id = ? AND status = 'In Progress' LIMIT 1`,
      [req.user.id, id]
    );
    if (!task) {
      return res.status(403).json({ error: 'Machine controls are only available while you are working on a started task for this machine' });
    }

    const result = await performControl(id, action);
    if (!result.ok) {
      const passthrough = [404, 409, 503];
      const status = passthrough.includes(result.status) ? result.status : 502;
      return res.status(status).json({ error: result.error || 'The device server rejected the command' });
    }

    console.log(`machine-control user=${req.user.id} machine=${id} action=${action} task=${task.id}`);
    return res.json({ success: true, message: 'Command sent to the machine', auto_revert_seconds: result.autoRevertSeconds });
  } catch (err) {
    console.error('controlMachine error:', err);
    return res.status(500).json({ error: 'Failed to send machine command' });
  }
};

module.exports = {
  getMachines,
  getMachineById,
  getFleetSummary,
  createMachine,
  registerPairedMachine,
  updateMachine,
  deleteMachine,
  controlMachine,
};
