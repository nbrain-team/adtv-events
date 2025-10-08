import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@store/useStore';
import { CreateFunnelTemplateModal } from '@components/CreateFunnelTemplateModal';
import { apiTemplates, apiContentTemplates } from '@lib/api';

export function TemplatesFunnel() {
  const { campaigns, contentTemplates, upsertContentTemplate, addToast, setCampaigns } = useStore() as any;
  const [open, setOpen] = useState(false);
  const [serverTemplates, setServerTemplates] = useState<any[]>([]);
  const loadServerTemplates = async () => {
    try { const list = await apiTemplates.list(); setServerTemplates(Array.isArray(list)?list:[]); } catch { setServerTemplates([]); }
  };
  // Removed search and status filters per request
  const [openTpl, setOpenTpl] = useState(false);
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [tplType, setTplType] = useState<'email'|'sms'|'voicemail'>('email');
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplText, setTplText] = useState('');
  const [tplScript, setTplScript] = useState('');
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const smsRef = useRef<HTMLTextAreaElement | null>(null);
  const vmRef = useRef<HTMLTextAreaElement | null>(null);

  const mergeTags = ['{{contact.first_name}}','{{contact.last_name}}','{{contact.email}}','{{contact.phone}}','{{contact.event_date}}','{{campaign.name}}','{{campaign.event_type}}'];

  const insertAtCursor = <T extends HTMLInputElement | HTMLTextAreaElement>(
    ref: React.RefObject<T>,
    value: string,
    setter: (v: string) => void,
    insert: string
  ) => {
    const el = ref.current;
    if (!el) { setter((value || '') + insert); return; }
    const start = (el as any).selectionStart ?? value.length;
    const end = (el as any).selectionEnd ?? value.length;
    const next = (value || '').slice(0, start) + insert + (value || '').slice(end);
    setter(next);
    // allow React to re-render; caret position not strictly necessary in prototype
  };

  const filtered = useMemo(() => campaigns, [campaigns]);

  const resetTplForm = () => {
    setTplType('email');
    setTplName('');
    setTplSubject('');
    setTplBody('');
    setTplText('');
    setTplScript('');
    setEditingTplId(null);
  };

  const openEditTpl = (id: string) => {
    const t = contentTemplates.find((x: any) => x.id === id);
    if (!t) return;
    setEditingTplId(t.id);
    setTplType(t.type);
    setTplName(t.name || '');
    setTplSubject(t.subject || '');
    setTplBody(t.body || '');
    setTplText(t.text || '');
    setTplScript(t.tts_script || '');
    setOpenTpl(true);
  };

  useEffect(() => {
    // Optionally fetch templates from backend to sync (non-blocking for static prototype)
    loadServerTemplates().catch(()=>{});
    // Load content templates from server CSV and merge into store
    apiContentTemplates.list()
      .then((list) => {
        if (!Array.isArray(list) || list.length === 0) return;
        const seen = new Set(contentTemplates.map((t: any) => t.id));
        for (const t of list) {
          if (seen.has(t.id)) continue;
          upsertContentTemplate(t as any);
          seen.add(t.id);
        }
      })
      .catch(()=>{});
  }, []);

  useEffect(() => {
    if (!open) loadServerTemplates().catch(()=>{});
  }, [open]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funnel Templates</h1>
          <p className="text-sm text-gray-600">Manage templates with nodes, edges, and settings</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline btn-md" onClick={() => setOpenTpl(true)}>+ Content Template</button>
          <button className="btn-primary btn-md" onClick={() => setOpen(true)}>+ Funnel Template</button>
        </div>
      </div>

      {/* Filters removed */}

      <div className="grid md:grid-cols-2 gap-4 mt-2">
        {serverTemplates.map((c: any) => (
          <Link key={c.id} to={`/templates/${c.id}`} className="card block hover:shadow-soft-xl transition border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-gray-500">v{c.version||1} · {c.status||'draft'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-primary">{Array.isArray(c.nodes)?c.nodes.length:0} nodes</span>
                <button
                  className="btn-outline btn-xs"
                  onClick={(e)=> { e.preventDefault(); e.stopPropagation(); (async ()=> {
                    const confirmDel = window.confirm('Delete this funnel template?');
                    if (!confirmDel) return;
                    try {
                      const resp = await fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/templates/${c.id}`, { method: 'DELETE' });
                      if (!resp.ok) throw new Error('Delete failed');
                      await loadServerTemplates();
                      addToast({ title: 'Template deleted', description: c.name, variant: 'success' });
                    } catch (err: any) {
                      addToast({ title: 'Delete failed', description: String(err?.message||'error'), variant: 'error' });
                    }
                  })(); }}
                >Delete</button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {contentTemplates.length > 0 && (
        <div className="space-y-3 mt-10">
          <div>
            <h2 className="text-xl font-semibold">Content Templates</h2>
            <p className="text-sm text-gray-600">Click a template to view and update</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            {contentTemplates.map((t: any) => (
              <button
                key={t.id}
                className="card text-left hover:shadow-soft-xl transition border border-gray-200"
                onClick={() => openEditTpl(t.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.type.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-secondary">Edit</span>
                    <button className="btn-outline btn-xs" onClick={async (e)=> { e.preventDefault(); e.stopPropagation();
                      const ok = window.confirm('Delete this content template?');
                      if (!ok) return;
                      try {
                        await apiContentTemplates.delete(t.id);
                        const next = contentTemplates.filter((x: any) => x.id !== t.id);
                        (useStore.getState() as any).contentTemplates = next;
                        addToast({ title: 'Content template deleted', description: t.name, variant: 'success' });
                      } catch (err: any) {
                        addToast({ title: 'Delete failed', description: String(err?.message||'error'), variant: 'error' });
                      }
                    }}>Delete</button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                  {t.type === 'email' && (t.subject || t.body) && (
                    <>
                      {t.subject && <span className="block"><strong>Subject:</strong> {t.subject}</span>}
                      {t.body && <span className="block opacity-80">{t.body}</span>}
                    </>
                  )}
                  {t.type === 'sms' && t.text && (
                    <span className="block opacity-80">{t.text}</span>
                  )}
                  {t.type === 'voicemail' && t.tts_script && (
                    <span className="block opacity-80">{t.tts_script}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <CreateFunnelTemplateModal open={open} onClose={() => setOpen(false)} />

      {openTpl && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingTplId ? 'Edit Content Template' : 'Create Content Template'}</h3>
              <button className="btn-outline btn-sm" onClick={()=> { resetTplForm(); setOpenTpl(false); }}>Close</button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" value={tplType} onChange={(e)=> setTplType(e.target.value as any)}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="voicemail">Voicemail</option>
                </select>
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input" value={tplName} onChange={(e)=> setTplName(e.target.value)} />
              </div>
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 border rounded p-2">
              <div className="font-semibold mb-1">Available merge tags</div>
              <div className="flex items-center gap-2 flex-wrap">
                {mergeTags.map((t)=> (
                  <span key={t} className="subtab">{t}</span>
                ))}
              </div>
            </div>

            {tplType==='email' && (
              <div className="space-y-2">
                <div>
                  <label className="label">Subject</label>
                  <input ref={subjectRef} className="input" value={tplSubject} onChange={(e)=> setTplSubject(e.target.value)} />
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {mergeTags.map((t)=> (
                      <button key={t} className="subtab" onClick={()=> insertAtCursor(subjectRef, tplSubject, setTplSubject, t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Body</label>
                  <textarea ref={bodyRef} className="input h-40" value={tplBody} onChange={(e)=> setTplBody(e.target.value)} />
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <button className="btn-outline btn-sm" onClick={()=> {
                      const url = window.prompt('Image URL');
                      if (!url) return;
                      const alt = window.prompt('Alt text') || '';
                      insertAtCursor(bodyRef, tplBody, setTplBody, `<img src="${url}" alt="${alt}" style="max-width:100%;" />`);
                    }}>Insert Image</button>
                    {mergeTags.map((t)=> (
                      <button key={t} className="subtab" onClick={()=> insertAtCursor(bodyRef, tplBody, setTplBody, t)}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tplType==='sms' && (
              <div>
                <label className="label">Text</label>
                <textarea ref={smsRef} className="input h-28" value={tplText} onChange={(e)=> setTplText(e.target.value)} />
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {mergeTags.map((t)=> (
                    <button key={t} className="subtab" onClick={()=> insertAtCursor(smsRef, tplText, setTplText, t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}
            {tplType==='voicemail' && (
              <div>
                <label className="label">TTS Script</label>
                <textarea ref={vmRef} className="input h-28" value={tplScript} onChange={(e)=> setTplScript(e.target.value)} />
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {mergeTags.map((t)=> (
                    <button key={t} className="subtab" onClick={()=> insertAtCursor(vmRef, tplScript, setTplScript, t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 justify-end">
          <button className="btn-outline btn-sm" onClick={()=> { resetTplForm(); setOpenTpl(false); }}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={async ()=> {
                try {
                  if (editingTplId) {
                    // Simple approach: delete and recreate for now
                    await apiContentTemplates.delete(editingTplId);
                  }
                  const created = await apiContentTemplates.create({ type: tplType, name: tplName, subject: tplSubject, body: tplBody, text: tplText, tts_script: tplScript });
                  upsertContentTemplate(created as any);
                  addToast({ title: 'Template saved', description: tplName, variant: 'success' });
                  resetTplForm();
                  setOpenTpl(false);
                } catch (e: any) {
                  addToast({ title: 'Save failed', description: String(e?.message||'error'), variant: 'error' });
                }
              }}>Save</button>
            </div>

            {contentTemplates.length>0 && (
              <div className="mt-2">
                <h4 className="font-semibold">Existing Content Templates</h4>
                <ul className="list-disc pl-5 text-sm">
                  {contentTemplates.map((t: any)=> (
                    <li key={t.id}>
                      <button className="link" onClick={()=> openEditTpl(t.id)}>{t.type.toUpperCase()} · {t.name}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


