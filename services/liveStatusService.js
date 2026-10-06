const mqtt = require('mqtt');
const { all } = require('../config/db');

// Pushes machine status to the apps over MQTT, so a phone sees a machine change without asking for it.
// The device-server sync (every 15 s) already knows each machine's state; this publishes it only when it changed.
// Disabled until MQTT_BACKEND_PASSWORD is set, the same way device sync is disabled without its key.
const MQTT_URL = process.env.MQTT_PUBLISH_URL || 'mqtt://127.0.0.1:1883';
const MQTT_USER = process.env.MQTT_BACKEND_USER || 'backend_service';
const MQTT_PASSWORD = process.env.MQTT_BACKEND_PASSWORD || '';

// The apps already listen on org/<org id>/device/+/telemetry and read state, health_status, relays, net and wash seconds.
const topicFor = (orgId, deviceId) => `org/${orgId}/device/${deviceId}/telemetry`;

// Only what the apps show. Signal strength and uptime are left out: they change every sync and would publish constantly.
const buildMessage = (m) => ({
  state: String(m.state || 'IDLE').toUpperCase(),
  health_status: String(m.health_status || 'OFFLINE').toUpperCase(),
  relay1: m.relay1 ? 1 : 0,
  relay2: m.relay2 ? 1 : 0,
  net: m.net || null,
  firmware_version: m.firmware_version || null,
  wash_remaining_seconds: Number(m.wash_remaining_seconds) || 0,
  wash_total_seconds: Number(m.wash_total_seconds) || 0,
});

/**
 * Remembers the last message sent for each machine and publishes only the ones that differ.
 * `publish(topic, text)` returns true when the message was handed to the broker, false when it could not be
 * (not connected); a message that could not be sent is tried again on the next sync.
 */
const createPublisher = (publish) => {
  const last = new Map();
  return {
    publishChanges(rows) {
      let sent = 0;
      for (const m of rows) {
        if (!m.org_id || !m.device_id) continue;
        const text = JSON.stringify(buildMessage(m));
        const topic = topicFor(m.org_id, m.device_id);
        if (last.get(topic) === text) continue;
        if (publish(topic, text)) {
          last.set(topic, text);
          sent += 1;
        }
      }
      return sent;
    },
    // After a reconnect everything is sent again, so no phone is left with an old retained value.
    forgetAll() {
      last.clear();
    },
  };
};

// A new chat message on a task. The event carries ids only, never the text: the app then fetches the message through
// the normal login-checked API. Needs this rule on the broker (/etc/mosquitto/acl):
//   pattern read org/%u/task/+/chat
const chatTopic = (orgId, taskId) => `org/${orgId}/task/${taskId}/chat`;
const chatEvent = (orgId, taskId, messageId, createdAt) => ({
  topic: chatTopic(orgId, taskId),
  payload: JSON.stringify({ task_id: taskId, message_id: messageId, created_at: createdAt }),
});

let client = null;
let publisher = null;

// Tells everyone listening on the task's organization that a message arrived. Never throws and never blocks the request.
const publishChatMessage = (orgId, taskId, messageId, createdAt) => {
  try {
    if (!client || !client.connected || !orgId || !taskId) return false;
    const { topic, payload } = chatEvent(orgId, taskId, messageId, createdAt);
    client.publish(topic, payload, { qos: 0, retain: false });
    return true;
  } catch (err) {
    console.warn('Chat event publish error:', err.message);
    return false;
  }
};

const start = () => {
  if (!MQTT_PASSWORD) {
    console.warn('MQTT_BACKEND_PASSWORD is not set — live status push is disabled.');
    return;
  }
  client = mqtt.connect(MQTT_URL, {
    username: MQTT_USER,
    password: MQTT_PASSWORD,
    clientId: `lz_backend_${process.pid}`,
    protocolVersion: 4,
    clean: true,
    keepalive: 30,
    reconnectPeriod: 5000,
  });
  publisher = createPublisher((topic, text) => {
    if (!client.connected) return false;
    // retained: a phone that opens the screen later still gets the current state straight away
    client.publish(topic, text, { qos: 1, retain: true }, (err) => {
      if (err) console.warn('Live status publish failed:', err.message);
    });
    return true;
  });
  client.on('connect', () => {
    console.log('Live status push: connected to the MQTT broker.');
    publisher.forgetAll();
  });
  client.on('error', (err) => console.warn('Live status push MQTT error:', err.message));
};

// Called after every device-server sync. Never throws: a failure here must not stop the sync.
const publishMachineStatuses = async () => {
  if (!publisher) return 0;
  try {
    const rows = await all(
      `SELECT device_id, org_id, health_status, state, relay1, relay2, net, firmware_version,
              wash_remaining_seconds, wash_total_seconds
       FROM machines WHERE org_id IS NOT NULL`
    );
    return publisher.publishChanges(rows);
  } catch (err) {
    console.warn('Live status publish error:', err.message);
    return 0;
  }
};

module.exports = { start, publishMachineStatuses, createPublisher, buildMessage, topicFor, chatTopic, chatEvent, publishChatMessage };
