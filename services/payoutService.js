// Payout figures and the payout report CSV. Pure functions, so they can be tested without a database.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-03" (a day in India time) -> the UTC instant that day starts, as an ISO string.
const istDayStartIso = (dateStr) => new Date(Date.parse(`${dateStr}T00:00:00Z`) - IST_OFFSET_MS).toISOString();
const addDays = (dateStr, n) => new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Optional from/to days (India time, inclusive) -> bounds on the transfer time, or an error text.
const rangeBounds = (from, to) => {
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return { error: 'from and to must be YYYY-MM-DD dates' };
  if (from && to && from > to) return { error: 'from must not be after to' };
  return { start: from ? istDayStartIso(from) : null, end: to ? istDayStartIso(addDays(to, 1)) : null };
};

const istDayText = (iso) => (iso ? new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10) : '');

const summarize = (rows) => {
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const paid = rows.filter((r) => (r.status || 'Paid') === 'Paid');
  return {
    count: rows.length,
    total: Math.round(total * 100) / 100,
    last_transferred_at: paid.length ? paid.map((r) => r.transferred_at).sort().slice(-1)[0] : null,
  };
};

const escapeCsv = (val) => {
  if (val === null || val === undefined) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
};

/**
 * CSV of payouts: a short header, then one row per payout, then the total.
 * rows: payouts (transaction_ref, amount, period_from, period_to, transferred_at, status, note, org_id)
 */
const buildPayoutCsv = (rows, { orgNames = {}, from = null, to = null, generatedAt = new Date() } = {}) => {
  const lines = [];
  lines.push(`${escapeCsv('Report')},${escapeCsv('Payout Report')}`);
  lines.push(`${escapeCsv('Transferred between')},${escapeCsv(from || to ? `${from || 'start'} to ${to || 'today'}` : 'All time')}`);
  lines.push(`${escapeCsv('Generated')},${escapeCsv(generatedAt.toISOString())}`);
  lines.push('');
  lines.push(['Transaction number', 'Organization', 'Amount (INR)', 'Period from', 'Period to', 'Transferred on (IST)', 'Status', 'Note'].map(escapeCsv).join(','));
  for (const r of rows) {
    lines.push([
      r.transaction_ref,
      orgNames[r.org_id] || r.org_id,
      (Number(r.amount) || 0).toFixed(2),
      r.period_from,
      r.period_to,
      istDayText(r.transferred_at),
      r.status || 'Paid',
      r.note || '',
    ].map(escapeCsv).join(','));
  }
  lines.push('');
  lines.push(`${escapeCsv('Total (INR)')},${escapeCsv('')},${escapeCsv(summarize(rows).total.toFixed(2))}`);
  return lines.join('\n') + '\n';
};

module.exports = { rangeBounds, summarize, buildPayoutCsv, istDayText, IST_OFFSET_MS };
