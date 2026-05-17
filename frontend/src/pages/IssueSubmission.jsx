import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import {
  MODULES, FUNCTIONS, CATEGORIES, FREQUENCIES, MOCK_TICKETS, formatINR
} from '../data/mockData';
import { api } from '../lib/api';
import { isLiveApi } from '../lib/hydrate';
import { notify } from '../lib/notify';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, FileText, Upload, Sparkles, Link2, X
} from 'lucide-react';

const COMPLIANCE_OPTIONS = ['No', 'Yes'];

export default function IssueSubmission() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showSimilar, setShowSimilar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    module: '',
    function: '',
    category: '',
    description: '',
    frequency: '',
    peopleAffected: '',
    hoursLost: '',
    costSavings: '',
    complianceRisk: '',
    suggestedSolution: '',
    relatedTicketId: '',
    hasWorkaround: 'No',
    workaroundText: '',
    attachments: [],
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const similarTickets = MOCK_TICKETS.filter((t) => {
    if (!form.title || form.title.length < 5) return false;
    const q = form.title.toLowerCase();
    return t.title.toLowerCase().includes(q.split(' ')[0]) ||
           (form.module && t.module === form.module);
  }).slice(0, 3);

  const goNext = () => {
    if (step === 1) {
      if (!form.title.trim()) { toast.error('Title is required'); return; }
      if (!form.module)       { toast.error('Module is required'); return; }
      if (!form.category)     { toast.error('Category is required'); return; }
      if (similarTickets.length > 0) { setShowSimilar(true); return; }
    }
    if (step === 2) {
      if (!form.frequency)                                              { toast.error('Frequency is required'); return; }
      if (!form.peopleAffected || Number(form.peopleAffected) < 1)      { toast.error('People Affected is required (>= 1)'); return; }
      if (!form.hoursLost      || Number(form.hoursLost) <= 0)          { toast.error('Hours lost is required (> 0)'); return; }
      if (!form.costSavings    || Number(form.costSavings) <= 0)        { toast.error('Cost saving potential is required (> 0)'); return; }
      if (!form.complianceRisk)                                         { toast.error('Compliance Risk Yes/No is required'); return; }
    }
    if (step === 3) {
      if (form.hasWorkaround === 'Yes' && !form.workaroundText.trim()) {
        toast.error('Please describe the existing workaround.'); return;
      }
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const continueAfterSimilar = () => { setShowSimilar(false); setStep(2); };

  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      title: form.title,
      module: form.module,
      function: form.function,
      category: form.category,
      description: form.description,
      submittedBy: user?.name,
      submittedById: user?.id,
      impact: {
        peopleAffected:   Number(form.peopleAffected) || 0,
        frequency:        form.frequency,
        hoursLostPerWeek: Number(form.hoursLost) || 0,
        costSavings:      Number(form.costSavings) || 0,
        complianceRisk:   form.complianceRisk,
      },
      suggestedSolution: form.suggestedSolution,
      relatedTicketId:   form.relatedTicketId,
      notes: form.hasWorkaround === 'Yes' ? `Existing workaround: ${form.workaroundText}` : '',
    };

    const localFallback = () => {
      const fakeId = `SCM-${(form.module || 'NEW').slice(0, 3).toUpperCase()}-${String(MOCK_TICKETS.length + 1).padStart(3, '0')}`;
      MOCK_TICKETS.unshift({
        ...payload,
        id: fakeId,
        submittedAt: new Date().toISOString(),
        assignedTo: null,
        assignedToId: null,
        status: 'Submitted',
        priority: form.complianceRisk === 'Yes' ? 'P0' : 'P3',
        sla: { responseHours: 24, resolutionHours: 168, elapsed: 0, state: 'on-track', daysOpen: 0 },
        coeEffortDays: 0,
        scores: { peopleScore: 0, freqScore: 0, timeScore: 0, costScore: 0, composite: 0 },
        composite: 0, rank: MOCK_TICKETS.length + 1,
        testEvidence: [], childrenIds: [], tags: [],
      });
      return fakeId;
    };

    if (!isLiveApi()) {
      const id = localFallback();
      toast.warning(`Demo mode: ${id} saved locally only — connect Supabase to persist.`);
      const created = MOCK_TICKETS.find((t) => t.id === id);
      if (created) notify.ticketSubmitted(created);
      setSubmitting(false);
      navigate('/dashboard');
      return;
    }

    try {
      const created = await api.createTicket(payload);
      toast.success(`Issue submitted — Ticket ID ${created.id}`);
      MOCK_TICKETS.unshift(created);
      notify.ticketSubmitted(created);
      navigate('/dashboard');
    } catch (e) {
      console.warn('[submit] API failed', e);
      const id = localFallback();
      toast.error(`Save failed (${e?.message || 'API error'}); kept locally as ${id}.`);
      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="issue-submission-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="back-btn">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">New Issue</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">Submit an SCM Issue</h1>
        </div>
      </div>

      {/* Stepper */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
              <span>Step {step} of 4</span>
              <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <Progress value={(step / 4) * 100} className="mt-2 h-2 [&>div]:bg-red-600" />
            <div className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
              {['Basic Info', 'Impact', 'Details', 'Review'].map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                  <div key={label} className={`flex items-center gap-1.5 ${active ? 'text-red-600 font-semibold' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {done ? <Check className="h-3 w-3" /> : n}
                    </span>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <Label className="text-xs font-semibold">Issue title *</Label>
                <Input
                  data-testid="form-title-input"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="One-line summary, e.g. PO approval taking >72 hours"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Module *</Label>
                  <Select value={form.module} onValueChange={(v) => set('module', v)}>
                    <SelectTrigger data-testid="form-module-select" className="mt-1"><SelectValue placeholder="Select module" /></SelectTrigger>
                    <SelectContent>
                      {MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Function</Label>
                  <Select value={form.function} onValueChange={(v) => set('function', v)}>
                    <SelectTrigger data-testid="form-function-select" className="mt-1"><SelectValue placeholder="Select function" /></SelectTrigger>
                    <SelectContent>
                      {FUNCTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Category *</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger data-testid="form-category-select" className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  data-testid="form-description-input"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={4}
                  placeholder="What is happening? Impact? Steps to reproduce…"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Frequency *</Label>
                  <Select value={form.frequency} onValueChange={(v) => set('frequency', v)}>
                    <SelectTrigger data-testid="form-frequency-select" className="mt-1"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">People affected *</Label>
                  <Input
                    data-testid="form-people-affected-input"
                    type="number" min={1}
                    value={form.peopleAffected}
                    onChange={(e) => set('peopleAffected', e.target.value)}
                    placeholder="e.g. 50"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Hours lost per week *</Label>
                  <Input
                    data-testid="form-hours-lost-input"
                    type="number" min={0.5} step={0.5}
                    value={form.hoursLost}
                    onChange={(e) => set('hoursLost', e.target.value)}
                    placeholder="e.g. 12"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Est. annual cost saving potential (₹) *</Label>
                  <Input
                    data-testid="form-cost-savings-input"
                    type="number" min={1}
                    value={form.costSavings}
                    onChange={(e) => set('costSavings', e.target.value)}
                    placeholder="e.g. 500000"
                    className="mt-1"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Enter the <strong>total annual ₹ saving</strong> if this issue is resolved (people-hours × ₹/hr + reworked-units × ₹/unit, etc.). Used directly in the priority composite — no implicit multiplier.
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Is this a Compliance Risk? *</Label>
                <p className="text-[11px] text-gray-500 mt-0.5">Selecting "Yes" auto-flags this as Priority Zero per the SCM framework.</p>
                <div className="mt-2 flex gap-2">
                  {COMPLIANCE_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      data-testid={`form-compliance-${c.toLowerCase()}`}
                      onClick={() => set('complianceRisk', c)}
                      className={`px-4 py-1.5 text-xs rounded-full font-semibold border ${form.complianceRisk === c ? (c === 'Yes' ? 'bg-red-600 text-white border-red-600' : 'bg-gray-900 text-white border-gray-900') : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {form.peopleAffected && form.hoursLost && (
                <Card className="border-red-200 bg-red-50/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-red-600" />
                    <div className="text-xs">
                      <div className="font-semibold text-gray-900">Estimated org-wide hours lost / week</div>
                      <div className="text-gray-600 mt-0.5">
                        {Number(form.peopleAffected)} ppl × {Number(form.hoursLost)} hrs = <strong>{(Number(form.peopleAffected) * Number(form.hoursLost)).toFixed(1)} hrs / week</strong>
                        {form.costSavings ? <> · annualised saving ≈ {formatINR(Number(form.costSavings))}</> : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <Label className="text-xs font-semibold">Suggested solution</Label>
                <Textarea
                  data-testid="form-suggested-solution-input"
                  value={form.suggestedSolution}
                  onChange={(e) => set('suggestedSolution', e.target.value)}
                  rows={3}
                  placeholder="If you have an idea on how to fix this…"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Related ticket ID</Label>
                <Input
                  data-testid="form-related-ticket-input"
                  value={form.relatedTicketId}
                  onChange={(e) => set('relatedTicketId', e.target.value)}
                  placeholder="SCM-MOD-NNN"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Existing workaround? *</Label>
                <div className="mt-2 flex gap-2">
                  {['No', 'Yes'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      data-testid={`form-workaround-${c.toLowerCase()}`}
                      onClick={() => set('hasWorkaround', c)}
                      className={`px-4 py-1.5 text-xs rounded-full font-semibold border ${form.hasWorkaround === c ? (c === 'Yes' ? 'bg-red-600 text-white border-red-600' : 'bg-gray-900 text-white border-gray-900') : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {form.hasWorkaround === 'Yes' && (
                  <div className="mt-3">
                    <Label className="text-xs font-semibold">Describe the workaround *</Label>
                    <Textarea
                      data-testid="form-workaround-text"
                      value={form.workaroundText}
                      onChange={(e) => set('workaroundText', e.target.value)}
                      rows={3}
                      placeholder="What manual / temporary process is in place today to work around this issue?"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold">Attachments</Label>
                <div className="mt-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-md p-8 text-center text-sm text-gray-500">
                  <Upload className="h-5 w-5 mr-2 text-gray-400" />
                  Drag &amp; drop or click to upload screenshots, docs (mock — not stored)
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in-up">
              <h3 className="font-display text-lg font-semibold">Review &amp; submit</h3>
              <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
                {[
                  ['Title', form.title],
                  ['Module / Function', `${form.module || '—'} · ${form.function || '—'}`],
                  ['Category', form.category || '—'],
                  ['Frequency', form.frequency],
                  ['People affected', form.peopleAffected || '—'],
                  ['Hours lost / wk', form.hoursLost || '—'],
                  ['Cost saving potential', form.costSavings ? formatINR(Number(form.costSavings)) : '—'],
                  ['Compliance risk', form.complianceRisk],
                  ['Workaround', form.hasWorkaround === 'Yes' ? `Yes — ${form.workaroundText}` : 'No'],
                  ['Related ticket', form.relatedTicketId || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-3 gap-2 px-4 py-2 text-sm">
                    <div className="text-gray-500">{k}</div>
                    <div className="col-span-2 font-medium text-gray-900">{v}</div>
                  </div>
                ))}
              </div>
              <Card className="border-red-200 bg-red-50/40">
                <CardContent className="p-4 flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold text-gray-900">After submission</div>
                    <div className="text-gray-600 mt-0.5">
                      AI will scan for duplicates, score impact, draft a BRD and route to the COE workbench.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-between border-t border-gray-100 pt-4">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              data-testid="form-prev-btn"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < 4 ? (
              <Button onClick={goNext} className="bg-red-600 hover:bg-red-700" data-testid="form-next-btn">
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="bg-red-600 hover:bg-red-700" data-testid="form-submit-btn">
                <FileText className="mr-1 h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit issue'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Similar Issue Dialog */}
      <Dialog open={showSimilar} onOpenChange={setShowSimilar}>
        <DialogContent data-testid="similar-issues-dialog" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-red-600" /> Similar issues found
            </DialogTitle>
            <DialogDescription>
              AI matched {similarTickets.length} potentially related ticket(s). Link to existing or create new.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {similarTickets.map((t) => (
              <Card key={t.id} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-airtel text-xs text-gray-500">{t.id}</span>
                        <Badge variant="secondary">{t.module}</Badge>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{t.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`link-similar-${t.id}`}
                      onClick={() => { set('relatedTicketId', t.id); setShowSimilar(false); setStep(2); toast.success(`Linked to ${t.id}`); }}
                    >
                      <Link2 className="mr-1 h-3 w-3" /> Link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" data-testid="dismiss-similar-btn" onClick={() => setShowSimilar(false)}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={continueAfterSimilar} data-testid="continue-new-btn" className="bg-red-600 hover:bg-red-700">
              Continue as new issue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
