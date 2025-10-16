import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { sendSms } from './services/smsProvider';
import { createProspect as bonzoCreateProspect, optInProspect as bonzoOptIn } from './services/bonzoApi';
import { generateTtsMp3 } from './services/elevenLabs';
import { storeVoicemailMp3, getVoicemailMp3 } from './services/mediaStore';
import { sendVoicemailDrop } from './services/voicemailProvider';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
const prisma = new PrismaClient();

// Auth helpers
function requireEnv(name: string): string {
  const v = (process.env as any)[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v as string;
}

function authMiddleware(req: any, _res: any, next: any) {
  try {
    const hdr = (req.headers['authorization'] || '').toString();
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
    if (token) {
      const decoded: any = jwt.verify(token, requireEnv('JWT_SECRET'));
      req.user = decoded;
    }
  } catch {}
  next();
}

app.use(authMiddleware);

// Content templates loader (CSV from repo root), with simple cache
type ContentTemplate = { id: string; type: 'email'|'sms'|'voicemail'; name: string; subject?: string; body?: string; text?: string; tts_script?: string };
let contentTemplatesCache: { at: number; items: ContentTemplate[] } | null = null;

function resolveTemplatesCsvPath(): string | null {
  const candidates = [
    // When running from built dist (apps/server/dist/src)
    path.resolve(__dirname, '../../../../templates.csv'),
    // When running with cwd at apps/server
    path.resolve(process.cwd(), '../../templates.csv'),
    // Fallbacks
    path.resolve(process.cwd(), '../templates.csv'),
    path.resolve(process.cwd(), 'templates.csv'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
async function loadContentTemplates(): Promise<ContentTemplate[]> {
  try {
    // Prefer DB-backed content templates
    const dbItems = await prisma.contentTemplate.findMany({ orderBy: { createdAt: 'desc' } }) as any[];
    if (Array.isArray(dbItems) && dbItems.length) {
      return dbItems.map((t) => ({ id: t.id, type: t.type, name: t.name, subject: t.subject || undefined, body: t.body || undefined, text: t.text || undefined, tts_script: t.ttsScript || undefined }));
    }
    const now = Date.now();
    if (contentTemplatesCache && now - contentTemplatesCache.at < 60_000) return contentTemplatesCache.items;
    const csvPath = resolveTemplatesCsvPath();
    if (!csvPath) {
      contentTemplatesCache = { at: now, items: [] };
      return [];
    }
    const csv = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true } as any);
    if ((parsed as any).errors && (parsed as any).errors.length) {
      contentTemplatesCache = { at: now, items: [] };
      return [];
    }
    const rows: any[] = Array.isArray((parsed as any).data) ? ((parsed as any).data as any[]) : [];
    const items = rows
      .map((row) => {
        const name = String(row.Name || row.name || '').trim();
        const content = String(row.Content || row.content || '').trim();
        const typeRaw = String(row.Type || row.type || '').trim().toLowerCase();
        if (!name || !content || !typeRaw) return null;
        let type: 'email'|'sms'|'voicemail' | null = null;
        if (typeRaw.startsWith('email')) type = 'email';
        else if (typeRaw.startsWith('sms')) type = 'sms';
        else if (typeRaw.startsWith('voice')) type = 'voicemail';
        if (!type) return null;
        const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const id = `ct_${slugify(name)}_${type}`;
        if (type === 'email') {
          const match = content.match(/^\s*Subject\s*:\s*(.*)$/mi);
          if (match) {
            const subject = (match[1] || '').trim();
            const body = content.replace(match[0], '').trim();
            return { id, type, name, subject, body } as ContentTemplate;
          }
          return { id, type, name, body: content } as ContentTemplate;
        }
        if (type === 'sms') return { id, type, name, text: content } as ContentTemplate;
        return { id, type, name, tts_script: content } as ContentTemplate;
      })
      .filter(Boolean) as ContentTemplate[];
    // De-duplicate by id
    const byId: Record<string, ContentTemplate> = {};
    for (const it of items) if (!byId[it.id]) byId[it.id] = it;
    const out = Object.values(byId);
    // Also seed DB once if empty
    try {
      const count = await prisma.contentTemplate.count();
      if (count === 0 && out.length) {
        await prisma.contentTemplate.createMany({ data: out.map((t) => ({ id: t.id, type: t.type, name: t.name, subject: t.subject || null, body: t.body || null, text: t.text || null, ttsScript: t.tts_script || null })) });
      }
    } catch {}
    contentTemplatesCache = { at: now, items: out };
    return out;
  } catch {
    return [];
  }
}

function renderMergeTags(input: string, ctx: Record<string, any>): string {
  if (!input) return '';
  return input.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, key) => {
    const path = String(key || '').trim().split('.');
    let cur: any = ctx;
    for (const p of path) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p]; else return '';
    }
    return String(cur ?? '');
  });
}

function splitName(full: string): { first_name: string; last_name: string } {
  const raw = String(full || '').trim();
  if (!raw) return { first_name: '', last_name: '' };
  const parts = raw.split(/\s+/);
  const first = parts.shift() || '';
  const last = parts.join(' ');
  return { first_name: first, last_name: last };
}

async function resolveSmsTextFromConfig(config: any): Promise<string> {
  try {
    if (config?.template_id) {
      const templates = await loadContentTemplates();
      const t = templates.find((x) => x.id === config.template_id && x.type === 'sms');
      if (t?.text) return String(t.text);
      // Template specified but not found: strict mode -> empty
      // eslint-disable-next-line no-console
      console.warn('[execute] SMS template not found or empty for id:', config.template_id);
      return '';
    }
    // No template selected: allow custom content
    if (config?.text) return String(config.text);
    if (config?.message) return String(config.message);
    if (config?.content?.text) return String(config.content.text);
  } catch {}
  return '';
}

