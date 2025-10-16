function doFetch(url: string, init?: any) {
  const f: any = (globalThis as any).fetch;
  if (!f) throw new Error('Global fetch not available in runtime');
  return f(url, init);
}

const baseUrl = (process.env.BONZO_API_BASE_URL || '').replace(/\/$/, '');
const apiKey = process.env.BONZO_API_KEY || '';
const authHeader = process.env.BONZO_AUTH_HEADER || 'Authorization';
const authScheme = (process.env.BONZO_AUTH_SCHEME ?? 'Bearer');

function headers(extra?: Record<string,string>) {
  const h: Record<string,string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (authHeader && apiKey) h[authHeader] = authScheme ? `${authScheme} ${apiKey}` : apiKey;
  if (extra) Object.assign(h, extra);
  return h;
}

export type CreateProspectInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  externalId?: string;
};

export async function createProspect(input: CreateProspectInput): Promise<{ id?: number; raw?: any }> {
  if (!baseUrl || !apiKey) return { id: undefined };
  const url = `${baseUrl}/v3/prospects`;
  const body: any = {
    first_name: input.firstName || (input.email ? input.email.split('@')[0] : 'Prospect'),
    last_name: input.lastName || null,
    email: input.email || null,
    phone: input.phone || null,
    external_id: input.externalId || null,
  };
  const res = await doFetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) {
    const raw = await res.text().catch(()=> '');
    // eslint-disable-next-line no-console
    console.error('Bonzo create prospect failed', { status: res.status, url, body, raw });
    return { id: undefined, raw };
  }
  const data = await res.json().catch(()=> ({}));
  const id = data?.data?.id ?? data?.id;
  return { id, raw: data };
}

export async function optInProspect(prospectId: number, type: 'sms'|'email' = 'sms'): Promise<boolean> {
  if (!baseUrl || !apiKey || !prospectId) return false;
  const url = `${baseUrl}/v3/prospects/${prospectId}/opt-in/${type}`;
  const res = await doFetch(url, { method: 'POST', headers: headers() });
  if (!res.ok) {
    const raw = await res.text().catch(()=> '');
    // eslint-disable-next-line no-console
    console.error('Bonzo opt-in failed', { status: res.status, url, raw });
    return false;
  }
  return true;
}





