import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_TICKETS, MODULES, CATEGORIES, STATUSES, formatINR, formatDate } from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import { toast } from 'sonner';
import { Search, Download, Filter, ChevronRight } from 'lucide-react';

export default function Reports() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [modFilter, setModFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = useMemo(() => MOCK_TICKETS.filter((t) =>
    (q ? (t.title.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase())) : true) &&
    (modFilter === 'all' ? true : t.module === modFilter) &&
    (catFilter === 'all' ? true : t.category === catFilter) &&
    (statusFilter === 'all' ? true : t.status === statusFilter)
  ), [q, modFilter, catFilter, statusFilter]);

  const exportCSV = () => {
    toast.success(`Exported ${rows.length} rows to CSV (mock)`);
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Reports</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">All tickets &amp; filters</h1>
          <p className="text-sm text-gray-500 mt-1">Build custom views, export and share with stakeholders.</p>
        </div>
        <Button data-testid="export-csv-btn" onClick={exportCSV} className="bg-red-600 hover:bg-red-700">
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                data-testid="reports-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by ticket ID or title…"
                className="pl-9"
              />
            </div>
            <FilterSelect testId="reports-module-filter" value={modFilter} onChange={setModFilter} placeholder="Module" options={MODULES} />
            <FilterSelect testId="reports-category-filter" value={catFilter} onChange={setCatFilter} placeholder="Category" options={CATEGORIES} />
            <FilterSelect testId="reports-status-filter" value={statusFilter} onChange={setStatusFilter} placeholder="Status" options={STATUSES} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Filter className="h-3.5 w-3.5" />
            Showing <span className="font-semibold text-gray-900">{rows.length}</span> of {MOCK_TICKETS.length} tickets
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[170px]">Ticket</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[110px]">Priority</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[130px]">SLA</TableHead>
              <TableHead className="w-[110px]">Savings</TableHead>
              <TableHead className="w-[110px]">Submitted</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} data-testid={`report-row-${t.id}`} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/tickets/${t.id}`)}>
                <TableCell>
                  <div className="font-mono-airtel text-xs text-gray-500">{t.id}</div>
                  <div className="text-[11px] text-gray-400">{t.module}</div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-sm text-gray-900 truncate max-w-md">{t.title}</div>
                  <div className="text-[11px] text-gray-500">{t.category}</div>
                </TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell><SlaChip sla={t.sla} /></TableCell>
                <TableCell className="text-sm font-semibold text-gray-900">{formatINR(t.impact.costSavings)}</TableCell>
                <TableCell className="text-xs text-gray-500">{formatDate(t.submittedAt)}</TableCell>
                <TableCell><ChevronRight className="h-4 w-4 text-gray-400" /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-500">No tickets match your filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const FilterSelect = ({ value, onChange, placeholder, options, testId }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger data-testid={testId} className="w-full lg:w-[180px]">
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All {placeholder.toLowerCase()}s</SelectItem>
      {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
    </SelectContent>
  </Select>
);
