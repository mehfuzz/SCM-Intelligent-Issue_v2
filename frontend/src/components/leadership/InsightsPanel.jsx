// AI Insights panel for Leadership / COE Admin.
//
// Loads the latest non-superseded insights from /api/insights, renders each
// as a card with finding text, supporting numbers, recommended action and
// 👍 / 👎 feedback buttons. A "Refresh insights" button forces an immediate
// regeneration (otherwise the nightly cron handles it).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import {
  Sparkles, RefreshCw, ThumbsUp, ThumbsDown, AlertTriangle, IndianRupee,
  Activity, Repeat, Users2, TrendingUp, ChevronRight,
} from 'lucide-react';

const CATEGORY_META = {
  hotspot:    { icon: AlertTriangle, color: 'bg-red-100 text-red-700',     label: 'Hotspot' },
  cost:       { icon: IndianRupee,    color: 'bg-emerald-100 text-emerald-700', label: 'Cost' },
  bottleneck: { icon: Activity,       color: 'bg-amber-100 text-amber-700', label: 'Bottleneck' },
  quality:    { icon: Repeat,         color: 'bg-rose-100 text-rose-700',   label: 'Quality' },
  load:       { icon: Users2,         color: 'bg-indigo-100 text-indigo-700', label: 'POC load' },
  forecast:   { icon: TrendingUp,     color: 'bg-sky-100 text-sky-700',     label: 'Forecast' },
};

const formatINR = (n) => {
  if (n == null || isNaN(n)) return null;
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
};

export default function InsightsPanel() {
  const navigate = useNavigate();
  const [items, setItems]       = useState([]);
  const [generatedAt, setGen]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefr]   = useState(false);
  const [error, setError]       = useState(null);
  const [voted, setVoted]       = useState({});  // local optimistic state

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.listInsights();
      setItems(res?.insights || []);
      setGen(res?.generated_at || null);
    } catch (e) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setRefr(true); setError(null);
    try {
      await api.refreshInsights();
      toast.success('Insights regenerated');
      await load();
    } catch (e) {
      setError(e?.message || String(e));
      toast.error(`Refresh failed — ${e?.message || 'API error'}`);
    } finally { setRefr(false); }
  };

  const vote = async (id, val) => {
    setVoted((p) => ({ ...p, [id]: val }));
    try { await api.postInsightFeedback({ insight_id: id, vote: val }); toast.success('Thanks for the feedback'); }
    catch (e) { toast.error(`Feedback failed: ${e?.message || ''}`); }
  };

  return (
    <div className="space-y-4" data-testid="insights-panel">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-red-600" />
            <h2 className="font-display text-lg font-bold text-gray-900">AI Insights</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-generated every night.{' '}
            {generatedAt ? <>Last run: <strong>{new Date(generatedAt).toLocaleString('en-IN')}</strong>.</> : 'Click Refresh to produce the first batch.'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          data-testid="insights-refresh"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Generating…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-xs">
          <strong>Insights failed:</strong> {error}
        </div>
      )}

      {loading && !items.length && (
        <Card className="border-gray-200"><CardContent className="p-6 text-sm text-gray-500 text-center">Loading…</CardContent></Card>
      )}

      {!loading && !items.length && (
        <Card className="border-gray-200">
          <CardContent className="p-6 text-sm text-gray-500 text-center">
            No insights yet. Click <strong>Refresh</strong> to generate the first batch.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((it) => {
          const meta = CATEGORY_META[it.category] || CATEGORY_META.hotspot;
          const Icon = meta.icon;
          const inr  = formatINR(it.projected_impact_inr);
          return (
            <Card key={it.id} data-testid={`insight-${it.id}`} className="border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 ${meta.color} text-[10px] font-semibold uppercase tracking-widest rounded px-2 py-0.5`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">Impact {it.impact_score}/100</Badge>
                </div>
                <h3 className="font-display text-sm font-bold text-gray-900 mt-2">{it.title}</h3>
                <p className="text-xs text-gray-700 mt-1 whitespace-pre-line">{it.body}</p>

                {Array.isArray(it.supporting_numbers) && it.supporting_numbers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {it.supporting_numbers.map((n, i) => (
                      <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                        <strong>{n.label}:</strong> {n.value}
                      </span>
                    ))}
                  </div>
                )}

                {it.recommended_action && (
                  <div className="mt-3 text-xs text-gray-700 border-l-2 border-red-300 pl-2">
                    <strong className="text-red-700">Action:</strong> {it.recommended_action}
                    {inr && <span className="ml-2 text-emerald-700 font-semibold">· ~{inr}/yr</span>}
                  </div>
                )}

                {Array.isArray(it.cited_ticket_ids) && it.cited_ticket_ids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {it.cited_ticket_ids.slice(0, 8).map((tid) => (
                      <button
                        key={tid}
                        onClick={() => navigate(`/tickets/${tid}`)}
                        className="font-mono-airtel text-[11px] text-red-700 hover:text-red-900 underline"
                      >
                        {tid}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end gap-1">
                  <Button
                    size="sm" variant="ghost"
                    data-testid={`insight-up-${it.id}`}
                    onClick={() => vote(it.id, 1)}
                    className={voted[it.id] === 1 ? 'text-emerald-700' : 'text-gray-400 hover:text-emerald-700'}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    data-testid={`insight-down-${it.id}`}
                    onClick={() => vote(it.id, -1)}
                    className={voted[it.id] === -1 ? 'text-red-700' : 'text-gray-400 hover:text-red-700'}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500">
        Insights are AI-generated suggestions. Verify with the cited ticket data before acting.
        Use 👍 / 👎 to teach the model what's useful — rejected patterns won't repeat in the next run.
      </p>
    </div>
  );
}
