const https = require('https');
const { run, get } = require('../config/db');

const DEVICE_SERVER_HOST = process.env.DEVICE_SERVER_HOST || 'data.upiziva.com';
const DEVICE_SERVER_PATH = process.env.DEVICE_SERVER_PATH || '/api/device/states';
const DEVICE_SERVER_API_KEY = process.env.DEVICE_SERVER_API_KEY || '';
const STALE_AFTER_MS = 90 * 1000;

if (!DEVICE_SERVER_API_KEY) {
  console.warn('DEVICE_SERVER_API_KEY is not set — live device state sync is disabled.');
}

/**
 * Fetches live device state array directly from the upstream Device Server at uat.upiziva.com
 */
const fetchDeviceStatesFromDeviceServer = () => {
  if (!DEVICE_SERVER_API_KEY) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const options = {
      hostname: DEVICE_SERVER_HOST,
      port: 443,
      path: DEVICE_SERVER_PATH,
      method: 'GET',
      headers: {
        'X-Internal-API-Key': DEVICE_SERVER_API_KEY,
        'User-Agent': 'Laundryziva-AppServer/1.0',
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          console.warn('Failed to parse device server response:', e);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('Device server request error:', err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn('Device server request timed out');
      resolve(null);
    });

    req.end();
  });
};

/**
 * Synchronizes live real-time telemetry from the Device Server into our database.
 * Only ever UPDATEs machines we already have registered — a device reported by the
 * device server that we don't recognize is simply ignored, never auto-created. Pairing
 * a new device to an organization happens on the device server's own dashboard, not here.
 */
const syncLiveDeviceStates = async () => {
  const synced = [];
  try {
    const response = await fetchDeviceStatesFromDeviceServer();
    if (response && response.success && Array.isArray(response.data)) {
      for (const device of response.data) {
        if (!device.device_id) continue;

        const healthStatus = (device.health || (device.online ? 'ONLINE' : 'OFFLINE')).toUpperCase();
        const machineState = (device.state || 'IDLE').toUpperCase();
        const relay1Val = device.relay1 === 'ON' || device.relay1 === 1 ? 1 : 0;
        const relay2Val = device.relay2 === 'ON' || device.relay2 === 1 ? 1 : 0;
        // Only store what the device actually reported — unknown stays NULL instead of a made-up value.
        const fwVersion = device.firmware_version && device.firmware_version !== '??' ? device.firmware_version : null;
        const rssi = typeof device.rssi === 'number' && device.rssi < 0 ? Math.round(device.rssi) : null;
        const uptime = typeof device.uptime === 'number' ? Math.round(device.uptime) : null;
        const net = device.net ? String(device.net).toLowerCase() : null;
        const lastSeenIso = device.last_seen ? new Date(device.last_seen * 1000).toISOString() : null;
        const washRemaining = typeof device.wash_remaining_seconds === 'number' ? device.wash_remaining_seconds : null;
        const washTotal = typeof device.wash_total_seconds === 'number' ? device.wash_total_seconds : null;

        const result = await run(`
          UPDATE machines
          SET health_status = ?,
              state = ?,
              relay1 = ?,
              relay2 = ?,
              firmware_version = ?,
              rssi = ?,
              uptime = ?,
              net = ?,
              wash_remaining_seconds = COALESCE(?, wash_remaining_seconds),
              wash_total_seconds = COALESCE(?, wash_total_seconds),
              last_seen_at = COALESCE(?, last_seen_at)
          WHERE device_id = ?
        `, [
          healthStatus,
          machineState,
          relay1Val,
          relay2Val,
          fwVersion,
          rssi,
          uptime,
          net,
          washRemaining,
          washTotal,
          lastSeenIso,
          device.device_id,
        ]);

        if (result.changes > 0) {
          synced.push(device);
        }
      }
    }
  } catch (err) {
    console.warn('syncLiveDeviceStates error:', err.message);
  }

  // Runs even when the device server is unreachable: a machine we haven't heard from recently
  // (or ever) must not keep showing as ONLINE from a stale row.
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    await run(
      `UPDATE machines SET health_status = 'OFFLINE', state = 'OFFLINE', relay1 = 0, relay2 = 0, uptime = NULL
       WHERE health_status <> 'OFFLINE' AND (last_seen_at IS NULL OR last_seen_at < ?)`,
      [cutoff]
    );
  } catch (err) {
    console.warn('stale machine sweep error:', err.message);
  }
  return synced;
};

module.exports = {
  fetchDeviceStatesFromDeviceServer,
  syncLiveDeviceStates,
};
