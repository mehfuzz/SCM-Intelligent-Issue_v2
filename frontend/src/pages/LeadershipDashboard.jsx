import { MOCK_TICKETS, formatINR, CATEGORIES } from '../data/mockData';
import { KpiCard } from '../components/shared/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, IndianRupee, ShieldCheck, Inbox } from 'lucide-react';

const COLORS = ['#E40000', '#374151', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

export default function LeadershipDashboard() {
  const total = MOCK_TICKETS.length;
  const closed = MOCK_TICKETS.filter((t) => t.status === 'Closed').length;
  const breached = MOCK_TICKETS.filter((t) => t.sla.state === 'breached').length;
  const slaCompliance = Math.round(((total - breached) / total) * 100);
  const savings = MOCK_TICKETS.reduce((s, t) => s + (t.impact.costSavings || 0), 0);

  const byCategory = CATEGORIES.map((c) => ({
    name: c,
    value: MOCK_TICKETS.filter((t) => t.category === c).length,
  }));

  const byPriority = ['P0', 'P1', 'P2', 'P3'].map((p) => ({
    name: p,
    open: MOCK_TICKETS.filter((t) => t.priority === p && t.status !== 'Closed').length,
    closed: MOCK_TICKETS.filter((t) => t.priority === p && t.status === 'Closed').length,
  }));

  // Simulated monthly trend
  const trend = [
    { m: 'Jul', submitted: 14, resolved: 10 },
    { m: 'Aug', submitted: 18, resolved: 15 },
    { m: 'Sep', submitted: 22, resolved: 19 },
    { m: 'Oct', submitted: 25, resolved: 24 },
    { m: 'Nov', submitted: 28, resolved: 25 },
    { m: 'Dec', submitted: 11, resolved: 4 },
  ];

  return (
    <div className="space-y-6" data-testid="leadership-dashboard">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Leadership View</p>
        <h1 className="font-display text-3xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">SCM transformation KPIs across all programs, modules and regions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testId="kpi-total" label="Total tickets" value={total} icon={Inbox} delta="+12% MoM" deltaType="up" accent />
        <KpiCard testId="kpi-resolved" label="Resolved" value={closed} icon={TrendingUp} delta="+8% MoM" deltaType="up" />
        <KpiCard testId="kpi-sla" label="SLA compliance" value={`${slaCompliance}%`} icon={ShieldCheck} delta={breached > 0 ? `${breached} breached` : 'No breach'} deltaType={breached > 0 ? 'down' : 'up'} />
        <KpiCard testId="kpi-savings-total" label="Identified savings" value={formatINR(savings)} icon={IndianRupee} delta="YTD" deltaType="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="font-display text-lg">Volume by category</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCategory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                <Bar dataKey="value" fill="#E40000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="font-display text-lg">Open vs Closed by priority</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byPriority} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="open" stackId="a" fill="#E40000" radius={[0, 0, 0, 0]} />
                <Bar dataKey="closed" stackId="a" fill="#374151" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="font-display text-lg">Submission vs Resolution trend</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="submitted" stroke="#E40000" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" stroke="#374151" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="font-display text-lg">Issue mix</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="font-display text-lg">Top contributors</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="divide-y divide-gray-100">
              {['Ravi Kumar', 'Priya Sharma', 'Amit Singh'].map((p, i) => (
                <li key={p} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-700 text-xs font-bold">
                      {p.split(' ').map((x) => x[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{p}</div>
                      <div className="text-[11px] text-gray-500">{['12 tickets', '8 tickets', '7 tickets'][i]}</div>
                    </div>
                  </div>
                  <div className="font-mono-airtel text-xs text-gray-500">#{i + 1}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
