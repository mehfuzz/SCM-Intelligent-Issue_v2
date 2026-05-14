import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { MOCK_TICKETS, formatDateTime } from '../data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { PriorityBadge, StatusBadge } from '../components/shared/Badges';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, ShieldCheck } from 'lucide-react';

export default function ValidationScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ticket = id
    ? MOCK_TICKETS.find((t) => t.id === id)
    : MOCK_TICKETS.find((t) => t.status === 'Pending Validation');

  const [feedback, setFeedback] = useState('');

  if (!ticket) {
    return (
      <div className="text-center py-20" data-testid="validation-no-ticket">
        <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h2 className="font-display text-2xl">Nothing to validate</h2>
        <p className="text-sm text-gray-500 mt-2">There are no tickets pending your validation right now.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto" data-testid="validation-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Validation</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">Review resolution</h1>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="font-mono-airtel text-xs text-gray-500">{ticket.id}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <CardTitle className="font-display text-lg mt-1">{ticket.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Original issue</div>
            <p className="mt-1 text-sm text-gray-700">{ticket.description}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Resolution summary</div>
            <p className="mt-1 text-sm text-gray-700">{ticket.suggestedSolution}</p>
            <p className="text-[11px] text-gray-400 mt-2">Resolved by {ticket.assignedTo || 'Owner'} on {formatDateTime(ticket.submittedAt)}.</p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Your feedback (optional)</div>
            <Textarea
              data-testid="validation-feedback-input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Any notes for the COE team…"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              data-testid="validation-reject-btn"
              onClick={() => { toast.warning('Ticket reopened for further work'); navigate('/dashboard'); }}
              className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" /> Reject &amp; reopen
            </Button>
            <Button
              data-testid="validation-accept-btn"
              onClick={() => { toast.success('Resolution accepted — ticket closed'); navigate('/dashboard'); }}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <Check className="h-4 w-4 mr-1" /> Accept resolution
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
