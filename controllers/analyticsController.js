const { run, get, all } = require('../config/db');

/**
 * Get organization analytics summary (Revenue, Washes, Success Rate)
 */
const getSummary = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let whereClause = '';
    const params = [];

    if (orgId) {
      whereClause = ' WHERE (org_id = ? OR org_id IS NULL)';
      params.push(orgId);
    }

    const txns = await all(`SELECT * FROM transactions${whereClause}`, params);

    let totalRevenue = 0;
    let thisMonthRevenue = 0;
    let todayRevenue = 0;

    let successfulWashes = 0;
    let failedPayments = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toISOString().split('T')[0];

    for (const t of txns) {
      const isSuccess = (t.status || '').toUpperCase() === 'SUCCESS';
      const amount = Number(t.amount) || 0;
      const createdAt = t.created_at ? new Date(t.created_at) : null;

      if (isSuccess) {
        totalRevenue += amount;
        successfulWashes += 1;

        if (createdAt) {
          if (createdAt.getFullYear() === currentYear && createdAt.getMonth() === currentMonth) {
            thisMonthRevenue += amount;
          }
          if (createdAt.toISOString().split('T')[0] === todayStr) {
            todayRevenue += amount;
          }
        }
      } else {
        failedPayments += 1;
      }
    }

    const totalWashes = successfulWashes + failedPayments;
    const successRate = totalWashes > 0 ? Number(((successfulWashes / totalWashes) * 100).toFixed(1)) : 100.0;

    return res.json({
      revenue: {
        total: totalRevenue,
        this_month: thisMonthRevenue,
        today: todayRevenue,
      },
      transactions: {
        total_washes: totalWashes,
        successful_washes: successfulWashes,
        failed_payments: failedPayments,
        success_rate: successRate,
      },
    });
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
};

/**
 * Get daily revenue breakdown
 */
const getDaily = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let whereClause = '';
    const params = [];

    if (orgId) {
      whereClause = ' WHERE (org_id = ? OR org_id IS NULL)';
      params.push(orgId);
    }

    const txns = await all(`SELECT * FROM transactions${whereClause} ORDER BY created_at ASC`, params);

    // Group by day YYYY-MM-DD
    const dailyMap = {};

    for (const t of txns) {
      if ((t.status || '').toUpperCase() !== 'SUCCESS') continue;
      const dateStr = t.created_at ? t.created_at.split('T')[0] : 'Today';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { day: dateStr, revenue: 0, washes: 0 };
      }
      dailyMap[dateStr].revenue += Number(t.amount) || 0;
      dailyMap[dateStr].washes += 1;
    }

    const dailyList = Object.values(dailyMap);
    return res.json({ daily: dailyList });
  } catch (err) {
    console.error('getDaily error:', err);
    return res.status(500).json({ error: 'Failed to fetch daily analytics' });
  }
};

/**
 * Get machine breakdown analytics
 */
const getMachinesAnalytics = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let machWhere = '';
    const machParams = [];

    if (orgId) {
      machWhere = ' WHERE (org_id = ? OR org_id IS NULL)';
      machParams.push(orgId);
    }

    const machines = await all(`SELECT * FROM machines${machWhere}`, machParams);
    const txns = await all(`SELECT * FROM transactions${machWhere}`, machParams);

    const machineStats = {};

    for (const m of machines) {
      machineStats[m.device_id] = {
        device_id: m.device_id,
        machine_name: m.friendly_name || m.device_id,
        location: m.location || 'N/A',
        total_washes: 0,
        total_revenue: 0,
        successful: 0,
        failed: 0,
      };
    }

    for (const t of txns) {
      const devId = t.device_id;
      if (!machineStats[devId]) {
        machineStats[devId] = {
          device_id: devId,
          machine_name: t.machine_name || devId,
          location: 'N/A',
          total_washes: 0,
          total_revenue: 0,
          successful: 0,
          failed: 0,
        };
      }

      machineStats[devId].total_washes += 1;
      if ((t.status || '').toUpperCase() === 'SUCCESS') {
        machineStats[devId].total_revenue += Number(t.amount) || 0;
        machineStats[devId].successful += 1;
      } else {
        machineStats[devId].failed += 1;
      }
    }

    const result = Object.values(machineStats).map((ms) => {
      const successRate = ms.total_washes > 0 ? ((ms.successful / ms.total_washes) * 100).toFixed(1) : '100.0';
      return {
        device_id: ms.device_id,
        machine_name: ms.machine_name,
        location: ms.location,
        total_washes: ms.total_washes,
        total_revenue: ms.total_revenue,
        success_rate: `${successRate}%`,
      };
    });

    return res.json({ machines: result });
  } catch (err) {
    console.error('getMachinesAnalytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch machines analytics' });
  }
};

/**
 * Export CSV analytics report from real database records
 */
