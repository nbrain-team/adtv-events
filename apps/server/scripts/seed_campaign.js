const fs = require('fs');
const Papa = require('papaparse');

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

async function main() {
  const csvPath = process.argv[2] || '/Users/dannydemichele/adtv-event-automation/NEW-ADTV-Homes.com 8_18 - lessgo.csv';
  const api = process.env.API_URL || 'http://localhost:4000';

  const campaign = await postJson(`${api}/api/campaigns`, {
    name: 'CSV Seeded Roadshow',
    ownerName: 'Demo Owner',
    ownerEmail: 'owner@example.com',
    eventType: 'in_person',
    eventDate: new Date().toISOString(),
    city: 'Boston',
    state: 'MA',
    status: 'draft',
  });

  const text = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(text, { header: true });
  const rows = (parsed.data || []).filter(Boolean);

  const statuses = [
    'No Activity',
    'Needs BDR',
    'Received RSVP',
    'Showed Up To Event',
    'Post Event #1',
    'Post Event #2',
    'Post Event #3',
    'Received Agreement',
    'Signed Agreement',
  ];

  const contacts = rows.slice(0, 50).map((r, i) => ({
    name: r.Name || r.name || `Contact ${i + 1}`,
    company: r.Company || r.company || '',
    email: r.Email || r.email || '',
    phone: r.Phone || r.phone || '',
    city: r.City || r.city || '',
    state: r.State || r.state || '',
    url: r.URL || r.url || '',
    status: statuses[i % statuses.length],
    stageId: null,
    raw: r,
  }));

  const bulk = await postJson(`${api}/api/campaigns/${campaign.id}/contacts/bulk`, { contacts });

  console.log(`Created campaign ${campaign.id} with ${contacts.length} contacts (bulk: ${bulk.count}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