async function resolveEmailFromConfig(config: any): Promise<{ subject: string; body: string }> {
  try {
    if (config?.template_id) {
      const templates = await loadContentTemplates();
      const t = templates.find((x) => x.id === config.template_id && x.type === 'email');
      if (t) return { subject: String(t.subject || ''), body: String(t.body || '') };
      // eslint-disable-next-line no-console
      console.warn('[execute] Email template not found for id:', config.template_id);
      return { subject: '', body: '' };
    }
    // No template selected: allow custom content
    if (config?.content && (config.content.subject || config.content.body)) {
      return { subject: String(config.content.subject || ''), body: String(config.content.body || '') };
    }
    if (config?.content?.text) {
      return { subject: '', body: String(config.content.text) };
    }
  } catch {}
  return { subject: '', body: '' };
}

async function resolveVoicemailScriptFromConfig(config: any): Promise<string> {
  try {
    if (config?.template_id) {
      const templates = await loadContentTemplates();
      const t = templates.find((x) => x.id === config.template_id && x.type === 'voicemail');
      if (t?.tts_script) return String(t.tts_script);
      // eslint-disable-next-line no-console
      console.warn('[execute] Voicemail template not found for id:', config.template_id);
      return '';
    }
    if (config?.tts?.custom_script) return String(config.tts.custom_script);
  } catch {}
  return '';
}
// Outbound SMS via provider adapter (Bonzo/Twilio)
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

    const result = await sendSms({ to: toNumber, text: body.text });
    const sent = result.sent;
    const sid = result.sid;

    if (convoId) {
      await prisma.message.create({ data: { conversationId: convoId, direction: 'out', text: body.text } });
    }

    res.json({ ok: true, sent, sid, provider: (process.env.SMS_PROVIDER||'').toLowerCase()|| (sent ? 'twilio' : 'mock'), simulated: !sent });
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



// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Serve temp-hosted TTS mp3s (in-memory, ephemeral). Not for production.
app.get('/media/vm/:id.mp3', async (req, res) => {
  const buf = getVoicemailMp3(String(req.params.id || ''));
  if (!buf) return res.status(404).end();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buf);
});

// Dev-only: upload a raw MP3 and get a public URL for Slybroadcast testing
app.post('/media/upload/raw', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    const bodyBuf = Buffer.isBuffer((req as any).body) ? (req as any).body : Buffer.from((req as any).body || '');
    if (!bodyBuf || bodyBuf.length === 0) return res.status(400).json({ error: 'empty body' });
    const id = storeVoicemailMp3(bodyBuf);
    const base = (process.env.PUBLIC_BASE_URL || (((req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host'))));
    const url = `${String(base).replace(/\/$/, '')}/media/vm/${id}.mp3`;
    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'upload failed' });
  }
});

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

// Delete template
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Detach campaigns that reference this template (keep their cloned campaign graph intact)
    await prisma.campaign.updateMany({ where: { templateId: id }, data: { templateId: null } });
    await prisma.$transaction([
      prisma.node.deleteMany({ where: { templateId: id } }),
      prisma.edge.deleteMany({ where: { templateId: id } }),
      prisma.template.delete({ where: { id } }),
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'delete error' });
  }
});

