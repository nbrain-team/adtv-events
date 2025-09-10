import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '@store/useStore';
import type { SeedCampaign } from '@seed/campaignSeed';

export function CampaignDetail() {
  const params = useParams();
  const { campaigns, upsertCampaign, addToast } = useStore();
  const found = useMemo(() => campaigns.find((c) => c.id === params.id), [campaigns, params.id]);
  const [tab, setTab] = useState<'overview' | 'edit' | 'json'>('overview');
  const [name, setName] = useState(found?.name ?? '');
  const [status, setStatus] = useState<SeedCampaign['status']>(found?.status ?? 'draft');

  if (!found) return <div className="text-gray-500">Campaign not found.</div>;

  const saveMeta = () => {
    upsertCampaign({ ...found, name, status });
    addToast({ title: 'Saved', description: 'Campaign details saved', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{found.name}</h1>
          <p className="text-sm text-gray-600">ID: {found.id}</p>
        </div>
        <a className="btn-outline btn-sm" href="/campaigns">Back</a>
      </div>

      <div className="flex gap-4 border-b">
        {(['overview','edit','json'] as const).map((t) => (
          <button key={t} className={`pb-2 ${tab === t ? 'text-primary-700 border-b-2 border-primary-700' : 'text-gray-600'}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Graph Nodes</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {found.graph.nodes.map((n) => (
                <div key={n.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{n.name}</p>
                    <p className="text-xs text-gray-500">{n.type} · {n.id}</p>
                  </div>
                  <button className="btn-outline btn-sm" onClick={() => addToast({ title: 'Node', description: `Clicked ${n.id}`, variant: 'info' })}>Open</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold">Details</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <button className="btn-primary btn-md w-full" onClick={saveMeta}>Save</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'edit' && (
        <div className="card">
          <p className="text-sm text-gray-600">Static mock editor: drag-and-drop disabled in this prototype. Click a node in Overview to simulate selection.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="btn-secondary btn-md">Add Email Node</button>
            <button className="btn-secondary btn-md">Add SMS Node</button>
            <button className="btn-secondary btn-md">Add Decision</button>
            <button className="btn-secondary btn-md">Add Wait</button>
          </div>
        </div>
      )}

      {tab === 'json' && (
        <div className="card">
          <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(found.graph, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}


