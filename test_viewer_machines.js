const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const dbPath = path.resolve(__dirname, 'config/db.js');
let mockAssignments = [];
if (!require.cache[dbPath]) {
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
      pool: { query: async () => ({ rows: [], rowCount: 0 }), on: () => {} },
      run: async (sql, params) => {
        if (sql.includes('DELETE FROM viewer_machine_assignments')) {
          mockAssignments = mockAssignments.filter(a => a.user_id !== params[0]);
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO viewer_machine_assignments')) {
          mockAssignments.push({ id: params[0], user_id: params[1], device_id: params[2], org_id: params[3] });
          return { changes: 1 };
        }
        return { changes: 1, rows: [] };
      },
      get: async () => undefined,
      all: async (sql, params) => {
        if (sql.includes('SELECT device_id FROM machines WHERE org_id = ?')) {
          const orgId = params[0];
          const requestedIds = params.slice(1);
          // Org 1 has MAC_01 and MAC_02. MAC_ORG2 belongs to Org 2.
          const orgMachines = ['MAC_01', 'MAC_02'];
          if (orgId === 'ORG_01') {
            return requestedIds.filter(id => orgMachines.includes(id)).map(id => ({ device_id: id }));
          }
          return [];
        }
        if (sql.includes('SELECT device_id FROM viewer_machine_assignments')) {
          return mockAssignments.filter(a => a.user_id === params[0]).map(a => ({ device_id: a.device_id }));
        }
        return [];
      },
    },
  };
}

const { isViewerRole, setViewerMachineAssignments, getViewerAssignedDeviceIds } = require('./services/viewerMachineService');

test('TC_RBAC_VIEWER: isViewerRole recognizes viewer role keys correctly', () => {
  assert.strictEqual(isViewerRole('organization_viewer'), true);
  assert.strictEqual(isViewerRole('viewer'), true);
  assert.strictEqual(isViewerRole('ORGANIZATION_VIEWER'), true);
  assert.strictEqual(isViewerRole('organization_owner'), false);
  assert.strictEqual(isViewerRole('field_operations'), false);
  assert.strictEqual(isViewerRole('super_admin'), false);
  assert.strictEqual(isViewerRole(null), false);
});

test('TC_VMAC_ASSIGN: assigns valid organization machines to viewer', async () => {
  const assigned = await setViewerMachineAssignments('USR_VIEWER_1', 'ORG_01', ['MAC_01', 'MAC_02']);
  assert.deepStrictEqual(assigned, ['MAC_01', 'MAC_02']);
  const deviceIds = await getViewerAssignedDeviceIds('USR_VIEWER_1');
  assert.deepStrictEqual(deviceIds, ['MAC_01', 'MAC_02']);
});

test('TC_VMAC_RESTRICT: refuses machines not belonging to the organization', async () => {
  await assert.rejects(
    async () => {
      await setViewerMachineAssignments('USR_VIEWER_1', 'ORG_01', ['MAC_01', 'MAC_FOREIGN_09']);
    },
    /Machines not found in this organization/
  );
});