// Template Versions - List all versions for a template
app.get('/api/templates/:id/versions', async (req, res) => {
  try {
    const versions = await prisma.templateVersion.findMany({
      where: { baseTemplateId: req.params.id },
      include: { campaign: { select: { id: true, name: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(versions.map(v => ({
      id: v.id,
      versionName: v.versionName,
      description: v.description,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      campaign: v.campaign,
      nodesCount: JSON.parse(v.nodesJson || '[]').length,
      edgesCount: JSON.parse(v.edgesJson || '[]').length,
    })));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'fetch error' });
  }
});

// Get specific template version with full data
app.get('/api/templates/:templateId/versions/:versionId', async (req, res) => {
  try {
    const version = await prisma.templateVersion.findUnique({
      where: { id: req.params.versionId },
      include: { campaign: true, baseTemplate: true }
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });
    res.json({
      ...version,
      nodes: JSON.parse(version.nodesJson || '[]'),
      edges: JSON.parse(version.edgesJson || '[]'),
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'fetch error' });
  }
});

// Create a new template version (from campaign customization)
app.post('/api/templates/:id/versions', async (req, res) => {
  try {
    const body = z.object({
      versionName: z.string(),
      description: z.string().optional(),
      campaignId: z.string().optional(),
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
      createdBy: z.string().optional(),
    }).parse(req.body);
    
    const version = await prisma.templateVersion.create({
      data: {
        baseTemplateId: req.params.id,
        versionName: body.versionName,
        description: body.description,
        campaignId: body.campaignId,
        nodesJson: JSON.stringify(body.nodes),
        edgesJson: JSON.stringify(body.edges),
        createdBy: body.createdBy,
      }
    });
    
    res.json({
      ...version,
      nodes: JSON.parse(version.nodesJson),
      edges: JSON.parse(version.edgesJson),
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'create error' });
  }
});

// Update template version
app.patch('/api/templates/:templateId/versions/:versionId', async (req, res) => {
  try {
    const body = z.object({
      versionName: z.string().optional(),
      description: z.string().optional(),
      nodes: z.array(z.any()).optional(),
      edges: z.array(z.any()).optional(),
    }).parse(req.body);
    
    const data: any = {};
    if (body.versionName) data.versionName = body.versionName;
    if (body.description !== undefined) data.description = body.description;
    if (body.nodes) data.nodesJson = JSON.stringify(body.nodes);
    if (body.edges) data.edgesJson = JSON.stringify(body.edges);
    
    const version = await prisma.templateVersion.update({
      where: { id: req.params.versionId },
      data
    });
    
    res.json({
      ...version,
      nodes: JSON.parse(version.nodesJson),
      edges: JSON.parse(version.edgesJson),
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'update error' });
  }
});

// Delete template version
app.delete('/api/templates/:templateId/versions/:versionId', async (req, res) => {
  try {
    await prisma.templateVersion.delete({ where: { id: req.params.versionId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'delete error' });
  }
});

// Export template or version to CSV
app.get('/api/templates/:id/export/csv', async (req, res) => {
  try {
    const versionId = req.query.versionId as string | undefined;
    let nodes: any[] = [];
    let edges: any[] = [];
    let templateName = 'template';
    
    if (versionId) {
      const version = await prisma.templateVersion.findUnique({
        where: { id: versionId },
        include: { baseTemplate: true }
      });
      if (!version) return res.status(404).json({ error: 'Version not found' });
      nodes = JSON.parse(version.nodesJson || '[]');
      edges = JSON.parse(version.edgesJson || '[]');
      templateName = `${version.baseTemplate.name}_${version.versionName}`;
    } else {
      const template = await prisma.template.findUnique({
        where: { id: req.params.id },
        include: { nodes: true, edges: true }
      });
      if (!template) return res.status(404).json({ error: 'Template not found' });
      nodes = template.nodes.map(n => ({
        id: n.key,
        type: n.type,
        name: n.name,
        config: n.configJson ? JSON.parse(n.configJson) : {},
        pos: (n.posX != null && n.posY != null) ? { x: n.posX, y: n.posY } : undefined
      }));
      edges = template.edges.map(e => ({
        from: e.fromKey,
        to: e.toKey,
        condition: e.conditionJson ? JSON.parse(e.conditionJson) : {}
      }));
      templateName = template.name;
    }
    
    // Build CSV with columns: NodeID, NodeType, NodeName, ConfigJSON, FromNode, ToNode, EdgeConditionJSON
    const rows: string[] = ['NodeID,NodeType,NodeName,ConfigJSON,PosX,PosY,EdgeFrom,EdgeTo,EdgeConditionJSON'];
    
    // Map node IDs to their data
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Create rows for each node with its outgoing edges
    for (const node of nodes) {
      const outgoingEdges = edges.filter(e => e.from === node.id);
      
      if (outgoingEdges.length === 0) {
        // Node with no outgoing edges
        rows.push([
          `"${node.id}"`,
          `"${node.type}"`,
          `"${node.name}"`,
          `"${JSON.stringify(node.config || {}).replace(/"/g, '""')}"`,
          node.pos?.x || '',
          node.pos?.y || '',
          '',
          '',
          ''
        ].join(','));
      } else {
        // Node with outgoing edges - create a row for each edge
        for (const edge of outgoingEdges) {
          rows.push([
            `"${node.id}"`,
            `"${node.type}"`,
            `"${node.name}"`,
            `"${JSON.stringify(node.config || {}).replace(/"/g, '""')}"`,
            node.pos?.x || '',
            node.pos?.y || '',
            `"${edge.from}"`,
            `"${edge.to}"`,
            `"${JSON.stringify(edge.condition || {}).replace(/"/g, '""')}"`,
          ].join(','));
        }
      }
    }
    
    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${templateName.replace(/[^a-z0-9]/gi, '_')}.csv"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'export error' });
  }
});

// Import CSV to update template or create version
app.post('/api/templates/:id/import/csv', async (req, res) => {
  try {
    const body = z.object({
      csvData: z.string(),
      createVersion: z.boolean().default(false),
      versionName: z.string().optional(),
      campaignId: z.string().optional(),
    }).parse(req.body);
    
    const parsed = Papa.parse(body.csvData, { header: true, skipEmptyLines: true }) as any;
    const rows: any[] = Array.isArray(parsed.data) ? parsed.data : [];
    
    // Rebuild nodes and edges from CSV
    const nodeMap = new Map<string, any>();
    const edges: any[] = [];
    
    for (const row of rows) {
      const nodeId = String(row.NodeID || '').trim();
      if (!nodeId) continue;
      
      // Add or update node
      if (!nodeMap.has(nodeId)) {
        const config = row.ConfigJSON ? JSON.parse(String(row.ConfigJSON)) : {};
        nodeMap.set(nodeId, {
          id: nodeId,
          type: String(row.NodeType || 'stage').trim(),
          name: String(row.NodeName || nodeId).trim(),
          config,
          pos: (row.PosX && row.PosY) ? { x: parseFloat(row.PosX), y: parseFloat(row.PosY) } : undefined
        });
      }
      
      // Add edge if present
      const edgeFrom = String(row.EdgeFrom || '').trim();
      const edgeTo = String(row.EdgeTo || '').trim();
      if (edgeFrom && edgeTo) {
        const condition = row.EdgeConditionJSON ? JSON.parse(String(row.EdgeConditionJSON)) : {};
        // Avoid duplicates
        if (!edges.some(e => e.from === edgeFrom && e.to === edgeTo)) {
          edges.push({ from: edgeFrom, to: edgeTo, condition });
        }
      }
    }
    
    const nodes = Array.from(nodeMap.values());
    
    if (body.createVersion) {
      // Create a new version
      const versionName = body.versionName || `Import ${new Date().toISOString().slice(0, 10)}`;
      const version = await prisma.templateVersion.create({
        data: {
          baseTemplateId: req.params.id,
          versionName,
          description: `Imported from CSV with ${nodes.length} nodes and ${edges.length} edges`,
          campaignId: body.campaignId,
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
        }
      });
      
      res.json({
        ok: true,
        version: {
          id: version.id,
          versionName: version.versionName,
          nodesCount: nodes.length,
          edgesCount: edges.length,
        }
      });
    } else {
      // Update the base template
      await prisma.$transaction([
        prisma.node.deleteMany({ where: { templateId: req.params.id } }),
        prisma.edge.deleteMany({ where: { templateId: req.params.id } }),
        prisma.node.createMany({
          data: nodes.map((n: any) => ({
            templateId: req.params.id,
            key: n.id,
            type: n.type,
            name: n.name,
            configJson: JSON.stringify(n.config || {}),
            posX: n.pos?.x ?? null,
            posY: n.pos?.y ?? null,
          }))
        }),
        prisma.edge.createMany({
          data: edges.map((e: any) => ({
            templateId: req.params.id,
            fromKey: e.from,
            toKey: e.to,
            conditionJson: JSON.stringify(e.condition || {}),
          }))
        })
      ]);
      
      res.json({
        ok: true,
        nodesCount: nodes.length,
        edgesCount: edges.length,
      });
    }
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'import error' });
  }
});

// Content Templates (from CSV in repo root)
app.get('/api/content-templates', async (_req, res) => {
  try {
    const list = await prisma.contentTemplate.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(list.map((t) => ({ id: t.id, type: t.type, name: t.name, subject: t.subject || undefined, body: t.body || undefined, text: t.text || undefined, tts_script: t.ttsScript || undefined })));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'import error' });
  }
});

