import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MOCK_TICKETS, MOCK_USERS, ROLES, STATUSES, PRIORITIES,
  formatINR, formatDate, relativeTime, linearRank, tierLabel,
  ticketsToCSV, downloadCSV,
} from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import { toast } from 'sonner';
import {
  Search, Download, UserPlus, Inbox, History, Table2, LayoutList, Sparkles,
} from 'lucide-react';

const POC_OPTIONS = MOCK_USERS.filter((u) => u.role === ROLES.POC_OWNER);

export default function CoeWorkbench() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState(MOCK_TICKETS);
  const [audit, setAudit] = useState([]); // Workbench-local audit trail of edits
  const [q, setQ] = useState('');
  const [prioFilter, setPrioFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const ranked = useMemo(() => linearRank(tickets), [tickets]);

  const visible = ranked.filter((t) =>
    (q ? (t.title.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase())) : true) &&
    (prioFilter === 'all' ? true : t.priority === prioFilter) &&
    (statusFilter === 'all' ? true : t.status === statusFilter)
  );

  const log = (ticketId, field, before, after) => {
    setAudit((prev) => [{
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      actor: user?.name || 'COE Admin',
      ticketId,
      field,
      before,
      after,
    }, ...prev]);
  };

  const updateTicket = (ticketId, patch, fieldLabel, beforeValue, afterValue) => {
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, ...patch } : t));
    log(ticketId, fieldLabel, beforeValue, afterValue);
    toast.success(`${ticketId}: ${fieldLabel} updated`);
    // Fire-and-forget persistence; failures fall back to in-memory only.
    api.patchTicket(ticketId, patch).catch((err) => {
      console.warn('[workbench] persistence failed', err);
    });
  };

  const changePriority = (ticketId, priority) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t || t.priority === priority) return;
    updateTicket(ticketId, { priority }, 'Priority', t.priority, priority);
  };

  const changeStatus = (ticketId, status) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t || t.status === status) return;
    updateTicket(ticketId, { status }, 'Status', t.status, status);
  };

  const assignPoc = (ticketId, userId) => {
    const t = tickets.find((x) => x.id === ticketId);
    const u = MOCK_USERS.find((x) => x.id === userId);
    if (!t || !u || t.assignedToId === u.id) return;
    updateTicket(
      ticketId,
      { assignedTo: u.name, assignedToId: u.id, status: ['Submitted', 'Triaged'].includes(t.status) ? 'POC Assigned' : t.status },
      'Assigned To',
      t.assignedTo || '—',
      u.name,
    );
  };

  const exportCSV = () => {
    const csv = ticketsToCSV(visible);
    downloadCSV(`scm-issue-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${visible.length} rows`);
  };

  return (
    <div className="space-y-6" data-testid="coe-workbench-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">COE Workbench</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">Triage, Prioritisation &amp; Assignment</h1>
          <p className="text-sm text-gray-500 mt-1">Central console — every issue, every priority. Edits are audit-logged.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-semibold">{visible.length} in view</span>
          <Button data-testid="workbench-export-csv" onClick={exportCSV} className="bg-red-600 hover:bg-red-700">
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                data-testid="workbench-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by ticket ID, title…"
                className="pl-9"
              />
            </div>
            <Select value={prioFilter} onValueChange={setPrioFilter}>
              <SelectTrigger data-testid="workbench-priority-filter" className="w-[180px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{tierLabel(p)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="workbench-status-filter" className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="triage">
        <TabsList>
          <TabsTrigger value="triage" data-testid="workbench-tab-triage">
            <LayoutList className="h-3.5 w-3.5 mr-1.5" /> Triage view
          </TabsTrigger>
          <TabsTrigger value="log" data-testid="workbench-tab-log">
            <Table2 className="h-3.5 w-3.5 mr-1.5" /> Issue log (Excel view)
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="workbench-tab-audit">
            <History className="h-3.5 w-3.5 mr-1.5" /> Audit trail ({audit.length})
          </TabsTrigger>
        </TabsList>

        {/* TRIAGE — compact, action-first */}
        <TabsContent value="triage" className="mt-4">
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-[60px]">Rank</TableHead>
                  <TableHead className="w-[160px]">Ticket</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[140px]">Priority</TableHead>
                  <TableHead className="w-[160px]">Status</TableHead>
                  <TableHead className="w-[120px]">SLA</TableHead>
                  <TableHead className="w-[110px]">Score</TableHead>
                  <TableHead className="w-[180px]">Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => (
                  <TableRow key={t.id} data-testid={`workbench-row-${t.id}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <TableCell className="font-mono-airtel text-xs">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-bold ${t.priority === 'P0' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.rank}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono-airtel text-xs text-gray-500">{t.id}</div>
                      <div className="text-[11px] text-gray-400">{relativeTime(t.submittedAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm text-gray-900 truncate max-w-md">{t.title}</div>
                      <div className="text-[11px] text-gray-500">{t.module} · {t.category} · {t.function}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={t.priority} onValueChange={(v) => changePriority(t.id, v)}>
                        <SelectTrigger data-testid={`priority-select-${t.id}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={t.status} onValueChange={(v) => changeStatus(t.id, v)}>
                        <SelectTrigger data-testid={`status-select-${t.id}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><SlaChip sla={t.sla} /></TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold text-red-600">{t.composite}</div>
                      <div className="text-[11px] text-gray-500">{formatINR(t.impact.costSavings)}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={t.assignedToId || ''} onValueChange={(v) => assignPoc(t.id, v)}>
                        <SelectTrigger data-testid={`assign-select-${t.id}`} className="h-8 text-xs">
                          <SelectValue placeholder={<span className="flex items-center text-gray-400"><UserPlus className="h-3 w-3 mr-1" /> Assign</span>} />
                        </SelectTrigger>
                        <SelectContent>
                          {POC_OPTIONS.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                      <Inbox className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      No tickets match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ISSUE LOG — Excel-like full column view */}
        <TabsContent value="log" className="mt-4">
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-amber-50/50 text-xs text-amber-800 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Auto-calculated columns (scores, composite, tier, rank) mirror the framework's Prioritisation engine. Compliance = Yes auto-overrides to P0.
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    {[
                      'Rank', 'Issue ID', 'Date', 'Module', 'Sub-Process', 'Category',
                      'Title', 'Reported By', 'Function', 'Frequency',
                      'People', 'Time (hrs/wk)', 'Cost Saving', 'Compliance?',
                      'People Score', 'Freq Score', 'Time Score', 'Cost Score',
                      'Composite', 'Tier', 'Stage', 'POC Owner', 'Days Open', 'SLA',
                    ].map((h) => (
                      <TableHead key={h} className="text-[11px] whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((t) => (
                    <TableRow key={t.id} data-testid={`log-row-${t.id}`} className="hover:bg-gray-50 cursor-pointer text-xs" onClick={() => navigate(`/tickets/${t.id}`)}>
                      <TableCell className="font-bold">{t.rank}</TableCell>
                      <TableCell className="font-mono-airtel">{t.id}</TableCell>
                      <TableCell>{formatDate(t.submittedAt)}</TableCell>
                      <TableCell>{t.module}</TableCell>
                      <TableCell>{t.subProcess}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={t.title}>{t.title}</TableCell>
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
                      <TableCell className="bg-amber-50/40">{t.scores.peopleScore}</TableCell>
                      <TableCell className="bg-amber-50/40">{t.scores.freqScore}</TableCell>
                      <TableCell className="bg-amber-50/40">{t.scores.timeScore}</TableCell>
                      <TableCell className="bg-amber-50/40">{t.scores.costScore}</TableCell>
                      <TableCell className="bg-amber-50/40 font-bold">{t.composite}</TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell>{t.assignedTo || '—'}</TableCell>
                      <TableCell>{t.sla?.daysOpen ?? '—'}</TableCell>
                      <TableCell><SlaChip sla={t.sla} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* AUDIT TRAIL — every edit recorded in this session */}
        <TabsContent value="audit" className="mt-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              {audit.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                  No edits yet. Priority, status, and assignment changes appear here.
                </div>
              ) : (
                <ol className="relative border-l-2 border-gray-100 space-y-5 ml-2">
                  {audit.map((a) => (
                    <li key={a.id} className="ml-4" data-testid={`audit-${a.id}`}>
                      <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-red-600 ring-4 ring-red-100" />
                      <div className="text-xs text-gray-500">{new Date(a.at).toLocaleString('en-IN')}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5">
                        <span className="font-mono-airtel text-xs text-red-700 mr-1.5">{a.ticketId}</span>
                        {a.field} changed
                      </div>
                      <div className="text-xs text-gray-600">
                        by <span className="font-semibold">{a.actor}</span>: <code className="px-1 bg-gray-100 rounded">{a.before ?? '—'}</code> → <code className="px-1 bg-red-50 text-red-700 rounded">{a.after}</code>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
