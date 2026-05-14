import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  MOCK_TICKETS, STATUSES, formatINR, formatDate, linearRank,
  ticketsToCSV, downloadCSV,
} from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import { toast } from 'sonner';
import { Download, History, Table2, Timer, ClipboardList, Inbox } from 'lucide-react';

export default function PocTaskView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Start with only issues assigned to this POC. Fall back to a demo set if empty.
  const initial = useMemo(() => {
    const mine = MOCK_TICKETS.filter((t) => t.assignedToId === user?.id);
    return mine.length ? mine : MOCK_TICKETS.slice(0, 3); // demo fallback
  }, [user]);

  const [tickets, setTickets] = useState(initial);
  const [audit, setAudit] = useState([]);
  const [slaDialog, setSlaDialog] = useState(null); // { ticket, newSla, comment }

  const ranked = useMemo(() => linearRank(tickets), [tickets]);

  const log = (ticketId, field, before, after, note) => {
    setAudit((prev) => [{
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      actor: user?.name || 'POC Owner',
      ticketId, field, before, after, note: note || '',
    }, ...prev]);
  };

  const persist = (ticketId, patch) =>
    api.patchTicket(ticketId, patch).catch((err) => console.warn('[poc] persistence failed', err));

  const changeStatus = (ticketId, status) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t || t.status === status) return;
    setTickets((prev) => prev.map((x) => x.id === ticketId ? { ...x, status } : x));
    log(ticketId, 'Status', t.status, status);
    toast.success(`${ticketId}: Status → ${status}`);
    persist(ticketId, { status });
  };

  const changeEffort = (ticketId, days) => {
    const t = tickets.find((x) => x.id === ticketId);
    const next = Number(days) || 0;
    if (!t || t.coeEffortDays === next) return;
    setTickets((prev) => prev.map((x) => x.id === ticketId ? { ...x, coeEffortDays: next } : x));
    log(ticketId, 'COE Effort (days)', t.coeEffortDays ?? '—', next);
    toast.success(`${ticketId}: COE effort → ${next}d`);
    persist(ticketId, { coeEffortDays: next });
  };

  const submitSlaChange = () => {
    if (!slaDialog) return;
    const { ticket, hours, comment } = slaDialog;
    const hoursNum = Number(hours);
    if (!hoursNum || hoursNum <= 0) { toast.error('Enter a valid SLA in hours'); return; }
    if (!comment.trim())             { toast.error('A comment is required for SLA changes'); return; }
    setTickets((prev) => prev.map((x) =>
      x.id === ticket.id ? { ...x, sla: { ...x.sla, resolutionHours: hoursNum } } : x
    ));
    log(ticket.id, 'SLA (resolution hrs)', ticket.sla?.resolutionHours ?? '—', hoursNum, comment);
    toast.success(`${ticket.id}: SLA updated`);
    api.patchTicket(ticket.id, { sla: { resolutionHours: hoursNum }, note: comment })
      .catch((err) => console.warn('[poc] persistence failed', err));
    setSlaDialog(null);
  };

  const exportCSV = () => {
    const csv = ticketsToCSV(ranked);
    downloadCSV(`my-assigned-issues-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${ranked.length} rows`);
  };

  return (
    <div className="space-y-6" data-testid="poc-task-view">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">My Tasks</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">POC Workbench</h1>
          <p className="text-sm text-gray-500 mt-1">Issues assigned to you — edit Status, COE effort, and SLA. Every change is audit-logged.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-semibold">{ranked.length} assigned</span>
          <Button data-testid="poc-export-csv" onClick={exportCSV} className="bg-red-600 hover:bg-red-700">
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log" data-testid="poc-tab-log">
            <Table2 className="h-3.5 w-3.5 mr-1.5" /> Issue log (Excel view)
          </TabsTrigger>
          <TabsTrigger value="board" data-testid="poc-tab-board">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Compact view
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="poc-tab-audit">
            <History className="h-3.5 w-3.5 mr-1.5" /> Audit trail ({audit.length})
          </TabsTrigger>
        </TabsList>

        {/* ISSUE LOG — Excel-style with inline editors */}
        <TabsContent value="log" className="mt-4">
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    {[
                      'Rank', 'Issue ID', 'Date', 'Module', 'Sub-Process', 'Category',
                      'Title', 'Function', 'Frequency', 'People', 'Time (hrs/wk)',
                      'Cost Saving', 'Compliance?', 'Composite', 'Priority',
                      'Status', 'SLA (hrs)', 'COE Effort (d)', 'Days Open', 'SLA Status',
                    ].map((h) => <TableHead key={h} className="text-[11px] whitespace-nowrap">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((t) => (
                    <TableRow key={t.id} className="hover:bg-gray-50 text-xs" data-testid={`poc-log-row-${t.id}`}>
                      <TableCell className="font-bold">{t.rank}</TableCell>
                      <TableCell className="font-mono-airtel cursor-pointer text-red-700" onClick={() => navigate(`/tickets/${t.id}`)}>{t.id}</TableCell>
                      <TableCell>{formatDate(t.submittedAt)}</TableCell>
                      <TableCell>{t.module}</TableCell>
                      <TableCell>{t.subProcess}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={t.title}>{t.title}</TableCell>
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
                      <TableCell>
                        <Select value={t.status} onValueChange={(v) => changeStatus(t.id, v)}>
                          <SelectTrigger data-testid={`poc-status-${t.id}`} className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          data-testid={`poc-sla-edit-${t.id}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] px-2"
                          onClick={() => setSlaDialog({ ticket: t, hours: String(t.sla?.resolutionHours || ''), comment: '' })}
                        >
                          <Timer className="h-3 w-3 mr-1" /> {t.sla?.resolutionHours ?? '—'}h
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Input
                          data-testid={`poc-effort-${t.id}`}
                          type="number"
                          min={0}
                          value={t.coeEffortDays ?? ''}
                          onChange={(e) => changeEffort(t.id, e.target.value)}
                          className="h-7 w-20 text-xs"
                        />
                      </TableCell>
                      <TableCell>{t.sla?.daysOpen ?? '—'}</TableCell>
                      <TableCell><SlaChip sla={t.sla} /></TableCell>
                    </TableRow>
                  ))}
                  {ranked.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center py-10 text-gray-500">
                        <Inbox className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        No tickets assigned to you.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* COMPACT BOARD */}
        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {ranked.map((t) => (
              <Card key={t.id} className="border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition" onClick={() => navigate(`/tickets/${t.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-airtel text-[11px] text-gray-500">{t.id}</span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-gray-900 leading-snug">{t.title}</div>
                  <div className="mt-1 text-[11px] text-gray-500">{t.module} · {t.category}</div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                    <StatusBadge status={t.status} />
                    <SlaChip sla={t.sla} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AUDIT */}
        <TabsContent value="audit" className="mt-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              {audit.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">No edits yet.</div>
              ) : (
                <ol className="relative border-l-2 border-gray-100 space-y-5 ml-2">
                  {audit.map((a) => (
                    <li key={a.id} className="ml-4" data-testid={`poc-audit-${a.id}`}>
                      <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-red-600 ring-4 ring-red-100" />
                      <div className="text-xs text-gray-500">{new Date(a.at).toLocaleString('en-IN')}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5">
                        <span className="font-mono-airtel text-xs text-red-700 mr-1.5">{a.ticketId}</span>
                        {a.field} changed
                      </div>
                      <div className="text-xs text-gray-600">
                        by <span className="font-semibold">{a.actor}</span>: <code className="px-1 bg-gray-100 rounded">{String(a.before ?? '—')}</code> → <code className="px-1 bg-red-50 text-red-700 rounded">{String(a.after)}</code>
                      </div>
                      {a.note && <div className="text-xs text-gray-500 italic mt-0.5">"{a.note}"</div>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SLA edit dialog — comment mandatory */}
      <Dialog open={!!slaDialog} onOpenChange={(open) => !open && setSlaDialog(null)}>
        <DialogContent data-testid="poc-sla-dialog">
          <DialogHeader>
            <DialogTitle>Update SLA — {slaDialog?.ticket?.id}</DialogTitle>
            <DialogDescription>Change the resolution SLA (hours). A justification comment is mandatory and will be recorded in the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Resolution SLA (hours)</Label>
              <Input
                data-testid="poc-sla-hours"
                type="number"
                min={1}
                value={slaDialog?.hours ?? ''}
                onChange={(e) => setSlaDialog((p) => ({ ...p, hours: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Justification *</Label>
              <Textarea
                data-testid="poc-sla-comment"
                rows={3}
                value={slaDialog?.comment ?? ''}
                onChange={(e) => setSlaDialog((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Why is this change required?"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSlaDialog(null)}>Cancel</Button>
            <Button data-testid="poc-sla-submit" onClick={submitSlaChange} className="bg-red-600 hover:bg-red-700">
              Save change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
