import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useStore } from '@store/useStore';
import { apiInbox, apiSms, apiEmail, apiCampaigns } from '@lib/api';

type Channel = 'sms' | 'email';
type Direction = 'inbound' | 'outbound';

type Activity = {
  id: string;
  contact: { id: string; name: string };
  channel: Channel;
  direction: Direction;
  subject?: string;
  body: string;
  time: string; // ISO
  campaignId?: string;
  nodeId?: string; // where automation paused
  intercepted?: boolean;
};

export function Inbox() {
  dayjs.extend(relativeTime);
  const { addToast, liveCampaigns } = useStore() as any;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState<'sms'|'email'>('sms');
  const [composeCampaignId, setComposeCampaignId] = useState<string>('');
  const [composeContactQuery, setComposeContactQuery] = useState('');
  const [composeCandidates, setComposeCandidates] = useState<any[]>([]);
  const [composeContact, setComposeContact] = useState<any | null>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  useEffect(() => {
    // Load conversations/messages into activity list (real data only)
    apiInbox
      .conversations()
      .then((convos: any[]) => {
        const mapped: Activity[] = [];
        convos.forEach((c) => {
          (c.messages || []).forEach((m: any) =>
            mapped.push({
              id: m.id,
              contact: { id: c.contactId, name: c.contact?.name || 'Contact' },
              channel: (c.channel === 'sms' ? 'sms' : 'email') as Channel,
              direction: (m.direction === 'in' ? 'inbound' : 'outbound') as Direction,
              body: m.text,
              time: m.createdAt,
              campaignId: c.contact?.campaignId || undefined,
            })
          );
        });
        // filter out demo contacts explicitly
        const cleaned = mapped.filter((a) => !/^Inbox Demo\b/i.test(a.contact.name || ''));
        // newest first
        cleaned.sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf());
        setActivities(cleaned);
      })
      .catch(() => {
        setActivities([]);
      });
  }, []);
  const [selectedId, setSelectedId] = useState<string>('');
  useEffect(() => {
    if (!selectedId && activities && activities.length > 0) setSelectedId(activities[0]?.id || '');
  }, [activities, selectedId]);
  const [filter, setFilter] = useState<'all' | Channel>('all');
  const [reply, setReply] = useState('');
  const selected = useMemo(() => activities.find((a) => a.id === selectedId), [activities, selectedId]);

  const filtered = useMemo(() => {
    return activities.filter((a) => (filter === 'all' ? true : a.channel === filter) && (campaignFilter==='all' ? true : a.campaignId === campaignFilter));
  }, [activities, filter, campaignFilter]);

  useEffect(() => {
    // If filtering removes the selected item, clear selection to avoid mismatch UI
    if (selectedId && !filtered.some((a) => a.id === selectedId)) {
      setSelectedId(filtered[0]?.id || '');
    }
    if (!selectedId && filtered.length === 0) {
      setSelectedId('');
    }
  }, [filtered, selectedId]);

  const loadCandidates = async (campaignId: string, q: string) => {
    if (!campaignId || q.trim().length < 1) { setComposeCandidates([]); return; }
    try {
      const list = await apiCampaigns.contacts(campaignId);
      const lowered = q.toLowerCase();
      const results = list.filter((c: any) => [c.name, c.email, c.phone].some((v)=> String(v||'').toLowerCase().includes(lowered))).slice(0, 10);
      setComposeCandidates(results);
    } catch { setComposeCandidates([]); }
  };

  const sendReply = async () => {
    if (!selected) return;
    // Persist to backend first
    try {
      if (selected.channel === 'sms') {
        try { await apiSms.send({ to: '', text: reply, contactId: selected.contact.id }); }
        catch { await apiInbox.sendMessage({ contactId: selected.contact.id, text: reply, direction: 'out' }); }
      } else {
        await apiInbox.sendMessage({ contactId: selected.contact.id, text: reply, direction: 'out' });
      }
    } catch {}
    const outbound: Activity = {
      id: Math.random().toString(36).slice(2),
      contact: selected.contact,
      channel: selected.channel,
      direction: 'outbound',
      subject: selected.channel === 'email' ? `Re: ${selected.subject ?? ''}` : undefined,
      body: reply,
      time: new Date().toISOString(),
    };
    setActivities((s) => [outbound, ...s]);
    setReply('');
    addToast({ title: 'Reply sent', description: `Responded to ${selected.contact.name}`, variant: 'success' });
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Inbox</h1>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select className="input w-full" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
            <select className="input w-full" value={campaignFilter} onChange={(e)=> setCampaignFilter(e.target.value)}>
              <option value="all">All Campaigns</option>
              {liveCampaigns.map((c: any)=> (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="mt-2">
            <button className="btn-primary btn-sm w-full" onClick={()=> { setComposeOpen(true); setComposeType('sms'); setComposeCampaignId(''); setComposeContact(null); setComposeContactQuery(''); setComposeCandidates([]); setComposeSubject(''); setComposeBody(''); }}>Create Message</button>
          </div>
        </div>
        <div className="card divide-y divide-gray-100 p-0">
          {filtered.map((a) => (
            <button key={a.id} className={`w-full text-left p-3 ${selectedId === a.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`} onClick={() => setSelectedId(a.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{a.contact.name}</p>
                  <p className="text-xs text-gray-500">{a.channel.toUpperCase()} · {dayjs(a.time).fromNow()}</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2 mt-1">{a.subject ? `${a.subject} — ` : ''}{a.body}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No messages yet.</div>
          )}
        </div>
      </div>

      <div className="md:col-span-2">
        {!selected ? (
          <div className="card text-gray-500 min-h-[300px] flex items-center justify-center">Select a message.</div>
        ) : (
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selected.contact.name}</p>
                  <p className="text-xs text-gray-500">{selected.channel.toUpperCase()} · {dayjs(selected.time).format('MMM D, YYYY h:mm A')}</p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <div className="border rounded p-3 bg-gray-50">
                  <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <textarea className="input h-32" placeholder={selected.channel === 'email' ? 'Write an email reply…' : 'Write an SMS reply…'} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex items-center justify-between">
                    <div />
                    <button className="btn-primary btn-md" onClick={sendReply} disabled={!reply.trim()}>Send</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold mb-2">Conversation</h3>
              <ul className="space-y-2 text-sm">
                {activities
                  .filter((a) => a.contact.id === selected.contact.id)
                  .sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())
                  .map((a) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <span className={`badge-${a.direction === 'inbound' ? 'gray' : 'primary'}`}>{a.direction}</span>
                      <span className="text-gray-500">{dayjs(a.time).format('h:mm A')}:</span>
                      <span>{a.subject ? `${a.subject} — ` : ''}{a.body}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {composeOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={(e)=> { if (e.target===e.currentTarget) setComposeOpen(false); }}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Message</h3>
              <button className="btn-outline btn-sm" onClick={()=> setComposeOpen(false)}>Close</button>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" value={composeType} onChange={(e)=> setComposeType(e.target.value as any)}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="label">Campaign</label>
                <select className="input" value={composeCampaignId} onChange={(e)=> { setComposeCampaignId(e.target.value); setComposeContact(null); setComposeContactQuery(''); setComposeCandidates([]); }}>
                  <option value="">Select…</option>
                  {liveCampaigns.map((c: any)=> (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="label">Contact</label>
                <input className="input" placeholder="Type to search…" value={composeContactQuery} onChange={(e)=> { setComposeContactQuery(e.target.value); if (composeCampaignId) loadCandidates(composeCampaignId, e.target.value); }} />
                {composeCandidates.length>0 && (
                  <div className="border rounded mt-1 max-h-40 overflow-auto text-sm">
                    {composeCandidates.map((c)=> (
                      <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=> { setComposeContact(c); setComposeCandidates([]); setComposeContactQuery(`${c.name} · ${c.email||c.phone||''}`); }}>
                        {c.name} <span className="text-gray-500">{c.email||c.phone||''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {composeType==='email' && (
                <div className="md:col-span-3 space-y-2">
                  <input className="input" placeholder="Subject" value={composeSubject} onChange={(e)=> setComposeSubject(e.target.value)} />
                  <textarea className="input h-40" placeholder="Write your email…" value={composeBody} onChange={(e)=> setComposeBody(e.target.value)} />
                </div>
              )}
              {composeType==='sms' && (
                <div className="md:col-span-3">
                  <textarea className="input h-32" placeholder="Write your text message…" value={composeBody} onChange={(e)=> setComposeBody(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="btn-outline btn-sm" onClick={()=> setComposeOpen(false)}>Cancel</button>
              <button className="btn-primary btn-sm" disabled={!composeCampaignId || !composeContact || !composeBody.trim() || (composeType==='email' && !composeSubject.trim())} onClick={async ()=> {
                try {
                  if (composeType==='sms') {
                    try { await apiSms.send({ contactId: composeContact.id, text: composeBody }); }
                    catch { await apiInbox.sendMessage({ contactId: composeContact.id, text: composeBody, direction: 'out' }); }
                  } else {
                    await apiEmail.send({ contactId: composeContact.id, to: composeContact.email, subject: composeSubject, body: composeBody });
                  }
                  setComposeOpen(false);
                  setComposeBody(''); setComposeSubject(''); setComposeContact(null); setComposeContactQuery('');
                  addToast({ title: 'Message queued', variant: 'success' });
                } catch {}
              }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


