const https = require('https');
const { run, get } = require('../config/db');

const DEVICE_SERVER_HOST = process.env.DEVICE_SERVER_HOST || 'uat.upiziva.com';
const DEVICE_SERVER_PATH = process.env.DEVICE_SERVER_PATH || '/api/device/states';
const DEVICE_SERVER_API_KEY = process.env.DEVICE_SERVER_API_KEY || 'dev_test_key_12345';

/**
 * Fetches live device state array directly from the upstream Device Server at uat.upiziva.com
 */
const fetchDeviceStatesFromDeviceServer = () => {
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
 * Synchronizes live real-time telemetry from Device Server for TITAN_1020BA01D418 into SQLite database
 */
const syncLiveDeviceStates = async () => {
  try {
    const response = await fetchDeviceStatesFromDeviceServer();
    if (response && response.success && Array.isArray(response.data)) {
      const titan = response.data.find((d) => d.device_id === 'TITAN_1020BA01D418');
      if (titan) {
        const healthStatus = (titan.health || (titan.online ? 'ONLINE' : 'OFFLINE')).toUpperCase();
        const machineState = (titan.state || 'IDLE').toUpperCase();
        const relay1Val = titan.relay1 === 'ON' || titan.relay1 === 1 ? 1 : 0;
        const relay2Val = titan.relay2 === 'ON' || titan.relay2 === 1 ? 1 : 0;
        const fwVersion = titan.firmware_version && titan.firmware_version !== '??' ? titan.firmware_version : '5.3.2';
        const gsmSig = Math.abs(titan.rssi || 21);
        const lastSeenIso = titan.last_seen ? new Date(titan.last_seen * 1000).toISOString() : new Date().toISOString();

        await run(`
          UPDATE machines
          SET health_status = ?,
              state = ?,
              relay1 = ?,
              relay2 = ?,
              firmware_version = ?,
              gsm_signal = ?,
              wash_remaining_seconds = ?,
              wash_total_seconds = ?,
              last_seen_at = ?
          WHERE device_id = 'TITAN_1020BA01D418'
        `, [
          healthStatus,
          machineState,
          relay1Val,
          relay2Val,
          fwVersion,
          gsmSig,
          titan.wash_remaining_seconds || 0,
          titan.wash_total_seconds || 0,
          lastSeenIso,
        ]);
        return titan;
      }
    }
  } catch (err) {
    console.warn('syncLiveDeviceStates error:', err.message);
  }
  return null;
};

module.exports = {
  fetchDeviceStatesFromDeviceServer,
  syncLiveDeviceStates,
};
