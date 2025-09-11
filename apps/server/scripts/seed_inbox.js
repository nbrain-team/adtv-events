// Usage: node apps/server/scripts/seed_inbox.js <campaignId> [--limit N]
// Uses API_URL env (defaults to http://localhost:4000)

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`GET ${url} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

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

async function postForm(url, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`POST ${url} failed: ${res.status} ${txt}`);
  }
  return res.text();
}

function last10Digits(phone) {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

function pick(arr, n) {
  const copy = [...arr];
  const result = [];
  while (copy.length && result.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

async function main() {
  const campaignId = process.argv[2];
  const limitArgIdx = process.argv.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? Number(process.argv[limitArgIdx + 1]) : undefined;
  if (!campaignId) {
    console.error('Usage: node apps/server/scripts/seed_inbox.js <campaignId> [--limit N]');
    process.exit(1);
  }
  const api = process.env.API_URL || 'http://localhost:4000';

  const contacts = await getJson(`${api}/api/campaigns/${campaignId}/contacts`);
  const smsContacts = contacts.filter((c) => last10Digits(c.phone).length === 10);
  const emailContacts = contacts.filter((c) => !c.phone && c.email);

  const smsSample = pick(smsContacts, Math.min(6, smsContacts.length));
  const emailSample = pick(emailContacts, Math.min(4, emailContacts.length));

  // Seed SMS: create an outbound, then simulate inbound via Twilio webhook
  const smsOutboundTemplates = [
    (n) => `Hi ${n}, quick question about ADTV—are you available to chat?`,
    (n) => `Hello ${n}, following up on our event invite. Interested?`,
    (n) => `${n}, this is ADTV. Can we send you more details?`,
  ];
  const smsInboundTemplates = [
    'Yes, tell me more',
    'No thanks',
    'Can we talk later today?',
    'STOP',
    'Who is this?',
    'Sure! What time?',
  ];

  let smsOut = 0, smsIn = 0;
  for (const c of smsSample) {
    const name = (c.name || '').split(' ')[0] || 'there';
    const outText = smsOutboundTemplates[Math.floor(Math.random()*smsOutboundTemplates.length)](name);
    await postJson(`${api}/api/messages`, { contactId: c.id, text: outText, direction: 'out' });
    smsOut++;
    const inbound = smsInboundTemplates[Math.floor(Math.random()*smsInboundTemplates.length)];
    // Simulate Twilio inbound
    await postForm(`${api}/api/twilio/inbound-sms`, { From: c.phone || '', To: '+10000000000', Body: inbound });
    smsIn++;
  }

  // Fetch conversations to locate email-channel convos
  const convos = await getJson(`${api}/api/conversations`);
  const emailConvoByContact = new Map();
  for (const cv of convos) {
    if (cv.channel === 'email' && cv.contactId) emailConvoByContact.set(cv.contactId, cv.id);
  }

  // Seed Email: create out and in messages directly on email conversations
  const emailOutboundTemplates = [
    (n) => `Hello ${n}, thanks for your interest in ADTV. Can we schedule a quick call?`,
    (n) => `${n}, following up on our event details—happy to answer questions.`,
  ];
  const emailInboundTemplates = [
    'Thanks—what time is the event?',
    'Can you share agenda details?',
    'Not interested right now.',
  ];

  let emailOut = 0, emailIn = 0;
  for (const c of emailSample) {
    const convoId = emailConvoByContact.get(c.id);
    if (!convoId) continue; // skip if no email convo exists
    const name = (c.name || '').split(' ')[0] || 'there';
    const outText = emailOutboundTemplates[Math.floor(Math.random()*emailOutboundTemplates.length)](name);
    await postJson(`${api}/api/messages`, { conversationId: convoId, text: outText, direction: 'out' });
    emailOut++;
    const inbound = emailInboundTemplates[Math.floor(Math.random()*emailInboundTemplates.length)];
    await postJson(`${api}/api/messages`, { conversationId: convoId, text: inbound, direction: 'in' });
    emailIn++;
  }

  console.log(`Seeded SMS: out=${smsOut}, in=${smsIn}; Email: out=${emailOut}, in=${emailIn}`);
}

main().catch((e) => { console.error(e); process.exit(1); });


