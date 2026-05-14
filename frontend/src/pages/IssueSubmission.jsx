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
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, FileText, Upload, Sparkles, Link2, X
} from 'lucide-react';

const COMPLIANCE_OPTIONS = ['No', 'Yes'];

export default function IssueSubmission() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showSimilar, setShowSimilar] = useState(false);
  const [form, setForm] = useState({
    title: '',
    module: '',
    function: '',
    category: '',
    description: '',
    frequency: 'Weekly',
    peopleAffected: '',
    hoursLost: '',
    costSavings: '',
    complianceRisk: 'No',
    suggestedSolution: '',
    relatedTicketId: '',
    hasWorkaround: false,
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
      if (!form.title || !form.module || !form.category) {
        toast.error('Please fill all required fields'); return;
      }
      if (similarTickets.length > 0) { setShowSimilar(true); return; }
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const continueAfterSimilar = () => { setShowSimilar(false); setStep(2); };

  const handleSubmit = () => {
    toast.success('Issue submitted — Ticket ID generated: SCM-2025-12-000012');
    setTimeout(() => navigate('/dashboard'), 800);
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
                  <Label className="text-xs font-semibold">Frequency</Label>
                  <Select value={form.frequency} onValueChange={(v) => set('frequency', v)}>
                    <SelectTrigger data-testid="form-frequency-select" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">People affected</Label>
                  <Input
                    data-testid="form-people-affected-input"
                    type="number"
                    value={form.peopleAffected}
                    onChange={(e) => set('peopleAffected', e.target.value)}
                    placeholder="e.g. 50"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Hours lost per week</Label>
                  <Input
                    data-testid="form-hours-lost-input"
                    type="number"
                    value={form.hoursLost}
                    onChange={(e) => set('hoursLost', e.target.value)}
                    placeholder="e.g. 12"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Est. cost saving potential (₹)</Label>
                  <Input
                    data-testid="form-cost-savings-input"
                    type="number"
                    value={form.costSavings}
                    onChange={(e) => set('costSavings', e.target.value)}
                    placeholder="e.g. 500000"
                    className="mt-1"
                  />
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
              {form.costSavings && (
                <Card className="border-red-200 bg-red-50/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-red-600" />
                    <div className="text-xs">
                      <div className="font-semibold text-gray-900">AI-projected annual savings</div>
                      <div className="text-gray-600 mt-0.5">~{formatINR(Number(form.costSavings) * 12)} based on inputs</div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Related ticket ID</Label>
                  <Input
                    data-testid="form-related-ticket-input"
                    value={form.relatedTicketId}
                    onChange={(e) => set('relatedTicketId', e.target.value)}
                    placeholder="SCM-2025-…"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                  <div>
                    <div className="text-sm font-semibold">Existing workaround?</div>
                    <div className="text-[11px] text-gray-500">Toggle if there is a manual workaround in place</div>
                  </div>
                  <Switch
                    data-testid="form-workaround-switch"
                    checked={form.hasWorkaround}
                    onCheckedChange={(v) => set('hasWorkaround', v)}
                  />
                </div>
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
                  ['Workaround', form.hasWorkaround ? 'Yes' : 'No'],
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
              <Button onClick={handleSubmit} className="bg-red-600 hover:bg-red-700" data-testid="form-submit-btn">
                <FileText className="mr-1 h-4 w-4" /> Submit issue
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
