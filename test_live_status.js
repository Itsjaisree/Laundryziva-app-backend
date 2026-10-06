// Run with: node --test test_live_status.js
const test = require('node:test');
const assert = require('node:assert');
const { createPublisher, buildMessage, topicFor, chatTopic, chatEvent, publishChatMessage } = require('./services/liveStatusService');

const row = (over = {}) => ({
  device_id: 'M1', org_id: 'ORG_A', health_status: 'ONLINE', state: 'IDLE', relay1: 0, relay2: 0,
  net: 'wifi', firmware_version: '5.0.2', wash_remaining_seconds: 0, wash_total_seconds: 0, ...over,
});

const setup = (connected = true) => {
  const sent = [];
  const pub = createPublisher((topic, text) => {
    if (!connected.value) return false;
    sent.push([topic, JSON.parse(text)]);
    return true;
  });
  return { pub, sent };
};
const up = () => ({ value: true });

test('topic is scoped to the organization and machine', () => {
  assert.strictEqual(topicFor('ORG_A', 'M1'), 'org/ORG_A/device/M1/telemetry');
});

test('message carries what the app reads, and not the noisy fields', () => {
  const msg = buildMessage(row({ state: 'washing', relay1: 1, rssi: -50, uptime: 99 }));
  assert.deepStrictEqual(Object.keys(msg).sort(), ['firmware_version', 'health_status', 'net', 'relay1', 'relay2', 'state', 'wash_remaining_seconds', 'wash_total_seconds']);
  assert.strictEqual(msg.state, 'WASHING');
  assert.strictEqual(msg.relay1, 1);
});

test('first sync publishes every machine, the next sync with no change publishes nothing', () => {
  const { pub, sent } = setup(up());
  assert.strictEqual(pub.publishChanges([row(), row({ device_id: 'M2' })]), 2);
  assert.strictEqual(pub.publishChanges([row(), row({ device_id: 'M2' })]), 0);
  assert.strictEqual(sent.length, 2);
});

test('a machine coming online is published, and only that machine', () => {
  const { pub, sent } = setup(up());
  pub.publishChanges([row({ health_status: 'OFFLINE', state: 'OFFLINE' }), row({ device_id: 'M2' })]);
  sent.length = 0;
  pub.publishChanges([row(), row({ device_id: 'M2' })]);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0][0], 'org/ORG_A/device/M1/telemetry');
  assert.strictEqual(sent[0][1].health_status, 'ONLINE');
});

test('signal strength or uptime changing alone publishes nothing', () => {
  const { pub } = setup(up());
  pub.publishChanges([row({ rssi: -40, uptime: 10 })]);
  assert.strictEqual(pub.publishChanges([row({ rssi: -70, uptime: 500 })]), 0);
});

test('a machine with no organization is never published', () => {
  const { pub } = setup(up());
  assert.strictEqual(pub.publishChanges([row({ org_id: null })]), 0);
});

test('when the broker is not connected nothing is lost: it is sent on the next sync', () => {
  const link = up();
  const { pub, sent } = setup(link);
  link.value = false;
  assert.strictEqual(pub.publishChanges([row()]), 0);
  link.value = true;
  assert.strictEqual(pub.publishChanges([row()]), 1);
  assert.strictEqual(sent.length, 1);
});

test('after a reconnect everything is sent again', () => {
  const { pub, sent } = setup(up());
  pub.publishChanges([row()]);
  pub.forgetAll();
  pub.publishChanges([row()]);
  assert.strictEqual(sent.length, 2);
});

test('a finished wash (state back to IDLE) is published', () => {
  const { pub, sent } = setup(up());
  pub.publishChanges([row({ state: 'WASHING', wash_remaining_seconds: 600, wash_total_seconds: 3540 })]);
  pub.publishChanges([row({ state: 'IDLE', wash_remaining_seconds: 0, wash_total_seconds: 0 })]);
  assert.strictEqual(sent[1][1].state, 'IDLE');
});

test('chat events go to the task topic and carry ids only, never the message text', () => {
  assert.strictEqual(chatTopic('ORG_A', 'TASK_1'), 'org/ORG_A/task/TASK_1/chat');
  const ev = chatEvent('ORG_A', 'TASK_1', 'MSG_9', '2026-10-06T10:00:00.000Z');
  assert.strictEqual(ev.topic, 'org/ORG_A/task/TASK_1/chat');
  assert.deepStrictEqual(JSON.parse(ev.payload), { task_id: 'TASK_1', message_id: 'MSG_9', created_at: '2026-10-06T10:00:00.000Z' });
});

test('publishing a chat event without a broker connection is harmless', () => {
  assert.strictEqual(publishChatMessage('ORG_A', 'TASK_1', 'MSG_9', 'now'), false);
  assert.strictEqual(publishChatMessage(null, 'TASK_1', 'MSG_9', 'now'), false);
});
