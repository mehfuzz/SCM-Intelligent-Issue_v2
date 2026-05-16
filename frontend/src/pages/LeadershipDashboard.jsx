import { useState, useMemo } from 'react';
import {
  MOCK_TICKETS, MOCK_USERS, ROLES, CATEGORIES, MODULES,
  formatINR, formatDate, linearRank, ticketsToCSV, downloadCSV,
} from '../data/mockData';
import { KpiCard } from '../components/shared/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, IndianRupee, ShieldCheck, Inbox, Download, Table2,
  LayoutGrid, AlertTriangle, Users2,
} from 'lucide-react';

const COLORS = ['#E40000', '#374151', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

export default function LeadershipDashboard() {
  const tickets = MOCK_TICKETS;
  const ranked = useMemo(() => linearRank(tickets), [tickets]);
  const [drill, setDrill] = useState(null); // { title, rows }

  // -------- KPI computations --------
  const total = tickets.length;
  const closed = tickets.filter((t) => t.status === 'Closed').length;
  const breached = tickets.filter((t) => t.sla?.state === 'breached').length;
  const atRisk = tickets.filter((t) => t.sla?.state === 'at-risk').length;
  const slaCompliance = total ? Math.round(((total - breached) / total) * 100) : 100;
  const savings = tickets.reduce((s, t) => s + (Number(t.impact.costSavings) || 0), 0);
  const compliance = tickets.filter((t) => t.impact.complianceRisk === 'Yes').length;
  const reopened = tickets.filter((t) => t.status === 'Reopened').length;

  // A ticket is "stalled" if it's been open for more than its resolution SLA
  // and the SLA state is breached. (Conservative — does not flag at-risk.)
  const stalled = tickets.filter(
    (t) => t.status !== 'Closed' && t.sla?.state === 'breached'
  ).length;

  // Average time-to-close (days). Uses sla.daysOpen on closed tickets — that
  // mirrors the framework "Days Open" field.
  const closedTickets = tickets.filter((t) => t.status === 'Closed');
  const avgCloseDays = closedTickets.length
    ? Math.round(closedTickets.reduce((s, t) => s + (t.sla?.daysOpen || 0), 0) / closedTickets.length)
    : 0;

  // -------- chart datasets --------
  // Always include every module — empty modules show as 0 so leadership can
  // see the full coverage map, not just the ones with traffic.
  const byCategory = CATEGORIES.map((c) => ({ name: c, value: tickets.filter((t) => t.category === c).length }));
  const byModule   = MODULES.map((m) => ({ name: m, value: tickets.filter((t) => t.module === m).length }));
  const byPriority = ['P0', 'P1', 'P2', 'P3'].map((p) => ({
    name: p,
    open:   tickets.filter((t) => t.priority === p && t.status !== 'Closed').length,
    closed: tickets.filter((t) => t.priority === p && t.status === 'Closed').length,
  }));

  // Per-module average days-to-close (only computed where there's at least one closed ticket).
  const avgCloseByModule = MODULES.map((m) => {
    const owns = tickets.filter((t) => t.module === m && t.status === 'Closed');
    return {
      name: m,
      value: owns.length ? Math.round(owns.reduce((s, t) => s + (t.sla?.daysOpen || 0), 0) / owns.length) : 0,
    };
  });

  // Reopens by module — historical signal for "fix didn't stick".
  const reopensByModule = MODULES.map((m) => ({
    name: m,
    value: tickets.filter((t) => t.module === m && t.status === 'Reopened').length,
  }));

  // Top 5 pending issues by composite score (highest impact, still open).
  const topPending = [...tickets]
    .filter((t) => t.status !== 'Closed')
    .sort((a, b) => (b.composite || 0) - (a.composite || 0))
    .slice(0, 5);

  // Per-POC report
  const pocs = MOCK_USERS.filter((u) => u.role === ROLES.POC_OWNER);
  const pocReport = pocs.map((p) => {
    const own = tickets.filter((t) => t.assignedToId === p.id);
    return {
      id: p.id,
      name: p.name,
      department: p.department,
      total: own.length,
      open: own.filter((t) => t.status !== 'Closed').length,
      breached: own.filter((t) => t.sla?.state === 'breached').length,
      avgComposite: own.length ? Math.round(own.reduce((s, t) => s + (t.composite || 0), 0) / own.length) : 0,
      effortDays: own.reduce((s, t) => s + (t.coeEffortDays || 0), 0),
      savings: own.reduce((s, t) => s + (t.impact.costSavings || 0), 0),
    };
  });

  // Trend (synthetic but module-aware)
  const trend = [
    { m: 'Nov', submitted: 14, resolved: 10 },
    { m: 'Dec', submitted: 18, resolved: 15 },
    { m: 'Jan', submitted: 22, resolved: 19 },
    { m: 'Feb', submitted: 25, resolved: 24 },
    { m: 'Mar', submitted: 28, resolved: 22 },
    { m: 'Apr', submitted: tickets.length, resolved: closed },
  ];

  // -------- drill-down helper --------
  const openDrill = (title, filterFn) => {
    setDrill({ title, rows: tickets.filter(filterFn) });
  };

  const exportFullLog = () => {
    const csv = ticketsToCSV(ranked);
    downloadCSV(`leadership-issue-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-6" data-testid="leadership-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Leadership View</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">SCM transformation KPIs across all programs, modules and POCs. Click a KPI or chart to drill down.</p>
        </div>
        <Button data-testid="leadership-export-csv" onClick={exportFullLog} className="bg-red-600 hover:bg-red-700">
          <Download className="h-4 w-4 mr-1" /> Export full log
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="lead-tab-overview"><LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="poc"       data-testid="lead-tab-poc"><Users2 className="h-3.5 w-3.5 mr-1.5" /> Per-POC report</TabsTrigger>
          <TabsTrigger value="log"       data-testid="lead-tab-log"><Table2 className="h-3.5 w-3.5 mr-1.5" /> Issue log (Excel)</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <DrillKpi testId="kpi-total"      label="Total tickets"        value={total}                 icon={Inbox}      accent
                      onDoubleClick={() => openDrill('All tickets', () => true)} />
            <DrillKpi testId="kpi-resolved"   label="Resolved"             value={closed}                icon={TrendingUp}
                      onDoubleClick={() => openDrill('Resolved tickets', (t) => t.status === 'Closed')} />
            <DrillKpi testId="kpi-sla"        label="SLA compliance"       value={`${slaCompliance}%`}   icon={ShieldCheck}
                      delta={breached > 0 ? `${breached} breached` : 'No breach'}
                      deltaType={breached > 0 ? 'down' : 'up'}
                      onDoubleClick={() => openDrill('SLA breached / at risk', (t) => ['breached', 'at-risk'].includes(t.sla?.state))} />
            <DrillKpi testId="kpi-savings"    label="Identified savings"   value={formatINR(savings)}    icon={IndianRupee} delta="YTD"
                      onDoubleClick={() => openDrill('All tickets (by savings)', () => true)} />
            <DrillKpi testId="kpi-stalled"    label="Stalled (SLA breached)" value={stalled}             icon={AlertTriangle}
                      delta={stalled > 0 ? 'needs escalation' : 'none'}
                      deltaType={stalled > 0 ? 'down' : 'up'}
                      onDoubleClick={() => openDrill('Stalled tickets', (t) => t.status !== 'Closed' && t.sla?.state === 'breached')} />
            <DrillKpi testId="kpi-avg-close"  label="Avg time to close" value={`${avgCloseDays}d`} icon={TrendingUp}
                      onDoubleClick={() => openDrill('Closed tickets sorted by Days Open', (t) => t.status === 'Closed')} />
          </div>

          {/* Top 5 pending issues — at-a-glance triage for leadership */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Top 5 pending issues</CardTitle>
              <span className="text-xs text-gray-500">Highest composite score, status ≠ Closed</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[60px]">Rank</TableHead>
                    <TableHead className="w-[140px]">Ticket</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[110px]">Module</TableHead>
                    <TableHead className="w-[100px]">Score</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[110px]">SLA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPending.map((t, i) => (
                    <TableRow key={t.id} data-testid={`top-pending-${t.id}`} className="hover:bg-gray-50">
                      <TableCell className="font-bold text-red-600">#{i + 1}</TableCell>
                      <TableCell className="font-mono-airtel text-xs">{t.id}</TableCell>
                      <TableCell className="text-sm truncate max-w-md">{t.title}</TableCell>
                      <TableCell className="text-xs">{t.module}</TableCell>
                      <TableCell className="font-semibold">{t.composite}</TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell><SlaChip sla={t.sla} /></TableCell>
                    </TableRow>
                  ))}
                  {topPending.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-xs text-gray-500 py-6">No pending issues — well done.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Volume by category — double-click a bar</CardTitle></CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byCategory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    onDoubleClick={(e) => e?.activeLabel && openDrill(`Category: ${e.activeLabel}`, (t) => t.category === e.activeLabel)}>
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
              <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Open vs Closed by priority</CardTitle></CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byPriority} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    onDoubleClick={(e) => e?.activeLabel && openDrill(`Priority: ${e.activeLabel}`, (t) => t.priority === e.activeLabel)}>
                    <CartesianGrid stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="open"   stackId="a" fill="#E40000" />
                    <Bar dataKey="closed" stackId="a" fill="#374151" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm lg:col-span-2">
              <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Submission vs Resolution trend</CardTitle></CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="submitted" stroke="#E40000" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="resolved"  stroke="#374151" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Issue mix</CardTitle></CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}
                         onDoubleClick={(_, idx) => openDrill(`Category: ${byCategory[idx].name}`, (t) => t.category === byCategory[idx].name)}>
                      {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm lg:col-span-2">
              <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Volume by module — every SCM module shown; double-click a bar</CardTitle></CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={Math.max(260, byModule.length * 26)}>
                  <BarChart data={byModule} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} layout="vertical"
                    onDoubleClick={(e) => e?.activeLabel && openDrill(`Module: ${e.activeLabel}`, (t) => t.module === e.activeLabel)}>
                    <CartesianGrid stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#374151' }} width={150} interval={0} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="value" fill="#E40000" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="font-display text-lg">Avg time to close (days) by module</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={avgCloseByModule} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    onDoubleClick={(e) => e?.activeLabel && openDrill(`Closed in module: ${e.activeLabel}`, (t) => t.module === e.activeLabel && t.status === 'Closed')}>
                    <CartesianGrid stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">Reopened tickets by module</CardTitle>
                <span className="text-xs text-gray-500">Total reopens: <strong>{reopened}</strong></span>
              </CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={reopensByModule} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    onDoubleClick={(e) => e?.activeLabel && openDrill(`Reopened in module: ${e.activeLabel}`, (t) => t.module === e.activeLabel && t.status === 'Reopened')}>
                    <CartesianGrid stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
            <CardContent className="p-4 text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {atRisk} ticket(s) at risk · {breached} breached · {stalled} stalled · {compliance} compliance-flagged · {reopened} reopened.
              Double-click any KPI tile or chart bar to drill into the underlying tickets.
            </CardContent>
          </Card>
        </TabsContent>

        {/* PER-POC REPORT */}
        <TabsContent value="poc" className="mt-4">
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead>POC Owner</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Breached</TableHead>
                  <TableHead className="text-right">Avg Composite</TableHead>
                  <TableHead className="text-right">COE Effort (days)</TableHead>
                  <TableHead className="text-right">Savings impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pocReport.map((p) => (
                  <TableRow key={p.id} data-testid={`poc-report-${p.id}`} className="cursor-pointer hover:bg-gray-50"
                            onDoubleClick={() => openDrill(`POC: ${p.name}`, (t) => t.assignedToId === p.id)}>
                    <TableCell>
                      <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                      <div className="text-[11px] text-gray-500">{p.department}</div>
                    </TableCell>
                    <TableCell className="text-right">{p.total}</TableCell>
                    <TableCell className="text-right">{p.open}</TableCell>
                    <TableCell className="text-right text-red-700 font-semibold">{p.breached}</TableCell>
                    <TableCell className="text-right">{p.avgComposite}</TableCell>
                    <TableCell className="text-right">{p.effortDays}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(p.savings)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500">
              Double-click a row to drill into that POC owner's tickets.
            </div>
          </Card>
        </TabsContent>

        {/* ISSUE LOG */}
        <TabsContent value="log" className="mt-4">
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    {[
                      'Rank', 'Issue ID', 'Date', 'Module', 'Sub-Process', 'Category',
                      'Title', 'Reported By', 'Function', 'Frequency', 'People',
                      'Time (hrs/wk)', 'Cost Saving', 'Compliance?', 'Composite',
                      'Priority', 'Stage', 'POC Owner', 'SLA',
                    ].map((h) => <TableHead key={h} className="text-[11px] whitespace-nowrap">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((t) => (
                    <TableRow key={t.id} className="text-xs hover:bg-gray-50" data-testid={`lead-log-${t.id}`}>
                      <TableCell className="font-bold">{t.rank}</TableCell>
                      <TableCell className="font-mono-airtel">{t.id}</TableCell>
                      <TableCell>{formatDate(t.submittedAt)}</TableCell>
                      <TableCell>{t.module}</TableCell>
                      <TableCell>{t.subProcess}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={t.title}>{t.title}</TableCell>
                      <TableCell>{t.submittedBy}</TableCell>
                      <TableCell>{t.function}</TableCell>
                      <TableCell>{t.impact.frequency}</TableCell>
                      <TableCell>{t.impact.peopleAffected}</TableCell>
                      <TableCell>{t.impact.hoursLostPerWeek}</TableCell>
                      <TableCell>{formatINR(t.impact.costSavings)}</TableCell>
                      <TableCell>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.impact.complianceRisk === 'Yes' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {t.impact.complianceRisk}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold">{t.composite}</TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell>{t.assignedTo || '—'}</TableCell>
                      <TableCell><SlaChip sla={t.sla} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DRILL-DOWN MODAL */}
      <Dialog open={!!drill} onOpenChange={(open) => !open && setDrill(null)}>
        <DialogContent className="max-w-5xl" data-testid="leadership-drill-dialog">
          <DialogHeader>
            <DialogTitle>{drill?.title}</DialogTitle>
            <DialogDescription>{drill?.rows?.length || 0} ticket(s).</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead>Ticket</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[80px]">Priority</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">SLA</TableHead>
                  <TableHead className="w-[110px]">Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drill?.rows || []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono-airtel text-xs">{t.id}</TableCell>
                    <TableCell className="text-sm">{t.title}</TableCell>
                    <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell><SlaChip sla={t.sla} /></TableCell>
                    <TableCell className="text-sm font-semibold">{formatINR(t.impact.costSavings)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wraps KpiCard with a double-click handler so numbers themselves drill.
const DrillKpi = ({ onDoubleClick, ...rest }) => (
  <div onDoubleClick={onDoubleClick} role="button" className="cursor-pointer select-none" title="Double-click to drill down">
    <KpiCard {...rest} />
  </div>
);
