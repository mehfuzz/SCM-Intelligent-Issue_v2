import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { MOCK_NOTIFICATIONS, relativeTime } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isLiveApi } from '../lib/hydrate';
import { Bell, CheckCheck, AlertTriangle, MessageSquare, UserPlus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const ICONS = {
  sla_breach: AlertTriangle,
  sla_at_risk: AlertTriangle,
  assignment: UserPlus,
  comment: MessageSquare,
  validation: ShieldCheck,
};

const COLORS = {
  sla_breach: 'bg-red-50 text-red-600',
  sla_at_risk: 'bg-amber-50 text-amber-600',
  assignment: 'bg-indigo-50 text-indigo-600',
  comment: 'bg-blue-50 text-blue-600',
  validation: 'bg-emerald-50 text-emerald-600',
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(false);

  // Lazy-load from backend when API is live and we know the user.
  useEffect(() => {
    if (!user?.id || !isLiveApi()) return;
    let cancelled = false;
    setLoading(true);
    api.listNotifications(user.id)
      .then((rows) => {
        if (cancelled) return;
        setItems((rows || []).map((r) => ({
          id: r.id, type: r.type, title: r.title, message: r.message,
          ticketId: r.ticket_id, at: r.at, read: !!r.read,
        })));
      })
      .catch((err) => console.warn('[notifications] fetch failed', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user?.id]);

  const filtered = tab === 'unread' ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    toast.success('All marked as read');
    if (isLiveApi()) {
      await Promise.all(items.filter((n) => !n.read).map((n) => api.markNotification(n.id, true).catch(() => null)));
    }
  };

  const open = (n) => {
    setItems((p) => p.map((x) => x.id === n.id ? { ...x, read: true } : x));
    if (isLiveApi() && !n.read) api.markNotification(n.id, true).catch(() => null);
    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="notification-center-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Notifications</p>
          <h1 className="font-display text-3xl font-bold text-gray-900">Alerts &amp; updates</h1>
          <p className="text-sm text-gray-500 mt-1">SLA breaches, assignments, comments and validations.</p>
        </div>
        <Button variant="outline" size="sm" data-testid="mark-all-read-btn" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="notif-tab-all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="unread" data-testid="notif-tab-unread">Unread ({unreadCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <ul className="divide-y divide-gray-100">
            {filtered.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <li
                  key={n.id}
                  data-testid={`notif-item-${n.id}`}
                  onClick={() => open(n)}
                  className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${COLORS[n.type] || 'bg-gray-100 text-gray-600'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900">{n.title}</h4>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-red-600 inline-block" />}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{relativeTime(n.at)} · <span className="font-mono-airtel">{n.ticketId}</span></p>
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-12 text-center text-sm text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                You're all caught up.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
