import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Pencil, UserX, X, MapPin } from 'lucide-react';
import { userService, locationService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import type { User, UserFormData, Location } from '../types';

export function UsersManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ 
    email: '', 
    password: '', 
    name: '', 
    role: 'agent',
    location_id: undefined,
  });

  useEffect(() => {
    locationService.getLocations().then(setLocations).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers(showInactive);
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  useEffect(() => {
    loadUsers();
  }, [showInactive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingUser) {
        const updateData: any = { 
          name: formData.name, 
          role: formData.role,
          location_id: formData.location_id || null,
        };
        if (formData.password) updateData.password = formData.password;
        await userService.updateUser(editingUser.id, updateData);
      } else {
        if (!formData.email || !formData.password) {
          setError('Email and password are required for new users');
          setLoading(false);
          return;
        }
        await userService.createUser(formData);
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', name: '', role: 'agent', location_id: undefined });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ email: user.email, password: '', name: user.name, role: user.role as UserFormData['role'], location_id: user.location_id });
    setIsModalOpen(true);
  };

  const handleDeactivate = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this user?')) {
      try {
        await userService.deactivateUser(id);
        loadUsers();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to deactivate user');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={() => { setIsModalOpen(true); setEditingUser(null); setFormData({ email: '', password: '', name: '', role: 'agent', location_id: undefined }); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={showInactive} 
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">Show inactive users</span>
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-sm font-medium text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium">{user.name}</span>
                      {user.id === currentUser?.id && (
                        <span className="text-xs text-muted-foreground">(You)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {user.location}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      user.role === 'central_admin' ? 'bg-red-100 text-red-700' : 
                      user.role === 'branch_admin' ? 'bg-violet-100 text-violet-700' : 
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'branch_admin' ? 'Branch Admin' : 
                       user.role === 'central_admin' ? 'Central Admin' : 
                       'Agent'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(user.id)}>
                          <UserX className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <UsersIcon className="h-12 w-12 mb-4" />
          <p>No users found</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required={!editingUser}
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <Label htmlFor="password">
                  Password {editingUser && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                  required={!editingUser}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={formData.role} 
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserFormData['role'] })}
                >
                  <option value="central_admin">Central Admin</option>
                  <option value="branch_admin">Branch Admin</option>
                  <option value="agent">Agent</option>
                </Select>
              </div>
              {(formData.role === 'branch_admin' || formData.role === 'agent') && (
              <div>
                <Label htmlFor="location">Location</Label>
                <Select 
                  value={formData.location_id != null ? String(formData.location_id) : ''} 
                  onChange={e => setFormData({ ...formData, location_id: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">No Location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                  ))}
                </Select>
              </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
