import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const prisma = new PrismaClient();
// Outbound SMS via Twilio
app.post('/api/sms/send', async (req, res) => {
  try {
    const candidate: any = (typeof (req as any).body === 'string'
      ? (()=> { try { return JSON.parse((req as any).body || '{}'); } catch { return {}; } })()
      : ((req as any).body && Object.keys((req as any).body||{}).length ? (req as any).body : (req as any).query)) || {};
    const body = z.object({ to: z.string().optional(), text: z.string().min(1), contactId: z.string().optional() }).parse(candidate);
    let toNumber = body.to || '';
    if (!toNumber && body.contactId) {
      const contact = await prisma.contact.findUnique({ where: { id: body.contactId } });
      toNumber = contact?.phone || '';
    }
    // normalize E.164 best-effort for US numbers
    if (toNumber && !/^\+\d+$/i.test(toNumber)) {
      const digits = toNumber.replace(/\D/g, '');
      if (digits.length === 10) toNumber = `+1${digits}`;
      else if (digits.length === 11 && digits.startsWith('1')) toNumber = `+${digits}`;
    }
    if (!toNumber) {
      return res.status(400).json({ error: 'Missing destination number' });
    }
    // Ensure conversation exists and log message regardless of Twilio status (so Inbox shows activity)
    let convoId: string | null = null;
    if (body.contactId) {
      let convo = await prisma.conversation.findFirst({ where: { contactId: body.contactId, channel: 'sms' } });
      if (!convo) convo = await prisma.conversation.create({ data: { contactId: body.contactId, channel: 'sms' } });
      convoId = convo.id;
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_MESSAGING_SERVICE_SID } = process.env as any;
    let sent = false;
    let sid: string | undefined;
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_FROM_NUMBER || TWILIO_MESSAGING_SERVICE_SID)) {
      try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const msg = await client.messages.create({
          to: toNumber,
          from: TWILIO_MESSAGING_SERVICE_SID ? undefined : TWILIO_FROM_NUMBER,
          messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID || undefined,
          body: body.text,
        });
        sent = true;
        sid = msg.sid;
      } catch (e) {
        // fall through to record locally
      }
    }

    if (convoId) {
      await prisma.message.create({ data: { conversationId: convoId, direction: 'out', text: body.text } });
    }

    res.json({ ok: true, sent, sid, simulated: !sent });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'send error' });
  }
});

// Check Twilio message status
app.get('/api/sms/status/:sid', async (req, res) => {
  try {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env as any;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return res.status(400).json({ error: 'Missing Twilio env' });
    }
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const m = await client.messages(req.params.sid).fetch();
    res.json({ sid: m.sid, status: m.status, to: m.to, from: m.from, errorCode: m.errorCode, errorMessage: m.errorMessage });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'status error' });
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Templates
app.get('/api/templates', async (_req, res) => {
  const list = await prisma.template.findMany({ include: { nodes: true, edges: true } });
  res.json(list);
});

app.post('/api/templates', async (req, res) => {
  const body = z.object({ name: z.string(), graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }) }).parse(req.body);
  const created = await prisma.template.create({ data: { name: body.name, nodes: { create: body.graph.nodes.map((n: any)=> ({ key: n.id, type: n.type, name: n.name, configJson: n.config?JSON.stringify(n.config):null })) }, edges: { create: body.graph.edges.map((e: any)=> ({ fromKey: e.from, toKey: e.to, conditionJson: e.condition?JSON.stringify(e.condition):null })) } } });
  res.json(created);
});

app.get('/api/templates/:id', async (req, res) => {
  const tpl = await prisma.template.findUnique({ where: { id: req.params.id }, include: { nodes: true, edges: true } });
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  res.json(tpl);
});

