import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_TICKETS, MOCK_USERS, ROLES, formatINR, relativeTime } from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import { toast } from 'sonner';
import { Search, ChevronRight, UserPlus, Inbox } from 'lucide-react';

const POC_OPTIONS = MOCK_USERS.filter((u) => u.role === ROLES.POC_OWNER);

export default function CoeWorkbench() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(MOCK_TICKETS);
  const [q, setQ] = useState('');
  const [prioFilter, setPrioFilter] = useState('all');

  const triageQueue = tickets.filter((t) =>
    !['Closed'].includes(t.status) &&
    (q ? (t.title.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase())) : true) &&
    (prioFilter === 'all' ? true : t.priority === prioFilter)
  );

  const assignPoc = (ticketId, userId) => {
    const u = MOCK_USERS.find((x) => x.id === userId);
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, assignedTo: u.name, assignedToId: u.id, status: t.status === 'Submitted' || t.status === 'Triage' ? 'Assigned' : t.status } : t));
    toast.success(`Assigned ${ticketId} to ${u.name}`);
  };

  const changePriority = (ticketId, priority) => {
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, priority } : t));
    toast.success(`${ticketId} → ${priority}`);
  };

  return (
    <div className="space-y-6" data-testid="coe-workbench-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">COE Workbench</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">Triage &amp; Assignment</h1>
          <p className="text-sm text-gray-500 mt-1">Central console — assign POCs, override priorities, monitor SLAs.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-red-50 text-red-700 px-3 py-1 font-semibold">{triageQueue.length} in queue</span>
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
              <SelectTrigger data-testid="workbench-priority-filter" className="w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="P0">P0 — Critical</SelectItem>
                <SelectItem value="P1">P1 — High</SelectItem>
                <SelectItem value="P2">P2 — Medium</SelectItem>
                <SelectItem value="P3">P3 — Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[160px]">Ticket</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[120px]">Priority</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[140px]">SLA</TableHead>
              <TableHead className="w-[110px]">Impact</TableHead>
              <TableHead className="w-[200px]">Assigned</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {triageQueue.map((t) => (
              <TableRow key={t.id} data-testid={`workbench-row-${t.id}`} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/tickets/${t.id}`)}>
                <TableCell>
                  <div className="font-mono-airtel text-xs text-gray-500">{t.id}</div>
                  <div className="text-[11px] text-gray-400">{relativeTime(t.submittedAt)}</div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-sm text-gray-900 truncate max-w-md">{t.title}</div>
                  <div className="text-[11px] text-gray-500">{t.module} · {t.category}</div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={t.priority} onValueChange={(v) => changePriority(t.id, v)}>
                    <SelectTrigger data-testid={`priority-select-${t.id}`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['P0', 'P1', 'P2', 'P3'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell><SlaChip sla={t.sla} /></TableCell>
                <TableCell>
                  <div className="text-sm font-semibold text-red-600">{t.impactScore}</div>
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
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </TableCell>
              </TableRow>
            ))}
            {triageQueue.length === 0 && (
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
    </div>
  );
}