// Create content template
app.post('/api/content-templates', async (req, res) => {
  try {
    const body = z.object({ type: z.enum(['email','sms','voicemail']), name: z.string(), subject: z.string().optional(), body: z.string().optional(), text: z.string().optional(), tts_script: z.string().optional() }).parse(req.body);
    const created = await prisma.contentTemplate.create({ data: { type: body.type, name: body.name, subject: body.subject || null, body: body.body || null, text: body.text || null, ttsScript: body.tts_script || null } });
    res.json({ id: created.id, type: created.type, name: created.name, subject: created.subject || undefined, body: created.body || undefined, text: created.text || undefined, tts_script: created.ttsScript || undefined });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'create error' });
  }
});

// Delete content template
app.delete('/api/content-templates/:id', async (req, res) => {
  try {
    await prisma.contentTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'delete error' });
  }
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

// Execute SMS nodes for a campaign (minimal executor)
app.post('/api/campaigns/:id/execute-sms', async (req, res) => {
  try {
    const body = z.object({ nodeKey: z.string().optional(), text: z.string().optional() }).parse(req.body || {});
    const campaignId = req.params.id;
    const [nodes, contacts] = await Promise.all([
      prisma.campaignNode.findMany({ where: { campaignId } }),
      prisma.contact.findMany({ where: { campaignId } }),
    ]);
    const smsNodes = nodes.filter((n) => n.type === 'sms_send' && (!body.nodeKey || n.key === body.nodeKey));
    if (smsNodes.length === 0) return res.json({ ok: true, sent: 0 });
    let total = 0;
    for (const contact of contacts) {
      const toNumber = (contact.phone || '').trim();
      if (!toNumber) continue;
      const msgTextRaw = body.text || (() => {
        try { const cfg = smsNodes[0].configJson ? JSON.parse(smsNodes[0].configJson) : {}; return cfg; } catch { return {}; }
      })();
      const cfgFirst = typeof msgTextRaw === 'string' ? { text: msgTextRaw } : (msgTextRaw || {});
      const resolvedText = await resolveSmsTextFromConfig(cfgFirst);
      const np = splitName(contact.name || '');
      const msgText = renderMergeTags(resolvedText || `Hi {{contact.first_name}}`, {
        contact: { name: contact.name, first_name: np.first_name, last_name: np.last_name, email: contact.email, phone: contact.phone },
        campaign: {},
      }).trim();

      const result = await sendSms({ to: toNumber, text: msgText });
      // Ensure conversation and log message
      let convo = await prisma.conversation.findFirst({ where: { contactId: contact.id, channel: 'sms' } });
      if (!convo) convo = await prisma.conversation.create({ data: { contactId: contact.id, channel: 'sms' } });
      await prisma.message.create({ data: { conversationId: convo.id, direction: 'out', text: msgText } });
      if (result.sent) total++;
    }
    res.json({ ok: true, sent: total });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'execute error' });
  }
});

