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
  const provider = (process.env.VOICEMAIL_PROVIDER || 'slybroadcast').toLowerCase();
  if (provider !== 'slybroadcast') {
    return { queued: false, provider: 'mock' };
  }

  const baseUrl = process.env.SLYBROADCAST_API_BASE_URL || 'https://www.mobile-sphere.com/gateway/vmb.php';
  const user = process.env.SLYBROADCAST_USERNAME || '';
  const password = process.env.SLYBROADCAST_PASSWORD || '';
  if (!user || !password) {
    return { queued: false, provider: 'slybroadcast', raw: { error: 'missing credentials' } };
  }

  const numbers = normalizePhone10(input.to);
  const isDataUrl = !!(input.audioUrl && input.audioUrl.startsWith('data:'));
  let audio_url = (!isDataUrl && input.audioUrl) ? input.audioUrl : (process.env.SLYBROADCAST_DEFAULT_AUDIO_URL || '');
  const audio_ext = (audio_url || '').toLowerCase().endsWith('.m4a') ? 'm4a' : ((audio_url || '').toLowerCase().endsWith('.wav') ? 'wav' : 'mp3');

  const legacy = new URLSearchParams();
  legacy.append('c_uid', user);
  legacy.append('c_password', password);
  legacy.append('c_url', audio_url);
  legacy.append('c_audio', audio_ext);
  legacy.append('c_phone', numbers);
  legacy.append('c_callerID', normalizePhone10(input.callerId || input.from || ''));
  legacy.append('c_date', input.scheduleAt || 'now');
  legacy.append('c_title', input.campaignId || '');
  if ((process.env.SLYBROADCAST_MOBILE_ONLY || '') === '1') legacy.append('mobile_only', '1');
  if ((process.env.SLYBROADCAST_DISPO_URL || '').trim()) legacy.append('c_dispo_url', String(process.env.SLYBROADCAST_DISPO_URL));
  let res = await doFetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: legacy.toString() });
  let text = await res.text().catch(() => '');
  const looksError = (s: string) => /error|invalid|fail/i.test(s || '');
  if (!res.ok || !text || looksError(text)) {
    const modern = new URLSearchParams();
    modern.append('campaign_id', input.campaignId || '');
    modern.append('caller_id', normalizePhone10(input.callerId || input.from || ''));
    modern.append('audio_url', audio_url);
    modern.append('list', numbers);
    modern.append('s', '1');
    modern.append('date', input.scheduleAt || 'now');
    modern.append('msg', input.note || '');
    modern.append('source', 'api');
    modern.append('method', 'new');
    modern.append('c_uid', user);
    modern.append('c_password', password);
    res = await doFetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: modern.toString() });
    text = await res.text().catch(() => '');
    if (!res.ok || !text || looksError(text)) {
      return { queued: false, provider: 'slybroadcast', raw: text || 'no response' };
    }
  }

  try {
    const data = JSON.parse(text);
    const id = (data && (data.campaign_id || data.id)) ? (data.campaign_id || data.id) : undefined;
    return { queued: true, provider: 'slybroadcast', id, raw: data };
  } catch {
    // legacy OK string e.g., "OK session_id=123456 number of phone=1"
    const m = /^\s*OK\s+session_id=([^\s]+)\b/i.exec(text || '');
    const id = m ? m[1] : undefined;
    return { queued: true, provider: 'slybroadcast', id, raw: text };
  }
}


