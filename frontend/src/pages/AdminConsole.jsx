import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  MODULES as INITIAL_MODULES, FUNCTIONS as INITIAL_FUNCTIONS,
  CATEGORIES as INITIAL_CATEGORIES, STATUSES, IN_PROGRESS_SUBSTAGES_DEFAULT, ROLES,
} from '../data/mockData';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Settings, X, Copy, UserCheck, UserX } from 'lucide-react';

export default function AdminConsole() {
  const [categories, setCategories] = useState([...INITIAL_CATEGORIES]);
  const [modules, setModules]       = useState([...INITIAL_MODULES]);
  const [functions, setFunctions]   = useState([...INITIAL_FUNCTIONS]);
  const [substages, setSubstages]   = useState([...IN_PROGRESS_SUBSTAGES_DEFAULT]);

  // Users — loaded from API
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data || []);
    } catch {
      toast.error('Could not load users from server');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // --- generic add/remove helpers ---
  const [addPrompt, setAddPrompt] = useState(null);
  const [addValue, setAddValue]   = useState('');

  const openAdd = (title, onSave) => { setAddPrompt({ title, onSave }); setAddValue(''); };
  const submitAdd = () => {
    const v = addValue.trim();
    if (!v) { toast.error('Enter a value first'); return; }
    addPrompt.onSave(v);
    setAddPrompt(null);
    setAddValue('');
  };

  // --- Add User dialog ---
  const [showAddUser, setShowAddUser]   = useState(false);
  const [newUser, setNewUser]           = useState({ name: '', email: '', role: ROLES.SUBMITTER, department: '' });
  const [addingUser, setAddingUser]     = useState(false);

  // --- Temp password reveal dialog ---
  const [tempPwInfo, setTempPwInfo]     = useState(null); // { name, email, tempPassword }

  const submitNewUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) { toast.error('Name and email are required'); return; }
    setAddingUser(true);
    try {
      const { user: created, tempPassword } = await api.createUser(newUser);
      setUsers((prev) => [...prev, created]);
      setTempPwInfo({ name: created.name, email: created.email, tempPassword });
      toast.success(`${created.name} added as ${created.role}`);
      setShowAddUser(false);
      setNewUser({ name: '', email: '', role: ROLES.SUBMITTER, department: '' });
    } catch (e) {
      toast.error(e?.message?.replace(/^API \d+: /, '') || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeactivate = async (u) => {
    try {
      await api.deactivateUser(u.id);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: false } : x));
      toast.success(`${u.name} deactivated`);
    } catch (e) {
      toast.error(e?.message?.replace(/^API \d+: /, '') || 'Failed to deactivate user');
    }
  };

  const handleActivate = async (u) => {
    try {
      await api.activateUser(u.id);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: true } : x));
      toast.success(`${u.name} re-activated`);
    } catch (e) {
      toast.error(e?.message?.replace(/^API \d+: /, '') || 'Failed to activate user');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-console-page">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Admin Console</p>
        <h1 className="font-display text-3xl font-bold text-gray-900">System &amp; master data</h1>
        <p className="text-sm text-gray-500 mt-1">Manage taxonomy, workflows, users, roles and master configurations.</p>
      </div>

      <Tabs defaultValue="taxonomy">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="taxonomy"  data-testid="admin-tab-taxonomy">Taxonomy</TabsTrigger>
          <TabsTrigger value="workflows" data-testid="admin-tab-workflows">Workflows</TabsTrigger>
          <TabsTrigger value="users"     data-testid="admin-tab-users">Users &amp; Roles</TabsTrigger>
          <TabsTrigger value="settings"  data-testid="admin-tab-settings">System Settings</TabsTrigger>
        </TabsList>

        {/* ---------- TAXONOMY ---------- */}
        <TabsContent value="taxonomy" className="mt-4 space-y-4">
          <TagListCard
            title="Categories" subtitle="Issue categories shown in the capture form."
            items={categories}
            onAdd={() => openAdd('Add category', (v) => setCategories((p) => p.includes(v) ? p : [...p, v]))}
            onRemove={(v) => setCategories((p) => p.filter((x) => x !== v))}
            tone="muted"
            testIdPrefix="cat"
          />
          <TagListCard
            title="Modules" subtitle="SCM modules a submitter can pick from."
            items={modules}
            onAdd={() => openAdd('Add module', (v) => setModules((p) => p.includes(v) ? p : [...p, v]))}
            onRemove={(v) => setModules((p) => p.filter((x) => x !== v))}
            tone="red"
            testIdPrefix="mod"
          />
          <TagListCard
            title="Functions" subtitle="Business functions tickets are tagged with."
            items={functions}
            onAdd={() => openAdd('Add function', (v) => setFunctions((p) => p.includes(v) ? p : [...p, v]))}
            onRemove={(v) => setFunctions((p) => p.filter((x) => x !== v))}
            tone="muted"
            testIdPrefix="fn"
          />
        </TabsContent>

        {/* ---------- WORKFLOWS ---------- */}
        <TabsContent value="workflows" className="mt-4 space-y-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-semibold mb-3">Workflow stages</h3>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                {STATUSES.map((s, i) => (
                  <div key={s} className="flex items-center">
                    <span className="rounded-full bg-white border border-gray-200 px-3 py-1.5 font-semibold">{s}</span>
                    {i < STATUSES.length - 1 && <span className="mx-1.5 text-gray-400">→</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">Core lifecycle is fixed. To change it, contact the platform team.</p>
            </CardContent>
          </Card>

          <TagListCard
            title="In-Progress sub-stages"
            subtitle='When a POC owner sets a ticket to "In Progress", a secondary dropdown lets them pick one of these detail stages.'
            items={substages}
            onAdd={() => openAdd('Add sub-stage', (v) => setSubstages((p) => p.includes(v) ? p : [...p, v]))}
            onRemove={(v) => setSubstages((p) => p.filter((x) => x !== v))}
            tone="muted"
            testIdPrefix="substage"
          />

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-display text-lg font-semibold">JIRA integration</h3>
              <p className="text-xs text-gray-500">
                When configured, POC owners will see a "Link to JIRA" action on each assigned issue and statuses will sync via webhook.
                Save the JIRA project URL and an API token below (stub — backend wiring is a follow-up).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">JIRA project URL</Label>
                  <Input data-testid="jira-url" placeholder="https://yourorg.atlassian.net/jira/software/projects/SCM" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">JIRA API token</Label>
                  <Input data-testid="jira-token" type="password" placeholder="paste token" className="mt-1" />
                </div>
              </div>
              <Button data-testid="jira-save" size="sm" onClick={() => toast.success('JIRA config saved (stub)')} className="bg-red-600 hover:bg-red-700">
                <Save className="h-3.5 w-3.5 mr-1" /> Save JIRA config
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- USERS & ROLES ---------- */}
        <TabsContent value="users" className="mt-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-semibold">Users</h3>
                  <p className="text-xs text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
                </div>
                <Button size="sm" data-testid="admin-add-user-btn" onClick={() => setShowAddUser(true)} className="bg-red-600 hover:bg-red-700">
                  <Plus className="h-4 w-4 mr-1" /> Add user
                </Button>
              </div>
              {usersLoading ? (
                <p className="text-sm text-gray-400 py-4 text-center">Loading users…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-red-600 text-white text-[11px]">{u.avatarInitials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium leading-tight">{u.name}</div>
                              {u.mustChangePassword && (
                                <div className="text-[10px] text-amber-600 font-medium">Awaiting password setup</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm font-mono-airtel">{u.email}</TableCell>
                        <TableCell><Badge className="bg-red-50 text-red-700 hover:bg-red-50">{u.role}</Badge></TableCell>
                        <TableCell className="text-gray-600 text-sm">{u.department || '—'}</TableCell>
                        <TableCell>
                          {u.isActive
                            ? <span className="text-xs text-green-700 font-medium">Active</span>
                            : <span className="text-xs text-gray-400 font-medium">Inactive</span>
                          }
                        </TableCell>
                        <TableCell>
                          {u.isActive ? (
                            <Button
                              variant="ghost" size="sm"
                              data-testid={`admin-deactivate-user-${u.id}`}
                              title="Deactivate user"
                              onClick={() => handleDeactivate(u)}
                            >
                              <UserX className="h-4 w-4 text-gray-400" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="sm"
                              data-testid={`admin-activate-user-${u.id}`}
                              title="Re-activate user"
                              onClick={() => handleActivate(u)}
                            >
                              <UserCheck className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- SYSTEM SETTINGS ---------- */}
        <TabsContent value="settings" className="mt-4">
          <Card className="border-gray-200 shadow-sm max-w-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> System settings</h3>
              <ToggleRow label="Enable AI deduplication on submission" defaultChecked testId="setting-dedup" />
              <ToggleRow label="Auto-generate BRD draft after triage" defaultChecked testId="setting-brd" />
              <ToggleRow label="Email notifications"   defaultChecked testId="setting-email" />
              <ToggleRow label="Teams notifications"   testId="setting-teams" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold">P0 response SLA (hours)</Label>
                  <Input data-testid="setting-p0-sla" defaultValue="4" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">P0 resolution SLA (hours)</Label>
                  <Input data-testid="setting-p0-res" defaultValue="24" className="mt-1" />
                </div>
              </div>
              <div className="pt-2">
                <Button data-testid="admin-save-settings-btn" onClick={() => toast.success('Settings saved')} className="bg-red-600 hover:bg-red-700">
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ----- Add taxonomy item dialog ----- */}
      <Dialog open={!!addPrompt} onOpenChange={(o) => !o && setAddPrompt(null)}>
        <DialogContent data-testid="admin-add-dialog">
          <DialogHeader>
            <DialogTitle>{addPrompt?.title}</DialogTitle>
            <DialogDescription>Enter a name; it'll be available immediately in the relevant dropdowns.</DialogDescription>
          </DialogHeader>
          <Input
            data-testid="admin-add-input"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            placeholder="Type here…"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddPrompt(null)}>Cancel</Button>
            <Button data-testid="admin-add-submit" onClick={submitAdd} className="bg-red-600 hover:bg-red-700">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Add User dialog ----- */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent data-testid="admin-add-user-dialog">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              A temporary password will be generated. Share it with the user — they'll be asked to set a new password on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Full name *</Label>
              <Input data-testid="admin-new-user-name" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="e.g. Priya Sharma" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Work email *</Label>
              <Input data-testid="admin-new-user-email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} className="mt-1" placeholder="firstname.lastname@airtel.in" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))}>
                <SelectTrigger data-testid="admin-new-user-role" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(ROLES).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Department</Label>
              <Input data-testid="admin-new-user-dept" value={newUser.department} onChange={(e) => setNewUser((p) => ({ ...p, department: e.target.value }))} className="mt-1" placeholder="e.g. Procurement Tech" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddUser(false)} disabled={addingUser}>Cancel</Button>
            <Button data-testid="admin-add-user-submit" onClick={submitNewUser} disabled={addingUser} className="bg-red-600 hover:bg-red-700">
              {addingUser ? 'Adding…' : 'Add user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Temp password reveal dialog ----- */}
      <Dialog open={!!tempPwInfo} onOpenChange={() => setTempPwInfo(null)}>
        <DialogContent data-testid="admin-temp-pw-dialog">
          <DialogHeader>
            <DialogTitle>User created — share temp password</DialogTitle>
            <DialogDescription>
              <strong>{tempPwInfo?.name}</strong> ({tempPwInfo?.email}) has been added. Share the temporary password below securely.
              They will be prompted to set a new password on their first login.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between gap-3 border border-gray-200">
            <code className="text-base font-mono font-semibold tracking-widest text-gray-800 select-all">
              {tempPwInfo?.tempPassword}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(tempPwInfo?.tempPassword || '');
                toast.success('Copied to clipboard');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
            This password is shown only once. Copy it now before closing.
          </p>
          <DialogFooter>
            <Button onClick={() => setTempPwInfo(null)} className="bg-red-600 hover:bg-red-700">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ToggleRow = ({ label, defaultChecked, testId }) => (
  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
    <div className="text-sm text-gray-700">{label}</div>
    <Switch defaultChecked={defaultChecked} data-testid={testId} />
  </div>
);

const TagListCard = ({ title, subtitle, items, onAdd, onRemove, tone, testIdPrefix }) => {
  const cls = tone === 'red'
    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200';
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <Button size="sm" data-testid={`admin-add-${testIdPrefix}-btn`} onClick={onAdd} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className={`inline-flex items-center gap-1.5 ${cls} text-xs font-semibold rounded-full pl-3 pr-1.5 py-1`}>
              {item}
              <button
                type="button"
                data-testid={`admin-remove-${testIdPrefix}-${item.replace(/\s+/g, '-')}`}
                onClick={() => onRemove(item)}
                className="rounded-full p-0.5 hover:bg-white/60"
                title={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {items.length === 0 && (
            <span className="text-xs text-gray-400">No items yet — click Add to create one.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
