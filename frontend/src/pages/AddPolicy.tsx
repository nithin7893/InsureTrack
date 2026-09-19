import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, ChevronLeft, Check, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Toast } from '../components/ui/toast';
import { policyService, productService, fieldMemberService, generalRiderService, customFieldService } from '../services/api';
import { companyService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { Company, ProductMaster, FieldMember, GeneralRider, CustomField } from '../types';

const INSURANCE_TYPES = ['Life', 'Health', 'General'] as const;

const LIFE_CATEGORIES = ['Linked', 'Non Linked'];
const LIFE_PRODUCTS_FALLBACK = ['Term Plan', 'Return of Premium', 'Annuity', 'Savings', 'ULIP', 'Pension', 'Group Term Life Insurance(GTLI)'];
const HEALTH_PRODUCTS_FALLBACK = ['Personal Health', 'GMC', 'Travel', 'Personal Accident', 'Topup', 'GPA'];
const HEALTH_SUB_CATEGORIES = ['Individual', 'Floater'];

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

const LIFE_RIDERS = [
  { key: 'rider_health_sickness', label: 'Health+Sickness' },
  { key: 'rider_accident_disability', label: 'Accident+Disability' },
  { key: 'rider_term_rider', label: 'Term' },
  { key: 'rider_other_pwb', label: 'Other (PWB)' },
  { key: 'rider_adb', label: 'Accidental Death Benefit (ADB)' },
  { key: 'rider_atpd', label: 'Accidental Total and Permanent Disability (ATPD)' },
  { key: 'rider_permanent_disability', label: 'Permanent Disability Benefit' },
  { key: 'rider_critical_illness', label: 'Critical Illness' },
  { key: 'rider_waiver_of_premium', label: 'Waiver of Premium' },
  { key: 'rider_terminal_illness', label: 'Terminal Illness' },
];

const PREMIUM_MODES = ['Annual', 'Semi Annual', 'Quarterly', 'Monthly'];
const POLICY_STATUSES = ['Fresh', 'Renewal', 'Other Company Renewal'];
const POLICY_STATUSES_LIFE = ['Fresh', 'Renewal'];
const CUSTOM_OPTION = '__custom__';

const policySchema = z.object({
  insurance_type: z.string().min(1, 'Insurance type is required'),
  company: z.string().min(1, 'Company is required'),
  category: z.string().optional(),
  sub_category: z.string().optional(),
  product_category: z.string().optional(),
  product: z.string().min(1, 'Product is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  primary_phone: z.string().min(10, 'Phone number is required').regex(/^\d{10}$/, 'Enter 10-digit phone number'),
  alternate_phone: z.string().optional(),
  policy_number: z.string().min(1, 'Policy number is required'),
  policy_term: z.coerce.number().min(1, 'Policy term is required'),
  premium_payment_mode: z.string().min(1, 'Premium payment mode is required'),
  ppt_term: z.coerce.number().min(1).optional(),
  sum_assured: z.coerce.number().min(0).optional(),
  sum_insured: z.coerce.number().min(0).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  premium_mode: z.string().min(1, 'Premium mode is required'),
  base_premium: z.coerce.number().min(0, 'Base premium is required'),
  rider_premium: z.coerce.number().min(0),
  rider_health_sickness: z.coerce.number().min(0).optional(),
  rider_accident_disability: z.coerce.number().min(0).optional(),
  rider_term_rider: z.coerce.number().min(0).optional(),
  rider_other_pwb: z.coerce.number().min(0).optional(),
  rider_adb: z.coerce.number().min(0).optional(),
  rider_atpd: z.coerce.number().min(0).optional(),
  rider_permanent_disability: z.coerce.number().min(0).optional(),
  rider_critical_illness: z.coerce.number().min(0).optional(),
  rider_waiver_of_premium: z.coerce.number().min(0).optional(),
  rider_terminal_illness: z.coerce.number().min(0).optional(),
  number_of_lives: z.coerce.number().min(0).optional(),
  health_rider: z.string().optional(),
  policy_status: z.string().min(1, 'Policy status is required'),
  agent_name: z.string().min(1, 'Agent name is required'),
  location: z.string().optional(),
  location_id: z.number().optional(),
  vehicle_number: z.string().optional(),
  vehicle_year: z.coerce.number().optional(),
  vehicle_model: z.string().optional(),
  owner_name: z.string().optional(),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface GeneralRiderDraft {
  sum_insured: number;
  premium: number;
  excess_type: 'percentage' | 'amount';
  excess_value: number;
}

const emptyGeneralRiderDraft = (): GeneralRiderDraft => ({
  sum_insured: 0,
  premium: 0,
  excess_type: 'percentage',
  excess_value: 0,
});

export function AddPolicyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dynamicProducts, setDynamicProducts] = useState<ProductMaster[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [riderValues, setRiderValues] = useState<Record<string, number>>({});
  const [riderEnabled, setRiderEnabled] = useState<Record<string, boolean>>({});
  const [fieldMembers, setFieldMembers] = useState<FieldMember[]>([]);
  const [generalRiders, setGeneralRiders] = useState<GeneralRider[]>([]);
  const [selectedGeneralRiders, setSelectedGeneralRiders] = useState<Record<number, GeneralRiderDraft>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [customCategory, setCustomCategory] = useState('');
  const [customSubCategory, setCustomSubCategory] = useState('');
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    unregister,
    formState: { errors },
  } = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      insurance_type: '',
      company: '',
      category: '',
      sub_category: '',
      product_category: '',
      product: '',
      customer_name: '',
      primary_phone: '',
      alternate_phone: '',
      policy_number: '',
      policy_term: 1,
      premium_payment_mode: 'Regular',
      ppt_term: undefined,
      sum_assured: undefined,
      start_date: '',
      end_date: '',
      premium_mode: 'Annual',
      base_premium: 0,
      rider_premium: 0,
      rider_health_sickness: 0,
      rider_accident_disability: 0,
      rider_term_rider: 0,
      rider_other_pwb: 0,
      rider_adb: 0,
      rider_atpd: 0,
      rider_permanent_disability: 0,
      rider_critical_illness: 0,
      rider_waiver_of_premium: 0,
      rider_terminal_illness: 0,
      number_of_lives: undefined,
      health_rider: '',
      policy_status: 'Fresh',
      agent_name: 'John Agent',
      location: user?.location || '',
      location_id: user?.location_id || undefined,
      vehicle_number: '',
      vehicle_year: new Date().getFullYear(),
      vehicle_model: '',
      owner_name: '',
    },
  });

  const insuranceType = watch('insurance_type');
  const company = watch('company');
  const category = watch('category');
  const sub_category = watch('sub_category');
  const product_category = watch('product_category');
  const product = watch('product');
  const premiumPaymentMode = watch('premium_payment_mode');
  const policyTerm = Number(watch('policy_term')) || 1;
  const startDate = watch('start_date');
  const basePremium = Number(watch('base_premium')) || 0;
  const riderPremium = Number(watch('rider_premium')) || 0;

  const effectiveCategory = category === CUSTOM_OPTION ? customCategory : category;
  const effectiveSubCategory = sub_category === CUSTOM_OPTION ? customSubCategory : sub_category;
  const showGeneralProductPicker = insuranceType === 'General' && effectiveCategory && effectiveSubCategory;

  const filteredCompanies = companies
    .filter(c => c.insurance_type === insuranceType)
    .map(c => c.name);

  const getAvailableProductNames = (): string[] => {
    return insuranceType === 'Life' ? LIFE_PRODUCTS_FALLBACK 
      : insuranceType === 'Health' ? HEALTH_PRODUCTS_FALLBACK 
      : [];
  };

  const availableProducts = getAvailableProductNames();

  useEffect(() => {
    if (insuranceType === 'Life') {
      setValue('category', 'Non Linked');
    } else {
      setValue('category', '');
    }
   }, [insuranceType, setValue]);

  useEffect(() => {
    if (startDate && policyTerm > 0) {
      const s = new Date(startDate);
      s.setFullYear(s.getFullYear() + policyTerm);
      setValue('end_date', s.toISOString().split('T')[0]);
    }
  }, [startDate, policyTerm, setValue]);

  useEffect(() => {
    if (premiumPaymentMode !== 'Limited') {
      unregister('ppt_term');
    }
  }, [premiumPaymentMode, unregister]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!insuranceType) {
        setDynamicProducts([]);
        return;
      }
      setProductsLoading(true);
      try {
        const params: any = {};
        params.insurance_type = insuranceType;
        if (company) params.company_name = company;
        if (effectiveCategory) params.category = effectiveCategory;
        if (effectiveSubCategory) params.sub_category = effectiveSubCategory;
        if (product_category) params.product_category = product_category;
        
        const data = await productService.getProducts(params);
        setDynamicProducts(data);
      } catch (err) {
        console.error('Failed to load products');
        setDynamicProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, [insuranceType, company, effectiveCategory, effectiveSubCategory, product_category]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await companyService.getCompanies();
        setCompanies(data);
      } catch (err) {
        console.error('Failed to load companies');
      }
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    fieldMemberService.getFieldMembers().then(setFieldMembers).catch(() => {});
  }, []);

  useEffect(() => {
    if (insuranceType === 'General' && effectiveCategory) {
      generalRiderService.getGeneralRiders(effectiveCategory)
        .then(setGeneralRiders)
        .catch(() => setGeneralRiders([]));
    } else {
      setGeneralRiders([]);
      setSelectedGeneralRiders({});
    }
  }, [insuranceType, effectiveCategory]);

  useEffect(() => {
    if (!insuranceType) {
      setCustomFields([]);
      setCustomFieldValues({});
      return;
    }
    customFieldService
      .getCustomFields({ insuranceType })
      .then(setCustomFields)
      .catch(() => setCustomFields([]));
  }, [insuranceType]);

  useEffect(() => {
    if (insuranceType === 'General') {
      const total = Object.values(selectedGeneralRiders).reduce((sum, r) => sum + (r.premium || 0), 0);
      setValue('rider_premium', total);
    } else {
      const total = Object.values(riderValues).reduce((sum, v) => sum + (v || 0), 0);
      setValue('rider_premium', total);
    }
  }, [riderValues, selectedGeneralRiders, insuranceType, setValue]);

  const calculateGST = () => {
    if (insuranceType === 'General') {
      return (basePremium + riderPremium) * 0.18;
    }
    if (insuranceType === 'Health' && product_category === 'GPA') {
      return basePremium * 0.18;
    }
    return 0;
  };

  const totalPremium = basePremium + riderPremium + calculateGST();

  const onSubmit = async (data: PolicyFormData) => {
    setIsLoading(true);
    
    try {
      const payload: any = {
        ...data,
        category: data.category === CUSTOM_OPTION ? customCategory : (data.category || ''),
        sub_category: data.sub_category === CUSTOM_OPTION ? customSubCategory : (data.sub_category || ''),
        product_category: data.product_category || '',
      };
      if (data.insurance_type === 'Health') {
        payload.sum_insured = data.sum_insured || 0;
        payload.sum_assured = undefined;
        payload.rider_premium = 0;
        payload.premium_payment_mode = undefined;
        payload.ppt_term = undefined;
      }
      if (data.insurance_type === 'Life') {
        LIFE_RIDERS.forEach(rider => {
          payload[rider.key] = riderValues[rider.key] || 0;
        });
        payload.sum_insured = undefined;
      }
      if (data.insurance_type === 'General') {
        payload.general_riders = Object.entries(selectedGeneralRiders).map(([riderId, draft]) => ({
          rider_id: Number(riderId),
          sum_insured: draft.sum_insured,
          premium: draft.premium,
          excess_type: draft.excess_type,
          excess_value: draft.excess_value,
          excess_amount: draft.excess_type === 'percentage' 
            ? (draft.sum_insured * draft.excess_value / 100) 
            : draft.excess_value
        }));
      }
      if (customFields.length > 0) {
        const customValues: Record<string, string> = {};
        for (const field of customFields) {
          const value = (customFieldValues[field.id] || '').trim();
          if (value) {
            customValues[field.id] = value;
          } else if (field.is_required) {
            setToast({ message: `${field.label} is required`, type: 'error' });
            setStep(4);
            setIsLoading(false);
            return;
          }
        }
        payload.custom_values = customValues;
      }
      await policyService.createPolicy(payload);
      setToast({ message: 'Policy created successfully!', type: 'success' });
      setTimeout(() => navigate('/policies'), 1500);
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Failed to create policy', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Insurance Type' },
    { number: 2, title: 'Company' },
    { number: 3, title: 'Category' },
    { number: 4, title: 'Policy Details' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add New Policy</h1>
        <p className="text-muted-foreground">Create a new insurance policy</p>
      </div>

      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all
                  ${step >= s.number 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'}`}
              >
                {step > s.number ? <Check className="h-5 w-5" /> : s.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`h-1 w-12 ${step > s.number ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{steps[step - 1].title}</CardTitle>
          <CardDescription>Step {step} of 4</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Insurance Type</Label>
                  <Controller
                    name="insurance_type"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} onChange={(e) => {
                        field.onChange(e);
                        setValue('company', '');
                        setValue('product', '');
                      }}>
                        <option value="">Select Type</option>
                        {INSURANCE_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </Select>
                    )}
                  />
                  {errors.insurance_type && (
                    <p className="text-sm text-destructive">{errors.insurance_type.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {INSURANCE_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setValue('insurance_type', type);
                        setValue('company', '');
                        setValue('product', '');
                      }}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary
                        ${insuranceType === type ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <span className="text-2xl">
                        {type === 'Life' ? '❤️' : type === 'Health' ? '🏥' : '🛡️'}
                      </span>
                      <span className="text-sm font-medium">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Controller
                    name="company"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} onChange={(e) => field.onChange(e)}>
                        <option value="">Select Company</option>
                        {filteredCompanies.length > 0 ? (
                          filteredCompanies.map((company) => (
                            <option key={company} value={company}>{company}</option>
                          ))
                        ) : (
                          <option value="" disabled>No companies available. Add companies in Companies page.</option>
                        )}
                      </Select>
                    )}
                  />
                  {errors.company && (
                    <p className="text-sm text-destructive">{errors.company.message}</p>
                  )}
                </div>

                {insuranceType === 'Life' && (
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} onChange={(e) => field.onChange(e)}>
                          {LIFE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {insuranceType === 'General' && (
                  <>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Controller
                        name="category"
                        control={control}
                        render={({ field }) => (
                          <Select {...field} onChange={(e) => {
                            field.onChange(e);
                            setValue('sub_category', '');
                            setValue('product', '');
                            setCustomCategory('');
                            setCustomSubCategory('');
                          }}>
                            <option value="">Select Category</option>
                            {GENERAL_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value={CUSTOM_OPTION}>Other (Custom)</option>
                          </Select>
                        )}
                      />
                      {category === CUSTOM_OPTION && (
                        <Input
                          placeholder="Enter custom category name"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                        />
                      )}
                    </div>

                    {(category && category !== CUSTOM_OPTION) || (category === CUSTOM_OPTION && customCategory) ? (
                      <div className="space-y-2">
                        <Label>Product</Label>
                        <Controller
                          name="sub_category"
                          control={control}
                          render={({ field }) => (
                            <Select {...field} onChange={(e) => {
                              field.onChange(e);
                              setValue('product', '');
                              setCustomSubCategory('');
                            }}>
                              <option value="">Select Product</option>
                              {category !== CUSTOM_OPTION && (GENERAL_SUB_CATEGORIES[category] || []).map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                              <option value={CUSTOM_OPTION}>Other (Custom)</option>
                            </Select>
                          )}
                        />
                        {sub_category === CUSTOM_OPTION && (
                          <Input
                            placeholder="Enter custom product name"
                            value={customSubCategory}
                            onChange={(e) => setCustomSubCategory(e.target.value)}
                          />
                        )}
                      </div>
                    ) : null}

                    {showGeneralProductPicker && (
                      <div className="space-y-2">
                        <Label>
                          <div className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            Product
                          </div>
                        </Label>
                        {productsLoading ? (
                          <div className="flex items-center justify-center h-10 border rounded-md">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        ) : (
                          <>
                            {dynamicProducts.length > 0 ? (
                              <Controller
                                name="product"
                                control={control}
                                render={({ field }) => (
                                  <Select {...field} onChange={(e) => field.onChange(e)}>
                                    <option value="">Select Product</option>
                                    {dynamicProducts.map((p) => (
                                      <option key={p.id} value={p.product_name}>{p.product_name}</option>
                                    ))}
                                  </Select>
                                )}
                              />
                            ) : (
                              <Controller
                                name="product"
                                control={control}
                                render={({ field }) => (
                                  <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 border">
                                      No products found for this combination. You can add products in Admin &rarr; Products.
                                    </div>
                                    <Input
                                      placeholder="Enter product name manually..."
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value)}
                                    />
                                  </div>
                                )}
                              />
                            )}
                          </>
                        )}
                        {errors.product && (
                          <p className="text-sm text-destructive">{errors.product.message}</p>
                        )}
                      </div>
                    )}

                    {insuranceType === 'General' && product && (
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          ⚠️ This product has 18% GST
                        </p>
                      </div>
                    )}
                  </>
                )}

                {insuranceType !== 'General' && (
                  <>
                    {insuranceType === 'Health' && product_category === 'Personal Health' && (
                      <div className="space-y-2">
                        <Label>Sub Category</Label>
                        <Controller
                          name="sub_category"
                          control={control}
                          render={({ field }) => (
                            <Select {...field} onChange={(e) => field.onChange(e)}>
                              <option value="">Select Sub Category</option>
                              {HEALTH_SUB_CATEGORIES.map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </Select>
                          )}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          Product Category
                        </div>
                      </Label>
                      <Controller
                        name="product_category"
                        control={control}
                        render={({ field }) => (
                          <Select {...field} onChange={(e) => {
                            field.onChange(e);
                            setValue('product', '');
                          }}>
                            <option value="">Select Category</option>
                            {availableProducts.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>

                    {sub_category && product_category && (
                      <div className="space-y-2">
                        <Label>
                          <div className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            Product
                          </div>
                        </Label>
                        {productsLoading ? (
                          <div className="flex items-center justify-center h-10 border rounded-md">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        ) : (
                          <>
                            {dynamicProducts.length > 0 ? (
                              <Controller
                                name="product"
                                control={control}
                                render={({ field }) => (
                                  <Select {...field} onChange={(e) => field.onChange(e)}>
                                    <option value="">Select Product</option>
                                    {dynamicProducts.map((p) => (
                                      <option key={p.id} value={p.product_name}>{p.product_name}</option>
                                    ))}
                                  </Select>
                                )}
                              />
                            ) : (
                              <Controller
                                name="product"
                                control={control}
                                render={({ field }) => (
                                  <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 border">
                                      No products found for this combination. You can add products in Admin &rarr; Products.
                                    </div>
                                    <Input
                                      placeholder="Enter product name manually..."
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value)}
                                    />
                                  </div>
                                )}
                              />
                            )}
                          </>
                        )}
                        {errors.product && (
                          <p className="text-sm text-destructive">{errors.product.message}</p>
                        )}
                      </div>
                    )}

                    {insuranceType === 'Health' && product_category === 'GPA' && product && (
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          ⚠️ GPA products have 18% GST
                        </p>
                      </div>
                    )}
                    {insuranceType === 'Life' && product && (
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          ℹ️ Life insurance products are GST exempt
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                {(product_category || showGeneralProductPicker) && (
                  <div className="space-y-2">
                    <Label>
                      <div className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        Product
                      </div>
                    </Label>
                    {productsLoading ? (
                      <div className="flex items-center justify-center h-10 border rounded-md">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : (
                      <>
                        {dynamicProducts.length > 0 ? (
                          <Controller
                            name="product"
                            control={control}
                            render={({ field }) => (
                              <Select {...field} onChange={(e) => field.onChange(e)}>
                                <option value="">Select Product</option>
                                {dynamicProducts.map((p) => (
                                  <option key={p.id} value={p.product_name}>{p.product_name}</option>
                                ))}
                              </Select>
                            )}
                          />
                        ) : (
                          <Controller
                            name="product"
                            control={control}
                            render={({ field }) => (
                              <Input
                                placeholder="Enter product name..."
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            )}
                          />
                        )}
                      </>
                    )}
                    {errors.product && (
                      <p className="text-sm text-destructive">{errors.product.message}</p>
                    )}
                  </div>
                )}

                {insuranceType === 'Life' && product_category === 'Group Term Life Insurance(GTLI)' && (
                  <div className="space-y-2">
                    <Label>Number of Lives Covered</Label>
                    <Input type="number" {...register('number_of_lives')} min="1" placeholder="Enter number of lives" />
                    {errors.number_of_lives && (
                      <p className="text-sm text-destructive">{errors.number_of_lives.message}</p>
                    )}
                  </div>
                )}

                <hr className="border-border" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input {...register('customer_name')} placeholder="Enter customer name" />
                    {errors.customer_name && (
                      <p className="text-sm text-destructive">{errors.customer_name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Number</Label>
                    <Input {...register('policy_number')} placeholder="POL/2024/001" />
                    {errors.policy_number && (
                      <p className="text-sm text-destructive">{errors.policy_number.message}</p>
                    )}
                  </div>
                </div>

                {insuranceType === 'General' && effectiveCategory === 'Motor' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vehicle Number</Label>
                        <Input {...register('vehicle_number')} placeholder="TN 01 AB 1234" />
                        {errors.vehicle_number && (
                          <p className="text-sm text-destructive">{errors.vehicle_number.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Vehicle Model</Label>
                        <Input {...register('vehicle_model')} placeholder="e.g., Honda City VX" />
                        {errors.vehicle_model && (
                          <p className="text-sm text-destructive">{errors.vehicle_model.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Year of Manufacture</Label>
                        <Input type="number" {...register('vehicle_year')} min="1990" max={new Date().getFullYear()} />
                        {errors.vehicle_year && (
                          <p className="text-sm text-destructive">{errors.vehicle_year.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Owner Name (if different)</Label>
                        <Input {...register('owner_name')} placeholder="Same as customer" />
                        {errors.owner_name && (
                          <p className="text-sm text-destructive">{errors.owner_name.message}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Phone (Mandatory)</Label>
                    <Input {...register('primary_phone')} placeholder="10-digit mobile number" maxLength={10} />
                    {errors.primary_phone && (
                      <p className="text-sm text-destructive">{errors.primary_phone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Alternate Phone (Optional)</Label>
                    <Input {...register('alternate_phone')} placeholder="10-digit mobile number" maxLength={10} />
                    {errors.alternate_phone && (
                      <p className="text-sm text-destructive">{errors.alternate_phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Term (Years)</Label>
                    <Input type="number" {...register('policy_term')} min="1" />
                    {errors.policy_term && (
                      <p className="text-sm text-destructive">{errors.policy_term.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Premium Mode</Label>
                    <Controller
                      name="premium_mode"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} onChange={(e) => field.onChange(e)}>
                          {PREMIUM_MODES.map((mode) => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {insuranceType === 'Life' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Premium Payment Term</Label>
                      <Controller
                        name="premium_payment_mode"
                        control={control}
                        render={({ field }) => (
                          <Select {...field} onChange={(e) => field.onChange(e)}>
                            <option value="Regular">Regular</option>
                            <option value="Limited">Limited</option>
                          </Select>
                        )}
                      />
                      {errors.premium_payment_mode && (
                        <p className="text-sm text-destructive">{errors.premium_payment_mode.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>PPT (Years)</Label>
                      {premiumPaymentMode === 'Limited' ? (
                        <Input type="number" {...register('ppt_term')} min="1" placeholder="Enter PPT" />
                      ) : (
                        <Input type="number" value={policyTerm} disabled className="bg-muted" />
                      )}
                      {errors.ppt_term && (
                        <p className="text-sm text-destructive">{errors.ppt_term.message}</p>
                      )}
                    </div>
                  </div>
                )}

                {insuranceType === 'Health' ? (
                  <div className="space-y-2">
                    <Label>Sum Insured (₹)</Label>
                    <Input type="number" {...register('sum_insured')} min="0" placeholder="Enter sum insured" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Sum Assured (₹)</Label>
                    <Input type="number" {...register('sum_assured')} min="0" placeholder="Enter sum assured" />
                    {errors.sum_assured && (
                      <p className="text-sm text-destructive">{errors.sum_assured.message}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{insuranceType === 'Health' ? 'Policy Inception Date' : 'Start Date'}</Label>
                    <Input type="date" {...register('start_date')} />
                    {errors.start_date && (
                      <p className="text-sm text-destructive">{errors.start_date.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" {...register('end_date')} disabled={insuranceType === 'Health'} className={insuranceType === 'Health' ? 'bg-muted' : ''} />
                    {errors.end_date && (
                      <p className="text-sm text-destructive">{errors.end_date.message}</p>
                    )}
                  </div>
                </div>

                {insuranceType === 'Health' ? (
                  <div className="space-y-2">
                    <Label>Premium (₹)</Label>
                    <Input type="number" {...register('base_premium')} min="0" placeholder="Enter premium" />
                    {errors.base_premium && (
                      <p className="text-sm text-destructive">{errors.base_premium.message}</p>
                    )}
                    <input type="hidden" {...register('rider_premium')} value={0} />
                  </div>
                ) : insuranceType === 'General' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Premium (₹)</Label>
                      <Input type="number" {...register('base_premium')} min="0" />
                      {errors.base_premium && (
                        <p className="text-sm text-destructive">{errors.base_premium.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Rider Premium (₹)</Label>
                      <Input type="number" value={riderPremium} disabled className="bg-muted" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Premium (₹)</Label>
                      <Input type="number" {...register('base_premium')} min="0" />
                      {errors.base_premium && (
                        <p className="text-sm text-destructive">{errors.base_premium.message}</p>
                      )}
                    </div>
                    {insuranceType !== 'Life' && (
                      <div className="space-y-2">
                        <Label>Rider Premium (₹)</Label>
                        <Input type="number" {...register('rider_premium')} min="0" />
                      </div>
                    )}
                  </div>
                )}

                {insuranceType === 'Health' && (
                  <div className="space-y-2">
                    <Label>Riders <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                    <Input {...register('health_rider')} placeholder="Enter rider details if any" />
                  </div>
                )}

                {insuranceType === 'Life' && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <Label className="font-medium">Rider Premiums</Label>
                    <div className="space-y-2">
                      {LIFE_RIDERS.map((rider) => (
                        <div key={rider.key} className="flex items-center gap-3 p-2 border rounded-md">
                          <input
                            type="checkbox"
                            id={rider.key}
                            checked={riderEnabled[rider.key] || false}
                            onChange={(e) => {
                              setRiderEnabled(prev => ({ ...prev, [rider.key]: e.target.checked }));
                              if (!e.target.checked) {
                                setRiderValues(prev => ({ ...prev, [rider.key]: 0 }));
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={rider.key} className="flex-1 cursor-pointer text-sm">{rider.label}</Label>
                          {riderEnabled[rider.key] && (
                            <Input
                              type="number"
                              min="0"
                              placeholder="Premium"
                              value={riderValues[rider.key] || ''}
                              onChange={(e) => setRiderValues(prev => ({ ...prev, [rider.key]: Number(e.target.value) || 0 }))}
                              className="w-36"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insuranceType === 'General' && generalRiders.length > 0 && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <Label className="font-medium">Riders (Multiple Allowed)</Label>
                    <div className="space-y-4">
                      {generalRiders.map((rider) => (
                        <div key={rider.id} className="border rounded-md p-3">
                          <div className="flex items-center gap-3 mb-3">
                            <input
                              type="checkbox"
                              id={`general-rider-${rider.id}`}
                              checked={selectedGeneralRiders[rider.id] !== undefined}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGeneralRiders(prev => ({ ...prev, [rider.id]: emptyGeneralRiderDraft() }));
                                } else {
                                  setSelectedGeneralRiders(prev => {
                                    const next = { ...prev };
                                    delete next[rider.id];
                                    return next;
                                  });
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`general-rider-${rider.id}`} className="cursor-pointer text-sm font-medium">
                              {rider.name}
                              {rider.description && (
                                <span className="text-muted-foreground text-xs ml-1">({rider.description})</span>
                              )}
                            </Label>
                          </div>
                          {selectedGeneralRiders[rider.id] !== undefined && (
                            <div className="grid grid-cols-2 gap-3 ml-7">
                              <div className="space-y-1">
                                <Label className="text-xs">Sum Insured (₹)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Sum insured"
                                  value={selectedGeneralRiders[rider.id].sum_insured || ''}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setSelectedGeneralRiders(prev => ({
                                      ...prev,
                                      [rider.id]: { ...prev[rider.id], sum_insured: val }
                                    }));
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Premium (₹)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Premium"
                                  value={selectedGeneralRiders[rider.id].premium || ''}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setSelectedGeneralRiders(prev => ({
                                      ...prev,
                                      [rider.id]: { ...prev[rider.id], premium: val }
                                    }));
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Excess/Deductible Type</Label>
                                <Select
                                  value={selectedGeneralRiders[rider.id].excess_type}
                                  onChange={(e) => {
                                    setSelectedGeneralRiders(prev => ({
                                      ...prev,
                                      [rider.id]: { ...prev[rider.id], excess_type: e.target.value as 'percentage' | 'amount' }
                                    }));
                                  }}
                                >
                                  <option value="percentage">Percentage (%)</option>
                                  <option value="amount">Direct Amount (₹)</option>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  {selectedGeneralRiders[rider.id].excess_type === 'percentage' ? 'Excess (%)' : 'Excess (₹)'}
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max={selectedGeneralRiders[rider.id].excess_type === 'percentage' ? 100 : undefined}
                                  placeholder={selectedGeneralRiders[rider.id].excess_type === 'percentage' ? 'e.g., 10' : 'e.g., 5000'}
                                  value={selectedGeneralRiders[rider.id].excess_value || ''}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setSelectedGeneralRiders(prev => ({
                                      ...prev,
                                      [rider.id]: { ...prev[rider.id], excess_value: val }
                                    }));
                                  }}
                                />
                              </div>
                              {selectedGeneralRiders[rider.id].excess_type === 'percentage' && selectedGeneralRiders[rider.id].sum_insured > 0 && (
                                <div className="col-span-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                                  Calculated Excess Amount: ₹{(selectedGeneralRiders[rider.id].sum_insured * selectedGeneralRiders[rider.id].excess_value / 100).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {customFields.length > 0 && (
                  <>
                    <hr className="border-border" />
                    <div className="rounded-lg border border-border p-4 space-y-4">
                      <Label className="font-medium">Additional Details</Label>
                      {customFields.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <Label>
                            {field.label}
                            {field.is_required && <span className="text-destructive"> *</span>}
                          </Label>
                          {field.field_type === 'select' ? (
                            <Select
                              value={customFieldValues[field.id] || ''}
                              onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            >
                              <option value="">Select...</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                              value={customFieldValues[field.id] || ''}
                              onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Status</Label>
                    <Controller
                      name="policy_status"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} onChange={(e) => field.onChange(e)}>
                          {(insuranceType === 'Life' ? POLICY_STATUSES_LIFE : POLICY_STATUSES).map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field Member</Label>
                    <Controller
                      name="agent_name"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} onChange={(e) => {
                          const selected = fieldMembers.find(fm => fm.name === e.target.value);
                          field.onChange(e);
                          if (selected) {
                            setValue('location' as any, selected.location);
                            setValue('location_id' as any, selected.location_id);
                          }
                        }}>
                          <option value="">Select Field Member</option>
                          {fieldMembers.map((fm) => (
                            <option key={fm.id} value={fm.name}>{fm.name} ({fm.location})</option>
                          ))}
                        </Select>
                      )}
                    />
                    {errors.agent_name && (
                      <p className="text-sm text-destructive">{errors.agent_name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={watch('location' as any) || ''} disabled className="bg-muted" />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <h4 className="font-medium mb-2">Premium Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{insuranceType === 'Health' ? 'Premium' : 'Base Premium'}:</span>
                      <span>₹{basePremium.toLocaleString()}</span>
                    </div>
                    {insuranceType !== 'Health' && (
                      <div className="flex justify-between">
                        <span>Rider Premium:</span>
                        <span>₹{riderPremium.toLocaleString()}</span>
                      </div>
                    )}
                    {(insuranceType === 'General' || (insuranceType === 'Health' && product_category === 'GPA')) && (
                      <div className="flex justify-between">
                        <span>GST (18%):</span>
                        <span>₹{calculateGST().toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t border-border pt-2 mt-2">
                      <span>Total Premium:</span>
                      <span>₹{totalPremium.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !insuranceType) ||
                    (step === 2 && !watch('company'))
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" isLoading={isLoading}>
                  Create Policy
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}