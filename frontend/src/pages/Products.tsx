import { useState, useEffect } from 'react';
import { Package, Plus, Pencil, X } from 'lucide-react';
import { productService, companyService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import type { ProductMaster, Company } from '../types';

const INSURANCE_TYPES = ['Life', 'Health', 'General'] as const;
const LIFE_CATEGORIES = ['Linked', 'Non Linked'];
const PRODUCT_CATEGORIES: Record<string, string[]> = {
  Life: ['Term Plan', 'Return of Premium', 'Annuity', 'Savings', 'ULIP', 'Pension', 'Group Term Life Insurance(GTLI)'],
  Health: ['Personal Health', 'GMC', 'Travel', 'Personal Accident', 'Topup', 'GPA'],
  General: ['Engineering', 'Fire', 'Health', 'Liability', 'Marine Cargo', 'Marine Hull', 'Miscellaneous', 'Motor'],
};

const GENERAL_CATEGORIES = [
  'Engineering', 'Fire', 'Health', 'Liability',
  'Marine Cargo', 'Marine Hull', 'Miscellaneous', 'Motor'
];

const GENERAL_SUB_CATEGORIES: Record<string, string[]> = {
  Engineering: [
    "Contractor's All Risks (CAR)",
    "Erection All Risks (EAR)",
    "Advance Loss of Profits (ALOP) / Delay in Start-Up (DSU)",
    "Machinery Breakdown (MBD)",
    "Contractor's Plant & Machinery (CPM)",
    "Boiler and Pressure Plant (BPP)",
    'Electronic Equipment (EEI)',
    'Machinery Loss of Profits (MLOP) / Business Interruption',
    'Deterioration of Stocks (DOS)',
    'Civil Engineering Completed Risks (CECR)',
  ],
  Fire: [
    'Bharat Griha Raksha',
    'Bharat Sookshma Udyam Suraksha',
    'Bharat Laghu Udyam Suraksha',
    'Standard Fire and Special Perils (SFSP)',
    'Floating Fire Policy',
    'Declaration Policy',
    'Consequential Loss (Fire) / Business Interruption',
    'Reinstatement / Replacement Value Policy',
  ],
  Health: [
    'Individual', 'Floater', 'GMC', 'Personal Accident', 'Travel', 'Topup', 'GPA',
  ],
  Liability: [
    'Public Liability (Act)',
    'Public Liability (Industrial / Non-Industrial)',
    'Product Liability',
    'Directors and Officers (D&O)',
    'Professional Indemnity (PI) / Errors & Omissions (E&O)',
    'Employment Practices Liability (EPLI)',
    'Cyber Liability',
    'Commercial Crime',
    'Commercial General Liability (CGL)',
  ],
  'Marine Cargo': [
    'Marine Open Policy',
    'Marine Sales Turnover (STOP)',
    'Specific Voyage Policy',
    'Marine Open Cover',
    'Inland Marine / Domestic Transit',
    'Export & Import Cargo',
    'ICC (A) - All Risks',
    'ICC (B) / ICC (C)',
    'ICC (Air)',
    'Marine DSU / Marine ALOP',
  ],
  'Marine Hull': [
    'Hull and Machinery (H&M)',
    'Freight & Disbursement',
    'Protection and Indemnity (P&I) - Restricted',
    'Time Hull Policy',
    'Voyage Hull Policy',
    'Fleet Insurance',
    "Builder's Risk / Ship Repairers Liability",
    'Port Risk Policy',
    'Blue-Water Hull',
    'Brown-Water / Inland Marine Hull',
    'Specialized Vessel',
  ],
  Miscellaneous: [
    'Burglary and Housebreaking',
    'Money in Transit / Money in Safe',
    'Fidelity Guarantee',
    'Plate Glass',
    'Neon Sign / Glow Sign',
    'Baggage',
    'Trade Credit',
    "Banker's Indemnity",
    "Jewellers' Block",
    'Cattle & Livestock',
    'Poultry',
    'Agricultural Pump Set',
    'Weather-Based Crop (Non-PMFBY)',
  ],
  Motor: [
    'Private Cars',
    'Two-Wheelers',
    'Commercial Vehicles - Goods Carrying',
    'Commercial Vehicles - Passenger Carrying',
    'Commercial Vehicles - Miscellaneous Class D',
    'Own Damage (OD)',
    'Third-Party (TP) Liability',
    'Comprehensive / Package Policy',
    'Bundled Policy (New Vehicles)',
    'Stand-Alone OD',
    'Pay-As-You-Drive / Telematics',
  ],
};

export function ProductsManagement() {
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [filterType, setFilterType] = useState('');
  const [formData, setFormData] = useState({
    insurance_type: 'Life' as string,
    company_name: '',
    category: '',
    sub_category: '',
    product_category: '',
    product_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProducts = async () => {
    try {
      const params: any = { include_inactive: showInactive };
      if (filterType) params.insurance_type = filterType;
      const data = await productService.getProducts(params);
      setProducts(data);
    } catch (err) {
      setError('Failed to load products');
    }
  };

  useEffect(() => {
    loadProducts();
    companyService.getCompanies().then(setCompanies).catch(() => {});
  }, [showInactive, filterType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, {
          ...formData,
          company_name: formData.company_name || undefined,
          category: formData.category || undefined,
          sub_category: formData.sub_category || undefined,
        });
      } else {
        await productService.createProduct({
          insurance_type: formData.insurance_type,
          company_name: formData.company_name || undefined,
          category: formData.category || undefined,
          sub_category: formData.sub_category || undefined,
          product_category: formData.product_category || undefined,
          product_name: formData.product_name,
        });
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({
        insurance_type: 'Life',
        company_name: '',
        category: '',
        sub_category: '',
        product_category: '',
        product_name: '',
      });
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: ProductMaster) => {
    setEditingProduct(product);
    setFormData({
      insurance_type: product.insurance_type,
      company_name: product.company_name || '',
      category: product.category || '',
      sub_category: product.sub_category || '',
      product_category: product.product_category || '',
      product_name: product.product_name,
    });
    setIsModalOpen(true);
  };

  const handleDeactivate = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this product?')) {
      try {
        await productService.deleteProduct(id);
        loadProducts();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to deactivate product');
      }
    }
  };

  const filteredCompanies = companies
    .filter(c => c.insurance_type === formData.insurance_type)
    .map(c => c.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Product Management</h1>
        <Button onClick={() => {
          setIsModalOpen(true);
          setEditingProduct(null);
          setFormData({
            insurance_type: 'Life',
            company_name: '',
            category: '',
            sub_category: '',
            product_category: '',
            product_name: '',
          });
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={showInactive} 
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">Show inactive products</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-[150px]">
            <option value="">All Types</option>
            {INSURANCE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Insurance Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Company</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Sub Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{product.product_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
                      ${product.insurance_type === 'Life' ? 'bg-pink-100 text-pink-700' : 
                        product.insurance_type === 'Health' ? 'bg-orange-100 text-orange-700' : 
                        'bg-purple-100 text-purple-700'}`}>
                      {product.insurance_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {product.company_name || <span className="text-muted-foreground/50">All Companies</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {product.category || <span className="text-muted-foreground/50">Any</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {product.sub_category || <span className="text-muted-foreground/50">Any</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {product.is_active && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(product.id)}>
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

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-4" />
          <p>No products found</p>
          <p className="text-sm">Add products to see them here</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="insurance_type">Insurance Type</Label>
                  <Select
                    value={formData.insurance_type}
                    onChange={e => setFormData({ ...formData, insurance_type: e.target.value, company_name: '', category: '', sub_category: '' })}
                  >
                    {INSURANCE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="company_name">
                    Company <span className="text-muted-foreground text-xs">(Optional: blank = all companies)</span>
                  </Label>
                  <Select
                    value={formData.company_name}
                    onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  >
                    <option value="">All Companies</option>
                    {filteredCompanies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {formData.insurance_type === 'Life' && (
                <div>
                  <Label htmlFor="category">
                    Category <span className="text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Any Category</option>
                    {LIFE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              )}

              {formData.insurance_type === 'General' && (
                <>
                  <div>
                    <Label htmlFor="category">
                      Category <span className="text-muted-foreground text-xs">(Optional)</span>
                    </Label>
                    <Select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value, sub_category: '' })}
                    >
                      <option value="">Any Category</option>
                      {GENERAL_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  {formData.category && (
                    <div>
                      <Label htmlFor="sub_category">
                        Sub Category <span className="text-muted-foreground text-xs">(Optional)</span>
                      </Label>
                      <Select
                        value={formData.sub_category}
                        onChange={e => setFormData({ ...formData, sub_category: e.target.value })}
                      >
                        <option value="">Any Sub Category</option>
                        {(GENERAL_SUB_CATEGORIES[formData.category] || []).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label htmlFor="product_category">
                  Product Category <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <Select
                  value={formData.product_category}
                  onChange={e => setFormData({ ...formData, product_category: e.target.value })}
                >
                  <option value="">Any Category</option>
                  {PRODUCT_CATEGORIES[formData.insurance_type]?.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="product_name">Product Name</Label>
                <Input
                  id="product_name"
                  value={formData.product_name}
                  onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="e.g., Term Plan, Motor Gold, etc."
                  required
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Matching Logic:</p>
                <p>This product will be shown when adding a policy IF:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Insurance Type matches</li>
                  <li>Company matches (or blank for all companies)</li>
                  <li>Category matches (or blank for any category)</li>
                  <li>Sub Category matches (or blank for any sub category)</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
