import twilio from 'twilio';

function doFetch(url: string, init?: any) {
  const f: any = (globalThis as any).fetch;
  if (!f) {
    throw new Error('Global fetch not available in runtime');
  }
  return f(url, init);
}

export type SendSmsInput = {
  to: string;
  text: string;
  fromNumber?: string;
};

export type SendSmsResult = {
  sent: boolean;
  provider: 'twilio' | 'bonzo' | 'mock';
  sid?: string;
  raw?: any;
};

function normalizePhoneToE164BestEffort(input: string): string {
  let val = (input || '').trim();
  if (val && !/^\+\d+$/i.test(val)) {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 10) val = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) val = `+${digits}`;
  }
  return val;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase() as 'bonzo' | 'twilio' | 'mock' | '';
  const to = normalizePhoneToE164BestEffort(input.to);

  // Bonzo provider via configurable endpoint
  if (provider === 'bonzo') {
    const baseUrl = process.env.BONZO_API_BASE_URL || '';
    const apiKey = process.env.BONZO_API_KEY || '';
    const fromNumber = input.fromNumber || process.env.BONZO_FROM_NUMBER || '';
    const sendPath = process.env.BONZO_SEND_PATH || '/messages/send';
    const authHeader = process.env.BONZO_AUTH_HEADER || 'Authorization';
    const authScheme = (process.env.BONZO_AUTH_SCHEME ?? 'Bearer');
    const onBehalfOf = process.env.BONZO_ON_BEHALF_OF || '';

    if (!baseUrl || !apiKey) {
      // fall through to mock if missing config
    } else {
      const baseTrimmed = baseUrl.replace(/\/$/, '');
      const isV3 = /\/v3(\/|$)/.test(sendPath);
      const needsApiPath = isV3 && /https?:\/\/app\.getbonzo\.com(\/|$)/i.test(baseTrimmed) && !/\/api(\/|$)/i.test(baseTrimmed);
      const effectiveBase = needsApiPath ? `${baseTrimmed}/api` : baseTrimmed;
      const url = `${effectiveBase}${sendPath}`;
      // Use Bonzo v3 payload when targeting their v3 API; otherwise legacy payload
      const body = (isV3
        ? {
            first_name: 'Contact',
            phone: to,
            message: input.text,
            send_as: (process.env.BONZO_SEND_AS || 'owner'),
          }
        : {
            to,
            from: fromNumber || undefined,
            message: input.text,
            text: input.text,
            send_as: process.env.BONZO_SEND_AS || undefined,
          }) as any;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (authHeader) {
        headers[authHeader] = authScheme ? `${authScheme} ${apiKey}` : apiKey;
      }
      if (onBehalfOf) {
        headers['On-Behalf-Of'] = onBehalfOf;
      }
      const res = await doFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.error('Bonzo send failed', { status: res.status, url, body, raw });
        return { sent: false, provider: 'bonzo', raw };
      }
      const data = await res.json().catch(() => ({}));
      // v3 responds as { data: { id, ... } }
      const sid = (data && (data.id || data.sid || (data.data && data.data.id))) ? (data.id || data.sid || (data.data && data.data.id)) : undefined;
      return { sent: true, provider: 'bonzo', sid, raw: data };
    }
  }

  // Twilio fallback (existing behavior)
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_MESSAGING_SERVICE_SID } = process.env as any;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_FROM_NUMBER || TWILIO_MESSAGING_SERVICE_SID)) {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const fromOverride = input.fromNumber ? normalizePhoneToE164BestEffort(input.fromNumber) : undefined;
      const msg = await client.messages.create({
        to,
        from: TWILIO_MESSAGING_SERVICE_SID ? undefined : (fromOverride || TWILIO_FROM_NUMBER),
        messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID || undefined,
        body: input.text,
      });
      return { sent: true, provider: 'twilio', sid: msg.sid, raw: msg };
    } catch (e: any) {
      return { sent: false, provider: 'twilio', raw: { error: e?.message || 'twilio send error' } };
    }
  }

  // Mock if nothing configured
  return { sent: false, provider: 'mock' };
}


