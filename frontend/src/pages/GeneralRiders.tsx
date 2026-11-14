import { useState, useEffect } from 'react';
import { Shield, Plus, Pencil, X, Trash2 } from 'lucide-react';
import { generalRiderService, productService } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { GENERAL_SUB_CATEGORIES } from '../constants/insurance';
import type { GeneralRider, ProductMaster } from '../types';

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
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    product_names: [] as string[],
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

  useEffect(() => {
    if (!showForm) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    productService
      .getProducts({
        insurance_type: 'General',
        category: formData.category || undefined,
      })
      .then(data => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showForm, formData.category]);

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
      setFormData({ name: '', description: '', category: '', product_names: [] });
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
      product_names: rider.product_names || [],
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

  const productOptions = Array.from(
    new Map(products.map(product => [product.product_name, product])).values()
  );

  // General policies fall back to the standard sub-category as their "product"
  // when Product Management has no product configured for the category (see
  // AddPolicy/EditPolicy). Offer both real product names and the standard
  // sub-categories so a rider can be scoped in either case.
  const configuredProductNames = productOptions.map(product => product.product_name);
  const subCategoryOptions = formData.category ? (GENERAL_SUB_CATEGORIES[formData.category] || []) : [];
  const selectableProducts = [
    ...productOptions.map(product => ({
      key: product.product_name,
      label: product.product_name,
      hint: product.sub_category || '',
    })),
    ...subCategoryOptions
      .filter(name => !configuredProductNames.includes(name))
      .map(name => ({ key: name, label: name, hint: 'standard sub-category' })),
  ];
  const hasConfiguredProducts = productOptions.length > 0;

  const toggleProduct = (productName: string) => {
    setFormData(prev => ({
      ...prev,
      product_names: prev.product_names.includes(productName)
        ? prev.product_names.filter(name => name !== productName)
        : [...prev.product_names, productName],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">General Insurance Riders</h1>
          <p className="text-muted-foreground">Manage riders available for general insurance policies</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingRider(null); setFormData({ name: '', description: '', category: '', product_names: [] }); }}>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value, product_names: [] }))}
                >
                  <option value="">Select Category</option>
                  {GENERAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Specific Products (Optional)</Label>
                {formData.product_names.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setFormData(prev => ({ ...prev, product_names: [] }))}
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tick the products this rider is available for. Leave all unticked to make it
                available for every product in the selected category.
              </p>
              {!formData.category ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Select a category to choose specific products.
                </div>
              ) : productsLoading ? (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  Loading products...
                </div>
              ) : selectableProducts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  No products configured for this category. This rider will apply to all products in {formData.category}.
                </div>
              ) : (
                <div className="space-y-2">
                  {!hasConfiguredProducts && (
                    <p className="text-xs text-muted-foreground">
                      No products are configured in Product Management for {formData.category}.
                      Pick from the standard {formData.category} sub-categories below, or leave
                      all unticked to apply the rider to every product.
                    </p>
                  )}
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
                    {selectableProducts.map(product => (
                      <label key={product.key} className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={formData.product_names.includes(product.key)}
                          onChange={() => toggleProduct(product.key)}
                          className="mt-0.5 h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">
                          {product.label}
                          {product.hint && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({product.hint})
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {formData.product_names.length > 0 && (
                <p className="text-xs text-primary">
                  This rider will only be offered for {formData.product_names.length} selected
                  product{formData.product_names.length === 1 ? '' : 's'}.
                </p>
              )}
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
          <Button onClick={() => { setShowForm(true); setEditingRider(null); setFormData({ name: '', description: '', category: filterCategory, product_names: [] }); }}>
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
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className="text-xs text-muted-foreground">Products:</span>
                          {rider.product_names && rider.product_names.length > 0 ? (
                            rider.product_names.map(productName => (
                              <span
                                key={productName}
                                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {productName}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              All products in {rider.category}
                            </span>
                          )}
                        </div>
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
