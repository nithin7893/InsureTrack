import { useState, useEffect } from 'react';
import { Shield, Plus, Pencil, X, Trash2 } from 'lucide-react';
import { generalRiderService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import type { GeneralRider } from '../types';

const GENERAL_CATEGORIES = [
  'Engineering', 'Fire', 'Health', 'Liability',
  'Marine Cargo', 'Marine Hull', 'Miscellaneous', 'Motor'
];

export function GeneralRidersPage() {
  const [riders, setRiders] = useState<GeneralRider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRider, setEditingRider] = useState<GeneralRider | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
  });
  const [error, setError] = useState('');

  const loadRiders = async () => {
    try {
      setIsLoading(true);
      const data = await generalRiderService.getGeneralRiders(filterCategory || undefined);
      setRiders(data);
    } catch (err) {
      console.error('Failed to load riders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRiders();
  }, [filterCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.category) {
      setError('Category is required');
      return;
    }

    try {
      if (editingRider) {
        await generalRiderService.updateGeneralRider(editingRider.id, formData);
      } else {
        await generalRiderService.createGeneralRider(formData);
      }
      setShowForm(false);
      setEditingRider(null);
      setFormData({ name: '', description: '', category: '' });
      loadRiders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save rider');
    }
  };

  const handleEdit = (rider: GeneralRider) => {
    setEditingRider(rider);
    setFormData({
      name: rider.name,
      description: rider.description || '',
      category: rider.category,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rider?')) return;
    try {
      await generalRiderService.deleteGeneralRider(id);
      loadRiders();
    } catch (err) {
      console.error('Failed to delete rider');
    }
  };

  const handleToggleActive = async (rider: GeneralRider) => {
    try {
      await generalRiderService.updateGeneralRider(rider.id, { is_active: !rider.is_active });
      loadRiders();
    } catch (err) {
      console.error('Failed to update rider');
    }
  };

  const groupedRiders = riders.reduce((acc, rider) => {
    if (!acc[rider.category]) {
      acc[rider.category] = [];
    }
    acc[rider.category].push(rider);
    return acc;
  }, {} as Record<string, GeneralRider[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">General Insurance Riders</h1>
          <p className="text-muted-foreground">Manage riders available for general insurance policies</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingRider(null); setFormData({ name: '', description: '', category: '' }); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rider
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="w-64">
          <Label>Filter by Category</Label>
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {GENERAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </div>
      </div>

      {showForm && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editingRider ? 'Edit Rider' : 'Add New Rider'}</h3>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingRider(null); setError(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rider Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter rider name"
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">Select Category</option>
                  {GENERAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the rider"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingRider(null); setError(''); }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingRider ? 'Update Rider' : 'Add Rider'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : riders.length === 0 ? (
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Riders Found</h3>
          <p className="text-muted-foreground mb-4">
            {filterCategory ? `No riders found for ${filterCategory} category` : 'No general riders have been added yet'}
          </p>
          <Button onClick={() => { setShowForm(true); setEditingRider(null); setFormData({ name: '', description: '', category: filterCategory }); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Rider
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRiders).map(([category, categoryRiders]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-3">{category}</h2>
              <div className="grid gap-3">
                {categoryRiders.map((rider) => (
                  <Card key={rider.id} className={`p-4 ${!rider.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{rider.name}</h3>
                          {!rider.is_active && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">Inactive</span>
                          )}
                        </div>
                        {rider.description && (
                          <p className="text-sm text-muted-foreground mt-1">{rider.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(rider)}
                        >
                          {rider.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(rider)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(rider.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
