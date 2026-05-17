// BRD list / index page.
//
// Replaces the previous `/brd` route that always opened a single hardcoded
// BRD. Now it scopes the visible tickets to the current user's role and
// presents a list — each row links to either the existing BRD or starts a
// fresh draft for the linked ticket.
//
//   Submitter   → BRDs for tickets they submitted
//   POC Owner   → BRDs for tickets assigned to them
//   COE Admin   → every ticket
//   Leadership  → every ticket (view-only on edits — enforced in BrdEditor)
//   Sys Admin   → every ticket

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MOCK_TICKETS, ROLES, formatDate, relativeTime } from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { PriorityBadge, StatusBadge } from '../components/shared/Badges';
import { FileText, Search, Plus, ChevronRight, Filter } from 'lucide-react';

export default function BrdList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | has-brd | no-brd

  const isSubmitter  = user?.role === ROLES.SUBMITTER;
  const isPoc        = user?.role === ROLES.POC_OWNER;
  const isLeadership = user?.role === ROLES.LEADERSHIP;
  const canStart     = !isLeadership;   // Leadership views existing BRDs only

  // Tickets in the user's scope.
  const scoped = useMemo(() => {
    if (!user) return [];
    if (isSubmitter) return MOCK_TICKETS.filter((t) => t.submittedById === user.id);
    if (isPoc)       return MOCK_TICKETS.filter((t) => t.assignedToId === user.id);
    return MOCK_TICKETS; // COE Admin / Leadership / Sys Admin see all
  }, [user, isSubmitter, isPoc]);

  // Search + has-BRD filter.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter((t) => {
      const matchesQ = !needle || [
        t.id, t.title, t.module, t.category, t.brdId, t.brdStatus, t.function,
      ].some((s) => (s == null ? '' : String(s).toLowerCase()).includes(needle));
      if (!matchesQ) return false;
      if (statusFilter === 'has-brd') return Boolean(t.brdId);
      if (statusFilter === 'no-brd')  return !t.brdId;
      return true;
    });
  }, [scoped, q, statusFilter]);

  const headline = isSubmitter ? 'BRDs for my tickets'
    : isPoc ? 'BRDs for my assigned tickets'
    : 'All BRDs';

  return (
    <div className="space-y-6" data-testid="brd-list-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">BRD Editor</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">{headline}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click a row to open the BRD. Tickets without a BRD yet can be drafted with AI in one click.
          </p>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                data-testid="brd-list-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by ticket ID, title, BRD ID, module…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="brd-list-status-filter" className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tickets</SelectItem>
                <SelectItem value="has-brd">Has a BRD</SelectItem>
                <SelectItem value="no-brd">No BRD yet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Filter className="h-3.5 w-3.5" />
            Showing <span className="font-semibold text-gray-900">{rows.length}</span> of {scoped.length}
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[160px]">Ticket</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[120px]">Module</TableHead>
              {!isSubmitter && <TableHead className="w-[90px]">Priority</TableHead>}
              <TableHead className="w-[120px]">Ticket status</TableHead>
              <TableHead className="w-[160px]">BRD</TableHead>
              <TableHead className="w-[110px]">Last update</TableHead>
              <TableHead className="w-[120px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const hasBrd = Boolean(t.brdId);
              const targetHref = hasBrd
                ? `/brd/${encodeURIComponent(t.brdId)}`
                : `/brd?ticket=${encodeURIComponent(t.id)}`;
              return (
                <TableRow
                  key={t.id}
                  data-testid={`brd-list-row-${t.id}`}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    if (hasBrd || canStart) navigate(targetHref);
                  }}
                >
                  <TableCell>
                    <div className="font-mono-airtel text-xs text-gray-500">{t.id}</div>
                    <div className="text-[11px] text-gray-400">{t.submittedBy}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-gray-900 truncate max-w-md">{t.title}</div>
                    <div className="text-[11px] text-gray-500">{t.category}</div>
                  </TableCell>
                  <TableCell className="text-xs">{t.module}</TableCell>
                  {!isSubmitter && (
                    <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                  )}
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell>
                    {hasBrd ? (
                      <div>
                        <div className="font-mono-airtel text-xs text-red-700">{t.brdId}</div>
                        <div className="text-[11px] text-gray-500">{t.brdStatus || 'Draft'}</div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">— not started —</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{relativeTime(t.submittedAt)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {hasBrd ? (
                      <Button
                        size="sm" variant="outline"
                        data-testid={`brd-open-${t.id}`}
                        onClick={() => navigate(targetHref)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" /> Open
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : canStart ? (
                      <Button
                        size="sm"
                        data-testid={`brd-start-${t.id}`}
                        onClick={() => navigate(targetHref)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Start
                      </Button>
                    ) : (
                      <span className="text-[11px] text-gray-400">view-only</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSubmitter ? 7 : 8} className="text-center py-12 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  {q ? 'No tickets match your search.' : 'No tickets in scope.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-[11px] text-gray-500">
        Tip: when you start a fresh BRD you'll be prompted to AI-draft it from the ticket. POC owners
        and COE admins can request edits from the submitter directly inside the editor.
      </p>
    </div>
  );
}
