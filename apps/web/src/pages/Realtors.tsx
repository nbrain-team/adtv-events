import { useMemo, useState } from 'react';

type Realtor = { id: string; name: string; email: string; phone: string; role: 'owner'|'admin'|'marketer'|'analyst'|'support' };

export function Realtors() {
  const [realtors, setRealtors] = useState<Realtor[]>([
    { id: 'r1', name: 'Jane Realtor', email: 'jane@example.com', phone: '+1 555‑0001', role: 'owner' },
    { id: 'r2', name: 'Alex Marketer', email: 'alex@example.com', phone: '+1 555‑0002', role: 'marketer' },
  ]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all'|Realtor['role']>('all');

  const filtered = useMemo(() => {
    return realtors.filter((r) => {
      const matchesQuery = r.name.toLowerCase().includes(query.toLowerCase()) || r.email.toLowerCase().includes(query.toLowerCase());
      const matchesRole = role === 'all' ? true : r.role === role;
      return matchesQuery && matchesRole;
    });
  }, [realtors, query, role]);

  const add = () => {
    setRealtors((s) => [{ id: Math.random().toString(36).slice(2), name: 'New Realtor', email: 'new@example.com', phone: '', role: 'marketer' }, ...s]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Realtors</h1>
          <p className="text-sm text-gray-600">Manage members and roles (mock)</p>
        </div>
        <button className="btn-primary btn-md" onClick={add}>Add Realtor</button>
      </div>

      <div className="flex gap-3">
        <input className="input" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-48" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="all">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="marketer">Marketer</option>
          <option value="analyst">Analyst</option>
          <option value="support">Support</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2">{r.phone}</td>
                <td className="px-4 py-2"><span className="badge-gray">{r.role}</span></td>
                <td className="px-4 py-2 text-right"><button className="btn-outline btn-sm">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


