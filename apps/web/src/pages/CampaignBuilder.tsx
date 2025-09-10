import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '@store/useStore';
import Papa from 'papaparse';
import { seedCampaigns } from '@seed/campaignSeed';
import { apiCampaigns, apiInbox, apiEmail } from '@lib/api';

const tabs = ['Overview','Contacts','Analytics','Map View'] as const;

const CONTACT_STATUSES = ['No Activity','Needs BDR','Received RSVP','Showed Up To Event','Post Event #1','Post Event #2','Post Event #3','Received Agreement','Signed Agreement'] as const;

export function CampaignBuilder() {
  const params = useParams();
  const { liveCampaigns, contactsByCampaignId, setContactsForCampaign, addToast, campaigns, updateLiveCampaign } = useStore();
  const campaign = useMemo(() => liveCampaigns.find((c) => c.id === params.id), [liveCampaigns, params.id]);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Overview');
  if (!campaign) return <div className="text-gray-500">Campaign not found.</div>;

  const contacts = contactsByCampaignId[campaign.id] || [];

  useEffect(() => {
    if (!campaign) return;
    if (contacts.length > 0) return;
    // Load from API if exists (keep seeded if empty)
    fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/campaigns/${campaign.id}/contacts`).then((r)=> r.json()).then((list)=> {
      if (Array.isArray(list) && list.length>0) {
        const mapped = list.map((c: any) => ({ id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, city: c.city, state: c.state, url: c.url, status: c.status, stageId: c.stageKey, raw: c.rawJson?JSON.parse(c.rawJson):{} }));
        setContactsForCampaign(campaign.id, mapped as any);
      }
    }).catch(() => {});
  }, [campaign?.id]);

  // Derive stages from campaign graph when available
  const [stages, setStages] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!campaign) return;
    apiCampaigns.graph(campaign.id).then((g) => {
      if (g?.nodes) setStages(g.nodes.map((n: any) => ({ id: n.id, name: n.name })));
    }).catch(()=>{});
  }, [campaign?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-gray-600">{campaign.owner_name} · {campaign.event_type} · {campaign.city}, {campaign.state}</p>
        </div>
        <a className="btn-outline btn-sm" href="/campaigns">Back</a>
      </div>

      <div className="subtabs">
        {tabs.map((t) => (
          <button key={t} className={`subtab ${tab===t?'subtab-active':''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab==='Overview' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card md:col-span-2">
            <h2 className="text-lg font-semibold mb-3">Campaign Details</h2>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="label">Associate</label>
                <input className="input" defaultValue={campaign.owner_name} onBlur={(e)=> updateLiveCampaign(campaign.id, { owner_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" defaultValue={campaign.owner_email} onBlur={(e)=> updateLiveCampaign(campaign.id, { owner_email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" defaultValue={campaign.owner_phone||''} onBlur={(e)=> updateLiveCampaign(campaign.id, { owner_phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Send From (Email)</label>
                <input className="input" defaultValue={(campaign as any).sender_email||''} onBlur={(e)=> updateLiveCampaign(campaign.id, { sender_email: e.target.value as any })} />
              </div>
              <div>
                <label className="label">Launch Date</label>
                <input className="input" defaultValue={campaign.launch_date||''} onBlur={(e)=> { updateLiveCampaign(campaign.id, { launch_date: e.target.value }); apiCampaigns.patch(campaign.id, { launchDate: e.target.value }).catch(()=>{}); }} />
              </div>
              <div>
                <label className="label">Video Link</label>
                <input className="input" defaultValue={(campaign as any).video_link||''} onBlur={(e)=> { updateLiveCampaign(campaign.id, { videoLink: e.target.value }); apiCampaigns.patch(campaign.id, { videoLink: e.target.value }).catch(()=>{}); }} />
              </div>
              <div>
                <label className="label">Event Link</label>
                <input className="input" defaultValue={(campaign as any).event_link||''} onBlur={(e)=> { updateLiveCampaign(campaign.id, { eventLink: e.target.value }); apiCampaigns.patch(campaign.id, { eventLink: e.target.value }).catch(()=>{}); }} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Funnel Template</label>
                <select className="input" value={campaign.template_id||''} onChange={(e)=> { updateLiveCampaign(campaign.id, { template_id: e.target.value }); apiCampaigns.patch(campaign.id, { templateId: e.target.value }).catch(()=>{}); }}>
                  <option value="">None</option>
                  {campaigns.map((t)=> (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Event Slots</h3>
              <ul className="list-disc pl-5 text-sm">
                {(campaign.event_slots||[]).map((s,i)=> (
                  <li key={i}>{s.date} {s.time}{s.calendly_link?` · ${s.calendly_link}`:''}</li>
                ))}
              </ul>
            </div>
            {campaign.event_type==='in_person' && (
              <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="label">Hotel</label>
                  <input className="input" defaultValue={campaign.hotel_name||''} onBlur={(e)=> updateLiveCampaign(campaign.id, { hotel_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" defaultValue={campaign.hotel_address||''} onBlur={(e)=> updateLiveCampaign(campaign.id, { hotel_address: e.target.value })} />
                </div>
                <div>
                  <label className="label">Calendly</label>
                  <input className="input" defaultValue={campaign.calendly_link||''} onBlur={(e)=> updateLiveCampaign(campaign.id, { calendly_link: e.target.value })} />
                </div>
              </div>
            )}
          </div>
          {/* Contacts controls moved to Contacts tab per request */}
        </div>
      )}

      {tab==='Contacts' && (
        <ContactsTab contacts={contacts} />
      )}

      

      {tab==='Analytics' && (
        <div className="card">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="card"><p className="font-semibold">Enrichment %</p><p className="text-3xl mt-2">62%</p></div>
            <div className="card"><p className="font-semibold">Email Generation %</p><p className="text-3xl mt-2">78%</p></div>
            <div className="card"><p className="font-semibold">Data Capture (Email/Phone)</p><p className="text-3xl mt-2">71% / 54%</p></div>
          </div>
        </div>
      )}

      {tab==='Map View' && (
        <div className="card text-sm text-gray-500">Map mock placeholder. Clustered markers, hotel marker when applicable.</div>
      )}
    </div>
  );
}
type ContactsTabProps = { contacts: ReturnType<typeof useStore.getState>['contactsByCampaignId'][string] };

function ContactsTab({ contacts }: ContactsTabProps) {
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | typeof CONTACT_STATUSES[number]>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { addToast } = useStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSms, setShowSms] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [facebook, setFacebook] = useState('');
  const { contactsByCampaignId, setContactsForCampaign } = useStore();
  const params = useParams();
  const campaignId = params.id as string;
  const [stagesLocal, setStagesLocal] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    // derive stages locally for modal default
    (async () => {
      try {
        const g = await apiCampaigns.graph(campaignId);
        if (g?.nodes) setStagesLocal(g.nodes.map((n: any) => ({ id: n.id, name: n.name })));
      } catch {}
    })();
  }, [campaignId]);

  const STATUS_CLASS: Record<typeof CONTACT_STATUSES[number], string> = {
    'No Activity': 'bg-gray-100 text-gray-700 border-gray-200',
    'Needs BDR': 'bg-amber-100 text-amber-800 border-amber-200',
    'Received RSVP': 'bg-blue-100 text-blue-800 border-blue-200',
    'Showed Up To Event': 'bg-green-100 text-green-800 border-green-200',
    'Post Event #1': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Post Event #2': 'bg-purple-100 text-purple-800 border-purple-200',
    'Post Event #3': 'bg-pink-100 text-pink-800 border-pink-200',
    'Received Agreement': 'bg-teal-100 text-teal-800 border-teal-200',
    'Signed Agreement': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return contacts.filter((c) =>
      [c.name, c.company, c.email, c.phone, c.city, c.state, (c as any).stageId].some((v) => (v || '').toLowerCase().includes(q)) &&
      (selectedStatus === 'All' || c.status === selectedStatus)
    );
  }, [contacts, query, selectedStatus]);

  const allChecked = filtered.length>0 && filtered.every((c)=> selectedIds.has(c.id));
  const someChecked = filtered.some((c)=> selectedIds.has(c.id));
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) { filtered.forEach((c)=> next.delete(c.id)); } else { filtered.forEach((c)=> next.add(c.id)); }
      return next;
    });
  };
  const toggleOne = (id: string) => setSelectedIds((prev)=> { const next = new Set(prev); next.has(id)?next.delete(id):next.add(id); return next; });

  const openSms = () => { if (selectedIds.size===0) return; setSmsText(''); setShowSms(true); };
  const openEmail = () => { if (selectedIds.size===0) return; setEmailSubject(''); setEmailBody(''); setShowEmail(true); };

  const sendBulkSms = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(async (id) => {
      const c = contacts.find((x)=> x.id===id);
      if (!c || !c.phone) return;
      try { await apiInbox.sendMessage({ contactId: c.id, text: smsText, direction: 'out' }); } catch {}
    }));
    setShowSms(false);
    addToast({ title: 'SMS sent', description: `${selectedIds.size} selected`, variant: 'success' });
  };

  const sendBulkEmail = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(async (id) => {
      const c = contacts.find((x)=> x.id===id);
      if (!c || !c.email) return;
      try { await apiEmail.send({ to: c.email, subject: emailSubject, body: emailBody, contactId: c.id }); } catch {}
    }));
    setShowEmail(false);
    addToast({ title: 'Email queued', description: `${selectedIds.size} selected`, variant: 'success' });
  };

  return (
    <>
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input className="input w-64" placeholder="Search contacts" value={query} onChange={(e)=> setQuery(e.target.value)} />
          <select className="input w-60" value={selectedStatus} onChange={(e)=> setSelectedStatus(e.target.value as any)}>
            <option value="All">All Statuses</option>
            {CONTACT_STATUSES.map((s)=> (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn-outline btn-sm cursor-pointer text-center">
            <input type="file" accept=".csv" className="hidden" onChange={(ev)=> {
              const file = ev.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = String(reader.result || '');
                const parsed = Papa.parse(text, { header: true });
                const rows = (parsed.data as any[]).filter(Boolean);
                // We don't have campaign context here; derive from URL
                const params = new URLSearchParams(window.location.search);
                const cid = window.location.pathname.split('/').pop() || '';
                const mapped = rows.map((r) => ({
                  id: Math.random().toString(36).slice(2),
                  name: r.name || r.Name || '-',
                  company: r.company || r.Company || '',
                  email: r.Email || r.email || '',
                  phone: r.Phone || r.phone || '',
                  city: r.city || r.City || '',
                  state: r.state || r.State || '',
                  url: r.url,
                  status: 'No Activity' as const,
                  stageId: '',
                  raw: r,
                })).slice(0, 1000);
                setContactsForCampaign(cid, mapped as any);
                fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/campaigns/${cid}/contacts/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contacts: mapped }) }).catch(()=>{});
                addToast({ title: 'Contacts imported', description: `${mapped.length} records`, variant: 'success' });
              };
              reader.readAsText(file);
            }} />
            Import CSV
          </label>
          <button className="btn-outline btn-sm" onClick={()=> {
            const cid = window.location.pathname.split('/').pop() || '';
            const list = (contactsByCampaignId as any)[cid] || [];
            const csv = ['Name,Company,Email,Phone,City,State,Status,StageId', ...list.map((c:any)=> [c.name,c.company,c.email,c.phone,c.city,c.state,c.status,c.stageId||''].map((v:string)=>`"${String(v??'').replace(/"/g,'\"')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `contacts_${cid}.csv`; a.click(); URL.revokeObjectURL(url);
          }}>Export CSV</button>
          <button className="btn-primary btn-sm" onClick={()=> setShowAddContact(true)}>Add Contact</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500">
              <th className="py-2 w-10">
                <input type="checkbox" checked={allChecked} ref={(el)=> { if (el) el.indeterminate = !allChecked && someChecked; }} onChange={toggleAll} />
              </th>
              <th className="py-2">Name</th>
              <th className="py-2">Company</th>
              <th className="py-2">Email</th>
              <th className="py-2">Phone</th>
              <th className="py-2">City</th>
              <th className="py-2">Status</th>
              <th className="py-2">Stage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <React.Fragment key={c.id}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={()=> setExpandedId(expandedId===c.id?null:c.id)}>
                  <td className="py-2" onClick={(e)=> e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={()=> toggleOne(c.id)} />
                  </td>
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2">{c.company}</td>
                  <td className="py-2">{c.email}</td>
                  <td className="py-2">{c.phone}</td>
                  <td className="py-2">{c.city}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_CLASS[c.status as keyof typeof STATUS_CLASS]}`}>{c.status}</span>
                  </td>
                  <td className="py-2 text-xs">{(c as any).stageId || '-'}</td>
                </tr>
                {expandedId===c.id && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={8} className="py-3">
                      <div className="grid md:grid-cols-3 gap-3 text-xs">
                        {Object.entries(c.raw).map(([k, v]) => {
                          const label = String(k).replace(/_/g,' ').replace(/\s+/g,' ').replace(/\b\w/g, (m) => m.toUpperCase());
                          return (
                            <div key={k}><span className="font-semibold text-black">{label}:</span> <span className="text-black font-normal">{String(v ?? '')}</span></div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    
    {showSms && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Create SMS ({selectedIds.size} selected)</h3>
            <button className="btn-outline btn-sm" onClick={()=> setShowSms(false)}>Close</button>
          </div>
          <textarea className="input h-40" placeholder="Write your text message…" value={smsText} onChange={(e)=> setSmsText(e.target.value)} />
          <div className="flex items-center justify-end gap-2">
            <button className="btn-outline btn-sm" onClick={()=> setShowSms(false)}>Cancel</button>
            <button className="btn-primary btn-sm" disabled={!smsText.trim()} onClick={sendBulkSms}>Send SMS</button>
          </div>
        </div>
      </div>
    )}

    {showEmail && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Create Email ({selectedIds.size} selected)</h3>
            <button className="btn-outline btn-sm" onClick={()=> setShowEmail(false)}>Close</button>
          </div>
          <input className="input" placeholder="Subject" value={emailSubject} onChange={(e)=> setEmailSubject(e.target.value)} />
          <textarea className="input h-48" placeholder="Email body…" value={emailBody} onChange={(e)=> setEmailBody(e.target.value)} />
          <div className="flex items-center justify-end gap-2">
            <button className="btn-outline btn-sm" onClick={()=> setShowEmail(false)}>Cancel</button>
            <button className="btn-primary btn-sm" disabled={!emailSubject.trim() && !emailBody.trim()} onClick={sendBulkEmail}>Send Email</button>
          </div>
        </div>
      </div>
    )}

    {showAddContact && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={(e)=>{ if (e.target===e.currentTarget) setShowAddContact(false); }}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add Contact</h3>
            <button className="btn-outline btn-sm" onClick={()=> setShowAddContact(false)}>Close</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">First Name</label>
              <input className="input" value={firstName} onChange={(e)=> setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input" value={lastName} onChange={(e)=> setLastName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} onChange={(e)=> setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e)=> setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" value={website} onChange={(e)=> setWebsite(e.target.value)} />
            </div>
            <div>
              <label className="label">Facebook Profile</label>
              <input className="input" value={facebook} onChange={(e)=> setFacebook(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="btn-outline btn-sm" onClick={()=> setShowAddContact(false)}>Cancel</button>
            <button className="btn-primary btn-sm" onClick={()=> {
              const name = `${firstName} ${lastName}`.trim() || firstName || lastName || 'Contact';
              const cid = window.location.pathname.split('/').pop() || '';
              const contact: any = { id: Math.random().toString(36).slice(2), name, email, phone, url: website, status: 'No Activity' as const, stageId: '', raw: { first_name: firstName, last_name: lastName, website, facebook_profile: facebook } };
              setContactsForCampaign(cid, [contact, ...(contactsByCampaignId as any)[cid]||[]]);
              fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/campaigns/${cid}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) }).catch(()=>{});
              setShowAddContact(false);
              setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setWebsite(''); setFacebook('');
            }}>Add</button>
          </div>
        </div>
      </div>
    )}
    {showAddContact && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={(e)=>{ if (e.target===e.currentTarget) setShowAddContact(false); }}>
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add Contact</h3>
            <button className="btn-outline btn-sm" onClick={()=> setShowAddContact(false)}>Close</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">First Name</label>
              <input className="input" value={firstName} onChange={(e)=> setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input" value={lastName} onChange={(e)=> setLastName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} onChange={(e)=> setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e)=> setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" value={website} onChange={(e)=> setWebsite(e.target.value)} />
            </div>
            <div>
              <label className="label">Facebook Profile</label>
              <input className="input" value={facebook} onChange={(e)=> setFacebook(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="btn-outline btn-sm" onClick={()=> setShowAddContact(false)}>Cancel</button>
            <button className="btn-primary btn-sm" onClick={()=> {
              const name = `${firstName} ${lastName}`.trim() || firstName || lastName || 'Contact';
              const tplStages = stagesLocal.length>0 ? stagesLocal : [];
              const stageId = (tplStages as any[])[0]?.id || '';
              const contact: any = { id: Math.random().toString(36).slice(2), name, email, phone, url: website, status: 'No Activity' as const, stageId, raw: { first_name: firstName, last_name: lastName, website, facebook_profile: facebook } };
              setContactsForCampaign(campaignId, [contact, ...(contactsByCampaignId[campaignId]||[])]);
              fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/campaigns/${campaignId}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) }).catch(()=>{});
              setShowAddContact(false);
              setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setWebsite(''); setFacebook('');
              addToast({ title: 'Contact added', description: name, variant: 'success' });
            }}>Add</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}


