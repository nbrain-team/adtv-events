// Usage: node apps/server/scripts/import_boston_with_status.js <csvPath> <campaignId> [--limit N]
// Optional: set API_URL env (defaults to http://localhost:4000)

const fs = require('fs');
const Papa = require('papaparse');

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST ${url} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

function pickCompany(r) {
  // Handle duplicate header names and variants
  return (
    r.company || r.Company || r['company_1'] || r['Company 1'] || r['company2'] || r['Company2'] || ''
  );
}

function pickUrl(r) {
  return r.agent_website || r.URL || r.url || '';
}

function buildName(r) {
  const first = r.first_name || r.First || r.first || '';
  const last = r.last_name || r.Last || r.last || '';
  const joined = `${String(first).trim()} ${String(last).trim()}`.trim();
  if (joined) return joined;
  return r.Name || r.name || '-';
}

function mapRow(r) {
  return {
    name: buildName(r),
    company: pickCompany(r),
    email: r.Email || r.email || '',
    phone: r.Phone || r.phone || '',
    city: r.city || r.City || '',
    state: r.state || r.State || '',
    url: pickUrl(r),
    raw: r,
  };
}

// Realistic weighted status distribution
const STATUS_WEIGHTS = [
  ['No Activity', 50],
  ['Needs BDR', 20],
  ['Received RSVP', 10],
  ['Showed Up To Event', 5],
  ['Post Event #1', 5],
  ['Post Event #2', 4],
  ['Post Event #3', 3],
  ['Received Agreement', 2],
  ['Signed Agreement', 1],
];

const STATUS_TOTAL = STATUS_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

function pickStatus() {
  let r = Math.random() * STATUS_TOTAL;
  for (const [status, weight] of STATUS_WEIGHTS) {
    if ((r -= weight) <= 0) return status;
  }
  return 'No Activity';
}

async function main() {
  const csvPath = process.argv[2] || '/Users/dannydemichele/adtv-event-automation/boston.csv';
  const campaignId = process.argv[3];
  const limitArgIdx = process.argv.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? Number(process.argv[limitArgIdx + 1]) : undefined;

  if (!csvPath || !campaignId) {
    console.error('Usage: node apps/server/scripts/import_boston_with_status.js <csvPath> <campaignId> [--limit N]');
    process.exit(1);
  }

  const api = process.env.API_URL || 'http://localhost:4000';

  const text = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(text, { header: true });
  const rows = (parsed.data || []).filter(Boolean);
  const sliced = typeof limit === 'number' && !Number.isNaN(limit) ? rows.slice(0, limit) : rows;

  const contacts = sliced.map((r) => {
    const base = mapRow(r);
    return {
      ...base,
      status: pickStatus(),
      stageId: null,
    };
  });

  const chunkSize = 500;
  let total = 0;
  let statusCounts = new Map();
  for (let i = 0; i < contacts.length; i += chunkSize) {
    const chunk = contacts.slice(i, i + chunkSize);
    await postJson(`${api}/api/campaigns/${campaignId}/contacts/bulk`, { contacts: chunk });
    total += chunk.length;
    // tally
    for (const c of chunk) {
      statusCounts.set(c.status, (statusCounts.get(c.status) || 0) + 1);
    }
  }

  // Log a summary
  console.log(`Imported ${total} contacts to campaign ${campaignId}`);
  const sorted = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sorted) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


