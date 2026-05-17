import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_TICKETS, ROLES, formatDateTime } from '../data/mockData';
import { canViewTicket } from '../lib/access';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { PriorityBadge, StatusBadge } from '../components/shared/Badges';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, ShieldCheck, ShieldAlert, ExternalLink, Image as ImageIcon, FileText } from 'lucide-react';

export default function ValidationScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ticket = id
    ? MOCK_TICKETS.find((t) => t.id === id)
    : MOCK_TICKETS.find((t) => t.status === 'Pending Validation' &&
        (user?.role !== ROLES.SUBMITTER || t.submittedById === user.id));

  const [feedback, setFeedback] = useState('');
  const isSubmitter = user?.role === ROLES.SUBMITTER;
  const testEvidence = ticket?.testEvidence || [];

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

  // Block direct-link access to a ticket the user isn't a party to.
  if (!canViewTicket(user, ticket)) {
    return (
      <div className="max-w-lg mx-auto py-16" data-testid="validation-access-denied">
        <div className="border border-red-200 rounded-lg p-6 text-center bg-white shadow-sm">
          <ShieldAlert className="h-10 w-10 text-red-600 mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold text-gray-900">
            You don't have access to validate this ticket
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Validation is restricted to the original submitter and the COE team.
          </p>
          <Button className="mt-5 bg-red-600 hover:bg-red-700" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
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
            {!isSubmitter && <PriorityBadge priority={ticket.priority} />}
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

          {/* Test evidence — screenshots and links for the submitter to verify */}
          <div data-testid="validation-test-evidence">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Test screenshots &amp; links</div>
            {testEvidence.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 p-4 text-xs text-gray-500 text-center">
                No test artefacts attached yet by the POC team.
              </div>
            ) : (
              <ul className="space-y-2">
                {testEvidence.map((e) => {
                  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(e.url || '');
                  const Icon = isImage ? ImageIcon : FileText;
                  return (
                    <li key={e.id} className="flex items-center gap-3 rounded-md border border-gray-200 p-3 hover:border-red-300 hover:bg-red-50/30 transition">
                      <Icon className="h-4 w-4 text-red-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">{e.label}</div>
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 hover:text-red-600 break-all">
                          {e.url}
                        </a>
                      </div>
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`validation-evidence-link-${e.id}`}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold inline-flex items-center"
                      >
                        Open <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
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
