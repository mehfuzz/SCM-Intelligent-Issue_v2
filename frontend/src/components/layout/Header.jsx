import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, Search, LogOut, ChevronDown, KeyRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { MOCK_NOTIFICATIONS } from '../../data/mockData';
import { api } from '../../lib/api';
import { isLiveApi } from '../../lib/hydrate';
import { ChangePasswordDialog } from '../ChangePasswordDialog';

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread]         = useState(0);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    if (!user?.id) { setUnread(0); return; }

    const computeFromMock = () => MOCK_NOTIFICATIONS
      .filter((n) => !n.read && (!n.user_id || n.user_id === user.id))
      .length;

    const refresh = async () => {
      if (!isLiveApi()) { setUnread(computeFromMock()); return; }
      try {
        const rows = await api.listNotifications(user.id);
        setUnread((rows || []).filter((n) => !n.read).length);
      } catch {
        setUnread(computeFromMock());
      }
    };

    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [user?.id]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/90 backdrop-blur px-4 lg:px-6">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              data-testid="global-search-input"
              placeholder="Search tickets, BRDs, modules…"
              className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-red-500"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          data-testid="header-notification-btn"
          onClick={() => navigate('/notifications')}
          className="relative"
        >
          <Bell className="h-5 w-5 text-gray-700" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="header-user-menu-btn"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-red-600 text-white text-xs font-semibold">
                  {user?.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-sm font-semibold text-gray-900">{user?.name}</div>
                <div className="text-[11px] text-gray-500">{user?.role}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-gray-500 font-normal">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="change-password-btn"
              onClick={() => setShowChangePw(true)}
            >
              <KeyRound className="mr-2 h-4 w-4" /> Change password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="logout-btn"
              onClick={() => { logout(); navigate('/login'); }}
              className="text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ChangePasswordDialog open={showChangePw} onClose={() => setShowChangePw(false)} />
    </>
  );
};