app.put('/api/templates/:id/graph', async (req, res) => {
  const body = z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }).parse(req.body);
  // Replace nodes/edges transactionally
  await prisma.$transaction([
    prisma.node.deleteMany({ where: { templateId: req.params.id } }),
    prisma.edge.deleteMany({ where: { templateId: req.params.id } }),
    prisma.node.createMany({ data: body.nodes.map((n: any)=> ({ id: n._id || undefined, templateId: req.params.id, key: n.id, type: n.type, name: n.name, configJson: n.config?JSON.stringify(n.config):null, posX: n.pos?.x ?? null, posY: n.pos?.y ?? null })) }),
    prisma.edge.createMany({ data: body.edges.map((e: any)=> ({ id: e._id || undefined, templateId: req.params.id, fromKey: e.from, toKey: e.to, conditionJson: e.condition?JSON.stringify(e.condition):null })) })
  ]);
  const tpl = await prisma.template.findUnique({ where: { id: req.params.id }, include: { nodes: true, edges: true } });
  res.json(tpl);
});

// Campaigns
app.get('/api/campaigns', async (_req, res) => {
  const list = await prisma.campaign.findMany({ include: { contacts: true, template: true } });
  res.json(list);
});

app.post('/api/campaigns', async (req, res) => {
  const body = z.object({
    name: z.string(), ownerName: z.string(), ownerEmail: z.string(), ownerPhone: z.string().optional(),
    city: z.string().optional(), state: z.string().optional(), videoLink: z.string().optional(), eventLink: z.string().optional(),
    eventType: z.string(), eventDate: z.string(), launchDate: z.string().optional(),
    hotelName: z.string().optional(), hotelAddress: z.string().optional(), calendlyLink: z.string().optional(),
    templateId: z.string().optional(), status: z.string().optional(), senderUserId: z.string().optional()
  }).parse(req.body);
  const created = await prisma.campaign.create({ data: {
    name: body.name, ownerName: body.ownerName, ownerEmail: body.ownerEmail, ownerPhone: body.ownerPhone,
    city: body.city, state: body.state, videoLink: body.videoLink, eventLink: body.eventLink,
    eventType: body.eventType, eventDate: new Date(body.eventDate), launchDate: body.launchDate ? new Date(body.launchDate) : undefined,
    hotelName: body.hotelName, hotelAddress: body.hotelAddress, calendlyLink: body.calendlyLink, senderUserId: body.senderUserId,
    templateId: body.templateId, status: body.status || 'draft'
  } });
  // If a template is provided, clone its nodes/edges to campaign graph
  if (body.templateId) {
    const [tplNodes, tplEdges] = await Promise.all([
      prisma.node.findMany({ where: { templateId: body.templateId } }),
      prisma.edge.findMany({ where: { templateId: body.templateId } })
    ]);
    if (tplNodes.length > 0) {
      await prisma.campaignNode.createMany({ data: tplNodes.map((n) => ({
        campaignId: created.id,
        key: n.key,
        type: n.type,
        name: n.name,
        configJson: n.configJson || null,
        posX: n.posX ?? null,
        posY: n.posY ?? null,
      })) });
    }
    if (tplEdges.length > 0) {
      await prisma.campaignEdge.createMany({ data: tplEdges.map((e) => ({
        campaignId: created.id,
        fromKey: e.fromKey,
        toKey: e.toKey,
        conditionJson: e.conditionJson || null,
      })) });
    }
  }
  res.json(created);
});

app.patch('/api/campaigns/:id', async (req, res) => {
  const body = z.object({ name: z.string().optional(), ownerName: z.string().optional(), ownerEmail: z.string().optional(), ownerPhone: z.string().optional(), city: z.string().optional(), state: z.string().optional(), videoLink: z.string().optional(), eventLink: z.string().optional(), eventType: z.string().optional(), eventDate: z.string().optional(), launchDate: z.string().optional(), hotelName: z.string().optional(), hotelAddress: z.string().optional(), calendlyLink: z.string().optional(), status: z.string().optional(), templateId: z.string().optional() }).partial().parse(req.body);
  const updated = await prisma.campaign.update({ where: { id: req.params.id }, data: { ...body, eventDate: body.eventDate ? new Date(body.eventDate) : undefined, launchDate: body.launchDate ? new Date(body.launchDate) : undefined } });
  res.json(updated);
});

// Contacts
app.get('/api/campaigns/:id/contacts', async (req, res) => {
  const contacts = await prisma.contact.findMany({ where: { campaignId: req.params.id } });
  res.json(contacts);
});

