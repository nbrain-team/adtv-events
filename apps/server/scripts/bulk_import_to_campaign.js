// Usage: node apps/server/scripts/bulk_import_to_campaign.js <csvPath> <campaignId>
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
    const txt = await res.text().catch(()=> '');
    throw new Error(`POST ${url} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

function mapRowToContact(r) {
  const name = r.name || r.Name || '-';
  return {
    id: Math.random().toString(36).slice(2),
    name,
    company: r.company || r.Company || '',
    email: r.Email || r.email || '',
    phone: r.Phone || r.phone || '',
    city: r.city || r.City || '',
    state: r.state || r.State || '',
    url: r.url || r.URL || r.agent_website || '',
    status: 'No Activity',
    stageId: null,
    raw: r,
  };
}

async function main() {
  const csvPath = process.argv[2];
  const campaignId = process.argv[3];
  if (!csvPath || !campaignId) {
    console.error('Usage: node apps/server/scripts/bulk_import_to_campaign.js <csvPath> <campaignId>');
    process.exit(1);
  }
  const api = process.env.API_URL || 'http://localhost:4000';
  const text = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(text, { header: true });
  const rows = (parsed.data || []).filter(Boolean);
  const contacts = rows.map(mapRowToContact);
  const chunkSize = 500;
  let total = 0;
  for (let i = 0; i < contacts.length; i += chunkSize) {
    const chunk = contacts.slice(i, i + chunkSize);
    await postJson(`${api}/api/campaigns/${campaignId}/contacts/bulk`, { contacts: chunk });
    total += chunk.length;
  }
  console.log(`Imported ${total} contacts to campaign ${campaignId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });



