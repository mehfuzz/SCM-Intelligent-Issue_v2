import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  MOCK_TICKETS, MODULES, FUNCTIONS, PRIORITIES, relativeTime,
} from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import { AlertTriangle, Clock, CheckCircle2, Timer, Filter, Search } from 'lucide-react';

export default function SlaMonitor() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [modFilter, setModFilter] = useState('all');
  const [fnFilter,  setFnFilter]  = useState('all');
  const [prioFilter, setPrioFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const open = useMemo(() => MOCK_TICKETS.filter((t) => t.status !== 'Closed'), []);
  const assignees = useMemo(
    () => Array.from(new Set(open.map((t) => t.assignedTo).filter(Boolean))).sort(),
    [open],
  );

  const filtered = useMemo(() => open.filter((t) =>
    (tab === 'all' ? true : t.sla?.state === tab) &&
    (q.trim() ? (t.title.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase())) : true) &&
    (modFilter   === 'all' ? true : t.module === modFilter) &&
    (fnFilter    === 'all' ? true : t.function === fnFilter) &&
    (prioFilter  === 'all' ? true : t.priority === prioFilter) &&
    (assigneeFilter === 'all'
      ? true
      : assigneeFilter === 'unassigned'
        ? !t.assignedTo
        : t.assignedTo === assigneeFilter)
  ), [open, tab, q, modFilter, fnFilter, prioFilter, assigneeFilter]);

  const counts = {
    all: open.length,
    'on-track': open.filter((t) => t.sla?.state === 'on-track').length,
    'at-risk':  open.filter((t) => t.sla?.state === 'at-risk').length,
    'breached': open.filter((t) => t.sla?.state === 'breached').length,
  };

  return (
    <div className="space-y-6" data-testid="sla-monitor-page">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">SLA Monitor</p>
        <h1 className="font-display text-3xl font-bold text-gray-900">Service Level Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Live view of all open tickets against response &amp; resolution SLAs.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SlaStat label="Total open" value={counts.all} icon={Timer} color="gray" />
        <SlaStat label="On track" value={counts['on-track']} icon={CheckCircle2} color="emerald" />
        <SlaStat label="At risk" value={counts['at-risk']} icon={Clock} color="amber" />
        <SlaStat label="Breached" value={counts['breached']} icon={AlertTriangle} color="red" />
      </div>

      {/* ---------- Filter bar ---------- */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                data-testid="sla-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by ticket ID or title…"
                className="pl-9"
              />
            </div>
            <FilterSelect testId="sla-module-filter"   value={modFilter}      onChange={setModFilter}      placeholder="Module"   options={MODULES} />
            <FilterSelect testId="sla-function-filter" value={fnFilter}       onChange={setFnFilter}       placeholder="Function" options={FUNCTIONS} />
            <FilterSelect testId="sla-priority-filter" value={prioFilter}     onChange={setPrioFilter}     placeholder="Priority" options={PRIORITIES} />
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger data-testid="sla-assignee-filter" className="w-full lg:w-[180px]">
                <SelectValue placeholder="POC owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All POC owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assignees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Filter className="h-3.5 w-3.5" />
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span> of {open.length} open tickets
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all"      data-testid="sla-tab-all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="breached" data-testid="sla-tab-breached">Breached ({counts.breached})</TabsTrigger>
          <TabsTrigger value="at-risk"  data-testid="sla-tab-at-risk">At risk ({counts['at-risk']})</TabsTrigger>
          <TabsTrigger value="on-track" data-testid="sla-tab-on-track">On track ({counts['on-track']})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.map((t) => {
          const pct = Math.min(100, Math.round(((t.sla?.elapsed || 0) / (t.sla?.resolutionHours || 1)) * 100));
          const barColor = t.sla?.state === 'breached' ? 'bg-red-500' : t.sla?.state === 'at-risk' ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <Card key={t.id} data-testid={`sla-row-${t.id}`} className="border-gray-200 shadow-sm hover:shadow cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-airtel text-xs text-gray-500">{t.id}</span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 truncate">{t.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {t.module} · {t.function} · Submitted {relativeTime(t.submittedAt)} · Assigned to {t.assignedTo || 'Unassigned'}
                    </div>
                  </div>
                  <div className="w-full sm:w-72">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">{t.sla?.elapsed ?? 0}h / {t.sla?.resolutionHours ?? '—'}h</span>
                      <SlaChip sla={t.sla} />
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="border-gray-200">
            <CardContent className="p-10 text-center text-sm text-gray-500">No tickets match these filters.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const SlaStat = ({ label, value, icon: Icon, color }) => {
  const palette = {
    gray:    'bg-gray-100 text-gray-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber:   'bg-amber-100 text-amber-700',
    red:     'bg-red-100 text-red-700',
  }[color];
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</div>
          <div className="font-display text-3xl font-bold mt-2">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${palette}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
};

const FilterSelect = ({ value, onChange, placeholder, options, testId }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger data-testid={testId} className="w-full lg:w-[160px]">
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All {placeholder.toLowerCase()}s</SelectItem>
      {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
    </SelectContent>
  </Select>
);
