import { useState, useEffect } from 'react';
import { UserCheck, Plus, Pencil, X, Check, MapPin, AlertTriangle } from 'lucide-react';
import { fieldMemberService, locationService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Toast } from '../components/ui/toast';
import { useAuth } from '../hooks/useAuth';
import type { FieldMember, Location } from '../types';

export function FieldMembersManagement() {
  const { user } = useAuth();
  const isCentralAdmin = user?.role === 'central_admin';
  const [members, setMembers] = useState<FieldMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<FieldMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FieldMember | null>(null);
  const [formData, setFormData] = useState({ name: '', location_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadMembers = async () => {
    try {
      const data = await fieldMemberService.getFieldMembers(showInactive, isCentralAdmin);
      setMembers(data);
    } catch (err) {
      setError('Failed to load field members');
    }
  };

  const loadPendingMembers = async () => {
    if (!isCentralAdmin) return;
    try {
      const data = await fieldMemberService.getPendingFieldMembers();
      setPendingMembers(data);
    } catch (err) {
      console.error('Failed to load pending members');
    }
  };

  useEffect(() => {
    loadMembers();
    if (isCentralAdmin) {
      loadPendingMembers();
    }
    locationService.getLocations().then(setLocations).catch(() => {});
  }, [showInactive, isCentralAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingMember) {
        await fieldMemberService.updateFieldMember(editingMember.id, { 
          name: formData.name, 
          location_id: Number(formData.location_id) 
        });
      } else {
        await fieldMemberService.createFieldMember({ 
          name: formData.name, 
          location_id: Number(formData.location_id) 
        });
      }
      setIsModalOpen(false);
      setEditingMember(null);
      setFormData({ name: '', location_id: '' });
      loadMembers();
      if (isCentralAdmin) loadPendingMembers();
      setToast({ 
        message: editingMember ? 'Field member updated' : (isCentralAdmin ? 'Field member created' : 'Request sent to central admin for approval'), 
        type: 'success' 
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save field member');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: FieldMember) => {
    setEditingMember(member);
    setFormData({ name: member.name, location_id: String(member.location_id || '') });
    setIsModalOpen(true);
  };

  const handleDeactivate = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this field member?')) {
      try {
        await fieldMemberService.deactivateFieldMember(id);
        loadMembers();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to deactivate field member');
      }
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await fieldMemberService.approveFieldMember(id);
      loadPendingMembers();
      loadMembers();
      setToast({ message: 'Field member approved', type: 'success' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: number) => {
    if (confirm('Are you sure you want to reject this field member request?')) {
      try {
        await fieldMemberService.rejectFieldMember(id);
        loadPendingMembers();
        loadMembers();
        setToast({ message: 'Field member rejected', type: 'success' });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to reject');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Field Member Management</h1>
        <Button onClick={() => {
          setIsModalOpen(true);
          setEditingMember(null);
          setFormData({ name: '', location_id: '' });
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field Member
        </Button>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {isCentralAdmin && pendingMembers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-800">
                Pending Approval Requests ({pendingMembers.length})
              </h2>
            </div>
            <p className="text-sm text-amber-700 mb-4">
              Branch admins have requested to add field members. Review and approve or reject.
            </p>
            <div className="space-y-3">
              {pendingMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <UserCheck className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {member.location}
                      </div>
                      {member.requested_by_name && (
                        <div className="text-xs text-muted-foreground">
                          Requested by: {member.requested_by_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => handleApprove(member.id)}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => handleReject(member.id)}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-4 items-center flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={showInactive} 
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">Show inactive members</span>
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
                <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Requested By</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <UserCheck className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {member.location}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {member.requested_by_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(member)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {member.is_active && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(member.id)}>
                          <X className="h-4 w-4 text-destructive" />
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

      {members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-4" />
          <p>No field members found</p>
          <p className="text-sm">Add field members to see them here</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingMember ? 'Edit Field Member' : 'Add Field Member'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {!isCentralAdmin && !editingMember && (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-700">
                  Your request will be sent to central admin for approval before the field member is activated.
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter field member name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Select
                  id="location"
                  value={formData.location_id}
                  onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                >
                  <option value="">Select Location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editingMember ? 'Update' : (!isCentralAdmin ? 'Request Approval' : 'Create')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
