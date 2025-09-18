import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useStore } from '@store/useStore';
import { apiInbox, apiSms } from '@lib/api';

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
  const { addToast } = useStore();
  const [activities, setActivities] = useState<Activity[]>([]);
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
    return activities.filter((a) => (filter === 'all' ? true : a.channel === filter));
  }, [activities, filter]);

  const sendReply = async () => {
    if (!selected) return;
    // Persist to backend first
    try {
      if (selected.channel === 'sms') {
        // We don't have the phone number in activity; rely on server to route by contactId
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
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">Inbox</h1>
          <select className="input w-36" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
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
          <div className="card text-gray-500">Select a message.</div>
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
    </div>
  );
}