// Combined executor: send emails and SMS for first matching nodes
app.post('/api/campaigns/:id/execute', async (req, res) => {
  try {
    const body = z.object({ nodeKey: z.string().optional() }).parse(req.body || {});
    const campaignId = req.params.id;
  const [nodes, contacts, campaign] = await Promise.all([
      prisma.campaignNode.findMany({ where: { campaignId } }),
      prisma.contact.findMany({ where: { campaignId } }),
    prisma.campaign.findUnique({ where: { id: campaignId }, include: { senderUser: true } }),
    ]);
    const firstSms = nodes.find((n) => n.type === 'sms_send' && (!body.nodeKey || n.key === body.nodeKey));
    const firstEmail = nodes.find((n) => n.type === 'email_send' && (!body.nodeKey || n.key === body.nodeKey));
    const firstVm = nodes.find((n) => n.type === 'voicemail_drop' && (!body.nodeKey || n.key === body.nodeKey));

    let smsSent = 0;
    let emailSent = 0;
    let vmQueued = 0;
    const campaignCtx = {
      name: campaign?.name,
      owner_name: campaign?.ownerName,
      owner_email: campaign?.ownerEmail,
      owner_phone: campaign?.ownerPhone,
      event_type: campaign?.eventType,
      city: campaign?.city,
      state: campaign?.state,
      launch_date: campaign?.launchDate ? campaign.launchDate.toISOString().slice(0,10) : '',
      event_date: campaign?.eventDate ? campaign.eventDate.toISOString().slice(0,10) : '',
      video_link: campaign?.videoLink,
      event_link: campaign?.eventLink,
      hotel_name: campaign?.hotelName,
      hotel_address: campaign?.hotelAddress,
      calendly_link: campaign?.calendlyLink,
      sender_email: undefined,
    } as any;

    if (firstSms) {
      let cfg: any = {};
      try { cfg = firstSms.configJson ? JSON.parse(firstSms.configJson) : {}; } catch {}
      const baseText = await resolveSmsTextFromConfig(cfg);
      for (const ct of contacts) {
        if (!ct.phone) continue;
        const np = splitName(ct.name || '');
        const text = renderMergeTags(baseText, { contact: { name: ct.name, first_name: np.first_name, last_name: np.last_name, email: ct.email, phone: ct.phone }, campaign: campaignCtx }).trim();
        const resSms = await sendSms({ to: ct.phone, text, fromNumber: (campaign as any)?.senderUser?.smsFromNumber || undefined });
        let convo = await prisma.conversation.findFirst({ where: { contactId: ct.id, channel: 'sms' } });
        if (!convo) convo = await prisma.conversation.create({ data: { contactId: ct.id, channel: 'sms' } });
        await prisma.message.create({ data: { conversationId: convo.id, direction: 'out', text } });
        if (resSms.sent) smsSent++;
      }
    }

    if (firstEmail) {
      let cfg: any = {};
      try { cfg = firstEmail.configJson ? JSON.parse(firstEmail.configJson) : {}; } catch {}
      const { subject, body: emailBody } = await resolveEmailFromConfig(cfg);
      for (const ct of contacts) {
        if (!ct.email) continue;
        const np = splitName(ct.name || '');
        const sub = renderMergeTags(subject || '', { contact: { name: ct.name, first_name: np.first_name, last_name: np.last_name, email: ct.email, phone: ct.phone }, campaign: campaignCtx }).trim();
        const bod = renderMergeTags(emailBody || '', { contact: { name: ct.name, first_name: np.first_name, last_name: np.last_name, email: ct.email, phone: ct.phone }, campaign: campaignCtx }).trim();
        try {
          await (async () => {
            const payload = { to: ct.email!, subject: sub, body: bod } as any;
            const r = await fetch((process.env.PUBLIC_BASE_URL || '') + '/api/email/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            } as any);
            if (!r.ok) throw new Error('email send failed');
          })();
          let convo = await prisma.conversation.findFirst({ where: { contactId: ct.id, channel: 'email' } });
          if (!convo) convo = await prisma.conversation.create({ data: { contactId: ct.id, channel: 'email' } });
          await prisma.message.create({ data: { conversationId: convo.id, direction: 'out', text: (sub ? `[${sub}]\n\n` : '') + bod, subject: sub, provider: 'smtp' } });
          emailSent++;
        } catch {}
      }
    }

    if (firstVm) {
      let cfg: any = {};
      try { cfg = firstVm.configJson ? JSON.parse(firstVm.configJson) : {}; } catch {}
      const baseScript = await resolveVoicemailScriptFromConfig(cfg);
      for (const ct of contacts) {
        if (!ct.phone) continue;
        const np = splitName(ct.name || '');
        const script = renderMergeTags(baseScript, { contact: { name: ct.name, first_name: np.first_name, last_name: np.last_name, email: ct.email, phone: ct.phone }, campaign: campaignCtx });
        let audioUrl = '';
        try {
          const tts = await generateTtsMp3({ script });
          if (tts.ok && tts.audioUrl) {
            if (tts.audioUrl.startsWith('data:audio/mpeg;base64,')) {
              const b64 = tts.audioUrl.replace('data:audio/mpeg;base64,', '');
              const buf = Buffer.from(b64, 'base64');
              const id = storeVoicemailMp3(buf);
              const base = (process.env.PUBLIC_BASE_URL || (((req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host'))));
              audioUrl = `${String(base).replace(/\/$/, '')}/media/vm/${id}.mp3`;
            } else {
              audioUrl = tts.audioUrl;
            }
          } else if (!tts.ok) {
            // eslint-disable-next-line no-console
            console.warn('[execute] ElevenLabs TTS failed', tts.raw);
          }
        } catch {}
        const r = await sendVoicemailDrop({ to: ct.phone, audioUrl: audioUrl || undefined, callerId: ((campaign as any)?.senderUser?.vmCallerId) || process.env.DROPCOWBOY_CALLER_ID || process.env.SLYBROADCAST_CALLER_ID || undefined, campaignId: campaign?.id });
        if (r.queued) vmQueued++;
        else {
          // eslint-disable-next-line no-console
          console.warn('[execute] Voicemail drop failed', { to: ct.phone, audioUrl, raw: r.raw });
        }
      }
    }

    res.json({ ok: true, smsSent, emailSent, vmQueued });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'execute error' });
  }
});

app.patch('/api/campaigns/:id', async (req, res) => {
  try {
    const body = z.object({
      name: z.string().optional(),
      ownerName: z.string().optional(),
      ownerEmail: z.string().optional(),
      ownerPhone: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      videoLink: z.string().optional(),
      eventLink: z.string().optional(),
      eventType: z.string().optional(),
      eventDate: z.string().optional(),
      launchDate: z.string().optional(),
      hotelName: z.string().optional(),
      hotelAddress: z.string().optional(),
      calendlyLink: z.string().optional(),
      status: z.string().optional(),
      templateId: z.string().optional(),
      importGraph: z.boolean().optional(),
      senderUserId: z.string().optional(),
    }).partial().parse(req.body);

    // Normalize empty strings to null/undefined where appropriate
    const updateData: any = {
      name: body.name,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerPhone: body.ownerPhone,
      city: body.city,
      state: body.state,
      videoLink: body.videoLink,
      eventLink: body.eventLink,
      eventType: body.eventType,
      status: body.status,
      hotelName: body.hotelName,
      hotelAddress: body.hotelAddress,
      calendlyLink: body.calendlyLink,
    };
    if (typeof body.templateId !== 'undefined') {
      updateData.templateId = body.templateId === '' ? null : body.templateId;
    }
    if (body.eventDate) {
      updateData.eventDate = new Date(body.eventDate);
    }
    if (body.launchDate) {
      updateData.launchDate = new Date(body.launchDate);
    }
    if (typeof body.senderUserId !== 'undefined') {
      updateData.senderUserId = body.senderUserId === '' ? null : body.senderUserId;
    }

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // If requested, replace campaign graph with the template's nodes/edges
    if (body.importGraph && body.templateId) {
      const [tplNodes, tplEdges] = await Promise.all([
        prisma.node.findMany({ where: { templateId: body.templateId } }),
        prisma.edge.findMany({ where: { templateId: body.templateId } }),
      ]);

      await prisma.$transaction([
        prisma.campaignNode.deleteMany({ where: { campaignId: updated.id } }),
        prisma.campaignEdge.deleteMany({ where: { campaignId: updated.id } }),
      ]);

      if (tplNodes.length > 0) {
        await prisma.campaignNode.createMany({
          data: tplNodes.map((n) => ({
            campaignId: updated.id,
            key: n.key,
            type: n.type,
            name: n.name,
            configJson: n.configJson || null,
            posX: n.posX ?? null,
            posY: n.posY ?? null,
          })),
        });
      }
      if (tplEdges.length > 0) {
        await prisma.campaignEdge.createMany({
          data: tplEdges.map((e) => ({
            campaignId: updated.id,
            fromKey: e.fromKey,
            toKey: e.toKey,
            conditionJson: e.conditionJson || null,
          })),
        });
      }
    }

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'update error' });
  }
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
  const c = z.object({
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    status: z.string().optional(),
    stageId: z.string().optional(),
    raw: z.any().optional(),
  }).parse(req.body);
  const fullName = (c.name && c.name.trim()) || `${(c.firstName||'').trim()} ${(c.lastName||'').trim()}`.trim() || 'Contact';
  const created = await prisma.contact.create({ data: { campaignId: req.params.id, name: fullName, email: c.email, phone: c.phone, status: c.status||'No Activity', stageKey: c.stageId||null, rawJson: c.raw?JSON.stringify(c.raw):null } });
  // Create Bonzo prospect and opt in for SMS (best-effort)
  try {
    const names = String(c.name||'').split(' ');
    const first = names.shift() || 'Prospect';
    const last = names.join(' ') || '';
    const createdProspect = await bonzoCreateProspect({ firstName: first, lastName: last, email: c.email, phone: c.phone, externalId: created.id });
    if (createdProspect?.id) await bonzoOptIn(createdProspect.id, 'sms');
  } catch {}
  // Ensure conversation exists
  const existing = await prisma.conversation.findFirst({ where: { contactId: created.id } });
  if (!existing) {
    await prisma.conversation.create({ data: { contactId: created.id, channel: created.phone ? 'sms' : 'email' } });
  }
  res.json(created);
});

// Backfill: create Bonzo prospects and opt-in for all contacts (optionally by campaignId)
app.post('/api/bonzo/backfill', async (req, res) => {
  try {
    const campaignId = (req.query?.campaignId as string | undefined) || undefined;
    const where: any = campaignId ? { campaignId } : {};
    const contacts = await prisma.contact.findMany({ where });
    // Preload campaigns to attach source name
    const campaignIds = Array.from(new Set(contacts.map((c) => c.campaignId).filter(Boolean))) as string[];
    const campaigns = campaignIds.length ? await prisma.campaign.findMany({ where: { id: { in: campaignIds } } }) : [];
    const idToCampaign: Record<string, { id: string; name: string }> = {};
    campaigns.forEach((c: any) => { idToCampaign[c.id] = { id: c.id, name: c.name }; });

    let createdCount = 0;
    let optedCount = 0;
    for (const ct of contacts) {
      if (!ct.phone && !ct.email) continue;
      const names = String(ct.name||'').split(' ');
      const first = names.shift() || 'Prospect';
      const last = names.join(' ') || '';
      const src = ct.campaignId && idToCampaign[ct.campaignId] ? `ADTV:${idToCampaign[ct.campaignId].name}` : 'ADTV';
      try {
        const p = await bonzoCreateProspect({ firstName: first, lastName: last, email: ct.email || undefined, phone: ct.phone || undefined, externalId: `${ct.id}` });
        if (p?.id) {
          createdCount++;
          const ok = await bonzoOptIn(p.id, 'sms');
          if (ok) optedCount++;
        }
      } catch {}
    }
    res.json({ ok: true, processed: contacts.length, created: createdCount, optedIn: optedCount });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'backfill error' });
  }
});

