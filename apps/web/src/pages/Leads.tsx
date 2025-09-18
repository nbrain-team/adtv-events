import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { apiCampaigns, apiEmail, apiInbox, apiSms } from '@lib/api';

const CONTACT_STATUSES = ['No Activity','Needs BDR','Received RSVP','Showed Up To Event','Post Event #1','Post Event #2','Post Event #3','Received Agreement','Signed Agreement'] as const;

type AggContact = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  url?: string;
  status: typeof CONTACT_STATUSES[number];
  stageId?: string;
  raw: Record<string, any>;
  campaignId: string;
  campaignName: string;
};

export function Leads() {
  const [all, setAll] = useState<AggContact[]>([]);
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | typeof CONTACT_STATUSES[number]>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSms, setShowSms] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    apiCampaigns
      .list()
      .then((list: any[]) => {
        const flattened: AggContact[] = [];
        list.forEach((c: any) => {
          (c.contacts || []).forEach((ct: any) => {
            flattened.push({
              id: ct.id,
              name: ct.name,
              company: ct.company || '',
              email: ct.email || '',
              phone: ct.phone || '',
              city: ct.city || '',
              state: ct.state || '',
              url: ct.url || '',
              status: (ct.status || 'No Activity') as any,
              stageId: ct.stageKey || '',
              raw: ct.rawJson ? JSON.parse(ct.rawJson) : {},
              campaignId: c.id,
              campaignName: c.name,
            });
          });
        });
        setAll(flattened);
      })
      .catch(() => setAll([]));
  }, []);

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
    return all.filter((c) =>
      [c.name, c.company, c.email, c.phone, c.city, c.state, c.stageId, c.campaignName]
        .some((v) => (String(v || '').toLowerCase().includes(q))) &&
      (selectedStatus === 'All' || c.status === selectedStatus)
    );
  }, [all, query, selectedStatus]);

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

  const sendBulkSms = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(async (id) => {
      const c = all.find((x)=> x.id===id);
      if (!c || !c.phone) return;
      try { await apiSms.send({ to: c.phone, text: smsText, contactId: c.id }); }
      catch { try { await apiInbox.sendMessage({ contactId: c.id, text: smsText, direction: 'out' }); } catch {} }
    }));
    setShowSms(false);
  };

  const sendBulkEmail = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(async (id) => {
      const c = all.find((x)=> x.id===id);
      if (!c || !c.email) return;
      try { await apiEmail.send({ to: c.email, subject: emailSubject, body: emailBody, contactId: c.id }); } catch {}
    }));
    setShowEmail(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-gray-600">Aggregated contacts from all campaigns</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input className="input w-64" placeholder="Search contacts" value={query} onChange={(e)=> setQuery(e.target.value)} />
          <select className="input w-60" value={selectedStatus} onChange={(e)=> setSelectedStatus(e.target.value as any)}>
            <option value="All">All Statuses</option>
            {CONTACT_STATUSES.map((s)=> (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn-outline btn-sm" onClick={()=> { if (selectedIds.size===0) return; setSmsText(''); setShowSms(true); }} disabled={selectedIds.size===0}>Create SMS</button>
          <button className="btn-outline btn-sm" onClick={()=> { if (selectedIds.size===0) return; setEmailSubject(''); setEmailBody(''); setShowEmail(true); }} disabled={selectedIds.size===0}>Create Email</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
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
              <th className="py-2">Origin Campaign</th>
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
                  <td className="py-2 text-xs">{c.stageId || '-'}</td>
                  <td className="py-2 text-xs"><a className="link" href={`/campaigns/${c.campaignId}`}>{c.campaignName}</a></td>
                </tr>
                {expandedId===c.id && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={9} className="py-3">
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
    </div>
  );
}


