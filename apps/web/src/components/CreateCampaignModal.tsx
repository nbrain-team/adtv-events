import { useState } from 'react';
import { useStore, type CampaignMeta, type Campaign } from '@store/useStore';

type Props = { open: boolean; onClose: () => void };

export function CreateCampaignModal({ open, onClose }: Props) {
  const { upsertCampaign, setCampaignMeta, addToast, addLiveCampaign } = useStore();
  const [meta, setMeta] = useState<CampaignMeta>({ name: '', eventType: undefined });
  const [kind, setKind] = useState<'template' | 'campaign'>('template');
  const [dateRows, setDateRows] = useState([{ date: '', time: '', calendly: '' }]);

  if (!open) return null;

  const addDateRow = () => setDateRows((s) => [...s, { date: '', time: '', calendly: '' }]);

  const submit = () => {
    if (kind === 'template') {
      const id = `tmpl_${Math.random().toString(36).slice(2)}`;
      upsertCampaign({ id, name: meta.name || 'New Template', status: 'draft', version: 1, graph: { schema_version: 1, nodes: [], edges: [], start_rules: {} } });
      const payload: CampaignMeta = {
        ...meta,
        eventDates: meta.eventType === 'in_person' ? dateRows.map((r) => ({ date: r.date, time: r.time, calendly: r.calendly })) : [],
      };
      setCampaignMeta(id, payload);
      addToast({ title: 'Template created', description: meta.name || id, variant: 'success' });
    } else {
      const id = `live_${Math.random().toString(36).slice(2)}`;
      const firstDate = (meta.launchDate || new Date().toISOString().slice(0, 10));
      const live: Campaign = {
        id,
        name: meta.name || 'New Campaign',
        owner_name: meta.associateProducer || 'Owner',
        owner_email: meta.associateEmail || 'owner@example.com',
        owner_phone: meta.associatePhone,
        city: meta.city,
        state: meta.state,
        video_link: meta.videoLink,
        event_link: meta.eventLink,
        launch_date: meta.launchDate,
        target_cities: meta.locationsToScrape?.join('\n'),
        event_type: (meta.eventType as any) || 'virtual',
        event_date: firstDate,
        event_slots: dateRows.map((r) => ({ date: r.date, time: r.time, calendly_link: r.calendly })),
        hotel_name: meta.hotelName,
        hotel_address: meta.hotelAddress,
        calendly_link: dateRows[0]?.calendly,
        status: 'draft',
        total_contacts: 0,
        enriched_contacts: 0,
        emails_generated: 0,
      } as Campaign;
      addLiveCampaign(live);
      addToast({ title: 'Campaign created', description: meta.name || id, variant: 'success' });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-soft-xl w-full max-w-3xl">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Campaign</h2>
          <button className="btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="label">Create As</label>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                <option value="template">Funnel Template</option>
                <option value="campaign">Campaign</option>
              </select>
            </div>
            <div>
              <label className="label">Campaign Name *</label>
              <input className="input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Q1 2024 Roadshow" />
            </div>
            <div>
              <label className="label">Associate Producer *</label>
              <input className="input" value={meta.associateProducer || ''} onChange={(e) => setMeta({ ...meta, associateProducer: e.target.value })} placeholder="Select associate producer" />
            </div>
            <div>
              <label className="label">Associate Email *</label>
              <input className="input" type="email" value={meta.associateEmail || ''} onChange={(e) => setMeta({ ...meta, associateEmail: e.target.value })} placeholder="owner@example.com" />
            </div>
            <div>
              <label className="label">Event Type *</label>
              <select className="input" value={meta.eventType || ''} onChange={(e) => setMeta({ ...meta, eventType: e.target.value as any })}>
                <option value="">Select event type</option>
                <option value="virtual">Virtual</option>
                <option value="in_person">In‑Person</option>
              </select>
            </div>

            {meta.eventType === 'in_person' && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">City</label>
                    <input className="input" value={meta.city || ''} onChange={(e) => setMeta({ ...meta, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input className="input" value={meta.state || ''} onChange={(e) => setMeta({ ...meta, state: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Event Dates & Times *</label>
                  <div className="space-y-2">
                    {dateRows.map((r, idx) => (
                      <div key={idx} className="grid md:grid-cols-3 gap-3">
                        <input type="date" className="input" value={r.date} onChange={(e) => setDateRows((s) => s.map((x, i) => i === idx ? { ...x, date: e.target.value } : x))} />
                        <input type="time" className="input" value={r.time} onChange={(e) => setDateRows((s) => s.map((x, i) => i === idx ? { ...x, time: e.target.value } : x))} />
                        <input className="input" placeholder="Calendly link" value={r.calendly} onChange={(e) => setDateRows((s) => s.map((x, i) => i === idx ? { ...x, calendly: e.target.value } : x))} />
                      </div>
                    ))}
                    <button className="btn-secondary btn-sm" onClick={addDateRow}>Add Time Slot</button>
                  </div>
                </div>
                <div>
                  <label className="label">Hotel Name</label>
                  <input className="input" value={meta.hotelName || ''} onChange={(e) => setMeta({ ...meta, hotelName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Hotel Address</label>
                  <input className="input" placeholder="123 Main St, City, State ZIP" value={meta.hotelAddress || ''} onChange={(e) => setMeta({ ...meta, hotelAddress: e.target.value })} />
                </div>
              </>
            )}

            <div>
              <label className="label">Launch Date *</label>
              <input type="date" className="input" value={meta.launchDate || ''} onChange={(e) => setMeta({ ...meta, launchDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Locations To Scrape</label>
              <textarea className="input h-24" placeholder="One per line" onChange={(e) => setMeta({ ...meta, locationsToScrape: e.target.value.split('\n').filter(Boolean) })} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Associate Phone</label>
                <input className="input" placeholder="(555) 123‑4567" value={meta.associatePhone || ''} onChange={(e) => setMeta({ ...meta, associatePhone: e.target.value })} />
              </div>
              <div>
                <label className="label">Video Link</label>
                <input className="input" placeholder="https://vimeo.com/..." value={meta.videoLink || ''} onChange={(e) => setMeta({ ...meta, videoLink: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Event Link</label>
              <input className="input" placeholder="https://example.com/event" value={meta.eventLink || ''} onChange={(e) => setMeta({ ...meta, eventLink: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <button className="btn-outline btn-md" onClick={onClose}>Cancel</button>
              <button className="btn-primary btn-md" onClick={submit} disabled={!meta.name || !meta.eventType || !meta.launchDate}>Create Campaign</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


