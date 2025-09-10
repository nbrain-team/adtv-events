import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

type CalEvent = { id: string; title: string; date: string; kind: 'virtual'|'in_person' };

export function Calendar() {
  const [events, setEvents] = useState<CalEvent[]>([
    { id: 'e1', title: 'Virtual Event – Q&A', date: dayjs().add(3, 'day').format('YYYY-MM-DD'), kind: 'virtual' },
    { id: 'e2', title: 'Open House – Downtown', date: dayjs().add(10, 'day').format('YYYY-MM-DD'), kind: 'in_person' },
  ]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [kind, setKind] = useState<'virtual'|'in_person'>('virtual');

  const grouped = useMemo(() => {
    return events.reduce<Record<string, CalEvent[]>>((acc, ev) => {
      const prev = acc[ev.date] ?? [];
      acc[ev.date] = [...prev, ev];
      return acc;
    }, {} as Record<string, CalEvent[]>);
  }, [events]);

  const add = () => {
    setEvents((s) => [{ id: Math.random().toString(36).slice(2), title, date, kind }, ...s]);
    setTitle('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events Calendar</h1>
          <p className="text-sm text-gray-600">Add and edit events (mock)</p>
        </div>
      </div>

      <div className="card grid md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="virtual">Virtual</option>
            <option value="in_person">In Person</option>
          </select>
        </div>
        <button className="btn-primary btn-md" onClick={add}>Add Event</button>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([d, list]) => (
          <div key={d} className="card">
            <p className="text-sm text-gray-500">{dayjs(d).format('MMM D, YYYY')}</p>
            <ul className="mt-2 space-y-2">
              {list.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between">
                  <span className="font-medium">{ev.title}</span>
                  <span className={ev.kind === 'virtual' ? 'badge-primary' : 'badge-gray'}>{ev.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}


