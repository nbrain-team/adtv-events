import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useStore } from '@store/useStore';
import { apiInbox } from '@lib/api';

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

const seedActivities: Activity[] = [
  { id: 'a1', contact: { id: 'c1', name: 'Ava Johnson' }, channel: 'sms', direction: 'inbound', body: 'What time does the event start?', time: dayjs().subtract(5, 'minute').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N70', intercepted: true },
  { id: 'a2', contact: { id: 'c2', name: 'Noah Lee' }, channel: 'email', direction: 'inbound', subject: 'RSVP link not working', body: 'The Calendly link seems broken.', time: dayjs().subtract(15, 'minute').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N50', intercepted: true },
  { id: 'a3', contact: { id: 'c3', name: 'Mia Chen' }, channel: 'sms', direction: 'outbound', body: 'Hi Mia, doors open at 5:30pm!', time: dayjs().subtract(4, 'minute').toISOString() },
  { id: 'a4', contact: { id: 'c4', name: 'Ethan Patel' }, channel: 'email', direction: 'outbound', subject: 'Re: RSVP link not working', body: 'Try this link instead: calend.ly/alt', time: dayjs().subtract(12, 'minute').toISOString() },
  { id: 'a5', contact: { id: 'c5', name: 'Sophia Gomez' }, channel: 'sms', direction: 'inbound', body: 'Can I bring a guest?', time: dayjs().subtract(25, 'minute').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N21', intercepted: true },
  { id: 'a6', contact: { id: 'c6', name: 'Liam Carter' }, channel: 'email', direction: 'inbound', subject: 'Parking?', body: 'Is parking available?', time: dayjs().subtract(40, 'minute').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N63', intercepted: true },
  { id: 'a7', contact: { id: 'c7', name: 'Olivia Rivera' }, channel: 'sms', direction: 'inbound', body: 'Stop', time: dayjs().subtract(1, 'hour').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N12', intercepted: true },
  { id: 'a8', contact: { id: 'c8', name: 'James Kim' }, channel: 'email', direction: 'inbound', subject: 'Question about the lender talk', body: 'Will there be a mortgage lender present?', time: dayjs().subtract(2, 'hour').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N20', intercepted: true },
  { id: 'a9', contact: { id: 'c9', name: 'Zoe Brooks' }, channel: 'sms', direction: 'inbound', body: 'Running late 10 min', time: dayjs().subtract(3, 'hour').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N60', intercepted: true },
  { id: 'a10', contact: { id: 'c10', name: 'Henry Davis' }, channel: 'email', direction: 'inbound', subject: 'Dietary options', body: 'Any vegetarian snacks?', time: dayjs().subtract(5, 'hour').toISOString(), campaignId: 'cmp_event_ad_tv', nodeId: 'N62', intercepted: true },
];

export function Inbox() {
  dayjs.extend(relativeTime);
  const { addToast } = useStore();
  const [activities, setActivities] = useState<Activity[]>(seedActivities);
  useEffect(() => {
    // Load conversations/messages into activity list (mock mapping)
    apiInbox.conversations().then((convos: any[]) => {
      const mapped: Activity[] = [];
      convos.forEach((c) => {
        (c.messages||[]).forEach((m: any) => mapped.push({
          id: m.id,
          contact: { id: c.contactId, name: c.contact?.name || 'Contact' },
          channel: (c.channel === 'sms' ? 'sms' : 'email') as Channel,
          direction: (m.direction === 'in' ? 'inbound' : 'outbound') as Direction,
          body: m.text,
          time: m.createdAt,
        }));
      });
      if (mapped.length) setActivities((s) => [...mapped, ...s]);
    }).catch(()=>{});
  }, []);
  const [selectedId, setSelectedId] = useState<string>(activities[0]?.id ?? '');
  const [filter, setFilter] = useState<'all' | Channel>('all');
  const [reply, setReply] = useState('');
  const selected = useMemo(() => activities.find((a) => a.id === selectedId), [activities, selectedId]);

  const filtered = useMemo(() => {
    return activities.filter((a) => (filter === 'all' ? true : a.channel === filter));
  }, [activities, filter]);

  const sendReply = () => {
    if (!selected) return;
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
    // Persist to backend if a conversation exists
    apiInbox.sendMessage({ contactId: selected.contact.id, text: reply, direction: 'out' }).catch(()=>{});
    setReply('');
    addToast({ title: 'Reply sent', description: `Responded to ${selected.contact.name}`, variant: 'success' });
  };

  const recheckIntoAutomation = (nodeId: string) => {
    if (!selected) return;
    setActivities((s) => s.map((a) => (a.id === selected.id ? { ...a, intercepted: false, nodeId } : a)));
    addToast({ title: 'Re‑enrolled', description: `Contact moved to stage ${nodeId}`, variant: 'info' });
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
                {a.intercepted && <span className="badge-warning">Intercepted</span>}
              </div>
              <p className="text-sm text-gray-700 line-clamp-2 mt-1">{a.subject ? `${a.subject} — ` : ''}{a.body}</p>
            </button>
          ))}
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
                <div className="flex gap-2">
                  <button className="btn-outline btn-sm" onClick={() => recheckIntoAutomation('N54')}>Recheck at BDR Confirmation (N54)</button>
                  <button className="btn-outline btn-sm" onClick={() => recheckIntoAutomation('N63')}>Recheck at 8am SMS (N63)</button>
                  <button className="btn-outline btn-sm" onClick={() => recheckIntoAutomation('N82')}>Recheck at eSign (N82)</button>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <div className="border rounded p-3 bg-gray-50">
                  <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <textarea className="input h-32" placeholder={selected.channel === 'email' ? 'Write an email reply…' : 'Write an SMS reply…'} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button className="btn-secondary btn-sm">Insert Template</button>
                      <button className="btn-secondary btn-sm">Attach Media</button>
                    </div>
                    <button className="btn-primary btn-md" onClick={sendReply} disabled={!reply.trim()}>Send</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold mb-2">Conversation (mock)</h3>
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


