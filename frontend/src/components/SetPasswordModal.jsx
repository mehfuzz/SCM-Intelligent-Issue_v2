import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function SetPasswordModal() {
  const { user, clearMustChangePassword } = useAuth();
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [saving, setSaving]       = useState(false);

  if (!user?.mustChangePassword) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      // mustChangePassword = true means this is the first-login flow — no old password needed.
      await api.changePassword(user.id, null, newPw);
      clearMustChangePassword();
      toast.success('Password set successfully. Welcome!');
    } catch (e) {
      toast.error(e?.message?.replace(/^API \d+: /, '') || 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-red-600" />
            <DialogTitle className="font-display text-xl">Set your password</DialogTitle>
          </div>
          <DialogDescription>
            Welcome, {user.name}! Your account was created with a temporary password.
            Please set a new password before you continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div>
            <Label htmlFor="sp-new" className="text-xs font-semibold text-gray-700">New password</Label>
            <div className="relative mt-1">
              <Input
                id="sp-new"
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                className="h-11 pr-10 focus-visible:ring-red-500"
                required
                autoFocus
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

          <div>
            <Label htmlFor="sp-confirm" className="text-xs font-semibold text-gray-700">Confirm new password</Label>
            <Input
              id="sp-confirm"
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Repeat password"
              className="mt-1 h-11 focus-visible:ring-red-500"
              required
            />
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-3">
            Password must be at least 8 characters. You can change it again later from account settings.
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
            disabled={saving}
          >
            {saving ? 'Setting password…' : 'Set password & continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
