import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_TICKETS, MOCK_COMMENTS, MOCK_AUDIT, formatINR, formatDateTime, relativeTime } from '../data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { PriorityBadge, StatusBadge, SlaChip } from '../components/shared/Badges';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, FileText, Link2, MessageSquare, History, Send, ShieldCheck, Sparkles
} from 'lucide-react';

export default function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ticket = MOCK_TICKETS.find((t) => t.id === id);
  const comments = MOCK_COMMENTS[id] || [];
  const audit = MOCK_AUDIT[id] || [];
  const [newComment, setNewComment] = useState('');

  if (!ticket) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl">Ticket not found</h2>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to dashboard</Button>
      </div>
    );
  }

  const postComment = () => {
    if (!newComment.trim()) return;
    toast.success('Comment posted');
    setNewComment('');
  };

  return (
    <div className="space-y-6" data-testid="ticket-details-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="ticket-back-btn">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono-airtel text-sm text-gray-500">{ticket.id}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            <SlaChip sla={ticket.sla} />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            {ticket.title}
          </h1>
        </div>
        {ticket.status === 'Pending Validation' && (
          <Button
            data-testid="open-validation-btn"
            onClick={() => navigate(`/tickets/${ticket.id}/validate`)}
            className="bg-red-600 hover:bg-red-700"
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Validate
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-lg">Description</CardTitle></CardHeader>
            <CardContent className="p-5">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{ticket.description}</p>
              {ticket.suggestedSolution && (
                <>
                  <Separator className="my-4" />
                  <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Suggested Solution</div>
                  <p className="text-sm text-gray-700">{ticket.suggestedSolution}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments" data-testid="tab-comments">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Comments ({comments.length})
              </TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit">
                <History className="h-3.5 w-3.5 mr-1.5" /> Audit Trail
              </TabsTrigger>
              <TabsTrigger value="brd" data-testid="tab-brd">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> BRD
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="space-y-4 mt-4">
              {comments.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">No comments yet.</p>
              )}
              {comments.map((c) => (
                <Card key={c.id} className="border-gray-200">
                  <CardContent className="p-4 flex gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-gray-200 text-gray-700 text-xs">
                        {c.author.split(' ').map((p) => p[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-900">{c.author}</span>
                        <span className="text-[11px] rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">{c.authorRole}</span>
                        <span className="text-xs text-gray-400 ml-auto">{relativeTime(c.at)}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{c.text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <Textarea
                    data-testid="new-comment-input"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment…"
                    rows={3}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      data-testid="post-comment-btn"
                      onClick={postComment}
                      className="bg-red-600 hover:bg-red-700"
                      size="sm"
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Post
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <Card className="border-gray-200">
                <CardContent className="p-5">
                  <ol className="relative border-l-2 border-gray-100 space-y-5 ml-2">
                    {audit.map((a) => (
                      <li key={a.id} className="ml-4">
                        <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-red-600 ring-4 ring-red-100" />
                        <div className="text-xs text-gray-500">{formatDateTime(a.at)}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-0.5">{a.action}</div>
                        <div className="text-xs text-gray-600">by {a.actor} · {a.detail}</div>
                      </li>
                    ))}
                    {audit.length === 0 && (
                      <li className="ml-4 text-sm text-gray-500">No audit events yet.</li>
                    )}
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="brd" className="mt-4">
              <Card className="border-gray-200">
                <CardContent className="p-5">
                  {ticket.brdId ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{ticket.brdId} · {ticket.brdStatus}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Auto-drafted BRD for this ticket.</div>
                      </div>
                      <Button
                        data-testid="open-brd-btn"
                        onClick={() => navigate(`/brd/${ticket.brdId}`)}
                        variant="outline"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Open BRD
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No BRD generated yet for this ticket.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right metadata */}
        <div className="space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-base">Details</CardTitle></CardHeader>
            <CardContent className="p-4 text-sm">
              {[
                ['Module', ticket.module],
                ['Function', ticket.function],
                ['Category', ticket.category],
                ['Subcategory', ticket.subcategory],
                ['Submitted by', ticket.submittedBy],
                ['Submitted at', formatDateTime(ticket.submittedAt)],
                ['Assigned to', ticket.assignedTo || 'Unassigned'],
                ['Frequency', ticket.impact.frequency],
                ['Compliance risk', ticket.impact.complianceRisk],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-2 gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500 text-xs">{k}</span>
                  <span className="font-medium text-gray-900 text-xs text-right">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-red-600" /> Impact &amp; priority</CardTitle></CardHeader>
            <CardContent className="p-4 text-sm space-y-2">
              <div className="rounded-md bg-red-50 p-3 text-red-700">
                <div className="text-[11px] uppercase tracking-widest font-semibold">AI impact score</div>
                <div className="font-display text-3xl font-bold mt-1">{ticket.impactScore}<span className="text-base">/100</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Metric label="People affected" value={ticket.impact.peopleAffected} />
                <Metric label="Hours / wk" value={ticket.impact.hoursLostPerWeek} />
                <Metric label="Cost savings" value={formatINR(ticket.impact.costSavings)} />
                <Metric label="COE effort" value={`${ticket.coeEffortScore}/10`} />
              </div>
            </CardContent>
          </Card>

          {(ticket.parentId || ticket.childrenIds.length > 0 || ticket.relatedTicketId) && (
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Linked tickets</CardTitle></CardHeader>
              <CardContent className="p-4 text-sm space-y-2">
                {ticket.parentId && <Linked id={ticket.parentId} label="Parent" />}
                {ticket.childrenIds.map((c) => <Linked key={c} id={c} label="Child" />)}
                {ticket.relatedTicketId && <Linked id={ticket.relatedTicketId} label="Related" />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const Metric = ({ label, value }) => (
  <div className="rounded-md border border-gray-100 p-2">
    <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</div>
    <div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div>
  </div>
);

const Linked = ({ id, label }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/tickets/${id}`)}
      className="w-full text-left rounded-md border border-gray-100 p-2 hover:border-red-300 hover:bg-red-50/40 transition"
    >
      <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</div>
      <div className="font-mono-airtel text-xs text-red-600 mt-0.5">{id}</div>
    </button>
  );
};
