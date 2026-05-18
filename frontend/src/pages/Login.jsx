import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

const LOGIN_BG = 'https://static.prod-images.emergentagent.com/jobs/fc2ba3c5-0b5b-4b11-b411-7769291a5640/images/1707e71cf21817423ce661c8d133bd790e79b96f0b7fc9703735548cc12a67db.png';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login({ email: email.trim(), password });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || 'Login failed');
      return;
    }
    // If mustChangePassword, SetPasswordModal will appear automatically.
    toast.success(`Welcome, ${res.user.name}`);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-white">
      {/* Left brand panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-10 text-white"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(228,0,0,0.92), rgba(140,0,0,0.92)), url(${LOGIN_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-red-600 font-display font-extrabold text-xl">a</div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold">airtel</div>
            <div className="text-xs uppercase tracking-widest opacity-80">SCM Center of Excellence</div>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.1]">
            SCM Issue Intelligence &<br />Workflow Portal
          </h1>
          <p className="mt-5 text-white/85 text-base leading-relaxed">
            Capture, triage and resolve supply chain issues — from raw signal to BRD-ready
            intelligence. One source of truth across procurement, vendor, warehouse and logistics.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="text-2xl font-display font-bold">24h</div>
              <div className="opacity-80">SLA tracked</div>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="text-2xl font-display font-bold">5</div>
              <div className="opacity-80">Roles</div>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="text-2xl font-display font-bold">14</div>
              <div className="opacity-80">Workflows</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs opacity-80">
          <ShieldCheck className="h-4 w-4" /> Internal use only · Airtel Confidential
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md airtel-grad text-white font-display font-extrabold text-xl">a</div>
            <div className="font-display text-lg font-bold">airtel SCM Portal</div>
          </div>

          <h2 className="font-display text-3xl font-bold text-gray-900">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter your Airtel email and password. Contact your System Admin if you need access.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Work email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="firstname.lastname@airtel.in"
                className="mt-1 h-11 focus-visible:ring-red-500"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pr-10 focus-visible:ring-red-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              data-testid="login-submit-btn"
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Signing in…' : <span className="flex items-center justify-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span>}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