// Update contact
app.patch('/api/contacts/:id', async (req, res) => {
  try {
    const body = z.object({
      name: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
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
    const nameFromParts = `${(body.firstName||'').trim()} ${(body.lastName||'').trim()}`.trim();
    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: (body.name ? body.name : (nameFromParts || undefined)) as any,
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
  const m = z.object({ conversationId: z.string().optional(), contactId: z.string().optional(), text: z.string(), subject: z.string().optional(), direction: z.enum(['in','out']), provider: z.string().optional(), providerMessageId: z.string().optional() }).parse(req.body);
  let conversationId = m.conversationId || null;
  if (!conversationId && m.contactId) {
    let convo = await prisma.conversation.findFirst({ where: { contactId: m.contactId } });
    if (!convo) {
      convo = await prisma.conversation.create({ data: { contactId: m.contactId, channel: 'sms' } });
    }
    conversationId = convo.id;
  }
  if (!conversationId) return res.status(400).json({ error: 'conversationId or contactId required' });
  const created = await prisma.message.create({ data: { conversationId, text: m.text, subject: m.subject, provider: m.provider, providerMessageId: m.providerMessageId, direction: m.direction } });
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

// Bonzo inbound SMS webhook (JSON or form). Map to our conversation log.
app.post('/api/bonzo/inbound-sms', async (req, res) => {
  try {
    const token = process.env.BONZO_WEBHOOK_TOKEN;
    if (token) {
      const provided = (req.headers['x-bonzo-token'] || req.query.token || req.body?.token || '').toString();
      if (!provided || provided !== token) return res.status(401).json({ ok: false });
    }
    const from = String((req.body && (req.body.from || req.body.From)) || '').trim();
    const text = String((req.body && (req.body.text || req.body.body || req.body.Body)) || '').trim();
    if (!from || !text) return res.status(200).json({ ok: true });
    const last10 = from.replace(/\D/g, '').slice(-10);
    const contact = await prisma.contact.findFirst({ where: { phone: { contains: last10 } }, orderBy: { createdAt: 'desc' } });
    if (contact) {
      let convo = await prisma.conversation.findFirst({ where: { contactId: contact.id, channel: 'sms' } });
      if (!convo) convo = await prisma.conversation.create({ data: { contactId: contact.id, channel: 'sms' } });
      await prisma.message.create({ data: { conversationId: convo.id, direction: 'in', text } });
      await prisma.contact.update({ where: { id: contact.id }, data: { status: 'Needs BDR' } });
    }
    return res.status(200).json({ ok: true });
  } catch (_e) {
    return res.status(200).json({ ok: true });
  }
});

// Voicemail: generate via ElevenLabs (optional) and drop via Slybroadcast
app.post('/api/voicemail/drop', async (req, res) => {
  try {
    const candidate: any = (typeof (req as any).body === 'string'
      ? (()=> { try { return JSON.parse((req as any).body || '{}'); } catch { return {}; } })()
      : ((req as any).body && Object.keys((req as any).body||{}).length ? (req as any).body : (req as any).query)) || {};
    const body = z.object({
      to: z.string().optional(),
      contactId: z.string().optional(),
      audioUrl: z.string().url().optional(),
      ttsScript: z.string().optional(),
      callerId: z.string().optional(),
      scheduleAt: z.string().optional(),
      campaignId: z.string().optional(),
    }).parse(candidate);

    let toNumber = body.to || '';
    if (!toNumber && body.contactId) {
      const contact = await prisma.contact.findUnique({ where: { id: body.contactId } });
      toNumber = contact?.phone || '';
    }
    if (!toNumber) return res.status(400).json({ error: 'Missing destination number' });

    let audioUrl = body.audioUrl || '';
    if (!audioUrl && body.ttsScript) {
      const tts = await generateTtsMp3({ script: body.ttsScript });
      if (tts.ok && tts.audioUrl) {
        // Convert data URL to Buffer and host at /media
        if (tts.audioUrl.startsWith('data:audio/mpeg;base64,')) {
          const b64 = tts.audioUrl.replace('data:audio/mpeg;base64,', '');
          const buf = Buffer.from(b64, 'base64');
          const id = storeVoicemailMp3(buf);
          const base = (process.env.PUBLIC_BASE_URL || ((req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host')));
          audioUrl = `${String(base).replace(/\/$/, '')}/media/vm/${id}.mp3`;
        } else {
          audioUrl = tts.audioUrl;
        }
      }
    }

    const result = await sendVoicemailDrop({
      to: toNumber,
      audioUrl: audioUrl || undefined,
      callerId: body.callerId,
      scheduleAt: body.scheduleAt,
      campaignId: body.campaignId,
    });

    // Log as message in conversation if contactId present
    if (body.contactId) {
      let convo = await prisma.conversation.findFirst({ where: { contactId: body.contactId, channel: 'sms' } });
      if (!convo) convo = await prisma.conversation.create({ data: { contactId: body.contactId, channel: 'sms' } });
      await prisma.message.create({ data: { conversationId: convo.id, direction: 'out', text: `[Voicemail drop queued]` } });
    }

    res.json({ ok: result.queued, provider: result.provider, id: result.id, raw: result.raw });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'voicemail error' });
  }
});


// Users
app.post('/api/users', async (req, res) => {
  const body = z.object({ name: z.string(), email: z.string().email(), password: z.string().optional(), role: z.enum(['bdr','admin']).optional(), phone: z.string().optional(), smsFromNumber: z.string().optional(), vmCallerId: z.string().optional(), smtp: z.object({ host: z.string(), port: z.number(), user: z.string(), pass: z.string(), secure: z.boolean().optional() }).optional() }).parse(req.body);
  const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
  const created = await prisma.user.create({ data: { name: body.name, email: body.email, role: body.role || 'bdr', passwordHash, phone: body.phone || null, smsFromNumber: body.smsFromNumber || null, vmCallerId: body.vmCallerId || null, smtpHost: body.smtp?.host, smtpPort: body.smtp?.port, smtpUser: body.smtp?.user, smtpPass: body.smtp?.pass, smtpSecure: body.smtp?.secure ?? true } });
  res.json(created);
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, requireEnv('JWT_SECRET'), { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'login error' });
  }
});

app.get('/api/auth/me', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, smsFromNumber: user.smsFromNumber, vmCallerId: user.vmCallerId, googleEmail: user.googleEmail });
});

// BDR CSV import
function resolveBdrCsvPath(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../bdr.csv'),
    path.resolve(process.cwd(), '../../bdr.csv'),
    path.resolve(process.cwd(), '../bdr.csv'),
    path.resolve(process.cwd(), 'bdr.csv'),
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return null;
}

app.post('/api/users/import/bdr', async (_req, res) => {
  try {
    const csvPath = resolveBdrCsvPath();
    if (!csvPath) return res.status(404).json({ error: 'bdr.csv not found in repo root' });
    const csv = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true } as any);
    const rows: any[] = Array.isArray((parsed as any).data) ? ((parsed as any).data as any[]) : [];
    let created = 0;
    for (const r of rows) {
      const name = String(r.name || r.Name || '').trim();
      const email = String(r.email || r.Email || '').trim();
      const phone = String(r.phone || r.Phone || '').trim();
      const smsFromNumber = String(r.smsFromNumber || r.SmsFromNumber || '').trim();
      const vmCallerId = String(r.vmCallerId || r.VmCallerId || '').trim();
      if (!name || !email) continue;
      try {
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) continue;
        const passwordHash = await bcrypt.hash('123456', 10);
        await prisma.user.create({ data: { name, email, role: 'bdr', passwordHash, phone: phone || null, smsFromNumber: smsFromNumber || null, vmCallerId: vmCallerId || null } });
        created++;
      } catch {}
    }
    res.json({ ok: true, created });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'import error' });
  }
});

