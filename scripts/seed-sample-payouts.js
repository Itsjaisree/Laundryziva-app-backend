// One-off: adds SAMPLE payouts for the Laundryziva organization so the Payouts screen and the Payout report have something
// to show. Safe to run twice (it skips ids that exist). Remove them later with:
//   DELETE FROM payouts WHERE id LIKE 'PAYOUT_SAMPLE_%';
//
// Usage (on the app server, after the payouts table exists):  node scripts/seed-sample-payouts.js
const { run, get } = require('../config/db');

const ORG_ID = 'ORG_1637D16F';
// Fortnightly payouts, each transferred two days after its period ends (India time, 11:20 AM)
const SAMPLES = [
  { n: 1, ref: 'UTR2608020041', amount: 10280.0, from: '2026-07-16', to: '2026-07-31', on: '2026-08-02' },
  { n: 2, ref: 'UTR2608170052', amount: 12450.0, from: '2026-08-01', to: '2026-08-15', on: '2026-08-17' },
  { n: 3, ref: 'UTR2609020063', amount: 11800.0, from: '2026-08-16', to: '2026-08-31', on: '2026-09-02' },
  { n: 4, ref: 'UTR2609170074', amount: 11640.0, from: '2026-09-01', to: '2026-09-15', on: '2026-09-17' },
  { n: 5, ref: 'UTR2610020085', amount: 12610.0, from: '2026-09-16', to: '2026-09-30', on: '2026-10-02' },
];
const at1120IST = (day) => new Date(Date.parse(`${day}T11:20:00Z`) - 5.5 * 60 * 60 * 1000).toISOString();

(async () => {
  for (const s of SAMPLES) {
    const id = `PAYOUT_SAMPLE_${String(s.n).padStart(3, '0')}`;
    if (await get(`SELECT id FROM payouts WHERE id = ?`, [id])) {
      console.log('skip (exists):', id);
      continue;
    }
    await run(
      `INSERT INTO payouts (id, org_id, transaction_ref, amount, period_from, period_to, transferred_at, status, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Paid', 'Sample data', NULL, ?)`,
      [id, ORG_ID, s.ref, s.amount, s.from, s.to, at1120IST(s.on), new Date().toISOString()]
    );
    console.log('added:', id, s.ref, s.amount, s.from, '->', s.to, 'transferred', s.on);
  }
  process.exit(0);
})().catch((e) => { console.error('seed-sample-payouts failed:', e.message); process.exit(1); });
