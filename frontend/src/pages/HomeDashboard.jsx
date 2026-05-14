import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MOCK_TICKETS, MOCK_NOTIFICATIONS, formatINR, relativeTime, ROLES } from '../data/mockData';
import { KpiCard } from '../components/shared/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import {
  Inbox, AlertTriangle, CheckCircle2, Timer, FilePlus2, ArrowRight, Sparkles, Search
} from 'lucide-react';

export default function HomeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  // role-aware ticket filtering
  let myTickets = MOCK_TICKETS;
  if (user.role === ROLES.SUBMITTER) myTickets = MOCK_TICKETS.filter((t) => t.submittedById === user.id);
  if (user.role === ROLES.POC_OWNER) myTickets = MOCK_TICKETS.filter((t) => t.assignedToId === user.id);
  if (user.role === ROLES.COE_ADMIN) myTickets = MOCK_TICKETS;

  const isSubmitter = user.role === ROLES.SUBMITTER;

  const filteredTickets = useMemo(() => {
    if (!q.trim()) return myTickets;
    const needle = q.toLowerCase();
    return myTickets.filter((t) =>
      t.id.toLowerCase().includes(needle) ||
      t.title.toLowerCase().includes(needle) ||
      (t.module || '').toLowerCase().includes(needle) ||
      (t.category || '').toLowerCase().includes(needle)
    );
  }, [myTickets, q]);

  const open = filteredTickets.filter((t) => !['Closed'].includes(t.status));
  const breached = filteredTickets.filter((t) => t.sla.state === 'breached');
  const closed = filteredTickets.filter((t) => t.status === 'Closed');
  const savings = filteredTickets.reduce((s, t) => s + (t.impact.costSavings || 0), 0);

  const recent = [...filteredTickets].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, isSubmitter ? 50 : 5);

  return (
    <div className="space-y-6" data-testid="home-dashboard">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">{user.role}</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what needs your attention today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="quick-action-view-reports"
            onClick={() => navigate('/reports')}
          >
            View reports
          </Button>
          <Button
            data-testid="quick-action-new-issue"
            onClick={() => navigate('/issues/new')}
            className="bg-red-600 hover:bg-red-700"
          >
            <FilePlus2 className="mr-2 h-4 w-4" /> New issue
          </Button>
        </div>
      </div>

      {/* Search box — surfaced for submitters per requirements */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              data-testid="home-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isSubmitter ? 'Search your tickets by ID, title, module…' : 'Search tickets…'}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testId="kpi-open" label={isSubmitter ? 'My open tickets' : 'Open tickets'} value={open.length} icon={Inbox} accent />
        {!isSubmitter && <KpiCard testId="kpi-breached" label="SLA breached" value={breached.length} icon={AlertTriangle} delta={breached.length > 0 ? `${breached.length} need action` : 'all clear'} deltaType={breached.length > 0 ? 'down' : 'up'} />}
        <KpiCard testId="kpi-closed" label={isSubmitter ? 'My closed' : 'Closed this month'} value={closed.length} icon={CheckCircle2} delta={isSubmitter ? '' : '+2 vs last mo'} deltaType="up" />
        <KpiCard testId="kpi-savings" label={isSubmitter ? 'My estimated savings' : 'Realized savings'} value={formatINR(savings)} icon={Timer} />
        {isSubmitter && <KpiCard testId="kpi-validation" label="Pending validation" value={filteredTickets.filter((t) => t.status === 'Pending Validation').length} icon={CheckCircle2} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tickets */}
        <Card className="lg:col-span-2 border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
            <CardTitle className="font-display text-lg">{isSubmitter ? 'My tickets' : 'Recent tickets'}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              data-testid="see-all-tickets-btn"
              onClick={() => navigate('/reports')}
            >
              See all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
              {recent.map((t) => (
                <li
                  key={t.id}
                  data-testid={`recent-ticket-${t.id}`}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-airtel text-xs text-gray-500">{t.id}</span>
                      {!isSubmitter && <PriorityBadge priority={t.priority} />}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-gray-900">{t.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {t.module} · {t.category} · {relativeTime(t.submittedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    {!isSubmitter && <SlaChip sla={t.sla} />}
                  </div>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="p-8 text-center text-sm text-gray-500">
                  {q ? 'No tickets match your search.' : 'No tickets yet — submit your first issue.'}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Notifications + AI tip */}
        <div className="space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Notifications</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {MOCK_NOTIFICATIONS.slice(0, 4).map((n) => (
                  <li
                    key={n.id}
                    onClick={() => navigate(`/tickets/${n.ticketId}`)}
                    className="p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-red-600" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">{n.title}</div>
                        <div className="text-xs text-gray-500 truncate">{n.message}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{relativeTime(n.at)}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-gray-900">AI assist (preview)</h4>
                  <p className="mt-1 text-xs text-gray-600">
                    When you submit a new issue, the AI engine will scan for duplicates,
                    auto-score impact and draft a BRD for COE review.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
