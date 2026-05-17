import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notify } from '../lib/notify';
import { MOCK_BRDS, MOCK_TICKETS, ROLES, formatDateTime, relativeTime } from '../data/mockData';
import { canViewBrd } from '../lib/access';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, FileText, History, X, Upload, MessageSquare, Send, Sparkles, Save,
  Wand2, Loader2, ShieldAlert,
} from 'lucide-react';

// Build a fresh BRD draft from a ticket — used when a Submitter clicks
// "Start BRD" on a ticket that has no BRD yet, or when the AI draft hasn't
// run for a given ticket.
function draftFromTicket(t) {
  if (!t) return null;
  return {
    id: `BRD-${t.id.replace(/^SCM-/, '')}`,
    ticketId: t.id,
    title: `BRD — ${t.title}`,
    status: 'Draft (auto-generated)',
    version: 'v1.0',
    versions: [{ v: 'v1.0', at: new Date().toISOString(), by: 'AI Draft' }],
    sections: {
      'Background':            t.description || '',
      'Objective':             `Resolve "${t.title}" to remove the documented impact.`,
      'Scope':                 `${t.module}${t.subProcess ? ` · ${t.subProcess}` : ''}.`,
      'Functional Requirements': t.suggestedSolution
        ? `Submitter's suggested solution:\n${t.suggestedSolution}\n\n(POC: expand with detailed FRs.)`
        : '1. <fill>\n2. <fill>\n3. <fill>',
      'Acceptance Criteria':   '• <criterion 1>\n• <criterion 2>',
      'Risks & Dependencies':  '<list of dependencies and known risks>',
    },
  };
}

