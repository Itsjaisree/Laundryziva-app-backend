// Run with: node --test test_payouts.js
const test = require('node:test');
const assert = require('node:assert');
const { rangeBounds, summarize, buildPayoutCsv, istDayText } = require('./services/payoutService');

const row = (over = {}) => ({ transaction_ref: 'UTR1', org_id: 'ORG_A', amount: 1000, period_from: '2026-09-01', period_to: '2026-09-15',
  transferred_at: '2026-09-17T05:00:00.000Z', status: 'Paid', note: null, ...over });

test('a date range becomes India-time bounds, inclusive of the last day', () => {
  const b = rangeBounds('2026-10-05', '2026-10-05');
  assert.strictEqual(b.start, '2026-10-04T18:30:00.000Z');   // 5 Oct 00:00 IST
  assert.strictEqual(b.end, '2026-10-05T18:30:00.000Z');     // 6 Oct 00:00 IST
});
test('no range means no bounds', () => assert.deepStrictEqual(rangeBounds(undefined, undefined), { start: null, end: null }));
test('bad or reversed dates are refused', () => {
  assert.ok(rangeBounds('05-10-2026', '2026-10-06').error);
  assert.ok(rangeBounds('2026-10-07', '2026-10-06').error);
});
test('summary totals the amounts and finds the last paid transfer', () => {
  const s = summarize([row({ amount: 100.5 }), row({ amount: 200.25, transferred_at: '2026-10-02T05:00:00.000Z' }), row({ amount: 50, status: 'Pending', transferred_at: '2026-11-01T05:00:00.000Z' })]);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.total, 350.75);
  assert.strictEqual(s.last_transferred_at, '2026-10-02T05:00:00.000Z');
});
test('summary of nothing', () => assert.deepStrictEqual(summarize([]), { count: 0, total: 0, last_transferred_at: null }));
test('transfer time is shown as the India day', () => {
  assert.strictEqual(istDayText('2026-09-17T20:00:00.000Z'), '2026-09-18');   // 01:30 IST next day
  assert.strictEqual(istDayText(null), '');
});
test('csv has the header, one row per payout and the total', () => {
  const csv = buildPayoutCsv([row({ note: 'said "ok", twice' })], { orgNames: { ORG_A: 'Laundryziva' }, from: '2026-09-01', to: '2026-09-30', generatedAt: new Date('2026-10-08T00:00:00Z') });
  const lines = csv.trim().split('\n');
  assert.strictEqual(lines[0], '"Report","Payout Report"');
  assert.strictEqual(lines[1], '"Transferred between","2026-09-01 to 2026-09-30"');
  assert.strictEqual(lines[4], '"Transaction number","Organization","Amount (INR)","Period from","Period to","Transferred on (IST)","Status","Note"');
  assert.strictEqual(lines[5], '"UTR1","Laundryziva","1000.00","2026-09-01","2026-09-15","2026-09-17","Paid","said ""ok"", twice"');
  assert.strictEqual(lines[lines.length - 1], '"Total (INR)","","1000.00"');
});
test('csv of no payouts still has headers and a zero total', () => {
  const csv = buildPayoutCsv([], { generatedAt: new Date('2026-10-08T00:00:00Z') });
  assert.ok(csv.includes('"Transaction number"'));
  assert.ok(csv.includes('"Total (INR)","","0.00"'));
  assert.ok(csv.includes('All time'));
});
