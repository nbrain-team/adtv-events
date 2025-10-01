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
  provider: 'slybroadcast' | 'mock';
  id?: string;
  raw?: any;
};

function normalizePhoneToUS(input: string): string {
  const d = (input || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length === 10) return d;
  return d;
}

// Minimal Slybroadcast integration (v3 HTTP API)
// Docs reference: https://www.slybroadcast.com/ (account API section)
function doFetch(url: string, init?: any) {
  const f: any = (globalThis as any).fetch;
  if (!f) {
    throw new Error('Global fetch not available in runtime');
  }
  return f(url, init);
}

export async function sendVoicemailDrop(input: VoicemailDropInput): Promise<VoicemailDropResult> {
  const provider = (process.env.VOICEMAIL_PROVIDER || 'slybroadcast').toLowerCase();
  if (provider !== 'slybroadcast') {
    return { queued: false, provider: 'mock' };
  }

  const baseUrl = process.env.SLYBROADCAST_API_BASE_URL || 'https://www.slybroadcast.com/gateway/vmb.php';
  const user = process.env.SLYBROADCAST_USERNAME || '';
  const password = process.env.SLYBROADCAST_PASSWORD || '';

  // Slybroadcast expects form-encoded parameters
  if (!user || !password) {
    return { queued: false, provider: 'slybroadcast', raw: { error: 'missing credentials' } };
  }

  const numbers = normalizePhoneToUS(input.to);

  // Slybroadcast requires either an audio URL, an existing audio id, or an uploaded file.
  // We'll prefer audioUrl. If not present, attempt to use ElevenLabs preview via env default.
  // Reject data: URLs since Slybroadcast must fetch a public URL
  const isDataUrl = !!(input.audioUrl && input.audioUrl.startsWith('data:'));
  let audio_url = (!isDataUrl && input.audioUrl) ? input.audioUrl : (process.env.SLYBROADCAST_DEFAULT_AUDIO_URL || '');

  const payload: Record<string, string> = {
    // see API for keys; 'cid' is campaign id, 'caller_id', 'audio_url'
    'c_uid': user,
    'c_password': password,
    'campaign_id': input.campaignId || '',
    'caller_id': input.callerId || input.from || '',
    'audio_url': audio_url,
    'list': numbers,
    's': input.scheduleAt ? '1' : '0',
    'date': input.scheduleAt || '',
    'msg': input.note || '',
    'source': 'adtv-event-automation',
    'method': 'send_blast',
  };

  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) form.append(k, v);

  const res = await doFetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return { queued: false, provider: 'slybroadcast', raw: text };
  }

  // Slybroadcast returns simple text or JSON depending on account. Try JSON first.
  try {
    const data = JSON.parse(text);
    const id = (data && (data.campaign_id || data.id)) ? (data.campaign_id || data.id) : undefined;
    return { queued: true, provider: 'slybroadcast', id, raw: data };
  } catch {
    // if not JSON, return raw text
    return { queued: true, provider: 'slybroadcast', raw: text };
  }
}


