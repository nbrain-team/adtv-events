import { useMemo, useState } from 'react';

type Lead = { id: string; name: string; email?: string; phone?: string; source: 'landing'|'upload'|'manual'; status: 'new'|'contacted'|'qualified'|'unqualified' };

export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([
    { id: 'l1', name: 'Chris Pine', email: 'chris@example.com', source: 'landing', status: 'new' },
    { id: 'l2', name: 'Taylor Swift', phone: '+1 555‑1111', source: 'upload', status: 'contacted' },
  ]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all'|Lead['status']>('all');

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const q = query.toLowerCase();
      const matchesQuery = l.name.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q);
      const matchesStatus = status === 'all' ? true : l.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [leads, query, status]);

  const add = () => setLeads((s) => [{ id: Math.random().toString(36).slice(2), name: 'New Lead', source: 'manual', status: 'new' }, ...s]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads & Landing</h1>
          <p className="text-sm text-gray-600">Capture preview and funnel (mock)</p>
        </div>
        <button className="btn-primary btn-md" onClick={add}>Add Lead</button>
      </div>

      <div className="flex gap-3">
        <input className="input" placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2">{l.email || l.phone || '-'}</td>
                <td className="px-4 py-2"><span className="badge-gray">{l.source}</span></td>
                <td className="px-4 py-2"><span className="badge-primary">{l.status}</span></td>
                <td className="px-4 py-2 text-right"><button className="btn-outline btn-sm">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


