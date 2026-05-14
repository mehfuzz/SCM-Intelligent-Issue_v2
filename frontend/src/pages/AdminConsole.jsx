import { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { MOCK_USERS, MODULES, FUNCTIONS, CATEGORIES, STATUSES } from '../data/mockData';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Settings } from 'lucide-react';

export default function AdminConsole() {
  return (
    <div className="space-y-6" data-testid="admin-console-page">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Admin Console</p>
        <h1 className="font-display text-3xl font-bold text-gray-900">System &amp; master data</h1>
        <p className="text-sm text-gray-500 mt-1">Manage taxonomy, workflows, users, roles and master configurations.</p>
      </div>

      <Tabs defaultValue="taxonomy">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="taxonomy" data-testid="admin-tab-taxonomy">Taxonomy</TabsTrigger>
          <TabsTrigger value="workflows" data-testid="admin-tab-workflows">Workflows</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users">Users &amp; Roles</TabsTrigger>
          <TabsTrigger value="settings" data-testid="admin-tab-settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="taxonomy" className="mt-4 space-y-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-semibold">Categories</h3>
                  <p className="text-xs text-gray-500">Issue categories from the SCM taxonomy.</p>
                </div>
                <Button size="sm" data-testid="admin-add-category-btn" className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-1" /> Add category</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Badge key={c} className="bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200">{c}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-semibold mb-3">Modules</h3>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((m) => <Badge key={m} className="bg-red-50 text-red-700 hover:bg-red-100">{m}</Badge>)}
                <Button size="sm" variant="outline" data-testid="admin-add-module-btn"><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-semibold mb-3">Functions</h3>
              <div className="flex flex-wrap gap-2">
                {FUNCTIONS.map((f) => <Badge key={f} className="bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200">{f}</Badge>)}
                <Button size="sm" variant="outline" data-testid="admin-add-function-btn"><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="mt-4">
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
              <p className="text-xs text-gray-500 mt-4">Workflow customisation per category will be available in v2.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-semibold">Users</h3>
                  <p className="text-xs text-gray-500">{MOCK_USERS.length} active users</p>
                </div>
                <Button size="sm" data-testid="admin-add-user-btn" className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-1" /> Add user</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_USERS.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7"><AvatarFallback className="bg-red-600 text-white text-[11px]">{u.avatarInitials}</AvatarFallback></Avatar>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm font-mono-airtel">{u.email}</TableCell>
                      <TableCell><Badge className="bg-red-50 text-red-700 hover:bg-red-50">{u.role}</Badge></TableCell>
                      <TableCell className="text-gray-600 text-sm">{u.department}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="border-gray-200 shadow-sm max-w-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> System settings</h3>
              <ToggleRow label="Enable AI deduplication on submission" defaultChecked testId="setting-dedup" />
              <ToggleRow label="Auto-generate BRD draft after triage" defaultChecked testId="setting-brd" />
              <ToggleRow label="Email notifications" defaultChecked testId="setting-email" />
              <ToggleRow label="Teams notifications" testId="setting-teams" />
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
                <Button data-testid="admin-save-settings-btn" onClick={() => toast.success('Settings saved')} className="bg-red-600 hover:bg-red-700"><Save className="h-4 w-4 mr-1" /> Save</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const ToggleRow = ({ label, defaultChecked, testId }) => (
  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
    <div className="text-sm text-gray-700">{label}</div>
    <Switch defaultChecked={defaultChecked} data-testid={testId} />
  </div>
);
