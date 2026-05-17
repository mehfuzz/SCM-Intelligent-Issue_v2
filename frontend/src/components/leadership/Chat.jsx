// Leadership chatbot UI.
//
// One pane:
//   left  — sessions list (recent first), New chat button
//   right — message thread, input bar
//
// Each assistant message can carry an inline chart (rendered via
// ChartFromSpec) and clickable ticket-id citations. Tool calls are
// surfaced as collapsed "data used: query_tickets(...)" chips so
// leadership can audit how the answer was produced.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import ChartFromSpec from './ChartFromSpec';
import { toast } from 'sonner';
import {
  Send, MessageSquare, Loader2, Bot, User, Plus, Database, Sparkles,
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'Which POC is best at closing P0 issues fast?',
  'Compare savings between Q1 and Q2',
  'Top 5 unresolved compliance risks',
  'Submission-volume forecast by module for next month',
];

// Take any "SCM-XXX-NNN" tokens in the assistant text and turn them into
// links to the ticket page. Returns an array of React nodes.
const renderWithCitations = (text, navigate) => {
  if (!text) return null;
  const parts = String(text).split(/(\bSCM-[A-Z]{2,4}-\d+\b)/g);
  return parts.map((part, i) => {
    if (/^SCM-[A-Z]{2,4}-\d+$/.test(part)) {
      return (
        <button
          key={i}
          onClick={() => navigate(`/tickets/${part}`)}
          className="font-mono-airtel text-red-700 hover:text-red-900 underline"
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export default function Chat() {
  const navigate = useNavigate();
  const [sessions, setSessions]   = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState(null);
  const scrollRef = useRef(null);

  // Load sessions once.
  useEffect(() => {
    api.chatSessions().then(setSessions).catch((e) => console.warn('[chat] sessions', e));
  }, []);

  // Load messages whenever sessionId changes.
  useEffect(() => {
    if (!sessionId) { setMessages([]); return; }
    api.chatMessages(sessionId).then((rows) => setMessages(rows || []))
      .catch((e) => console.warn('[chat] messages', e));
  }, [sessionId]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (text) => {
    const body = (text ?? input).trim();
    if (!body) return;
    setInput(''); setSending(true); setError(null);

    // Optimistic user message in the thread.
    const tempId = `local-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', content: body, at: new Date().toISOString() }]);

    try {
      const res = await api.chat({ session_id: sessionId, message: body });
      if (res.session_id !== sessionId) {
        setSessionId(res.session_id);
        // Refresh sessions list to show the new title.
        api.chatSessions().then(setSessions).catch(() => null);
      }
      // Reload full thread so tool messages render in order.
      const rows = await api.chatMessages(res.session_id);
      setMessages(rows || []);
    } catch (e) {
      setError(e?.message || String(e));
      toast.error(`Chat failed: ${e?.message || 'API error'}`);
    } finally {
      setSending(false);
    }
  };

  const newSession = () => { setSessionId(null); setMessages([]); setError(null); };

  return (
    <div className="grid grid-cols-12 gap-4" data-testid="leadership-chat">
      {/* Sessions list */}
      <div className="col-span-12 lg:col-span-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-gray-700 uppercase tracking-widest">Chats</h3>
          <Button size="sm" variant="outline" data-testid="chat-new" onClick={newSession}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New
          </Button>
        </div>
        <Card className="border-gray-200">
          <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
            <ul className="divide-y divide-gray-100">
              {sessions.length === 0 && (
                <li className="p-4 text-xs text-gray-500 text-center">No chats yet</li>
              )}
              {sessions.map((s) => (
                <li
                  key={s.id}
                  data-testid={`chat-session-${s.id}`}
                  onClick={() => setSessionId(s.id)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 ${sessionId === s.id ? 'bg-red-50' : ''}`}
                >
                  <div className="text-xs font-semibold text-gray-900 truncate">{s.title || '(untitled)'}</div>
                  <div className="text-[11px] text-gray-500">{new Date(s.updated_at).toLocaleString('en-IN')}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Conversation */}
      <div className="col-span-12 lg:col-span-9 space-y-3">
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div ref={scrollRef} className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
              {messages.length === 0 && !sending && (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 text-red-600" />
                  <p className="text-sm text-gray-600">
                    Ask the SCM analyst anything about your tickets.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="rounded-full border border-gray-200 bg-white hover:border-red-300 hover:bg-red-50/40 text-xs text-gray-700 px-3 py-1.5"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => <MessageRow key={m.id} m={m} navigate={navigate} />)}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-900 px-3 py-2 text-xs">
                  <strong>Failed:</strong> {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2"
        >
          <Input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about tickets, savings, POC load, forecasts…"
            disabled={sending}
            className="flex-1"
          />
          <Button
            type="submit"
            data-testid="chat-send"
            disabled={sending || !input.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            <Send className="h-4 w-4 mr-1" /> Send
          </Button>
        </form>

        <p className="text-[11px] text-gray-500">
          The assistant queries the ticket database via tools — every numeric claim comes from a tool call you can audit below it.
          It is read-only and cannot change tickets, priorities, or SLAs.
        </p>
      </div>
    </div>
  );
}

function MessageRow({ m, navigate }) {
  if (m.role === 'tool') {
    return (
      <div className="ml-9 text-[11px]">
        <Badge variant="secondary" className="inline-flex items-center gap-1 text-[10px]">
          <Database className="h-3 w-3" /> data: {m.tool_name}
        </Badge>
      </div>
    );
  }
  if (m.role === 'user') {
    return (
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center"><User className="h-3.5 w-3.5" /></div>
        <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 text-sm whitespace-pre-line max-w-[80%]">{m.content}</div>
      </div>
    );
  }
  // assistant
  // If the assistant produced a tool_call to `chart`, we render the chart spec inline.
  // Stored chat_messages have tool_result on tool rows; for assistant rows we look at
  // the most recent tool message in the thread for charts. Simpler approach below:
  // we look for any tool_calls on this assistant message of type chart.
  const charts = Array.isArray(m.tool_calls)
    ? m.tool_calls.filter((tc) => tc?.function?.name === 'chart')
    : [];
  return (
    <div className="flex items-start gap-2">
      <div className="h-7 w-7 rounded-full bg-red-600 text-white flex items-center justify-center"><Bot className="h-3.5 w-3.5" /></div>
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 max-w-[80%] whitespace-pre-line">
          {renderWithCitations(m.content, navigate)}
        </div>
        {charts.map((tc, i) => {
          let args = {};
          try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
          return <ChartFromSpec key={i} spec={args} />;
        })}
        {(m.provider || m.model) && (
          <div className="mt-1 text-[10px] text-gray-400">
            <MessageSquare className="inline h-2.5 w-2.5 mr-0.5" />
            {m.provider}{m.model ? ` · ${m.model}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