export default function BrdEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Resolve which BRD this page is rendering. Entry paths:
  //   1. /brd/BRD-001         → load by id; if MOCK_BRDS doesn't have a
  //                              template, draft from the ticket that owns
  //                              that brdId so the page is never empty.
  //   2. /brd?ticket=SCM-NNN  → draft a new BRD for that ticket
  //   3. /brd                 → handled by the parent route (BrdList);
  //                              this component only renders here for
  //                              direct-link or auto-generate flows.
  const initialBrd = useMemo(() => {
    if (id) {
      if (MOCK_BRDS[id]) return MOCK_BRDS[id];
      const owner = MOCK_TICKETS.find((x) => x.brdId === id);
      if (owner) {
        // Same as draftFromTicket but keep the canonical BRD id so the URL
        // remains /brd/BRD-XYZ rather than the auto-derived one.
        return { ...draftFromTicket(owner), id };
      }
    }
    const ticketParam = searchParams.get('ticket');
    if (ticketParam) {
      const t = MOCK_TICKETS.find((x) => x.id === ticketParam);
      if (t) return draftFromTicket(t);
    }
    return null;
  }, [id, searchParams]);

  const [brd, setBrd] = useState(initialBrd);
  const [audit, setAudit] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [editRequest, setEditRequest] = useState('');
  // AI generation state.
  const [generating, setGenerating] = useState(false);
  const [aiMeta, setAiMeta] = useState(null); // { provider, model, fallbackUsed, at }
  const [aiError, setAiError] = useState(null);
  // Guards against re-firing the auto-generation on hot reloads / re-renders.
  const autoFiredRef = useRef(false);

  const canEdit = user && (
    user.role === ROLES.POC_OWNER ||
    user.role === ROLES.COE_ADMIN ||
    user.role === ROLES.SYSTEM_ADMIN ||
    (user.role === ROLES.SUBMITTER && brd?.ticketId &&
      MOCK_TICKETS.find((t) => t.id === brd.ticketId)?.submittedById === user.id)
  );

  const logAudit = (action, detail) => {
    setAudit((prev) => [{
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      actor: user?.name || 'System',
      role: user?.role || '',
      action, detail,
    }, ...prev]);
  };

  const updateSection = (key, val) => {
    setBrd((p) => ({ ...p, sections: { ...p.sections, [key]: val } }));
  };

  // ──────────────────────────────────────────────────────────────────────
  // AI: Generate full draft (Groq → Gemini fallback).
  // The endpoint loads the ticket server-side so we send minimal payload —
  // unless we're in demo mode (Supabase not configured), in which case we
  // ship the ticket inline.
  // ──────────────────────────────────────────────────────────────────────
  const onGenerateDraft = async () => {
    if (!brd?.ticketId) {
      toast.error('No ticket linked to this BRD');
      return;
    }
    setGenerating(true);
    setAiError(null);
    try {
      const linked = MOCK_TICKETS.find((t) => t.id === brd.ticketId) || null;
      const res = await api.generateBrd(brd.ticketId, linked);
      // Populate every section the model returned. If the model skipped a
      // key, leave the existing draft value in place rather than blanking
      // it — gives the POC something to keep editing.
      setBrd((p) => ({
        ...p,
        sections: { ...p.sections, ...res.sections },
        status: 'Draft (AI-generated)',
        versions: [
          { v: bumpVersion(p.version), at: res.meta?.at || new Date().toISOString(),
            by: `AI · ${res.meta?.provider}:${res.meta?.model}${res.meta?.fallbackUsed ? ' (fallback)' : ''}` },
          ...(p.versions || []),
        ],
        version: bumpVersion(p.version),
      }));
      setAiMeta(res.meta || null);
      logAudit(
        'AI draft generated',
        `${res.meta?.provider}:${res.meta?.model}${res.meta?.fallbackUsed ? ' (fallback)' : ''} · ${
          res.meta?.at ? new Date(res.meta.at).toLocaleString('en-IN') : ''
        }`,
      );
      toast.success(`BRD draft generated via ${res.meta?.provider}`);
    } catch (e) {
      // The endpoint surfaces structured attempts on 503. Show whichever
      // reason is most concrete.
      const detail = e?.message || String(e);
      setAiError(detail);
      toast.error(`AI draft failed — ${detail}`);
    } finally {
      setGenerating(false);
    }
  };

  // If the route is /brd?ticket=X&autoGenerate=1 — typically arriving here
  // straight from the Issue Submission form — fire the generator once on
  // mount so the submitter lands on a populated draft, not an empty one.
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (searchParams.get('autoGenerate') !== '1') return;
    if (!brd?.ticketId) return;
    if (generating) return;
    autoFiredRef.current = true;
    // Small delay so the page paints first; gives the operator visual
    // feedback that something is happening rather than a blank flash.
    const t = setTimeout(() => { onGenerateDraft(); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brd?.ticketId, searchParams]);

  const onSaveDraft = () => {
    const newV = bumpVersion(brd.version);
    setBrd((p) => ({
      ...p, version: newV,
      versions: [{ v: newV, at: new Date().toISOString(), by: user?.name || 'You' }, ...(p.versions || [])],
    }));
    logAudit('Draft saved', `Version → ${newV}`);
    toast.success(`BRD saved as ${newV}`);
  };

  const linkedTicket = brd?.ticketId ? MOCK_TICKETS.find((t) => t.id === brd.ticketId) : null;

  const onApprove = () => {
    setBrd((p) => ({ ...p, status: 'Approved' }));
    logAudit('Approved', `By ${user?.name}`);
    toast.success('BRD approved');
    if (linkedTicket) notify.brdApproved(linkedTicket, user?.name || 'POC');
  };

  const onRequestEdits = () => {
    if (!editRequest.trim()) { toast.error('Please describe what needs changing'); return; }
    logAudit('Edits requested', editRequest);
    toast.success('Edit request sent to submitter — they will see it in the comments thread.');
    setComments((prev) => [{
      id: `c-${Date.now()}`, author: user?.name || 'POC', role: user?.role || '',
      text: `📝 EDIT REQUEST: ${editRequest}`, at: new Date().toISOString(),
    }, ...prev]);
    if (linkedTicket) notify.brdEditRequested(linkedTicket, editRequest, user?.name || 'POC');
    setEditRequest('');
  };

  const onUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedFile({ name: f.name, size: f.size, at: new Date().toISOString(), by: user?.name || 'You' });
    logAudit('External BRD uploaded', `${f.name} (${Math.round(f.size / 1024)} KB)`);
    toast.success(`Uploaded ${f.name}`);
  };

  const postComment = () => {
    const t = newComment.trim();
    if (!t) return;
    setComments((prev) => [{
      id: `c-${Date.now()}`, author: user?.name || 'You', role: user?.role || '',
      text: t, at: new Date().toISOString(),
    }, ...prev]);
    setNewComment('');
    logAudit('Comment added', t.length > 60 ? t.slice(0, 60) + '…' : t);
    toast.success('Comment posted');
    if (linkedTicket) notify.commentPosted(linkedTicket, user?.id, user?.name || 'Someone', t);
  };

  if (!brd) {
    return (
      <div className="text-center py-20" data-testid="brd-no-brd">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h2 className="font-display text-2xl">No BRD selected</h2>
        <p className="text-sm text-gray-500 mt-2">Open a ticket and click "Open BRD" to start.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to dashboard</Button>
      </div>
    );
  }

  // Per-BRD access guard. The BRD is reachable by anyone who can see the
  // underlying ticket (submitter, assignee, COE/Leadership/Sys Admin).
  // Anyone else hitting /brd/<id> directly is blocked here — no fields,
  // no version history, nothing leaks.
  const brdTicket = brd.ticketId ? MOCK_TICKETS.find((t) => t.id === brd.ticketId) : null;
  if (brdTicket && !canViewBrd(user, brdTicket)) {
    return (
      <div className="max-w-lg mx-auto py-16" data-testid="brd-access-denied">
        <div className="border border-red-200 rounded-lg p-6 text-center bg-white shadow-sm">
          <ShieldAlert className="h-10 w-10 text-red-600 mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold text-gray-900">
            You don't have access to this BRD
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            BRDs are visible to the underlying ticket's submitter, assigned POC owner, and the COE team.
          </p>
          <Button className="mt-5 bg-red-600 hover:bg-red-700" onClick={() => navigate('/brd')}>
            Back to BRD list
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="brd-editor-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono-airtel text-xs text-gray-500">{brd.id}</span>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{brd.status}</Badge>
            <Badge variant="secondary">{brd.version}</Badge>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{brd.title}</h1>
          {brd.ticketId && (
            <p className="text-xs text-gray-500 mt-1">
              Linked to ticket{' '}
              <button onClick={() => navigate(`/tickets/${brd.ticketId}`)} className="text-red-600 font-mono-airtel hover:underline">
                {brd.ticketId}
              </button>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && brd?.ticketId && (
            <Button
              variant="outline"
              data-testid="brd-generate-ai-btn"
              onClick={onGenerateDraft}
              disabled={generating}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              {generating
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</>
                : <><Wand2 className="h-4 w-4 mr-1" /> Generate draft (AI)</>}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" data-testid="brd-save-btn" onClick={onSaveDraft}>
              <Save className="h-4 w-4 mr-1" /> Save draft
            </Button>
          )}
          {user?.role !== ROLES.SUBMITTER && (
            <Button data-testid="brd-approve-btn" className="bg-red-600 hover:bg-red-700" onClick={onApprove}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
          )}
        </div>
      </div>

      {/* AI status strip — shown after a successful or failed generation. */}
      {aiMeta && !aiError && (
        <div
          data-testid="brd-ai-meta"
          className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 text-xs flex items-center gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            AI draft generated via <strong>{aiMeta.provider}</strong>
            {aiMeta.model ? <> · model <code className="px-1 bg-white/60 rounded">{aiMeta.model}</code></> : null}
            {aiMeta.fallbackUsed ? ' (fallback)' : ''}
            {aiMeta.at ? ` · ${new Date(aiMeta.at).toLocaleString('en-IN')}` : ''}.
          </span>
          <span className="ml-auto text-emerald-700/70">Edit any section below — every change is audited.</span>
        </div>
      )}
      {aiError && (
        <div
          data-testid="brd-ai-error"
          className="rounded-md border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-xs"
        >
          <strong>AI draft failed:</strong> {aiError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(brd.sections).map(([key, val]) => (
            <Card key={key} className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100 py-3">
                <CardTitle className="font-display text-sm uppercase tracking-widest text-gray-700">{key}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Textarea
                  data-testid={`brd-section-${key.replace(/\s+/g, '-').toLowerCase()}`}
                  value={val}
                  onChange={(e) => updateSection(key, e.target.value)}
                  rows={key === 'Functional Requirements' ? 6 : 3}
                  disabled={!canEdit}
                  className="border-gray-200 focus-visible:ring-red-500"
                />
              </CardContent>
            </Card>
          ))}

          {/* Upload own BRD */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 py-3">
              <CardTitle className="font-display text-sm uppercase tracking-widest text-gray-700">Upload your own BRD</CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm">
              <label className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-md p-6 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition" data-testid="brd-upload-area">
                <Upload className="h-5 w-5 mr-2 text-gray-400" />
                <span className="text-gray-600">{uploadedFile ? `${uploadedFile.name} · ${Math.round(uploadedFile.size / 1024)} KB` : 'Click to attach a DOCX / PDF (stored in memory for this session)'}</span>
                <input data-testid="brd-upload-input" type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onUpload} />
              </label>
            </CardContent>
          </Card>

          {/* Comments + edit-request thread */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments" data-testid="brd-tab-comments">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Comments ({comments.length})
              </TabsTrigger>
              {user?.role !== ROLES.SUBMITTER && (
                <TabsTrigger value="request" data-testid="brd-tab-request">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Request edits from submitter
                </TabsTrigger>
              )}
              <TabsTrigger value="audit" data-testid="brd-tab-audit">
                <History className="h-3.5 w-3.5 mr-1.5" /> Audit trail
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="mt-3 space-y-3">
              <Card className="border-gray-200">
                <CardContent className="p-3">
                  <Textarea
                    data-testid="brd-new-comment"
                    rows={2}
                    placeholder="Add a comment — submitter & POC are both notified."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" data-testid="brd-post-comment" onClick={postComment} className="bg-red-600 hover:bg-red-700">
                      <Send className="h-3.5 w-3.5 mr-1" /> Post
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {comments.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No comments yet.</p>}
              {comments.map((c) => (
                <Card key={c.id} className="border-gray-200">
                  <CardContent className="p-3 flex gap-2">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-gray-200 text-gray-700 text-[11px]">{c.author.split(' ').map((p) => p[0]).join('')}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{c.author}</span>
                        {c.role && <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{c.role}</span>}
                        <span className="text-gray-400 ml-auto">{relativeTime(c.at)}</span>
                      </div>
                      <p className="mt-1 text-gray-700 whitespace-pre-line">{c.text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {user?.role !== ROLES.SUBMITTER && (
              <TabsContent value="request" className="mt-3">
                <Card className="border-gray-200">
                  <CardContent className="p-3 space-y-2">
                    <Textarea
                      data-testid="brd-edit-request-input"
                      rows={3}
                      placeholder="Describe what you'd like the submitter to add or change in the BRD…"
                      value={editRequest}
                      onChange={(e) => setEditRequest(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" data-testid="brd-send-edit-request" onClick={onRequestEdits} className="bg-red-600 hover:bg-red-700">
                        <Send className="h-3.5 w-3.5 mr-1" /> Send to submitter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="audit" className="mt-3">
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  {audit.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">No edits yet — your actions will appear here.</p>
                  ) : (
                    <ol className="relative border-l-2 border-gray-100 space-y-3 ml-2">
                      {audit.map((a) => (
                        <li key={a.id} className="ml-3">
                          <span className="absolute -left-[6px] mt-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-4 ring-red-100" />
                          <div className="text-[11px] text-gray-500">{formatDateTime(a.at)}</div>
                          <div className="text-xs font-semibold text-gray-900 mt-0.5">{a.action}</div>
                          <div className="text-[11px] text-gray-600">
                            by <span className="font-semibold">{a.actor}</span>{a.role ? ` (${a.role})` : ''}{a.detail ? ` · ${a.detail}` : ''}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100"><CardTitle className="font-display text-base flex items-center gap-2"><History className="h-4 w-4" /> Version history</CardTitle></CardHeader>
            <CardContent className="p-4">
              <ol className="space-y-3">
                {(brd.versions || []).map((v, i) => (
                  <li key={`${v.v}-${i}`} className="flex items-start gap-2 text-xs">
                    <Badge variant="secondary" className="font-mono-airtel">{v.v}</Badge>
                    <div className="flex-1">
                      <div className="text-gray-700 font-medium">{v.by}</div>
                      <div className="text-gray-400">{formatDateTime(v.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/40 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3 text-xs">
              <FileText className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-900">AI draft</div>
                <div className="text-gray-600 mt-1">
                  This BRD was auto-drafted from the linked ticket. Both POC and submitter can edit any section,
                  upload an external BRD, request changes, and discuss in the comments thread. Every action is
                  recorded in the audit trail.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const bumpVersion = (v) => {
  // 'v1.2' → 'v1.3'; default to 'v1.1' if format is unfamiliar.
  const m = /^v(\d+)\.(\d+)$/.exec(v || '');
  if (!m) return 'v1.1';
  return `v${m[1]}.${Number(m[2]) + 1}`;
};
