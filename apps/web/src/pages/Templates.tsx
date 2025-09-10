import { useState } from 'react';

type Template = { id: string; name: string; type: 'email'|'sms'|'voicemail'; content: string };

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([
    { id: 'tmpl_email_1', name: 'Email 1', type: 'email', content: '<h1>Welcome</h1>' },
    { id: 'tmpl_sms_1', name: 'SMS 1', type: 'sms', content: 'Hi {{contact.first_name}} 👋' },
    { id: 'tmpl_vm_1', name: 'VM Script 1', type: 'voicemail', content: 'Hey there, quick invite...' },
  ]);
  const [selected, setSelected] = useState<Template | null>(templates[0] ?? null);

  const save = () => {
    if (!selected) return;
    setTemplates((s) => s.map((t) => (t.id === selected.id ? selected : t)));
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="card md:col-span-1">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Templates</h1>
          <button className="btn-primary btn-sm" onClick={() => setSelected({ id: `tmpl_${Date.now()}`, name: 'New Template', type: 'email', content: '' })}>New</button>
        </div>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <button className={`w-full text-left p-2 rounded ${selected?.id === t.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`} onClick={() => setSelected(t)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className="badge-gray">{t.type}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card md:col-span-2">
        {!selected ? (
          <p className="text-gray-500">Select a template.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={selected.type} onChange={(e) => setSelected({ ...selected, type: e.target.value as any })}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="voicemail">Voicemail</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Content</label>
              <textarea className="input h-56" value={selected.content} onChange={(e) => setSelected({ ...selected, content: e.target.value })} />
            </div>
            <button className="btn-primary btn-md" onClick={save}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}


