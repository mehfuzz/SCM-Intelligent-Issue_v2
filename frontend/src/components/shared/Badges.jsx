import { cn } from '../../lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Flame } from 'lucide-react';

export const PriorityBadge = ({ priority, className }) => {
  const map = {
    P0: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', label: 'P0 · Critical' },
    P1: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', label: 'P1 · High' },
    P2: { bg: 'bg-yellow-50', text: 'text-yellow-800', ring: 'ring-yellow-200', label: 'P2 · Medium' },
    P3: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', label: 'P3 · Low' },
  };
  const s = map[priority] || map.P3;
  return (
    <span
      data-testid={`priority-badge-${priority}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        s.bg, s.text, s.ring, className
      )}
    >
      {priority === 'P0' && <Flame className="h-3 w-3" />}
      {s.label}
    </span>
  );
};

export const StatusBadge = ({ status, className }) => {
  const map = {
    'Submitted': 'bg-slate-100 text-slate-700 ring-slate-200',
    'Triage': 'bg-purple-50 text-purple-700 ring-purple-200',
    'Assigned': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    'In Progress': 'bg-blue-50 text-blue-700 ring-blue-200',
    'Pending Validation': 'bg-amber-50 text-amber-800 ring-amber-200',
    'Closed': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'Reopened': 'bg-rose-50 text-rose-700 ring-rose-200',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      map[status] || map['Submitted'], className
    )}>
      {status}
    </span>
  );
};

export const SlaChip = ({ sla, className }) => {
  if (!sla) return null;
  const pct = Math.min(100, Math.round((sla.elapsed / sla.resolutionHours) * 100));
  const map = {
    'on-track': { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', icon: CheckCircle2, label: 'On Track' },
    'at-risk': { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-200', icon: Clock, label: 'At Risk' },
    'breached': { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', icon: AlertTriangle, label: 'Breached' },
  };
  const s = map[sla.state] || map['on-track'];
  const Icon = s.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
      s.bg, s.text, s.ring, className
    )}>
      <Icon className="h-3 w-3" />
      {s.label} · {pct}%
    </span>
  );
};
