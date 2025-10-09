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

  const baseUrl = process.env.SLYBROADCAST_API_BASE_URL || 'https://www.mobile-sphere.com/gateway/vmb.php';
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
  const audio_ext = (audio_url || '').toLowerCase().endsWith('.m4a') ? 'm4a' : ((audio_url || '').toLowerCase().endsWith('.wav') ? 'wav' : 'mp3');

  // v3 API accepts either legacy c_* fields or newer fields; use documented fields
  const payload: Record<string, string> = {
    'campaign_id': input.campaignId || '',
    'caller_id': input.callerId || input.from || '',
    'audio_url': audio_url,
    'list': numbers,
    's': '1',
    'date': input.scheduleAt || 'now',
    'msg': input.note || '',
    'source': 'api',
    'method': 'new',
    'c_uid': user,
    'c_password': password,
  };

  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) form.append(k, v);

  let res = await doFetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  let text = await res.text().catch(() => '');
  if (!res.ok || !text) {
    // Fallback to legacy c_* fields if first attempt failed
    const legacy = new URLSearchParams();
    legacy.append('c_uid', user);
    legacy.append('c_password', password);
    legacy.append('c_url', audio_url);
    legacy.append('c_audio', audio_ext);
    legacy.append('c_phone', numbers);
    legacy.append('c_callerID', input.callerId || input.from || '');
    legacy.append('c_date', input.scheduleAt || 'now');
    legacy.append('c_title', input.campaignId || '');
    res = await doFetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: legacy.toString() });
    text = await res.text().catch(() => '');
    if (!res.ok && !text) {
      return { queued: false, provider: 'slybroadcast', raw: 'no response' };
    }
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


