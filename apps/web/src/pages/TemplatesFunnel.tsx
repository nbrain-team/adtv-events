import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@store/useStore';
import { CreateFunnelTemplateModal } from '@components/CreateFunnelTemplateModal';
import { apiTemplates } from '@lib/api';

export function TemplatesFunnel() {
  const { campaigns, contentTemplates, upsertContentTemplate, addToast } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all'|'draft'|'published'|'archived'>('all');
  const [openTpl, setOpenTpl] = useState(false);
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

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'all' ? true : c.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [campaigns, query, status]);

  useEffect(() => {
    // Optionally fetch templates from backend to sync (non-blocking for static prototype)
    apiTemplates.list().then(() => {}).catch(()=>{});
  }, []);

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

      <div className="flex gap-3">
        <input className="input" placeholder="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <Link key={c.id} to={`/templates/${c.id}`} className="card block hover:shadow-soft-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-gray-500">v{c.version} · {c.status}</p>
              </div>
              <span className="badge-primary">{c.graph.nodes.length} nodes</span>
            </div>
          </Link>
        ))}
      </div>

      <CreateFunnelTemplateModal open={open} onClose={() => setOpen(false)} />

      {openTpl && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Content Template</h3>
              <button className="btn-outline btn-sm" onClick={()=> setOpenTpl(false)}>Close</button>
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
              <button className="btn-outline btn-sm" onClick={()=> setOpenTpl(false)}>Cancel</button>
              <button className="btn-primary btn-sm" onClick={()=> {
                const id = Math.random().toString(36).slice(2);
                upsertContentTemplate({ id, type: tplType, name: tplName, subject: tplSubject, body: tplBody, text: tplText, tts_script: tplScript });
                addToast({ title: 'Template saved', description: tplName, variant: 'success' });
                setTplName(''); setTplSubject(''); setTplBody(''); setTplText(''); setTplScript(''); setTplType('email'); setOpenTpl(false);
              }}>Save</button>
            </div>

            {contentTemplates.length>0 && (
              <div className="mt-2">
                <h4 className="font-semibold">Existing Content Templates</h4>
                <ul className="list-disc pl-5 text-sm">
                  {contentTemplates.map((t)=> (
                    <li key={t.id}>{t.type.toUpperCase()} · {t.name}</li>
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


