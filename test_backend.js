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
    assert(fleet.status === 200 && fleet.data.total_devices >= 1, 'Fleet Summary API (/api/fleet/summary)');

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

    // 14. Technician Login
    const techLogin = await request('POST', '/api/auth/login', {
      email: 'technician@demo.com',
      password: 'Technician@123',
    });
    assert(techLogin.status === 200 && techLogin.data.access_token, 'Technician Login API (/api/auth/login)');
    const techToken = techLogin.data.access_token;

    // 15. Technician Tasks - List (mine)
    const myTasks = await request('GET', '/api/technician/tasks', null, techToken);
    assert(myTasks.status === 200 && Array.isArray(myTasks.data.tasks) && myTasks.data.tasks.length > 0, 'Technician Task Listing API (/api/technician/tasks)');

    // 16. Technician Tasks - Get Single
    const singleTask = await request('GET', '/api/technician/tasks/TASK_DEMO_001', null, techToken);
    assert(singleTask.status === 200 && singleTask.data.task?.id === 'TASK_DEMO_001', 'Technician Task Detail API (/api/technician/tasks/:id)');

    // 17. Technician Tasks - Start
    const startedTask = await request('POST', '/api/technician/tasks/TASK_DEMO_001/start', null, techToken);
    assert(startedTask.status === 200 && startedTask.data.task?.status === 'In Progress', 'Technician Task Start API (/api/technician/tasks/:id/start)');

    // 18. Technician Tasks - Complete with verification photo
    const completedTask = await request('POST', '/api/technician/tasks/TASK_DEMO_001/complete', {
      verification_photo_url: 'https://example.com/verification-test.jpg',
    }, techToken);
    assert(
      completedTask.status === 200 &&
      completedTask.data.task?.status === 'Completed' &&
      completedTask.data.task?.verification_photo_url === 'https://example.com/verification-test.jpg',
      'Technician Task Complete API (/api/technician/tasks/:id/complete)'
    );

    // 19. Technician Tasks - Change Request
    const changeReq = await request('POST', '/api/technician/tasks/TASK_DEMO_003/change-request', {
      type: 'Reschedule',
      reason: 'Integration test reason',
    }, techToken);
    assert(
      changeReq.status === 200 && changeReq.data.task?.change_request_status === 'Pending',
      'Technician Task Change Request API (/api/technician/tasks/:id/change-request)'
    );

    // 20. Task Messages - auto-logged from change request
    const changeReqMessages = await request('GET', '/api/technician/tasks/TASK_DEMO_003/messages', null, techToken);
    assert(
      changeReqMessages.status === 200 && changeReqMessages.data.messages.length >= 2,
      'Task Messages Auto-Logged on Change Request (/api/technician/tasks/:id/messages)'
    );

    // 21. Task Messages - Post & Verify Persistence (incl. auto-reply)
    const postedMessage = await request('POST', '/api/technician/tasks/TASK_DEMO_002/messages', {
      message: 'Integration test message',
    }, techToken);
    assert(postedMessage.status === 201 && postedMessage.data.task_message?.message === 'Integration test message', 'Post Task Message API (/api/technician/tasks/:id/messages)');

    const taskMessages = await request('GET', '/api/technician/tasks/TASK_DEMO_002/messages', null, techToken);
    assert(
      taskMessages.status === 200 && taskMessages.data.messages.some(m => m.message === 'Integration test message'),
      'Verified Posted Task Message Persisted in DB'
    );
    assert(
      taskMessages.data.messages.some(m => m.is_system === 1 && m.message === 'An agent will review your message shortly.'),
      'Verified Auto-Reply System Message Persisted in DB'
    );

    // 22. Machine Single Lookup
    const singleMachine = await request('GET', '/api/machines/TITAN_1020BA01D418', null, token);
    assert(singleMachine.status === 200 && singleMachine.data.machine?.device_id === 'TITAN_1020BA01D418', 'Machine Single Lookup API (/api/machines/:id)');

    const missingMachine = await request('GET', '/api/machines/NON_EXISTENT_DEVICE', null, token);
    assert(missingMachine.status === 404, 'Machine Single Lookup 404 for unknown device');

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
