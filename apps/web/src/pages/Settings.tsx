import { useEffect, useState } from 'react';
import { apiAuth, apiGoogle } from '../lib/api';

export function Settings() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => {
    apiAuth.me().then(setMe).catch(() => setMe(null));
  }, []);
  const testSend = async () => {
    const num = window.prompt('Enter phone number (E.164 or US local)');
    if (!num) return;
    try {
      const res = await fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: num, text: 'ADTV test from Settings' })
      });
      const data = await res.json().catch(()=>({}));
      alert(res.ok ? `Sent (or simulated). Details: ${JSON.stringify(data)}` : `Send failed: ${JSON.stringify(data)}`);
    } catch (e) {
      alert('Send error');
    }
  };
  const testVoicemail = async () => {
    const num = window.prompt('Enter phone number for voicemail drop (US local or E.164)');
    if (!num) return;
    try {
      const res = await fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/voicemail/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: num, ttsScript: 'Hey, this is ADTV with a quick invite. Call me back when you can!' })
      });
      const data = await res.json().catch(()=>({}));
      alert(res.ok ? `Queued (or simulated). Details: ${JSON.stringify(data)}` : `Drop failed: ${JSON.stringify(data)}`);
    } catch (e) {
      alert('Drop error');
    }
  };
  const doLogin = async () => {
    const email = window.prompt('Email');
    const password = window.prompt('Password');
    if (!email || !password) return;
    try {
      const r = await apiAuth.login(email, password);
      localStorage.setItem('auth_token', r.token);
      const meData = await apiAuth.me();
      setMe(meData);
      alert('Logged in');
    } catch (e) {
      alert('Login failed');
    }
  };
  const connectGoogle = async () => {
    if (!me?.id) return alert('Login first');
    try {
      const { url } = await apiGoogle.initiate(me.id);
      window.location.href = url;
    } catch (e) {
      alert('Google initiate failed');
    }
  };
  const syncGmail = async () => {
    if (!me?.id) return alert('Login first');
    try {
      const out = await apiGoogle.sync(me.id, 30);
      alert(`Imported ${out.imported} replies`);
    } catch (e) {
      alert('Sync failed');
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-600">Branding and integrations</p>
        <div className="mt-3 flex items-center gap-3">
          {!me && <button className="btn-primary btn-sm" onClick={doLogin}>Login</button>}
          {me && <span className="text-sm text-gray-700">Logged in as {me.email}</span>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold">Branding</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Logo</label>
              <input className="input" placeholder="Upload mock" />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <input className="input" type="color" defaultValue="#4f46e5" />
            </div>
            <button className="btn-primary btn-md">Save</button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Integrations</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Gmail</label>
              <div className="flex items-center gap-2">
                <button className="btn-primary btn-sm" onClick={connectGoogle}>Connect Google</button>
                <button className="btn-secondary btn-sm" onClick={syncGmail}>Sync Replies</button>
              </div>
              {me?.googleEmail && <p className="text-xs text-gray-600 mt-1">Connected: {me.googleEmail}</p>}
            </div>
            <div>
              <label className="label">Email Provider</label>
              <select className="input">
                <option>Mock</option>
              </select>
            </div>
            <div>
              <label className="label">Twilio</label>
              <div className="flex items-center gap-2">
                <input className="input flex-1" placeholder="Send test SMS…" defaultValue="+17604940404" />
                <button className="btn-primary btn-sm" onClick={testSend}>Send Test</button>
              </div>
            </div>
            <div>
              <label className="label">Voicemail Drop (Slybroadcast)</label>
              <div className="flex items-center gap-2">
                <input className="input flex-1" placeholder="Queue test voicemail…" defaultValue="+17604940404" />
                <button className="btn-primary btn-sm" onClick={testVoicemail}>Queue Test</button>
              </div>
            </div>
            <div>
              <label className="label">Calendly</label>
              <input className="input" placeholder="Webhook key (mock)" />
            </div>
            <button className="btn-primary btn-md">Connect</button>
          </div>
        </div>
      </div>
    </div>
  );
}