app.post('/api/campaigns/:id/contacts/bulk', async (req, res) => {
  const body = z.object({ contacts: z.array(z.any()) }).parse(req.body);
  const created = await prisma.$transaction(body.contacts.map((c: any) => prisma.contact.create({ data: { campaignId: req.params.id, name: c.name, company: c.company, email: c.email, phone: c.phone, city: c.city, state: c.state, url: c.url, status: c.status||'No Activity', stageKey: c.stageId||null, rawJson: c.raw?JSON.stringify(c.raw):null } })));
  // Ensure a conversation exists for each contact (prefer sms if phone present)
  for (const ct of created) {
    const existing = await prisma.conversation.findFirst({ where: { contactId: ct.id } });
    if (!existing) {
      const channel = ct.phone ? 'sms' : 'email';
      await prisma.conversation.create({ data: { contactId: ct.id, channel } });
    }
  }
  res.json({ count: created.length });
});

app.post('/api/campaigns/:id/contacts', async (req, res) => {
  const c = z.object({ name: z.string(), email: z.string().optional(), phone: z.string().optional(), status: z.string().optional(), stageId: z.string().optional(), raw: z.any().optional() }).parse(req.body);
  const created = await prisma.contact.create({ data: { campaignId: req.params.id, name: c.name, email: c.email, phone: c.phone, status: c.status||'No Activity', stageKey: c.stageId||null, rawJson: c.raw?JSON.stringify(c.raw):null } });
  // Ensure conversation exists
  const existing = await prisma.conversation.findFirst({ where: { contactId: created.id } });
  if (!existing) {
    await prisma.conversation.create({ data: { contactId: created.id, channel: created.phone ? 'sms' : 'email' } });
  }
  res.json(created);
});

// Update contact
app.patch('/api/contacts/:id', async (req, res) => {
  try {
    const body = z.object({
      name: z.string().optional(),
      company: z.string().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      status: z.string().optional(),
      stageId: z.string().nullable().optional(),
      raw: z.any().optional(),
    }).parse(req.body);
    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: body.name as any,
        company: body.company as any,
        email: (body.email ?? undefined) as any,
        phone: (body.phone ?? undefined) as any,
        city: (body.city ?? undefined) as any,
        state: (body.state ?? undefined) as any,
        url: (body.url ?? undefined) as any,
        status: body.status as any,
        stageKey: (body.stageId ?? undefined) as any,
        rawJson: body.raw ? JSON.stringify(body.raw) : undefined,
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'update error' });
  }
});

// Campaign graph
app.get('/api/campaigns/:id/graph', async (req, res) => {
  const [nodes, edges] = await Promise.all([
    prisma.campaignNode.findMany({ where: { campaignId: req.params.id } }),
    prisma.campaignEdge.findMany({ where: { campaignId: req.params.id } }),
  ]);
  res.json({
    nodes: nodes.map((n) => ({ id: n.key, type: n.type, name: n.name, config: n.configJson ? JSON.parse(n.configJson) : undefined, pos: (n.posX!=null && n.posY!=null) ? { x: n.posX, y: n.posY } : undefined })),
    edges: edges.map((e) => ({ from: e.fromKey, to: e.toKey, condition: e.conditionJson ? JSON.parse(e.conditionJson) : undefined })),
  });
});

// Inbox (mock endpoints)
app.get('/api/conversations', async (_req, res) => {
  const convos = await prisma.conversation.findMany({ include: { messages: true, contact: true } });
  res.json(convos);
});

app.post('/api/messages', async (req, res) => {
  const m = z.object({ conversationId: z.string().optional(), contactId: z.string().optional(), text: z.string(), direction: z.enum(['in','out']) }).parse(req.body);
  let conversationId = m.conversationId || null;
  if (!conversationId && m.contactId) {
    let convo = await prisma.conversation.findFirst({ where: { contactId: m.contactId } });
    if (!convo) {
      convo = await prisma.conversation.create({ data: { contactId: m.contactId, channel: 'sms' } });
    }
    conversationId = convo.id;
  }
  if (!conversationId) return res.status(400).json({ error: 'conversationId or contactId required' });
  const created = await prisma.message.create({ data: { conversationId, text: m.text, direction: m.direction } });
  res.json(created);
});

