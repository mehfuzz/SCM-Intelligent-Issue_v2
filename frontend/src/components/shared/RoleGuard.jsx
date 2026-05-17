import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ShieldAlert } from 'lucide-react';

// Wraps a route element so only users with one of the allowed roles render
// the child. If the user is unauthenticated, redirects to /login. If they
// are authenticated but lack the role, shows a clear "no access" panel
// (NOT a silent redirect — silent redirects hide bugs from operators).
//
//   <RoleGuard allow={[ROLES.COE_ADMIN, ROLES.SYSTEM_ADMIN]}>
//     <CoeWorkbench />
//   </RoleGuard>
export const RoleGuard = ({ allow, children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!Array.isArray(allow) || !allow.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto py-16" data-testid="role-guard-denied">
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <ShieldAlert className="h-10 w-10 text-red-600 mx-auto mb-3" />
            <h2 className="font-display text-2xl font-bold text-gray-900">
              You don't have access to this page
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              This area is restricted to: {allow?.join(', ') || 'specific roles'}.
              You are signed in as <strong>{user.name}</strong> ({user.role}).
            </p>
            <Button
              className="mt-5 bg-red-600 hover:bg-red-700"
              onClick={() => { window.location.href = '/dashboard'; }}
            >
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return children;
};
