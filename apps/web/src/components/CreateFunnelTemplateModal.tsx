import { useState } from 'react';
import { useStore } from '@store/useStore';
import { eventCampaignGraph } from '@seed/campaignSeed';
import { apiTemplates } from '@lib/api';

type Props = { open: boolean; onClose: () => void };

export function CreateFunnelTemplateModal({ open, onClose }: Props) {
  const { upsertCampaign, addToast } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initMode, setInitMode] = useState<'blank'|'seed'>('blank');

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ title: 'Name is required', variant: 'warning' });
      return;
    }
    const id = 'tpl_' + Math.random().toString(36).slice(2, 8);
    const graph = initMode === 'seed'
      ? JSON.parse(JSON.stringify(eventCampaignGraph))
      : {
          schema_version: 1,
          nodes: [
            { id: 'N00', type: 'start', name: 'Start' },
            { id: 'N10', type: 'stage', name: 'Campaign' },
          ],
          edges: [
            { from: 'N00', to: 'N10' },
          ],
          start_rules: {},
        };

    upsertCampaign({ id, name, status: 'draft', version: 1, graph });
    // Persist to backend (best-effort)
    try {
      await apiTemplates.create(name, { nodes: graph.nodes, edges: graph.edges });
    } catch {}
    addToast({ title: 'Funnel Template created', description: name, variant: 'success' });
    setName(''); setDescription(''); setInitMode('blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">New Funnel Template</h3>
          <button className="btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>

        <div>
          <label className="label">Template Name</label>
          <input className="input" value={name} onChange={(e)=> setName(e.target.value)} placeholder="e.g., Realtor Event Nurture" />
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea className="input h-28" value={description} onChange={(e)=> setDescription(e.target.value)} placeholder="Short summary of this automation" />
        </div>

        <div>
          <label className="label">Initialize With</label>
          <div className="grid md:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
              <input type="radio" name="init" checked={initMode==='blank'} onChange={()=> setInitMode('blank')} />
              <div>
                <div className="font-semibold">Blank</div>
                <div className="text-xs text-gray-500">Start with Start → Campaign</div>
              </div>
            </label>
            <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
              <input type="radio" name="init" checked={initMode==='seed'} onChange={()=> setInitMode('seed')} />
              <div>
                <div className="font-semibold">ADTV Event Seed</div>
                <div className="text-xs text-gray-500">Prebuilt event workflow skeleton</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button className="btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={handleSave}>Create</button>
        </div>
      </div>
    </div>
  );
}