// Google OAuth2 / Gmail
function createOAuthClient() {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

app.get('/api/auth/google/initiate', async (req: any, res) => {
  try {
    const userId = (req.user?.id || req.query.userId || '').toString();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const oauth2Client = createOAuthClient();
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ];
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes, include_granted_scopes: true, state: JSON.stringify({ userId }) });
    res.json({ url });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'oauth error' });
  }
});

app.get('/api/auth/google/callback', async (req: any, res) => {
  try {
    const code = (req.query.code || '').toString();
    const state = (() => { try { return JSON.parse((req.query.state || '').toString() || '{}'); } catch { return {}; } })();
    const userId = (state && state.userId) ? String(state.userId) : '';
    if (!code || !userId) return res.status(400).json({ error: 'missing code or userId' });
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const me = await oauth2.userinfo.get();
    const googleEmail = (me.data && (me.data as any).email) ? String((me.data as any).email) : null;
    await prisma.user.update({ where: { id: userId }, data: {
      googleAccessToken: tokens.access_token || null,
      googleRefreshToken: tokens.refresh_token || null,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleScope: Array.isArray(tokens.scope) ? (tokens.scope as any).join(' ') : ((tokens.scope as any) || null),
      googleEmail,
    } });
    res.json({ ok: true, googleEmail });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'callback error' });
  }
});

