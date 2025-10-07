import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, type Campaign } from '@store/useStore';
import { apiCampaigns, apiTemplates } from '@lib/api';

const PRODUCERS = [
  { name: 'Kalena Conley', email: 'kalena@example.com' },
  { name: 'Evan Jones', email: 'evan@example.com' },
  { name: 'Sigrid Smith', email: 'sigrid@example.com' },
  { name: 'Amy Dodsworth', email: 'amy@example.com' },
  { name: 'Bailey Jacobs', email: 'bailey@example.com' },
];

type Props = { open: boolean; onClose: () => void };

export function CreateLiveCampaignModal({ open, onClose }: Props) {
  const { addLiveCampaign, addToast, campaigns } = useStore();
  const [name, setName] = useState('');
  const [producer, setProducer] = useState<string>('');
  const [producerPhone, setProducerPhone] = useState('');
  const [eventType, setEventType] = useState<'virtual'|'in_person'|''>('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [locations, setLocations] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [slots, setSlots] = useState<Array<{date: string; time: string; calendly?: string}>>([{ date: '', time: '', calendly: '' }]);
  const [hotelName, setHotelName] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [inPersonCalendly, setInPersonCalendly] = useState('');
  const [senderEmail, setSenderEmail] = useState('ivy@adtvmedia.com');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('');
  const maxSlots = eventType === 'virtual' ? 3 : 2;

  // Load templates when modal opens; fetch from API with store fallback
  useEffect(() => {
    if (!open) return;
    try {
      if (Array.isArray(campaigns) && campaigns.length) {
        setTemplates((prev) => (prev.length ? prev : campaigns.map((t: any) => ({ id: t.id, name: t.name }))));
      }
    } catch {}
    apiTemplates.list().then((list: any) => {
      if (Array.isArray(list) && list.length) setTemplates(list);
    }).catch(()=>{});
  }, [open, campaigns]);

  if (!open) return null;

  const combinedTemplates = (() => {
    const storeList = Array.isArray(campaigns) ? campaigns.map((t: any) => ({ id: t.id, name: t.name })) : [];
    const apiList = Array.isArray(templates) ? templates : [];
    const seen = new Set<string>();
    const merged: Array<{ id: string; name: string }> = [];
    [...apiList, ...storeList].forEach((t) => {
      if (t && t.id && !seen.has(t.id)) { seen.add(t.id); merged.push({ id: t.id, name: t.name }); }
    });
    return merged;
  })();

  const addSlot = () => {
    if (slots.length >= maxSlots) return;
    setSlots((s) => [...s, { date: '', time: '', calendly: '' }]);
  };
  const removeSlot = (idx: number) => {
    if (slots.length <= 1) return;
    setSlots((s) => s.filter((_, i) => i !== idx));
  };

  const disabled = !name || !producer || !eventType || !launchDate || !(slots[0]?.date) || !(slots[0]?.time);

  const submit = async () => {
    const id = `live_${Math.random().toString(36).slice(2)}`;
    const prod = PRODUCERS.find((p) => p.name === producer);
    // Ensure selected template exists on server; if a local-only template was chosen, create it on server now
    let effectiveTemplateId = templateId || '';
    try {
      if (effectiveTemplateId) {
        const existsOnServer = Array.isArray(templates) && templates.some((t: any) => t && t.id === effectiveTemplateId);
        if (!existsOnServer) {
          const localTpl = (Array.isArray(campaigns) ? campaigns : []).find((t: any) => t.id === effectiveTemplateId);
          if (localTpl && localTpl.graph && Array.isArray(localTpl.graph.nodes) && Array.isArray(localTpl.graph.edges)) {
            const created = await apiTemplates.create(localTpl.name || 'Template', { nodes: localTpl.graph.nodes, edges: localTpl.graph.edges });
            if (created && created.id) {
              effectiveTemplateId = created.id;
            }
          }
        }
      }
    } catch {}
    const payload: Campaign = {
      id,
      name,
      owner_name: prod?.name || producer,
      owner_email: prod?.email || 'owner@example.com',
      owner_phone: producerPhone,
      city,
      state,
      video_link: videoLink,
      event_link: eventLink,
      launch_date: launchDate,
      event_type: eventType as any,
      event_date: slots[0]?.date || '',
      event_slots: slots.map((s) => ({ date: s.date, time: s.time, calendly_link: eventType === 'virtual' ? s.calendly : undefined })),
      target_cities: locations,
      hotel_name: eventType === 'in_person' ? hotelName : undefined,
      hotel_address: eventType === 'in_person' ? hotelAddress : undefined,
      calendly_link: eventType === 'in_person' ? inPersonCalendly : undefined,
      status: 'draft',
      total_contacts: 0,
      enriched_contacts: 0,
      emails_generated: 0,
    } as Campaign;
    addLiveCampaign(payload);
    addToast({ title: 'Campaign created', description: name, variant: 'success' });
    // Persist to backend (best-effort)
    try {
      await apiCampaigns.create({
        name,
        ownerName: payload.owner_name,
        ownerEmail: payload.owner_email,
        ownerPhone: payload.owner_phone,
        city,
        state,
        videoLink,
        eventLink,
        eventType: eventType,
        eventDate: (slots[0]?.date) || new Date().toISOString().slice(0,10),
        launchDate: launchDate || undefined,
        hotelName: eventType==='in_person'?hotelName: undefined,
        hotelAddress: eventType==='in_person'?hotelAddress: undefined,
        calendlyLink: eventType==='in_person'?inPersonCalendly: undefined,
        templateId: effectiveTemplateId || undefined,
        // optional: server could look up userId by email; for now, pass nothing and use default profile
        status: 'draft',
      });
    } catch {}
    onClose();
  };

  // templates load handled in useEffect above

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-soft-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Campaign</h2>
          <button type="button" className="btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="label">Choose Funnel Template</label>
            <select className="input" value={templateId} onChange={(e)=> setTemplateId(e.target.value)}>
              <option value="">Select a template</option>
              {combinedTemplates.map((t)=> (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {combinedTemplates.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No templates yet. Go to <Link className="underline" to="/templates">Funnel Templates</Link> to create one.</p>
            )}
          </div>
          <div>
            <label className="label">Campaign Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q1 2024 Roadshow" />
          </div>
          <div>
            <label className="label">Associate Producer *</label>
            <select className="input" value={producer} onChange={(e) => setProducer(e.target.value)}>
              <option value="">Select associate producer</option>
              {PRODUCERS.map((p) => (<option key={p.email} value={p.name}>{p.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Associate Phone</label>
            <input className="input" value={producerPhone} onChange={(e) => setProducerPhone(e.target.value)} placeholder="(555) 123‑4567" />
          </div>
          <div>
            <label className="label">Event Type *</label>
            <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value as any)}>
              <option value="">Select event type</option>
              <option value="virtual">Virtual</option>
              <option value="in_person">In‑Person</option>
            </select>
          </div>

          {(eventType === 'virtual' || eventType === 'in_person') && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">City</label>
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Event Dates & Times *</label>
                <div className="space-y-2">
                  {slots.map((s, idx) => (
                    <div key={idx} className="grid md:grid-cols-3 gap-3 items-center">
                      <input type="date" className="input" value={s.date} onChange={(e) => setSlots((arr) => arr.map((x, i) => i===idx?{...x, date: e.target.value}:x))} />
                      <input type="time" className="input" value={s.time} onChange={(e) => setSlots((arr) => arr.map((x, i) => i===idx?{...x, time: e.target.value}:x))} />
                      {eventType === 'virtual' ? (
                        <input className="input" placeholder="Calendly link" value={s.calendly} onChange={(e) => setSlots((arr) => arr.map((x, i) => i===idx?{...x, calendly: e.target.value}:x))} />
                      ) : (
                        <button className="btn-outline btn-sm" onClick={() => removeSlot(idx)} disabled={slots.length===1}>Remove</button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <button className="btn-secondary btn-sm" onClick={addSlot} disabled={slots.length>=maxSlots}>Add Time Slot</button>
                    {eventType === 'in_person' && (
                      <input className="input w-1/2" placeholder="Calendly link" value={inPersonCalendly} onChange={(e)=>setInPersonCalendly(e.target.value)} />
                    )}
                  </div>
                </div>
              </div>

              {eventType === 'in_person' && (
                <>
                  <div>
                    <label className="label">Hotel Name</label>
                    <input className="input" value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Hotel Address</label>
                    <textarea className="input h-20" value={hotelAddress} onChange={(e) => setHotelAddress(e.target.value)} />
                  </div>
                </>
              )}
            </>
          )}

          <div>
            <label className="label">Launch Date *</label>
            <input type="date" className="input" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Locations To Scrape</label>
            <textarea className="input h-24" value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="One per line" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Video Link</label>
              <input className="input" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://vimeo.com/..." />
            </div>
            <div>
              <label className="label">Event Link</label>
              <input className="input" value={eventLink} onChange={(e) => setEventLink(e.target.value)} placeholder="https://example.com/event" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" className="btn-outline btn-md" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary btn-md" onClick={submit} disabled={disabled}>Create Campaign</button>
          </div>
        </div>
      </div>
    </div>
  );
}


