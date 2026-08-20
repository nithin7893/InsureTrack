import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { companyService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Toast } from '../components/ui/toast';
import type { Company, CompanyFormData } from '../types';

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>({ name: '', insurance_type: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadCompanies = async () => {
    try {
      const data = await companyService.getCompanies(filterType || undefined);
      setCompanies(data);
    } catch (err) {
      setToast({ message: 'Failed to load companies', type: 'error' });
    }
  };

  const loadTypes = async () => {
    try {
      const types = await companyService.getInsuranceTypes();
      setInsuranceTypes(types);
    } catch (err) {
      console.error('Failed to load types');
    }
  };

  useEffect(() => {
    loadCompanies();
    loadTypes();
  }, [filterType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCompany) {
        await companyService.updateCompany(editingCompany.id, formData);
        setToast({ message: 'Company updated successfully!', type: 'success' });
      } else {
        await companyService.createCompany(formData);
        setToast({ message: 'Company added successfully!', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingCompany(null);
      setFormData({ name: '', insurance_type: '' });
      loadCompanies();
      loadTypes();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Failed to save company', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({ name: company.name, insurance_type: company.insurance_type });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this company?')) {
      try {
        await companyService.deleteCompany(id);
        setToast({ message: 'Company deactivated', type: 'success' });
        loadCompanies();
      } catch (err) {
        setToast({ message: 'Failed to delete company', type: 'error' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Insurance Companies</h1>
        <Button onClick={() => { setIsModalOpen(true); setEditingCompany(null); setFormData({ name: '', insurance_type: '' }); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-[200px]">
          <option value="">All Types</option>
          {insuranceTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map(company => (
          <Card key={company.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{company.name}</h3>
                  <p className="text-sm text-muted-foreground">{company.insurance_type}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4" />
          <p>No companies found</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingCompany ? 'Edit Company' : 'Add Company'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., LIC, HDFC Life"
                  required
                />
              </div>
              <div>
                <Label htmlFor="insurance_type">Insurance Type</Label>
                <Select value={formData.insurance_type} onChange={e => setFormData({ ...formData, insurance_type: e.target.value })}>
                  <option value="">Select type</option>
                  <option value="Life">Life</option>
                  <option value="Health">Health</option>
                  <option value="General">General</option>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editingCompany ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
