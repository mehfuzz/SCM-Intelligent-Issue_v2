import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/sonner';
import { DemoModeBanner } from './components/shared/DemoModeBanner';
import { hydrateFromApi } from './lib/hydrate';

import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import IssueSubmission from './pages/IssueSubmission';
import TicketDetails from './pages/TicketDetails';
import CoeWorkbench from './pages/CoeWorkbench';
import PocTaskView from './pages/PocTaskView';
import BrdEditor from './pages/BrdEditor';
import BrdList from './pages/BrdList';
import SlaMonitor from './pages/SlaMonitor';
import ValidationScreen from './pages/ValidationScreen';
import LeadershipDashboard from './pages/LeadershipDashboard';
import AdminConsole from './pages/AdminConsole';
import NotificationCenter from './pages/NotificationCenter';
import Reports from './pages/Reports';

// `/brd` is normally the role-scoped list page. When the URL carries
// `?ticket=...` (the auto-draft hand-off from IssueSubmission), route
// straight into the editor instead so the flow stays seamless.
const BrdIndexOrEditor = () => {
  const [searchParams] = useSearchParams();
  if (searchParams.get('ticket')) return <BrdEditor />;
  return <BrdList />;
};

import '@/App.css';

const RootRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
};

const SplashScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="text-center">
      <div className="airtel-grad inline-flex h-12 w-12 items-center justify-center rounded-md text-white font-display font-extrabold text-xl">a</div>
      <p className="mt-4 text-sm text-gray-500">Loading SCM workspace…</p>
    </div>
  </div>
);

function App() {
  const [ready, setReady] = useState(false);
  const [usingLiveApi, setUsingLiveApi] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    hydrateFromApi().then((res) => {
      if (cancelled) return;
      setUsingLiveApi(Boolean(res?.available));
      setHealth(res?.health || null);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <div className="App" data-live-api={usingLiveApi ? '1' : '0'}>
      {!usingLiveApi && <DemoModeBanner health={health} />}
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<HomeDashboard />} />
              <Route path="/issues/new" element={<IssueSubmission />} />
              <Route path="/tickets/:id" element={<TicketDetails />} />
              <Route path="/tickets/:id/validate" element={<ValidationScreen />} />
              <Route path="/validate" element={<ValidationScreen />} />
              <Route path="/coe-workbench" element={<CoeWorkbench />} />
              <Route path="/poc-tasks" element={<PocTaskView />} />
              <Route path="/brd" element={<BrdIndexOrEditor />} />
              <Route path="/brd/:id" element={<BrdEditor />} />
              <Route path="/sla-monitor" element={<SlaMonitor />} />
              <Route path="/leadership" element={<LeadershipDashboard />} />
              <Route path="/admin" element={<AdminConsole />} />
              <Route path="/notifications" element={<NotificationCenter />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </div>
  );
}

export default App;
