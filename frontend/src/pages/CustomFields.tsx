import { useState, useEffect } from 'react';
import { FormInput, Plus, Pencil, Trash2, X } from 'lucide-react';
import { customFieldService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Toast } from '../components/ui/toast';
import type { CustomField } from '../types';

const EMPTY_FORM = {
  label: '',
  insurance_type: '',
  field_type: 'text' as CustomField['field_type'],
  options: '',
  is_required: false,
};

export function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadFields = async () => {
    try {
      const data = await customFieldService.getCustomFields({ includeInactive: true });
      setFields(data);
    } catch (err) {
      setToast({ message: 'Failed to load custom fields', type: 'error' });
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        label: formData.label,
        insurance_type: formData.insurance_type || null,
        field_type: formData.field_type,
        is_required: formData.is_required,
        options: formData.field_type === 'select' ? formData.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      };
      if (editingField) {
        await customFieldService.updateCustomField(editingField.id, payload);
        setToast({ message: 'Custom field updated successfully!', type: 'success' });
      } else {
        await customFieldService.createCustomField(payload);
        setToast({ message: 'Custom field added successfully!', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingField(null);
      setFormData(EMPTY_FORM);
      loadFields();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Failed to save custom field', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      label: field.label,
      insurance_type: field.insurance_type || '',
      field_type: field.field_type,
      options: (field.options || []).join(', '),
      is_required: field.is_required,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this custom field?')) {
      try {
        await customFieldService.deleteCustomField(id);
        setToast({ message: 'Custom field deactivated', type: 'success' });
        loadFields();
      } catch (err) {
        setToast({ message: 'Failed to delete custom field', type: 'error' });
      }
    }
  };

  const fieldTypeLabel = (type: string) =>
    type === 'select' ? 'Dropdown' : type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Custom Fields</h1>
        <Button onClick={() => { setIsModalOpen(true); setEditingField(null); setFormData(EMPTY_FORM); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <Card className="p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 pr-4">Field</th>
              <th className="pb-2 pr-4">Applies To</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Options</th>
              <th className="pb-2 pr-4">Required</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map(field => (
              <tr key={field.id} className={`border-b ${!field.is_active ? 'text-muted-foreground' : ''}`}>
                <td className="py-3 pr-4">{field.label}</td>
                <td className="py-3 pr-4">{field.insurance_type || 'All'}</td>
                <td className="py-3 pr-4">{fieldTypeLabel(field.field_type)}</td>
                <td className="py-3 pr-4">{field.options?.join(', ') || '-'}</td>
                <td className="py-3 pr-4">{field.is_required ? 'Yes' : 'No'}</td>
                <td className="py-3 pr-4">{field.is_active ? 'Active' : 'Inactive'}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(field)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {field.is_active && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(field.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  <FormInput className="mx-auto mb-2 h-8 w-8" />
                  No custom fields yet. Add one to show extra inputs on the policy screens.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Nominee Name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="insurance_type">Applies To</Label>
                <Select
                  id="insurance_type"
                  value={formData.insurance_type}
                  onChange={e => setFormData({ ...formData, insurance_type: e.target.value })}
                >
                  <option value="">All insurance types</option>
                  <option value="Life">Life</option>
                  <option value="Health">Health</option>
                  <option value="General">General</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="field_type">Field Type</Label>
                <Select
                  id="field_type"
                  value={formData.field_type}
                  onChange={e => setFormData({ ...formData, field_type: e.target.value as CustomField['field_type'] })}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                </Select>
              </div>
              {formData.field_type === 'select' && (
                <div>
                  <Label htmlFor="options">Dropdown Options (comma separated)</Label>
                  <Input
                    id="options"
                    value={formData.options}
                    onChange={e => setFormData({ ...formData, options: e.target.value })}
                    placeholder="e.g., Male, Female, Other"
                    required
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Required on policy forms
              </label>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editingField ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}