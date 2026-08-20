import { useState, useEffect } from 'react';
import { MapPin, Plus, Pencil, X } from 'lucide-react';
import { locationService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import type { Location } from '../types';

export function LocationsManagement() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLocations = async () => {
    try {
      const data = await locationService.getLocations(showInactive);
      setLocations(data);
    } catch (err) {
      setError('Failed to load locations');
    }
  };

  useEffect(() => {
    loadLocations();
  }, [showInactive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingLocation) {
        await locationService.updateLocation(editingLocation.id, { name });
      } else {
        await locationService.createLocation(name);
      }
      setIsModalOpen(false);
      setEditingLocation(null);
      setName('');
      loadLocations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setName(location.name);
    setIsModalOpen(true);
  };

  const handleDeactivate = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this location?')) {
      try {
        await locationService.deleteLocation(id);
        loadLocations();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to deactivate location');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Location Management</h1>
        <Button onClick={() => { setIsModalOpen(true); setEditingLocation(null); setName(''); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
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
          <span className="text-sm">Show inactive locations</span>
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
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(location => (
                <tr key={location.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{location.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      location.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {location.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(location)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {location.is_active && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(location.id)}>
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

      {locations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MapPin className="h-12 w-12 mb-4" />
          <p>No locations found</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingLocation ? 'Edit Location' : 'Add Location'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., New York"
                  required
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editingLocation ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
