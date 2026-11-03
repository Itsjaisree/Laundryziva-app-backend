const { run, all, get } = require('../config/db');
const crypto = require('crypto');

/**
 * Check if a role key represents a Viewer
 */
function isViewerRole(roleKey) {
  if (!roleKey) return false;
  const key = String(roleKey).toLowerCase().trim();
  return key === 'organization_viewer' || key === 'viewer';
}

/**
 * Get device IDs assigned to a Viewer user
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getViewerAssignedDeviceIds(userId) {
  if (!userId) return [];
  try {
    const rows = await all(
      'SELECT device_id FROM viewer_machine_assignments WHERE user_id = ?',
      [userId]
    );
    return rows.map((r) => r.device_id);
  } catch (err) {
    console.error('Error fetching viewer machine assignments:', err);
    return [];
  }
}

/**
 * Get full machine objects assigned to a Viewer user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getViewerAssignedMachines(userId) {
  if (!userId) return [];
  try {
    const rows = await all(
      `SELECT m.device_id, m.friendly_name, m.location, m.health_status, m.state, m.org_id
       FROM machines m
       INNER JOIN viewer_machine_assignments vma ON m.device_id = vma.device_id
       WHERE vma.user_id = ?`,
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('Error fetching viewer assigned machines:', err);
    return [];
  }
}

/**
 * Set machine assignments for a viewer.
 * Validates that all machines belong to the given organization.
 * Replaces existing assignments for the user.
 * @param {string} userId
 * @param {string} orgId
 * @param {string[]} deviceIds
 */
async function setViewerMachineAssignments(userId, orgId, deviceIds = []) {
  if (!userId || !orgId) {
    throw new Error('userId and orgId are required');
  }

  const cleanedIds = Array.from(new Set((deviceIds || []).filter(Boolean)));

  // Validate that all devices belong to this org
  if (cleanedIds.length > 0) {
    const placeholders = cleanedIds.map(() => '?').join(',');
    const validMachines = await all(
      `SELECT device_id FROM machines WHERE org_id = ? AND device_id IN (${placeholders})`,
      [orgId, ...cleanedIds]
    );
    const validSet = new Set(validMachines.map((m) => m.device_id));
    const invalid = cleanedIds.filter((id) => !validSet.has(id));
    if (invalid.length > 0) {
      throw new Error(`Machines not found in this organization: ${invalid.join(', ')}`);
    }
  }

  // Clear existing assignments for this user
  await run('DELETE FROM viewer_machine_assignments WHERE user_id = ?', [userId]);

  // Insert new assignments
  const now = new Date().toISOString();
  for (const deviceId of cleanedIds) {
    const id = `VMA_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    await run(
      `INSERT INTO viewer_machine_assignments (id, user_id, device_id, org_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, deviceId, orgId, now]
    );
  }

  return cleanedIds;
}

/**
 * Delete all machine assignments for a user (e.g. when unlinked from org or deleted)
 * @param {string} userId
 */
async function removeViewerMachineAssignments(userId) {
  if (!userId) return;
  await run('DELETE FROM viewer_machine_assignments WHERE user_id = ?', [userId]);
}

module.exports = {
  isViewerRole,
  getViewerAssignedDeviceIds,
  getViewerAssignedMachines,
  setViewerMachineAssignments,
  removeViewerMachineAssignments,
};
