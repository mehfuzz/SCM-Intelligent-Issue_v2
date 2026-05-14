import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../data/mockData';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, FilePlus2, Inbox, ClipboardList, FileText,
  Timer, ShieldCheck, BarChart3, Settings, Bell, Files, Users
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard, roles: 'ALL', testid: 'nav-home' },
  { to: '/issues/new', label: 'Submit Issue', icon: FilePlus2, roles: [ROLES.SUBMITTER, ROLES.COE_ADMIN, ROLES.SYSTEM_ADMIN], testid: 'nav-submit-issue' },
  { to: '/coe-workbench', label: 'COE Workbench', icon: Inbox, roles: [ROLES.COE_ADMIN], testid: 'nav-coe-workbench' },
  { to: '/poc-tasks', label: 'My Tasks', icon: ClipboardList, roles: [ROLES.POC_OWNER], testid: 'nav-poc-tasks' },
  { to: '/brd', label: 'BRD Editor', icon: FileText, roles: [ROLES.POC_OWNER], testid: 'nav-brd' },
  { to: '/sla-monitor', label: 'SLA Monitor', icon: Timer, roles: [ROLES.COE_ADMIN, ROLES.LEADERSHIP], testid: 'nav-sla-monitor' },
  { to: '/validate', label: 'Validation', icon: ShieldCheck, roles: [ROLES.SUBMITTER, ROLES.COE_ADMIN], testid: 'nav-validate' },
  { to: '/leadership', label: 'Leadership', icon: BarChart3, roles: [ROLES.LEADERSHIP], testid: 'nav-leadership' },
  { to: '/reports', label: 'Reports', icon: Files, roles: 'ALL', testid: 'nav-reports' },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: 'ALL', testid: 'nav-notifications' },
  { to: '/admin', label: 'Admin Console', icon: Settings, roles: [ROLES.SYSTEM_ADMIN], testid: 'nav-admin' },
];

export const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role;

  const visible = NAV_ITEMS.filter(
    (n) => n.roles === 'ALL' || (Array.isArray(n.roles) && n.roles.includes(role))
  );

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md airtel-grad text-white font-display font-extrabold">a</div>
        <div className="leading-tight">
          <div className="font-display text-sm font-bold text-gray-900">airtel</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">SCM Portal</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  data-testid={item.testid}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-red-50 text-red-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-red-600' : 'text-gray-500')} />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-200 p-4">
        <div className="rounded-lg bg-gray-50 p-3 text-xs">
          <div className="flex items-center gap-2 text-gray-700">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold">{user?.name}</span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">{user?.role}</div>
        </div>
      </div>
    </aside>
  );
};
