import { useEffect, useMemo, useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { apiCampaigns } from '@lib/api';
import { useStore } from '@store/useStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

export function AnalyticsMaster() {
  const { liveCampaigns } = useStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedId && liveCampaigns.length) setSelectedId(liveCampaigns[0].id);
  }, [liveCampaigns, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    apiCampaigns.stats(selectedId).then((d) => setData(d)).finally(() => setLoading(false));
  }, [selectedId]);

  const lineData = useMemo(() => {
    const labels = (data?.messagesByDay || []).map((d: any) => d.date);
    return {
      labels,
      datasets: [
        { label: 'Inbound', data: (data?.messagesByDay || []).map((d: any) => d.in), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)', tension: 0.3 },
        { label: 'Outbound', data: (data?.messagesByDay || []).map((d: any) => d.out), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', tension: 0.3 },
      ],
    };
  }, [data]);

  const statusData = useMemo(() => {
    const entries = Object.entries(data?.statusCounts || {});
    const labels = entries.map(([k]) => k);
    const values = entries.map(([_, v]: any) => v);
    const colors = ['#6b7280','#f59e0b','#3b82f6','#10b981','#6366f1','#a855f7','#ec4899','#14b8a6','#22c55e'];
    return { labels, datasets: [{ label: 'Contacts', data: values, backgroundColor: colors.slice(0, values.length) }] };
  }, [data]);

  const kpis = [
    { label: 'Contacts', value: data?.totals?.contacts ?? 0 },
    { label: 'Messages', value: data?.totals?.messages ?? 0 },
    { label: 'Inbound', value: data?.totals?.inbound ?? 0 },
    { label: 'Outbound', value: data?.totals?.outbound ?? 0 },
    { label: 'RSVPs', value: data?.funnel?.rsvpConfirmed ?? 0 },
    { label: 'Attended', value: data?.funnel?.attended ?? 0 },
    { label: 'eSign Sent', value: data?.funnel?.esignSent ?? 0 },
    { label: 'Signed', value: data?.funnel?.signed ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-gray-600">Aggregate analytics across campaigns with drilldown</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="label">Campaign</label>
          <select className="input" value={selectedId} onChange={(e)=> setSelectedId(e.target.value)}>
            {liveCampaigns.map((c)=> (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="card text-gray-500">Loading…</div>}
      {!loading && (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <div key={k.label} className="card">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-3xl mt-2">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="card md:col-span-2">
              <h3 className="font-semibold mb-2">Messages by Day (30d)</h3>
              <Line data={lineData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { maxTicksLimit: 10 } } } }} />
            </div>
            <div className="card">
              <h3 className="font-semibold mb-2">Contact Status Breakdown</h3>
              <Doughnut data={statusData} options={{ plugins: { legend: { position: 'bottom' } } }} />
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">Recent Messages</h3>
            <ul className="text-sm space-y-2 max-h-64 overflow-auto">
              {(data?.recentMessages || []).map((m: any) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span className={`badge-${m.direction==='in'?'gray':'primary'}`}>{m.direction}</span>
                  <span className="text-gray-500">{new Date(m.time).toLocaleString()}:</span>
                  <span>{m.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}


