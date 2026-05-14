import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_POC_TASKS, MOCK_TICKETS, formatDate } from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PriorityBadge } from '../components/shared/Badges';
import { toast } from 'sonner';
import { CalendarDays, ChevronRight, ClipboardList } from 'lucide-react';

const STAGES = ['To Do', 'In Progress', 'Review', 'Completed'];

export default function PocTaskView() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(MOCK_POC_TASKS);

  const advance = (id) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const idx = STAGES.indexOf(t.stage);
      const next = STAGES[Math.min(STAGES.length - 1, idx + 1)];
      return { ...t, stage: next };
    }));
    toast.success('Task moved to next stage');
  };

  return (
    <div className="space-y-6" data-testid="poc-task-view">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">My Tasks</p>
        <h1 className="font-display text-3xl font-bold text-gray-900">POC Task Board</h1>
        <p className="text-sm text-gray-500 mt-1">Tickets assigned to you, organised by sub-workflow stage.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const items = tasks.filter((t) => t.stage === stage);
          return (
            <div key={stage} data-testid={`kanban-col-${stage.replace(/\s+/g, '-').toLowerCase()}`} className="bg-gray-50 rounded-lg border border-gray-200 p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-gray-900">{stage}</span>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <ClipboardList className="h-4 w-4 text-gray-400" />
              </div>
              <div className="space-y-2">
                {items.map((t) => {
                  const ticket = MOCK_TICKETS.find((x) => x.id === t.ticketId);
                  return (
                    <Card key={t.id} data-testid={`kanban-card-${t.id}`} className="border-gray-200 shadow-sm hover:shadow-md transition cursor-pointer">
                      <CardContent className="p-3" onClick={() => navigate(`/tickets/${t.ticketId}`)}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono-airtel text-[11px] text-gray-500">{t.ticketId}</span>
                          {ticket && <PriorityBadge priority={ticket.priority} />}
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-gray-900 leading-snug">{t.title}</div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDate(t.dueAt)}</span>
                          {t.stage !== 'Completed' && (
                            <button
                              data-testid={`advance-task-${t.id}`}
                              onClick={(e) => { e.stopPropagation(); advance(t.id); }}
                              className="text-red-600 hover:text-red-700 font-semibold flex items-center"
                            >
                              Next <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
