import { useState } from 'react';

type MediaItem = { id: string; name: string; kind: 'video'|'image'|'audio'; tags: string[] };

export function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([
    { id: 'm1', name: 'Open House – Teaser.mp4', kind: 'video', tags: ['teaser','event'] },
    { id: 'm2', name: 'Neighborhood Spotlight.png', kind: 'image', tags: ['social'] },
    { id: 'm3', name: 'VM Script – Invite v1.mp3', kind: 'audio', tags: ['voicemail','invite'] },
  ]);
  const [query, setQuery] = useState('');

  const addMock = () => {
    setItems((s) => [{ id: Math.random().toString(36).slice(2), name: 'New Asset', kind: 'image', tags: [] }, ...s]);
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-gray-600">Upload and manage assets (mock)</p>
        </div>
        <button className="btn-primary btn-md" onClick={addMock}>Upload Mock</button>
      </div>

      <input className="input" placeholder="Search media" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="grid md:grid-cols-3 gap-4">
        {filtered.map((i) => (
          <div key={i.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-gray-500">{i.kind}</p>
              </div>
              <button className="btn-outline btn-sm">Edit</button>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {i.tags.map((t) => (
                <span key={t} className="badge-gray">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