const exportAnalytics = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;

    // Fetch Organization Info
    let orgName = 'Laundryziva Organization';
    if (orgId) {
      const orgRecord = await get(`SELECT name FROM organizations WHERE id = ?`, [orgId]);
      if (orgRecord?.name) orgName = orgRecord.name;
    }

    const startDate = req.query.start_date || req.query.startDate;
    const endDate = req.query.end_date || req.query.endDate;
    const statusParam = req.query.status;
    const deviceIdParam = req.query.device_id || req.query.deviceId;

    // Fetch Transactions
    let txnSql = `SELECT * FROM transactions`;
    const params = [];
    const conditions = [];

    if (orgId) {
      conditions.push(`(org_id = ? OR org_id IS NULL)`);
      params.push(orgId);
    }

    if (startDate) {
      const formattedStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
      conditions.push(`created_at >= ?`);
      params.push(formattedStart);
    }

    if (endDate) {
      const formattedEnd = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      conditions.push(`created_at <= ?`);
      params.push(formattedEnd);
    }

    if (statusParam && statusParam.toUpperCase() !== 'ALL') {
      const upperStatus = statusParam.toUpperCase() === 'SUCCESSFUL' ? 'SUCCESS' : statusParam.toUpperCase();
      conditions.push(`UPPER(status) = UPPER(?)`);
      params.push(upperStatus);
    }

    if (deviceIdParam && deviceIdParam.toUpperCase() !== 'ALL') {
      conditions.push(`(device_id = ? OR machine_name LIKE ?)`);
      params.push(deviceIdParam);
      params.push(`%${deviceIdParam}%`);
    }

    if (conditions.length > 0) {
      txnSql += ` WHERE ` + conditions.join(' AND ');
    }

    txnSql += ` ORDER BY created_at DESC`;

    const txns = await all(txnSql, params);

    // Fetch Machines
    let machSql = `SELECT * FROM machines`;
    const machParams = [];
    if (orgId) {
      machSql += ` WHERE (org_id = ? OR org_id IS NULL)`;
      machParams.push(orgId);
    }
    const machines = await all(machSql, machParams);

    // Calculate Summary Totals
    let totalRevenue = 0;
    let successfulCount = 0;
    let failedCount = 0;

    for (const t of txns) {
      if ((t.status || '').toUpperCase() === 'SUCCESS') {
        totalRevenue += Number(t.amount) || 0;
        successfulCount += 1;
      } else {
        failedCount += 1;
      }
    }

    const totalCount = successfulCount + failedCount;
    const successRateStr = totalCount > 0 ? `${((successfulCount / totalCount) * 100).toFixed(1)}%` : '100.0%';

    // Build CSV Output
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines = [];

    // 1. Report Header
    lines.push(`${escapeCsv('Report')},${escapeCsv('Organization Analytics Summary Report')}`);
    lines.push(`${escapeCsv('Organization Name')},${escapeCsv(orgName)}`);
    lines.push(`${escapeCsv('Generated Date')},${escapeCsv(new Date().toISOString())}`);
    lines.push(`${escapeCsv('Total Revenue (INR)')},${escapeCsv(totalRevenue.toFixed(2))}`);
    lines.push(`${escapeCsv('Total Washes')},${escapeCsv(totalCount)}`);
    lines.push(`${escapeCsv('Successful Washes')},${escapeCsv(successfulCount)}`);
    lines.push(`${escapeCsv('Failed Payments')},${escapeCsv(failedCount)}`);
    lines.push(`${escapeCsv('Success Rate')},${escapeCsv(successRateStr)}`);
    lines.push(''); // Blank line

    // 2. Transaction Listing Table
    lines.push(`${escapeCsv('--- TRANSACTION DETAILS ---')}`);
    lines.push([
      escapeCsv('Transaction ID'),
      escapeCsv('Date/Time'),
      escapeCsv('Machine Name'),
      escapeCsv('Device ID'),
      escapeCsv('Amount (INR)'),
      escapeCsv('Status'),
      escapeCsv('Razorpay ID')
    ].join(','));

    if (txns.length === 0) {
      lines.push(`${escapeCsv('No transaction records found for this organization')}`);
    } else {
      for (const t of txns) {
        lines.push([
          escapeCsv(t.txn_id),
          escapeCsv(t.created_at),
          escapeCsv(t.machine_name),
          escapeCsv(t.device_id),
          escapeCsv(Number(t.amount || 0).toFixed(2)),
          escapeCsv(t.status),
          escapeCsv(t.razorpay_id || 'N/A')
        ].join(','));
      }
    }

    lines.push(''); // Blank line

    // 3. Machine Performance Table
    lines.push(`${escapeCsv('--- MACHINE PERFORMANCE ---')}`);
    lines.push([
      escapeCsv('Device ID'),
      escapeCsv('Machine Name'),
      escapeCsv('Location'),
      escapeCsv('Total Washes'),
      escapeCsv('Total Revenue (INR)')
    ].join(','));

    const machineMap = {};
    for (const m of machines) {
      machineMap[m.device_id] = {
        device_id: m.device_id,
        name: m.friendly_name || m.device_id,
        location: m.location || 'N/A',
        washes: 0,
        revenue: 0
      };
    }

    for (const t of txns) {
      const devId = t.device_id;
      if (!machineMap[devId]) {
        machineMap[devId] = {
          device_id: devId,
          name: t.machine_name || devId,
          location: 'N/A',
          washes: 0,
          revenue: 0
        };
      }
      machineMap[devId].washes += 1;
      if ((t.status || '').toUpperCase() === 'SUCCESS') {
        machineMap[devId].revenue += Number(t.amount) || 0;
      }
    }

    const machineList = Object.values(machineMap);
    if (machineList.length === 0) {
      lines.push(`${escapeCsv('No machine records found for this organization')}`);
    } else {
      for (const m of machineList) {
        lines.push([
          escapeCsv(m.device_id),
          escapeCsv(m.name),
          escapeCsv(m.location),
          escapeCsv(m.washes),
          escapeCsv(m.revenue.toFixed(2))
        ].join(','));
      }
    }

    const csvContent = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics_report.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('exportAnalytics error:', err);
    return res.status(500).json({ error: 'Failed to export analytics report' });
  }
};

module.exports = {
  getSummary,
  getDaily,
  getMachinesAnalytics,
  exportAnalytics,
};
