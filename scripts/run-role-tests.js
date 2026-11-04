const { execSync } = require('child_process');
const fs = require('fs');

const testFile = process.argv[2] || '';
const roleLabel = process.argv[3] || 'Backend Tests';

const cmd = testFile ? `node --test --test-reporter=spec ${testFile}` : 'npm test';

let out = '';
let exitCode = 0;
try {
  out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (err) {
  out = (err.stdout || '') + '\n' + (err.stderr || '');
  exitCode = err.status || 1;
}

console.log('\n=======================================================');
console.log(`      ALLZIVA BACKEND TEST - ${roleLabel.toUpperCase()}   `);
console.log('=======================================================\n');
console.log(out);

const lines = out.split('\n');
let md = `### 📋 Backend Test Execution - ${roleLabel}\n\n`;
md += '| Status | Test Case | Duration |\n';
md += '| :---: | :--- | :---: |\n';

let passed = 0;
let failed = 0;

lines.forEach((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('✔')) {
    passed++;
    // Extract title and duration (e.g., "✔ TC_SA_BE_01: ... (2.69ms)")
    const match = trimmed.match(/^✔\s*(.*?)(?:\s*\((.*?)\))?$/);
    const title = match ? match[1] : trimmed.replace('✔', '').trim();
    const dur = match && match[2] ? match[2] : 'N/A';
    md += `| ✅ PASS | ${title} | ${dur} |\n`;
  } else if (trimmed.startsWith('✖')) {
    failed++;
    const match = trimmed.match(/^✖\s*(.*?)(?:\s*\((.*?)\))?$/);
    const title = match ? match[1] : trimmed.replace('✖', '').trim();
    const dur = match && match[2] ? match[2] : 'N/A';
    md += `| ❌ FAIL | ${title} | ${dur} |\n`;
  }
});

md += `\n**Summary:** ${passed} / ${passed + failed} tests passed successfully.\n\n`;

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  try {
    fs.appendFileSync(summaryFile, md, 'utf8');
  } catch (err) {
    console.error('Failed to write GITHUB_STEP_SUMMARY:', err);
  }
}

if (exitCode !== 0 || failed > 0) {
  process.exit(1);
}
