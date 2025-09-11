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
  ChartOptions,
} from 'chart.js';
import { apiCampaigns } from '@lib/api';
import { useStore } from '@store/useStore';

// Simple needle plugin for gauge-style doughnut
const needlePlugin = {
  id: 'gaugeNeedle',
  afterDatasetDraw(chart: any, args: any, pluginOptions: any) {
    const { ctx, data, chartArea: { width, height } } = chart;
    const dataset = data.datasets[0];
    const value = dataset?.data?.[0]?.value ?? dataset?.data?.[0] ?? 0;
    const max = (dataset as any)?.maxValue ?? 100;
    const angle = Math.PI + (value / Math.max(max, 1)) * Math.PI; // half circle
    const cx = width / 2 + chart.getDatasetMeta(0).data[0].x - width / 2;
    const cy = chart.getDatasetMeta(0).data[0].y; // center y
    const r = Math.min(width, height) / 2 * 0.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#374151';
    ctx.stroke();
    ctx.restore();
  }
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, needlePlugin as any);

export function AnalyticsMaster() {
  const { liveCampaigns } = useStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedId && liveCampaigns && liveCampaigns.length) setSelectedId(liveCampaigns[0]?.id || '');
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

  // Gauge helpers (half-doughnut)
  const buildGauge = (value: number, max: number, label: string) => {
    const pct = Math.min(value / Math.max(max, 1), 1);
    // Three ranges: red 0-25%, yellow 25-60%, green 60-100%
    const red = Math.min(pct, 0.25);
    const yellow = Math.max(Math.min(pct - 0.25, 0.35), 0);
    const green = Math.max(pct - 0.60, 0);
    const remain = 1 - (red + yellow + green);
    const seg = [red, yellow, green, remain].map((p) => Math.max(p, 0) * 100);
    return {
      data: {
        labels: ['Low','Med','High','Remaining'],
        datasets: [
          {
            data: seg,
            backgroundColor: ['#ef4444','#f59e0b','#4ade80','#e5e7eb'],
            borderWidth: 0,
            circumference: 180,
            rotation: 180,
            // custom for needle
            maxValue: max,
            // store value for plugin
            dataElementType: 'arc',
            // embed the actual numeric value in first datum for plugin
            // @ts-ignore
            dataValue: value,
          } as any,
        ],
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      } as ChartOptions<'doughnut'>,
      centerText: { label, value },
      max,
    };
  };

  const overallReach = data?.totals?.contacts ?? 0;
  const overallImpressions = data?.totals?.messages ?? 0;
  const overallEngagement = (data?.recentMessages || []).filter((m: any)=> m.direction==='in').length;
  const frequency = overallReach > 0 ? Math.round((overallImpressions / overallReach) * 10) / 10 : 0;

  const gauges = [
    buildGauge(overallReach, 40000, 'Reach'),
    buildGauge(overallImpressions, 40000, 'Impressions'),
    buildGauge(overallEngagement, 15000, 'Post Engagement'),
    buildGauge(Math.min(frequency, 12), 12, 'Frequency'),
  ];

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

          {/* Overall Account Metrics */}
          <div className="card">
            <h3 className="font-semibold mb-4">Overall Account Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {gauges.map((g, i) => (
                <div key={i} className="flex flex-col items-center justify-center">
                  <div className="w-full max-w-xs">
                    <Doughnut data={g.data as any} options={g.options as any} />
                  </div>
                  <div className="-mt-6 text-center">
                    <p className="text-xs uppercase text-gray-500 tracking-wider">{g.centerText.label}</p>
                    <p className="text-lg font-semibold">{g.centerText.value.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="card md:col-span-3">
              <h3 className="font-semibold mb-2">Messages by Day (30d)</h3>
              <Line data={lineData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { maxTicksLimit: 10 } } } }} />
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">Performance By Post</h3>
            <ul className="text-sm space-y-2 max-h-64 overflow-auto">
              {(data?.recentMessages || []).filter((m: any)=> m.direction==='out').slice(0,5).map((m: any) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span className="badge-primary">OUT</span>
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


