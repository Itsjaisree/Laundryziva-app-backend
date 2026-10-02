const { sendDeviceCommand } = require('./deviceServerService');

// A forced relay survives a machine reboot (the firmware stores it in flash), so every override a
// technician switches ON is released automatically — on a timer, and when their task ends.
const AUTO_REVERT_MS = 10 * 60 * 1000;

// Technician-facing action -> relay command. "Off" always means "hand control back to normal"
// (payment logic), never a forced OFF that would stop customers from using the machine later.
const ACTIONS = {
  TEST_RUN: { command: 'RELAY1_ON', relay: 1, revertCommand: 'RELAY1_NORMAL' },
  STOP: { command: 'RELAY1_NORMAL', relay: 1 },
  MODE_ON: { command: 'RELAY2_ON', relay: 2, revertCommand: 'RELAY2_NORMAL' },
  MODE_OFF: { command: 'RELAY2_NORMAL', relay: 2 },
};

const revertTimers = new Map();
const timerKey = (machineId, relay) => `${machineId}:${relay}`;

const clearRevertTimer = (machineId, relay) => {
  const key = timerKey(machineId, relay);
  if (revertTimers.has(key)) {
    clearTimeout(revertTimers.get(key));
    revertTimers.delete(key);
  }
};

const isValidAction = (action) => Object.prototype.hasOwnProperty.call(ACTIONS, action);

const performControl = async (machineId, action) => {
  const spec = ACTIONS[action];
  const result = await sendDeviceCommand(machineId, spec.command);
  if (!result.ok) return result;

  clearRevertTimer(machineId, spec.relay);
  if (spec.revertCommand) {
    const timer = setTimeout(() => {
      revertTimers.delete(timerKey(machineId, spec.relay));
      sendDeviceCommand(machineId, spec.revertCommand).then((r) => {
        if (!r.ok) console.warn(`Auto-revert ${spec.revertCommand} failed for ${machineId}: ${r.error || r.status}`);
      });
    }, AUTO_REVERT_MS);
    timer.unref();
    revertTimers.set(timerKey(machineId, spec.relay), timer);
  }
  return { ...result, autoRevertSeconds: spec.revertCommand ? AUTO_REVERT_MS / 1000 : null };
};

// Called when a technician's access to a machine ends (task completed, change requested,
// reassigned). Best effort: failures are logged, never thrown into the caller's request.
const releaseMachineControl = async (machineId) => {
  if (!machineId) return;
  clearRevertTimer(machineId, 1);
  clearRevertTimer(machineId, 2);
  for (const command of ['RELAY1_NORMAL', 'RELAY2_NORMAL']) {
    const r = await sendDeviceCommand(machineId, command);
    if (!r.ok) console.warn(`Release ${command} failed for ${machineId}: ${r.error || r.status}`);
  }
};

module.exports = { isValidAction, performControl, releaseMachineControl };
