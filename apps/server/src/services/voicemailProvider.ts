export type VoicemailDropInput = {
  to: string;
  audioUrl?: string; // pre-recorded mp3 url
  audioFileId?: string; // for future: uploaded media id
  campaignId?: string;
  from?: string;
  scheduleAt?: string; // ISO datetime for scheduling
  callerId?: string; // optional caller id
  note?: string;
};

export type VoicemailDropResult = {
  queued: boolean;
  provider: 'dropcowboy' | 'mock';
  id?: string;
  raw?: any;
};

function normalizePhone10(input: string): string {
  const d = (input || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length >= 10) return d.slice(-10);
  return d;
}

// Minimal HTTP wrapper
function doFetch(url: string, init?: any) {
  const f: any = (globalThis as any).fetch;
  if (!f) {
    throw new Error('Global fetch not available in runtime');
  }
  return f(url, init);
}

export async function sendVoicemailDrop(input: VoicemailDropInput): Promise<VoicemailDropResult> {
  const provider = 'dropcowboy';

  const endpoint = (process.env.DROPCOWBOY_API_URL || '').trim() || `${(process.env.DROPCOWBOY_API_BASE_URL || 'https://api.dropcowboy.com/v1').replace(/\/$/, '')}/voicemail`;
  const apiKey = process.env.DROPCOWBOY_API_KEY || '';
  const apiSecret = process.env.DROPCOWBOY_API_SECRET || '';
  const bearer = process.env.DROPCOWBOY_BEARER_TOKEN || '';

  const toNumber = normalizePhone10(input.to);
  const callerId = normalizePhone10(input.callerId || input.from || '');
  const audioUrl = (input.audioUrl || '').startsWith('data:') ? '' : (input.audioUrl || '');
  if (!audioUrl) {
    return { queued: false, provider, raw: { error: 'audioUrl required' } };
  }
  if (!toNumber) {
    return { queued: false, provider, raw: { error: 'destination required' } };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  if (!bearer && apiKey) headers['X-API-KEY'] = apiKey;
  if (!bearer && apiSecret) headers['X-API-SECRET'] = apiSecret;

  const payload = {
    to: toNumber,
    caller_id: callerId || undefined,
    audio_url: audioUrl,
    schedule_at: input.scheduleAt || undefined,
    title: input.campaignId || undefined,
    note: input.note || undefined,
  } as any;

  try {
    const res = await doFetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return { queued: false, provider, raw: text || `HTTP ${res.status}` };
    }
    try {
      const data = JSON.parse(text);
      const id = data?.id || data?.message_id || data?.session_id;
      return { queued: true, provider, id, raw: data };
    } catch {
      return { queued: true, provider, raw: text };
    }
  } catch (e: any) {
    return { queued: false, provider, raw: e?.message || 'network error' };
  }
}


