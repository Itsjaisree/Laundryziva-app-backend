const http = require('http');

const BASE_URL = 'http://localhost:5000';

const request = (method, path, data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('\n--- STARTING LAUNDRYZIVA BACKEND INTEGRATION TESTS ---\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title} ${details}`);
      failed++;
    }
  };

  try {
    // 1. Health Check
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'OK', 'Health Check API (/api/health)');

    // 2. Auth Login
    const login = await request('POST', '/api/auth/login', {
      email: 'owner@demo.com',
      password: 'Owner@123',
    });
    assert(login.status === 200 && login.data.access_token, 'Login API (/api/auth/login)');

    const token = login.data.access_token;

    // 3. Auth Me
    const me = await request('GET', '/api/auth/me', null, token);
    assert(me.status === 200 && me.data.user.email === 'owner@demo.com', 'Authenticated User Profile (/api/auth/me)');

    // 4. Permissions
    const perms = await request('GET', '/api/auth/me/permissions', null, token);
    assert(perms.status === 200 && perms.data.permissions.view_dashboard === 'view', 'Permissions API (/api/auth/me/permissions)');

    // 5. Fleet Summary
    const fleet = await request('GET', '/api/fleet/summary', null, token);
    assert(fleet.status === 200 && fleet.data.total_devices >= 3, 'Fleet Summary API (/api/fleet/summary)');

    // 6. Machines List
    const machines = await request('GET', '/api/machines/', null, token);
    assert(machines.status === 200 && Array.isArray(machines.data.machines), 'Machines Listing API (/api/machines/)');

    // 7. Organizations List
    const orgs = await request('GET', '/api/organizations/', null, token);
    assert(orgs.status === 200 && Array.isArray(orgs.data.organizations), 'Organizations Listing API (/api/organizations/)');

    // 8. Roles List
    const roles = await request('GET', '/api/roles/?include_system=true', null, token);
    assert(roles.status === 200 && Array.isArray(roles.data.roles), 'Roles Listing API (/api/roles/)');

    // 9. Users List
    const users = await request('GET', '/api/users/', null, token);
    assert(users.status === 200 && Array.isArray(users.data.users), 'Users Listing API (/api/users/)');

    // 10. Transactions List
    const txns = await request('GET', '/api/transactions/', null, token);
    assert(txns.status === 200 && Array.isArray(txns.data.transactions), 'Transactions Listing API (/api/transactions/)');

    // 11. Notifications List & Read Persistence Test
    const notifs = await request('GET', '/api/notifications/', null, token);
    assert(notifs.status === 200 && Array.isArray(notifs.data.notifications) && notifs.data.notifications.length > 0, 'Notifications Listing API (/api/notifications/)');

    const targetNotif = notifs.data.notifications.find(n => n.is_read === 0) || notifs.data.notifications[0];
    if (targetNotif) {
      const markSingle = await request('PUT', `/api/notifications/${targetNotif.id}/read`, null, token);
      assert(markSingle.status === 200, `Mark Notification Read API (/api/notifications/${targetNotif.id}/read)`);

      const reCheckNotifs = await request('GET', '/api/notifications/', null, token);
      const updatedNotif = reCheckNotifs.data.notifications.find(n => n.id === targetNotif.id);
      assert(updatedNotif && updatedNotif.is_read === 1, 'Verified Notification is_read=1 Persisted in DB');
    }

    const markAll = await request('PUT', '/api/notifications/read-all', null, token);
    assert(markAll.status === 200, 'Mark All Notifications Read API (/api/notifications/read-all)');

    const allCheckNotifs = await request('GET', '/api/notifications/', null, token);
    const allAreRead = allCheckNotifs.data.notifications.every(n => n.is_read === 1);
    assert(allAreRead, 'Verified All Notifications marked as is_read=1 Persistently');

    // 12. Firmware History List
    const firmware = await request('GET', '/api/firmware/deployments/history', null, token);
    assert(firmware.status === 200 && Array.isArray(firmware.data.deployments), 'Firmware Deployments API (/api/firmware/deployments/history)');

    // 13. Analytics & Export CSV API Test
    const analyticsSummary = await request('GET', '/api/analytics/summary', null, token);
    assert(analyticsSummary.status === 200 && typeof analyticsSummary.data?.revenue?.total === 'number', 'Analytics Summary API (/api/analytics/summary)');

    const analyticsMachines = await request('GET', '/api/analytics/machines', null, token);
    assert(analyticsMachines.status === 200 && Array.isArray(analyticsMachines.data?.machines), 'Analytics Machines API (/api/analytics/machines)');

    const analyticsExport = await request('GET', '/api/analytics/export', null, token);
    const csvData = typeof analyticsExport.data === 'string' ? analyticsExport.data : JSON.stringify(analyticsExport.data);
    assert(analyticsExport.status === 200 && csvData.includes('Organization Analytics Summary Report'), 'Analytics Export CSV API (/api/analytics/export)');

    console.log(`\n----------------------------------------------------`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`----------------------------------------------------\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
};

runTests();
