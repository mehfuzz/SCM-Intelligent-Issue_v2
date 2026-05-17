import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isLiveApi } from '../lib/hydrate';
import { notify } from '../lib/notify';
import {
  MOCK_TICKETS, MOCK_USERS, STATUSES, ROLES, IN_PROGRESS_SUBSTAGES_DEFAULT,
  formatINR, formatDate, linearRank, ticketsToCSV, downloadCSV,
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
import {
  Download, History, Table2, Timer, ClipboardList, Inbox, ExternalLink,
} from 'lucide-react';

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
  const [slaDialog, setSlaDialog] = useState(null); // { ticket, hours, comment, approver }
  const [jiraDialog, setJiraDialog] = useState(null); // { ticket, jiraKey }

  // Sub-stages a POC owner can pick after moving a ticket to "In Progress".
  // Admins edit this list at runtime in Admin Console → Workflows.
  const SUBSTAGES = IN_PROGRESS_SUBSTAGES_DEFAULT;
  // People who can approve an SLA-change request (COE Admin + Leadership).
  const approvers = MOCK_USERS.filter((u) =>
    [ROLES.COE_ADMIN, ROLES.LEADERSHIP, ROLES.SYSTEM_ADMIN].includes(u.role)
  );

  const ranked = useMemo(() => linearRank(tickets), [tickets]);

  const log = (ticketId, field, before, after, note) => {
    setAudit((prev) => [{
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      actor: user?.name || 'POC Owner',
      ticketId, field, before, after, note: note || '',
    }, ...prev]);
  };

  const persist = (ticketId, patch, label) => {
    if (!isLiveApi()) {
      toast.warning(`${ticketId}: ${label || 'change'} saved locally — not persisted (demo mode)`);
      return Promise.resolve();
    }
    return api.patchTicket(ticketId, patch).catch((err) => {
      console.warn('[poc] persistence failed', err);
      toast.error(`${ticketId}: save failed — ${err?.message || 'API error'}`);
    });
  };

  const changeStatus = (ticketId, status) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t || t.status === status) return;
    // Setting to In Progress without a sub-stage? Default to first available.
    const patch = status === 'In Progress'
      ? { status, inProgressSubStage: t.inProgressSubStage || SUBSTAGES[0] }
      : { status, inProgressSubStage: null };
    setTickets((prev) => prev.map((x) => x.id === ticketId ? { ...x, ...patch } : x));
    log(ticketId, 'Status', t.status, status);
    toast.success(`${ticketId}: Status → ${status}`);
    persist(ticketId, { status, notes: patch.inProgressSubStage ? `Sub-stage: ${patch.inProgressSubStage}` : t.notes }, 'Status');
    notify.statusChanged(t, t.status, status, user?.name);
    if (status === 'Pending Validation') notify.validationReady(t);
  };

  const changeSubStage = (ticketId, sub) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t || t.inProgressSubStage === sub) return;
    setTickets((prev) => prev.map((x) => x.id === ticketId ? { ...x, inProgressSubStage: sub } : x));
    log(ticketId, 'In-Progress sub-stage', t.inProgressSubStage ?? '—', sub);
    toast.success(`${ticketId}: stage → ${sub}`);
    persist(ticketId, { notes: `Sub-stage: ${sub}` }, 'In-Progress sub-stage');
  };

  const changeEffort = (ticketId, days) => {
    const t = tickets.find((x) => x.id === ticketId);
    const next = Number(days) || 0;
    if (!t || t.coeEffortDays === next) return;
    setTickets((prev) => prev.map((x) => x.id === ticketId ? { ...x, coeEffortDays: next } : x));
    log(ticketId, 'COE Effort (days)', t.coeEffortDays ?? '—', next);
    toast.success(`${ticketId}: COE effort → ${next}d`);
    persist(ticketId, { coeEffortDays: next }, 'COE effort');
  };

  const submitJira = () => {
    if (!jiraDialog?.jiraKey?.trim()) { toast.error('JIRA key is required'); return; }
    const { ticket, jiraKey } = jiraDialog;
    setTickets((prev) => prev.map((x) => x.id === ticket.id ? { ...x, jiraKey } : x));
    log(ticket.id, 'JIRA link', ticket.jiraKey ?? '—', jiraKey);
    toast.success(`${ticket.id} linked to JIRA ${jiraKey}`);
    persist(ticket.id, { notes: `JIRA: ${jiraKey}` }, 'JIRA link');
    notify.jiraLinked(ticket, jiraKey, user?.name);
    setJiraDialog(null);
  };

  // SLA change is no longer applied directly — POC sends an *approval request*
  // to a selected COE Admin / Leadership user. Both sides are audited.
  // Optionally, an email can be drafted to the approver.
  const submitSlaChange = () => {
    if (!slaDialog) return;
    const { ticket, hours, comment, approverId, sendEmail, emailTo } = slaDialog;
    const hoursNum = Number(hours);
    if (!hoursNum || hoursNum <= 0)  { toast.error('Enter a valid SLA in hours'); return; }
    if (!comment.trim())              { toast.error('Justification comment is mandatory'); return; }
    if (!approverId)                  { toast.error('Pick an approver'); return; }
    const approver = approvers.find((a) => a.id === approverId);
    if (!approver)                    { toast.error('Approver not found'); return; }

    // If "Send email" is checked, validate the email field.
    if (sendEmail) {
      const e = (emailTo || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        toast.error('Enter a valid email address for the approver, or uncheck "Send email"');
        return;
      }
    }

    setTickets((prev) => prev.map((x) =>
      x.id === ticket.id
        ? { ...x, slaChangeRequest: {
            requestedBy: user?.name, requestedById: user?.id,
            requestedHours: hoursNum, justification: comment,
            approverName: approver.name, approverId: approver.id,
            requestedAt: new Date().toISOString(), status: 'Pending',
            emailTo: sendEmail ? emailTo.trim() : null,
          } }
        : x
    ));
    log(
      ticket.id,
      'SLA change requested',
      `${ticket.sla?.resolutionHours ?? '—'}h`,
      `${hoursNum}h → ${approver.name}${sendEmail ? ` (emailed to ${emailTo.trim()})` : ''}`,
      comment
    );
    toast.success(
      sendEmail
        ? `${ticket.id}: SLA change sent to ${approver.name} (email queued to ${emailTo.trim()})`
        : `${ticket.id}: SLA change request sent to ${approver.name}`
    );
    persist(
      ticket.id,
      { notes: `SLA-change requested to ${hoursNum}h, approver ${approver.name}${sendEmail ? ` (cc ${emailTo.trim()})` : ''}: ${comment}` },
      'SLA-change request'
    );
    notify.slaChangeRequested(ticket, approver.id, hoursNum, comment);
    setSlaDialog(null);
  };

  // Approver actions (rendered when current user is among approvers).
  const decideSlaChange = (ticketId, decision) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t?.slaChangeRequest) return;
    const req = t.slaChangeRequest;
    const next = {
      ...t,
      slaChangeRequest: { ...req, status: decision, decidedAt: new Date().toISOString(), decidedBy: user?.name },
    };
    if (decision === 'Approved') {
      next.sla = { ...t.sla, resolutionHours: req.requestedHours };
    }
    setTickets((prev) => prev.map((x) => x.id === ticketId ? next : x));
    log(ticketId, `SLA change ${decision.toLowerCase()}`, `${t.sla?.resolutionHours ?? '—'}h`, decision === 'Approved' ? `${req.requestedHours}h` : 'unchanged', `Decided by ${user?.name}`);
    toast.success(`${ticketId}: SLA change ${decision.toLowerCase()}`);
    if (decision === 'Approved') {
      persist(ticketId, { sla: { resolutionHours: req.requestedHours }, note: `SLA approved by ${user?.name}` }, 'SLA approval');
    } else {
      persist(ticketId, { notes: `SLA change rejected by ${user?.name}` }, 'SLA rejection');
    }
    notify.slaChangeDecided(next, decision, user?.name);
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
                      'Rank', 'Issue ID', 'Module', 'Title', 'Compliance?',
                      'Composite', 'Priority', 'Status', 'In-Progress sub-stage',
                      'SLA (hrs)', 'COE Effort (d)', 'JIRA', 'SLA Status',
                    ].map((h) => <TableHead key={h} className="text-[11px] whitespace-nowrap">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((t) => (
                    <TableRow key={t.id} className="hover:bg-gray-50 text-xs" data-testid={`poc-log-row-${t.id}`}>
                      <TableCell className="font-bold">{t.rank}</TableCell>
                      <TableCell className="font-mono-airtel cursor-pointer text-red-700" onClick={() => navigate(`/tickets/${t.id}`)}>{t.id}</TableCell>
                      <TableCell>{t.module}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={t.title}>
                        {t.title}
                        {t.slaChangeRequest?.status === 'Pending' && (
                          <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold">
                            SLA change awaiting {t.slaChangeRequest.approverName}
                          </span>
                        )}
                      </TableCell>
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
                        {t.status === 'In Progress' ? (
                          <Select value={t.inProgressSubStage || ''} onValueChange={(v) => changeSubStage(t.id, v)}>
                            <SelectTrigger data-testid={`poc-substage-${t.id}`} className="h-8 text-xs w-[180px]"><SelectValue placeholder="Pick sub-stage" /></SelectTrigger>
                            <SelectContent>
                              {SUBSTAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button
                          data-testid={`poc-sla-edit-${t.id}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] px-2"
                          onClick={() => setSlaDialog({ ticket: t, hours: String(t.sla?.resolutionHours || ''), comment: '', approverId: '' })}
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
                      <TableCell>
                        {t.jiraKey ? (
                          <a
                            href={`https://jira.example/browse/${t.jiraKey}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-red-700 hover:text-red-900 font-mono-airtel inline-flex items-center"
                          >
                            {t.jiraKey} <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        ) : (
                          <Button
                            size="sm" variant="outline"
                            data-testid={`poc-jira-${t.id}`}
                            className="h-7 text-[11px] px-2"
                            onClick={() => setJiraDialog({ ticket: t, jiraKey: '' })}
                          >
                            Link
                          </Button>
                        )}
                      </TableCell>
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

      {/* SLA change request dialog — approver + comment mandatory */}
      <Dialog open={!!slaDialog} onOpenChange={(open) => !open && setSlaDialog(null)}>
        <DialogContent data-testid="poc-sla-dialog">
          <DialogHeader>
            <DialogTitle>Request SLA change — {slaDialog?.ticket?.id}</DialogTitle>
            <DialogDescription>
              Pick an approver, propose a new SLA (hours), and justify the change. Both your request and the
              approver's decision will be written to the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Proposed resolution SLA (hours) *</Label>
              <Input
                data-testid="poc-sla-hours"
                type="number" min={1}
                value={slaDialog?.hours ?? ''}
                onChange={(e) => setSlaDialog((p) => ({ ...p, hours: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Approver *</Label>
              <Select value={slaDialog?.approverId ?? ''} onValueChange={(v) => setSlaDialog((p) => ({ ...p, approverId: v }))}>
                <SelectTrigger data-testid="poc-sla-approver" className="mt-1"><SelectValue placeholder="Pick a COE Admin or Leadership user" /></SelectTrigger>
                <SelectContent>
                  {approvers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="rounded-md border border-gray-200 p-3 space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  data-testid="poc-sla-email-checkbox"
                  type="checkbox"
                  checked={!!slaDialog?.sendEmail}
                  onChange={(e) => setSlaDialog((p) => {
                    const sendEmail = e.target.checked;
                    const fallbackEmail = (approvers.find((a) => a.id === p?.approverId)?.email) || '';
                    return { ...p, sendEmail, emailTo: p.emailTo || fallbackEmail };
                  })}
                />
                Send approval request as email
              </label>
              {slaDialog?.sendEmail && (
                <div>
                  <Label className="text-xs font-semibold">Approver email *</Label>
                  <Input
                    data-testid="poc-sla-email-to"
                    type="email"
                    value={slaDialog?.emailTo ?? ''}
                    onChange={(e) => setSlaDialog((p) => ({ ...p, emailTo: e.target.value }))}
                    placeholder="approver@airtel.in"
                    className="mt-1"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    The request will be drafted with the ticket ID, justification, and a link to approve.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSlaDialog(null)}>Cancel</Button>
            <Button data-testid="poc-sla-submit" onClick={submitSlaChange} className="bg-red-600 hover:bg-red-700">
              Send for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JIRA link dialog */}
      <Dialog open={!!jiraDialog} onOpenChange={(o) => !o && setJiraDialog(null)}>
        <DialogContent data-testid="poc-jira-dialog">
          <DialogHeader>
            <DialogTitle>Link {jiraDialog?.ticket?.id} to JIRA</DialogTitle>
            <DialogDescription>Paste the JIRA issue key (e.g. <code>SCM-123</code>). JIRA project URL is configured by Admin in Admin Console → Workflows.</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs font-semibold">JIRA key *</Label>
            <Input
              data-testid="poc-jira-key"
              value={jiraDialog?.jiraKey ?? ''}
              onChange={(e) => setJiraDialog((p) => ({ ...p, jiraKey: e.target.value.toUpperCase() }))}
              placeholder="SCM-123"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJiraDialog(null)}>Cancel</Button>
            <Button data-testid="poc-jira-submit" onClick={submitJira} className="bg-red-600 hover:bg-red-700">Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
