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

    // 2. Auth Login - Organization Owner
    const loginOwner = await request('POST', '/api/auth/login', {
      email: 'owner@demo.com',
      password: 'Owner@123',
    });
    assert(loginOwner.status === 200 && loginOwner.data.access_token, 'Login API - Org Owner (/api/auth/login)');
    const ownerToken = loginOwner.data.access_token;

    // 3. Auth Login - Super Admin (for generating operational events)
    const loginAdmin = await request('POST', '/api/auth/login', {
      email: 'admin@laundryziva.com',
      password: 'Admin@123',
    });
    assert(loginAdmin.status === 200 && loginAdmin.data.access_token, 'Login API - Admin (/api/auth/login)');
    const adminToken = loginAdmin.data.access_token;

    // 4. Auth Me
    const me = await request('GET', '/api/auth/me', null, ownerToken);
    assert(me.status === 200 && me.data.user.email === 'owner@demo.com', 'Authenticated User Profile (/api/auth/me)');

    // 5. Fleet Summary
    const fleet = await request('GET', '/api/fleet/summary', null, ownerToken);
    assert(
      fleet.status === 200 && 
      fleet.data.total_devices >= 1 && 
      typeof fleet.data.running_devices === 'number' &&
      typeof fleet.data.online_devices === 'number' &&
      typeof fleet.data.offline_devices === 'number',
      'Fleet Summary API (/api/fleet/summary with status breakdown)'
    );

    // 6. View-Only Permission Enforcement Test
    const startAttempt = await request('POST', '/api/machines/TITAN_1020BA01D418/start', { transaction_id: 'TXN_TEST' }, ownerToken);
    assert(
      startAttempt.status === 403 && (startAttempt.data.error || '').includes('view-only'),
      'View-Only Role Operational Restriction: Start Machine (POST /api/machines/:id/start blocked with 403)'
    );

    const editAttempt = await request('PUT', '/api/machines/TITAN_1020BA01D418', { friendly_name: 'Hacked Name' }, ownerToken);
    assert(
      editAttempt.status === 403 && (editAttempt.data.error || '').includes('view-only'),
      'View-Only Role Operational Restriction: Edit Machine (PUT /api/machines/:id blocked with 403)'
    );

    const removeAttempt = await request('DELETE', '/api/machines/TITAN_1020BA01D418', null, ownerToken);
    assert(
      removeAttempt.status === 403 && (removeAttempt.data.error || '').includes('view-only'),
      'View-Only Role Operational Restriction: Remove Machine (DELETE /api/machines/:id blocked with 403)'
    );

    // 7. Organization Data Isolation Test
    const foreignOrgFleet = await request('GET', '/api/fleet/summary?org_id=ORG_OTHER_EXPLICIT_HACK', null, ownerToken);
    assert(
      foreignOrgFleet.status === 200 && foreignOrgFleet.data.total_devices === fleet.data.total_devices,
      'Organization Data Isolation (Parameter tampering ignored for Org Owner)'
    );

    // 8. Fleet Summary Dynamic Database Match Test
    const machinesListCheck = await request('GET', '/api/machines/', null, ownerToken);
    const dbMachineCount = machinesListCheck.data?.machines?.length || 0;
    assert(
      fleet.data.total_devices === dbMachineCount,
      `Fleet Summary Dynamic Accuracy (Fleet summary total ${fleet.data.total_devices} matches database records count ${dbMachineCount})`
    );

    // =========================================================================
    // INTEGRATION TESTS FOR ALL 12 NOTIFICATION EVENTS
    // =========================================================================
    console.log('\n--- TESTING ALL 12 NOTIFICATION EVENTS ---');

    // 1. New Machine Added
    const testDeviceId = `WM_TEST_${Date.now().toString().slice(-4)}`;
    const addMachineRes = await request('POST', '/api/machines/', {
      device_id: testDeviceId,
      friendly_name: 'Test Washer 100',
      location: 'Block A, Floor 1',
      org_id: 'ORG_1637D16F',
    }, adminToken);
    assert(addMachineRes.status === 201, 'Admin: Create New Machine API');

    let notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif1 = (notifs.data?.notifications || []).find(n => n.title === 'New Machine Added' && n.message.includes(testDeviceId));
    assert(!!notif1, 'Notification Event 1: New Machine Added created in DB');

    // 2. Machine Offline
    const offlineRes = await request('PUT', `/api/machines/${testDeviceId}`, { health_status: 'OFFLINE' }, adminToken);
    assert(offlineRes.status === 200, 'Admin: Update Machine Status to OFFLINE');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif2 = (notifs.data?.notifications || []).find(n => n.title === 'Machine Offline' && n.message.includes(testDeviceId));
    assert(!!notif2, 'Notification Event 2: Machine Offline created in DB');

    // Deduplication test: repeated OFFLINE should NOT generate another notification
    const countBeforeDup = (notifs.data?.notifications || []).filter(n => n.title === 'Machine Offline' && n.message.includes(testDeviceId)).length;
    await request('PUT', `/api/machines/${testDeviceId}`, { health_status: 'OFFLINE' }, adminToken);
    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    const countAfterDup = (notifs.data?.notifications || []).filter(n => n.title === 'Machine Offline' && n.message.includes(testDeviceId)).length;
    assert(countBeforeDup === countAfterDup, 'State Transition Deduplication: Repeated OFFLINE status ignored');

    // 3. Machine Fault Detected
    const faultRes = await request('PUT', `/api/machines/${testDeviceId}`, { health_status: 'ERROR' }, adminToken);
    assert(faultRes.status === 200, 'Admin: Update Machine Status to ERROR');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif3 = (notifs.data?.notifications || []).find(n => n.title === 'Machine Fault Detected' && n.message.includes(testDeviceId));
    assert(!!notif3, 'Notification Event 3: Machine Fault Detected created in DB');

    // 4. Maintenance Required
    const maintReqRes = await request('PUT', `/api/machines/${testDeviceId}`, { state: 'MAINTENANCE' }, adminToken);
    assert(maintReqRes.status === 200, 'Admin: Update Machine State to MAINTENANCE');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif4 = (notifs.data?.notifications || []).find(n => n.title === 'Maintenance Required' && n.message.includes(testDeviceId));
    assert(!!notif4, 'Notification Event 4: Maintenance Required created in DB');

    // 5. Machine Decommissioned
    const deleteRes = await request('DELETE', `/api/machines/${testDeviceId}`, null, adminToken);
    assert(deleteRes.status === 200, 'Admin: Decommission/Delete Machine');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif5 = (notifs.data?.notifications || []).find(n => n.title === 'Machine Decommissioned' && n.message.includes(testDeviceId));
    assert(!!notif5, 'Notification Event 5: Machine Decommissioned created in DB');

    // 6. Maintenance Issue Reported
    const ticketRes = await request('POST', '/api/customercare/tickets', {
      issue_title: 'Water Pressure Drop',
      description: 'Sensor reading below threshold',
      machine_id: 'WM_PG1_102'
    }, adminToken);
    assert(ticketRes.status === 201, 'Admin: Create Customer Care Ticket');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif6 = (notifs.data?.notifications || []).find(n => n.title === 'Maintenance Issue Reported');
    assert(!!notif6, 'Notification Event 6: Maintenance Issue Reported created in DB');

    const createdTicketId = ticketRes.data?.id;

    // 7. Technician Task Assigned
    if (createdTicketId) {
      const reassignRes = await request('POST', `/api/customercare/tickets/${createdTicketId}/reassign`, {
        tech_id: 'TECH_007',
        tech_name: 'John Technician'
      }, adminToken);
      assert(reassignRes.status === 200, 'Admin: Reassign Ticket to Technician');

      notifs = await request('GET', '/api/notifications/', null, ownerToken);
      let notif7 = (notifs.data?.notifications || []).find(n => n.title === 'Technician Task Assigned');
      assert(!!notif7, 'Notification Event 7: Technician Task Assigned created in DB');
    }

    // 8. Maintenance Task Completed
    if (createdTicketId) {
      const resolveRes = await request('POST', `/api/customercare/tickets/${createdTicketId}/resolve`, null, adminToken);
      assert(resolveRes.status === 200, 'Admin: Resolve Ticket');

      notifs = await request('GET', '/api/notifications/', null, ownerToken);
      let notif8 = (notifs.data?.notifications || []).find(n => n.title === 'Maintenance Task Completed');
      assert(!!notif8, 'Notification Event 8: Maintenance Task Completed created in DB');
    }

    // 9. Payment Failed
    const failedTxnRes = await request('POST', '/api/transactions/', {
      machine_name: 'Washer 01',
      device_id: 'WM_PG1_102',
      amount: 150,
      status: 'FAILED',
      org_id: 'ORG_1637D16F'
    }, adminToken);
    assert(failedTxnRes.status === 201, 'Admin: Create Failed Transaction');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif9 = (notifs.data?.notifications || []).find(n => n.title === 'Payment Failed');
    assert(!!notif9, 'Notification Event 9: Payment Failed created in DB');

    // 10. Refund Processed
    const successTxnRes = await request('POST', '/api/transactions/', {
      machine_name: 'Washer 02',
      device_id: 'WM_PG1_102',
      amount: 200,
      status: 'SUCCESS',
      org_id: 'ORG_1637D16F'
    }, adminToken);
    const txnToRefundId = successTxnRes.data?.txn_id;

    if (txnToRefundId) {
      const refundRes = await request('POST', `/api/transactions/${txnToRefundId}/refund`, null, adminToken);
      assert(refundRes.status === 200, 'Admin: Process Refund');

      notifs = await request('GET', '/api/notifications/', null, ownerToken);
      let notif10 = (notifs.data?.notifications || []).find(n => n.title === 'Refund Processed');
      assert(!!notif10, 'Notification Event 10: Refund Processed created in DB');
    }

    // 11. Firmware Update Completed
    const firmwareRes = await request('POST', '/api/firmware/deployments', {
      device_id: 'WM_PG1_102',
      firmware_version: 'v2.2.5',
      status: 'success',
      org_id: 'ORG_1637D16F'
    }, adminToken);
    assert(firmwareRes.status === 201, 'Admin: Create Firmware Deployment');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif11 = (notifs.data?.notifications || []).find(n => n.title === 'Firmware Update Completed');
    assert(!!notif11, 'Notification Event 11: Firmware Update Completed created in DB');

    // 12. Organization System Alert
    const sysAlertRes = await request('POST', '/api/notifications/system-alert', {
      title: 'Organization System Alert',
      message: 'Scheduled cloud gateway upgrade planned for 03:00 AM.',
      category: 'warning',
      org_id: 'ORG_1637D16F'
    }, adminToken);
    assert(sysAlertRes.status === 201, 'Admin: Trigger System Alert');

    notifs = await request('GET', '/api/notifications/', null, ownerToken);
    let notif12 = (notifs.data?.notifications || []).find(n => n.title === 'Organization System Alert');
    assert(!!notif12, 'Notification Event 12: Organization System Alert created in DB');

    // =========================================================================
    // READ PERSISTENCE & MARK ALL READ TESTS
    // =========================================================================
    console.log('\n--- TESTING READ PERSISTENCE & MARK ALL READ ---');

    const unreadNotif = (notifs.data?.notifications || []).find(n => n.is_read === 0);
    if (unreadNotif) {
      const markOneRes = await request('PUT', `/api/notifications/${unreadNotif.id}/read`, null, ownerToken);
      assert(markOneRes.status === 200, `Mark Notification Read API (${unreadNotif.id})`);

      const verifyNotifs = await request('GET', '/api/notifications/', null, ownerToken);
      const verifiedNotif = (verifyNotifs.data?.notifications || []).find(n => n.id === unreadNotif.id);
      assert(verifiedNotif && verifiedNotif.is_read === 1, 'Mark Read Persistence: is_read=1 verified in DB');
    }

    const markAllRes = await request('PUT', '/api/notifications/read-all', null, ownerToken);
    assert(markAllRes.status === 200, 'Mark All Notifications Read API (/api/notifications/read-all)');

    const finalNotifs = await request('GET', '/api/notifications/', null, ownerToken);
    const allRead = (finalNotifs.data?.notifications || []).every(n => n.is_read === 1);
    assert(allRead, 'Mark All Read Persistence: All notifications is_read=1 verified in DB');

    // =========================================================================
    // DATE RANGE FILTERING & CSV EXPORT TESTS
    // =========================================================================
    console.log('\n--- TESTING DATE RANGE FILTERING & EXPORT ---');

    // 1. Transactions Date Range API Test
    const todayStr = new Date().toISOString().split('T')[0];
    const dateFilteredTxns = await request('GET', `/api/transactions/?start_date=2026-01-01&end_date=${todayStr}`, null, ownerToken);
    assert(
      dateFilteredTxns.status === 200 && Array.isArray(dateFilteredTxns.data?.transactions),
      'Date Range Transaction Filtering API (GET /api/transactions?start_date=...&end_date=...)'
    );

    // 2. Full CSV Export API Test (Without Date Range)
    const exportFullRes = await request('GET', '/api/transactions/export', null, ownerToken);
    const exportFullCsv = typeof exportFullRes.data === 'string' ? exportFullRes.data : JSON.stringify(exportFullRes.data);
    assert(
      exportFullRes.status === 200 && exportFullCsv.includes('Organization Analytics Summary Report'),
      'Transaction CSV Export API without date filter (GET /api/transactions/export)'
    );

    // 3. Date-Filtered CSV Export API Test
    const exportFilteredRes = await request('GET', `/api/transactions/export?start_date=2026-01-01&end_date=${todayStr}`, null, ownerToken);
    const exportFilteredCsv = typeof exportFilteredRes.data === 'string' ? exportFilteredRes.data : JSON.stringify(exportFilteredRes.data);
    assert(
      exportFilteredRes.status === 200 && exportFilteredCsv.includes('TRANSACTION DETAILS'),
      'Transaction CSV Export API with date filter (GET /api/transactions/export?start_date=...&end_date=...)'
    );

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
