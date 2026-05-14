import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/sonner';

import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import IssueSubmission from './pages/IssueSubmission';
import TicketDetails from './pages/TicketDetails';
import CoeWorkbench from './pages/CoeWorkbench';
import PocTaskView from './pages/PocTaskView';
import BrdEditor from './pages/BrdEditor';
import SlaMonitor from './pages/SlaMonitor';
import ValidationScreen from './pages/ValidationScreen';
import LeadershipDashboard from './pages/LeadershipDashboard';
import AdminConsole from './pages/AdminConsole';
import NotificationCenter from './pages/NotificationCenter';
import Reports from './pages/Reports';

import '@/App.css';

const RootRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
};

function App() {
  return (
    <div className="App">
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
              <Route path="/brd" element={<BrdEditor />} />
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
