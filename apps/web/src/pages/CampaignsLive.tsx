import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, type Campaign } from '@store/useStore';
import { CreateLiveCampaignModal } from '@components/CreateLiveCampaignModal';
import { apiCampaigns } from '@lib/api';

export function CampaignsLive() {
  const { liveCampaigns, addLiveCampaign, deleteLiveCampaign, replaceLiveCampaigns } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'draft' | 'enriching' | 'ready_for_personalization' | 'generating_emails' | 'ready_to_send'>('all');

  const filtered = useMemo(() => {
    return liveCampaigns.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'all' ? true : c.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [liveCampaigns, query, status]);

  useEffect(() => {
    apiCampaigns.list().then((list: any[]) => {
      const mapped: Campaign[] = list.map((c: any) => ({
        id: c.id,
        name: c.name,
        owner_name: c.ownerName,
        owner_email: c.ownerEmail,
        owner_phone: c.ownerPhone,
        city: c.city,
        state: c.state,
        videoLink: c.videoLink,
        eventLink: c.eventLink,
        event_type: c.eventType,
        event_date: (c.eventDate || '').slice(0,10),
        launch_date: c.launchDate ? (c.launchDate || '').slice(0,10) : undefined,
        hotel_name: c.hotelName,
        hotel_address: c.hotelAddress,
        calendly_link: c.calendlyLink,
        status: (c.status || 'draft') as any,
        total_contacts: (typeof c.totalContacts === 'number' ? c.totalContacts : (Array.isArray(c.contacts) ? c.contacts.length : 0)) ?? 0,
        enriched_contacts: c.enrichedContacts ?? 0,
        emails_generated: c.emailsGenerated ?? 0,
        template_id: c.templateId || undefined,
      }));
      replaceLiveCampaigns(mapped);
    }).catch(()=>{});
  }, [replaceLiveCampaigns]);

  const createMockCampaign = () => {
    const id = `live_${Math.random().toString(36).slice(2)}`;
    const mock: Campaign = {
      id,
      name: 'In‑Person Launch Event',
      owner_name: 'Kalena Conley',
      owner_email: 'kalena@example.com',
      owner_phone: '(555) 234‑5678',
      city: 'Los Angeles',
      state: 'CA',
      video_link: 'https://vimeo.com/123456',
      event_link: 'https://example.com/event',
      launch_date: new Date().toISOString().slice(0,10),
      event_type: 'in_person',
      event_date: new Date().toISOString().slice(0, 10),
      event_slots: [
        { date: new Date().toISOString().slice(0,10), time: '17:30' },
        { date: new Date().toISOString().slice(0,10), time: '19:00' }
      ],
      hotel_name: 'Marriott Downtown',
      hotel_address: '123 Main St, Los Angeles, CA 90001',
      calendly_link: 'https://calendly.com/kalena/meet',
      status: 'draft',
      total_contacts: 0,
      enriched_contacts: 0,
      emails_generated: 0,
    } as Campaign;
    addLiveCampaign(mock);
    // Persist best-effort
    apiCampaigns.create({
      name: mock.name,
      ownerName: mock.owner_name,
      ownerEmail: mock.owner_email,
      ownerPhone: mock.owner_phone,
      city: mock.city,
      state: mock.state,
      eventType: mock.event_type,
      eventDate: mock.event_date,
      launchDate: mock.launch_date,
      hotelName: mock.hotel_name,
      hotelAddress: mock.hotel_address,
      calendlyLink: mock.calendly_link,
      status: mock.status,
    }).catch(()=>{});
  };

  const seedRoadshows = () => {
    const mk = (name: string, city: string, state: string, date: string): Campaign => ({
      id: `live_${Math.random().toString(36).slice(2)}`,
      name,
      owner_name: 'ADTV Team',
      owner_email: 'team@adtv.com',
      city, state,
      event_type: 'in_person',
      event_date: date,
      launch_date: date,
      status: 'draft',
      total_contacts: 0,
      enriched_contacts: 0,
      emails_generated: 0,
    } as Campaign);
    const c1 = mk('Boston Roadshow 9/9/2025','Boston','MA','2025-09-09');
    const c2 = mk('Miami Roadshow 9/15/2025','Miami','FL','2025-09-15');
    addLiveCampaign(c1);
    addLiveCampaign(c2);
    [c1, c2].forEach((m) => {
      apiCampaigns.create({ name: m.name, ownerName: m.owner_name, ownerEmail: m.owner_email, city: m.city, state: m.state, eventType: m.event_type, eventDate: m.event_date, launchDate: m.launch_date, status: m.status }).catch(()=>{});
    });
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-gray-600">Live campaigns per CAMPAIGN_BUILDER_SPEC</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary btn-md" onClick={() => setOpen(true)}>New Campaign</button>
        </div>
      </div>

      <div className="flex gap-3">
        <input className="input" placeholder="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-60" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="enriching">Enriching</option>
          <option value="ready_for_personalization">Ready for personalization</option>
          <option value="generating_emails">Generating emails</option>
          <option value="ready_to_send">Ready to send</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <Link key={c.id} to={`/campaigns/${c.id}`} className="card block hover:shadow-soft-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold hover:underline">{c.name}</div>
                <p className="text-xs text-gray-500">{c.status} · {c.event_type}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-primary">{c.total_contacts} contacts</span>
                <button
                  className="btn-outline btn-sm"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteLiveCampaign(c.id); }}
                >
                  Delete
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
    <CreateLiveCampaignModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}


