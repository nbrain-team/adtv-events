import { useEffect, useState } from 'react';
import { useStore } from '@store/useStore';
import { seedCampaigns } from '@seed/campaignSeed';
import { API_URL } from '@lib/api';

export function Dashboard() {
  const { campaigns, setCampaigns, liveCampaigns, addLiveCampaign } = useStore();
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    if (campaigns.length === 0) setCampaigns(seedCampaigns);
    // Seed roadshows if none present
    if (liveCampaigns.length === 0) {
      const mk = (name: string, city: string, state: string, date: string) => ({
        id: `live_${Math.random().toString(36).slice(2)}`,
        name,
        owner_name: 'ADTV Team',
        owner_email: 'team@adtv.com',
        city, state,
        event_type: 'in_person' as const,
        event_date: date,
        launch_date: date,
        status: 'draft' as const,
        total_contacts: 0,
        enriched_contacts: 0,
        emails_generated: 0,
      });
      addLiveCampaign(mk('Boston Roadshow 9/9/2025','Boston','MA','2025-09-09'));
      addLiveCampaign(mk('Miami Roadshow 9/15/2025','Miami','FL','2025-09-15'));
    }
  }, [campaigns.length, setCampaigns]);

  useEffect(() => {
    fetch(`${API_URL}/api/stats`).then((r)=> r.json()).then((s)=> setStats(s)).catch(()=>{});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Campaign Overview</h1>
        <p className="mt-1 text-sm text-gray-600">Seeded from Event Campaign Flow – ADTV</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: 'Enrolled', value: stats?.enrolled ?? 0 },
          { label: 'Messaged', value: stats?.messaged ?? 0 },
          { label: 'RSVP Confirmed', value: stats?.rsvpConfirmed ?? 0 },
          { label: 'Attended', value: stats?.attended ?? 0 },
          { label: 'eSign Sent', value: stats?.esignSent ?? 0 },
          { label: 'Signed', value: stats?.signed ?? 0 },
          { label: 'Podio Created', value: stats?.podioCreated ?? 0 },
        ]).map((k) => (
          <div key={k.label} className="card">
            <p className="text-sm text-gray-600">{k.label}</p>
            <p className="text-3xl font-semibold mt-2">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        {stats?.recentActivity?.length ? (
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-2">
            {stats.recentActivity.map((a: any) => (
              <li key={a.id}><span className="text-gray-500">{new Date(a.time).toLocaleString()}:</span> {a.direction === 'in' ? 'Inbound' : 'Outbound'} from {a.contact} — {a.text}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No recent activity.</p>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Active Campaigns</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {liveCampaigns.map((c) => (
            <div key={c.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.status} · {c.event_type}</p>
                </div>
                <a className="btn-primary btn-sm" href={`/campaigns/${c.id}`}>Open</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