app.post('/api/gmail/sync', async (req, res) => {
  try {
    const body = z.object({ userId: z.string(), days: z.number().optional() }).parse(req.body || {});
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user || !user.googleRefreshToken) return res.status(400).json({ error: 'Google not connected' });
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const sinceDays = Math.max(1, Math.min(60, body.days || 30));
    const sent = await prisma.message.findMany({
      where: { direction: 'out', subject: { not: null }, convo: { contact: { email: { not: null } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { convo: { include: { contact: true } } },
    });

    let imported = 0;
    for (const m of sent) {
      const contactEmail = (m as any).convo?.contact?.email as string | undefined;
      const subject = m.subject as string | undefined;
      if (!contactEmail || !subject) continue;
      const q = `from:${contactEmail} to:${user.googleEmail || user.email} subject:\"${subject.replace(/\\\"/g, '"')}\" newer_than:${sinceDays}d`;
      const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 5 });
      const msgs = list.data.messages || [];
      for (const gm of msgs) {
        const msgId = gm.id as string;
        const exists = await prisma.message.findFirst({ where: { provider: 'gmail', providerMessageId: msgId } });
        if (exists) continue;
        const full = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
        const snippet = full.data.snippet || '';
        await prisma.message.create({ data: { conversationId: m.conversationId, direction: 'in', text: snippet || '[Gmail reply]', subject: subject, provider: 'gmail', providerMessageId: msgId, providerThreadId: (full.data.threadId as any) || null, rawJson: JSON.stringify(full.data || {}) } });
        imported++;
      }
    }
    res.json({ ok: true, imported });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'sync error' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${port}`);
});


