import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function ChangePasswordDialog({ open, onClose }) {
  const { user } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [saving, setSaving]       = useState(false);

  const reset = () => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setShowPw(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { toast.error('New passwords do not match'); return; }
    setSaving(true);
    try {
      await api.changePassword(user.id, currentPw, newPw);
      toast.success('Password changed successfully');
      reset();
      onClose();
    } catch (e) {
      toast.error(e?.message?.replace(/^API \d+: /, '') || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Change password</DialogTitle>
          <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 space-y-4">
          <div>
            <Label htmlFor="cp-current" className="text-xs font-semibold text-gray-700">Current password</Label>
            <div className="relative mt-1">
              <Input
                id="cp-current"
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="h-10 pr-10 focus-visible:ring-red-500"
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
            <Label htmlFor="cp-new" className="text-xs font-semibold text-gray-700">New password</Label>
            <Input
              id="cp-new"
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1 h-10 focus-visible:ring-red-500"
              required
            />
          </div>
          <div>
            <Label htmlFor="cp-confirm" className="text-xs font-semibold text-gray-700">Confirm new password</Label>
            <Input
              id="cp-confirm"
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="mt-1 h-10 focus-visible:ring-red-500"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
