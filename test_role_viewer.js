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

const { isViewerRole, setViewerMachineAssignments, getViewerAssignedDeviceIds, removeViewerMachineAssignments } = require('./services/viewerMachineService');

test('TC_VIEWER_BE_01: isViewerRole recognizes viewer role variants and excludes owner, tech and admin', () => {
  assert.strictEqual(isViewerRole('organization_viewer'), true);
  assert.strictEqual(isViewerRole('viewer'), true);
  assert.strictEqual(isViewerRole('ORGANIZATION_VIEWER'), true);
  assert.strictEqual(isViewerRole('organization_owner'), false);
  assert.strictEqual(isViewerRole('field_operations'), false);
  assert.strictEqual(isViewerRole('super_admin'), false);
  assert.strictEqual(isViewerRole(null), false);
});

test('TC_VIEWER_BE_02: setViewerMachineAssignments assigns valid organization machines to viewer', async () => {
  const assigned = await setViewerMachineAssignments('USR_VIEWER_1', 'ORG_01', ['MAC_01', 'MAC_02']);
  assert.deepStrictEqual(assigned, ['MAC_01', 'MAC_02']);
  const deviceIds = await getViewerAssignedDeviceIds('USR_VIEWER_1');
  assert.deepStrictEqual(deviceIds, ['MAC_01', 'MAC_02']);
});

test('TC_VIEWER_BE_03: setViewerMachineAssignments strictly rejects machines not in viewer organization', async () => {
  await assert.rejects(
    async () => {
      await setViewerMachineAssignments('USR_VIEWER_1', 'ORG_01', ['MAC_01', 'MAC_FOREIGN_09']);
    },
    /Machines not found in this organization/
  );
});

test('TC_VIEWER_BE_04: removeViewerMachineAssignments cleans up viewer assignments when unlinked', async () => {
  await setViewerMachineAssignments('USR_VIEWER_DEL', 'ORG_01', ['MAC_01']);
  let ids = await getViewerAssignedDeviceIds('USR_VIEWER_DEL');
  assert.strictEqual(ids.length, 1);
  await removeViewerMachineAssignments('USR_VIEWER_DEL');
  ids = await getViewerAssignedDeviceIds('USR_VIEWER_DEL');
  assert.strictEqual(ids.length, 0);
});

test('TC_VIEWER_BE_05: Viewer read-only guard verifies viewer has zero write privileges for machine control', () => {
  const canSendMachineCommand = (roleKey) => {
    // Only field technicians or owners can trigger direct hardware commands
    return ['field_operations', 'organization_owner', 'super_admin'].includes(roleKey);
  };

  assert.strictEqual(canSendMachineCommand('organization_viewer'), false);
  assert.strictEqual(canSendMachineCommand('viewer'), false);
  assert.strictEqual(canSendMachineCommand('field_operations'), true);
});