// Dashboard stats
app.get('/api/stats', async (_req, res) => {
  const [campaignsCount, contactsCount, msgs] = await Promise.all([
    prisma.campaign.count(),
    prisma.contact.count(),
    prisma.message.findMany({ orderBy: { createdAt: 'desc' }, take: 500, include: { convo: { include: { contact: true } } } })
  ]);
  const inbound = msgs.filter((m) => m.direction === 'in');
  const respondedQuestion = inbound.filter((m) => m.text.includes('?')).length;
  const respondedNeg = inbound.filter((m) => /\b(stop|no)\b/i.test(m.text)).length;
  const respondedPos = Math.max(inbound.length - respondedQuestion - respondedNeg, 0);
  const [rsvpConfirmed, attended, esignSent, signed] = await Promise.all([
    prisma.contact.count({ where: { status: 'Received RSVP' } }),
    prisma.contact.count({ where: { status: 'Showed Up To Event' } }),
    prisma.contact.count({ where: { status: 'Received Agreement' } }),
    prisma.contact.count({ where: { status: 'Signed Agreement' } })
  ]);
  const recentActivity = msgs.slice(0, 5).map((m) => ({
    id: m.id,
    text: m.text,
    direction: m.direction,
    time: m.createdAt,
    contact: m.convo?.contact?.name || 'Contact'
  }));
  // Build simple timeseries of messages by day (last 30 days)
  const byDay: Record<string, { in: number; out: number }> = {};
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { in: 0, out: 0 };
  }
  msgs.forEach((m) => {
    const key = m.createdAt.toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { in: 0, out: 0 };
    if (m.direction === 'in') byDay[key].in++;
    else byDay[key].out++;
  });
  const messagesByDay = Object.entries(byDay)
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, in: v.in, out: v.out }));
  res.json({
    enrolled: contactsCount,
    messaged: msgs.length,
    respondedPos,
    respondedQuestion,
    respondedNeg,
    rsvpConfirmed,
    attended,
    esignSent,
    signed,
    podioCreated: signed,
    campaigns: campaignsCount,
    recentActivity,
    messagesByDay
  });
});

// Campaign-specific analytics
app.get('/api/campaigns/:id/stats', async (req, res) => {
  const id = req.params.id;
  const [contacts, convos] = await Promise.all([
    prisma.contact.findMany({ where: { campaignId: id } }),
    prisma.conversation.findMany({ where: { contact: { campaignId: id } }, select: { id: true } })
  ]);
  const convoIds = convos.map((c) => c.id);
  const msgs = convoIds.length
    ? await prisma.message.findMany({ where: { conversationId: { in: convoIds } }, orderBy: { createdAt: 'desc' } })
    : [];

  const statusCounts = contacts.reduce<Record<string, number>>((acc, c) => { acc[c.status] = (acc[c.status]||0) + 1; return acc; }, {});
  const inbound = msgs.filter((m) => m.direction === 'in');
  const outbound = msgs.filter((m) => m.direction === 'out');

  const byDay: Record<string, { in: number; out: number }> = {};
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { in: 0, out: 0 };
  }
  msgs.forEach((m) => {
    const key = m.createdAt.toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { in: 0, out: 0 };
    if (m.direction === 'in') byDay[key].in++;
    else byDay[key].out++;
  });
  const messagesByDay = Object.entries(byDay)
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, in: v.in, out: v.out }));

  const rsvpConfirmed = contacts.filter((c)=> c.status === 'Received RSVP').length;
  const attended = contacts.filter((c)=> c.status === 'Showed Up To Event').length;
  const esignSent = contacts.filter((c)=> c.status === 'Received Agreement').length;
  const signed = contacts.filter((c)=> c.status === 'Signed Agreement').length;

  res.json({
    totals: {
      contacts: contacts.length,
      messages: msgs.length,
      inbound: inbound.length,
      outbound: outbound.length,
    },
    statusCounts,
    messagesByDay,
    funnel: { rsvpConfirmed, attended, esignSent, signed },
    recentMessages: msgs.slice(0, 20).map((m)=> ({ id: m.id, direction: m.direction, text: m.text, time: m.createdAt }))
  });
});

