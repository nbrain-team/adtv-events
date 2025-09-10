const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

async function getJson(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

async function sendJson(method: string, path: string, body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed`);
  return res.json();
}

// Templates
export const apiTemplates = {
  list: () => getJson('/api/templates'),
  get: (id: string) => getJson(`/api/templates/${id}`),
  create: (name: string, graph: { nodes: any[]; edges: any[] }) => sendJson('POST', '/api/templates', { name, graph }),
  saveGraph: (id: string, graph: { nodes: any[]; edges: any[] }) => sendJson('PUT', `/api/templates/${id}/graph`, graph),
};

// Campaigns
export const apiCampaigns = {
  list: () => getJson('/api/campaigns'),
  create: (payload: any) => sendJson('POST', '/api/campaigns', payload),
  patch: (id: string, payload: any) => sendJson('PATCH', `/api/campaigns/${id}`, payload),
  contacts: (id: string) => getJson(`/api/campaigns/${id}/contacts`),
  contactsBulk: (id: string, contacts: any[]) => sendJson('POST', `/api/campaigns/${id}/contacts/bulk`, { contacts }),
  contactAdd: (id: string, contact: any) => sendJson('POST', `/api/campaigns/${id}/contacts`, contact),
  graph: (id: string) => getJson(`/api/campaigns/${id}/graph`),
  stats: (id: string) => getJson(`/api/campaigns/${id}/stats`),
};

// Inbox
export const apiInbox = {
  conversations: () => getJson('/api/conversations'),
  sendMessage: (opts: { conversationId?: string; contactId?: string; text: string; direction: 'in'|'out' }) => sendJson('POST', '/api/messages', opts),
};

export const apiEmail = {
  send: (payload: { to: string; subject: string; body: string; userId?: string; contactId?: string }) => sendJson('POST', '/api/email/send', payload),
};

export { API_URL };


