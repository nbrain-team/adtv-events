import { useMemo, useState } from 'react';
import { useStore } from '@store/useStore';
import { CreateCampaignModal } from '@components/CreateCampaignModal';

export function Campaigns() {
  const { campaigns, upsertCampaign } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all'|'draft'|'published'|'archived'>('all');

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'all' ? true : c.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [campaigns, query, status]);

  const createCampaign = () => setOpen(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-gray-600">Create, manage, and simulate campaigns (static)</p>
        </div>
        <button className="btn-primary btn-md" onClick={createCampaign}>+ Funnel Template</button>
      </div>

      <div className="flex gap-3">
        <input className="input" placeholder="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <a key={c.id} href={`/campaigns/${c.id}`} className="card block hover:shadow-soft-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-gray-500">v{c.version} · {c.status}</p>
              </div>
              <span className="badge-primary">{c.graph.nodes.length} nodes</span>
            </div>
          </a>
        ))}
      </div>

      <CreateCampaignModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}