// Dev email test endpoint (uses SMTP creds from env)
app.post('/api/test-email', async (req, res) => {
  try {
    const body = z.object({ to: z.string().email(), subject: z.string(), text: z.string() }).parse(req.body);
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env as any;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      return res.status(400).json({ error: 'Missing SMTP env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS' });
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const info = await transporter.sendMail({ from: SMTP_USER, to: body.to, subject: body.subject, text: body.text });
    res.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'send error' });
  }
});

// Send email via stored user SMTP
app.post('/api/email/send', async (req, res) => {
  try {
    const body = z.object({
      to: z.string().email(),
      subject: z.string().default(''),
      body: z.string().default(''),
      userId: z.string().optional(),
      contactId: z.string().optional(),
    }).parse(req.body);

    let smtpHost = process.env.SMTP_HOST;
    let smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    let smtpUser = process.env.SMTP_USER;
    let smtpPass = process.env.SMTP_PASS;
    let smtpSecure = (process.env.SMTP_SECURE === 'true') || (smtpPort === 465);

    if (body.userId || (!smtpHost || !smtpPort || !smtpUser || !smtpPass)) {
      const user = body.userId ? await prisma.user.findUnique({ where: { id: body.userId } }) : await prisma.user.findFirst();
      if (user?.smtpHost && user?.smtpPort && user?.smtpUser && user?.smtpPass) {
        smtpHost = user.smtpHost;
        smtpPort = user.smtpPort as number;
        smtpUser = user.smtpUser as string;
        smtpPass = user.smtpPass as string;
        smtpSecure = user.smtpSecure ?? true;
      }
    }

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      return res.status(400).json({ error: 'Missing SMTP configuration' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });
    const info = await transporter.sendMail({ from: smtpUser, to: body.to, subject: body.subject, text: body.body });

    if (body.contactId) {
      let convo = await prisma.conversation.findFirst({ where: { contactId: body.contactId } });
      if (!convo) {
        convo = await prisma.conversation.create({ data: { contactId: body.contactId, channel: 'email' } });
      }
      await prisma.message.create({ data: { conversationId: convo.id, direction: 'out', text: (body.subject ? `[${body.subject}]\n\n` : '') + body.body } });
    }

    res.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'send error' });
  }
});

// Twilio inbound SMS webhook (POST x-www-form-urlencoded)
app.post('/api/twilio/inbound-sms', async (req, res) => {
  try {
    const from = String(req.body.From || '').trim();
    const to = String(req.body.To || '').trim();
    const text = String(req.body.Body || '').trim();
    if (!from || !text) {
      return res.status(200).type('text/xml').send('<Response></Response>');
    }
    // normalize: last 10 digits to match stored formats loosely
    const last10 = from.replace(/\D/g, '').slice(-10);
    const contact = await prisma.contact.findFirst({
      where: { phone: { contains: last10 } },
      orderBy: { createdAt: 'desc' },
    });
    if (contact) {
      let convo = await prisma.conversation.findFirst({ where: { contactId: contact.id, channel: 'sms' } });
      if (!convo) {
        convo = await prisma.conversation.create({ data: { contactId: contact.id, channel: 'sms' } });
      }
      await prisma.message.create({ data: { conversationId: convo.id, direction: 'in', text } });
      // bump status to Needs BDR
      await prisma.contact.update({ where: { id: contact.id }, data: { status: 'Needs BDR' } });
    }
    // empty TwiML response
    return res.status(200).type('text/xml').send('<Response></Response>');
  } catch (e) {
    return res.status(200).type('text/xml').send('<Response></Response>');
  }
});


// Users
app.post('/api/users', async (req, res) => {
  const body = z.object({ name: z.string(), email: z.string().email(), smtp: z.object({ host: z.string(), port: z.number(), user: z.string(), pass: z.string(), secure: z.boolean().optional() }).optional() }).parse(req.body);
  const created = await prisma.user.create({ data: { name: body.name, email: body.email, smtpHost: body.smtp?.host, smtpPort: body.smtp?.port, smtpUser: body.smtp?.user, smtpPass: body.smtp?.pass, smtpSecure: body.smtp?.secure ?? true } });
  res.json(created);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${port}`);
});


