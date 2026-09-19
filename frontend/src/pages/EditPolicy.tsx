import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { policyService, fieldMemberService, alertService, generalRiderService, customFieldService } from '../services/api';
import type { FieldMember, GeneralRider, CustomField } from '../types';

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

const INSURANCE_TYPES = ['Life', 'Health', 'General'] as const;
const LIFE_COMPANIES = ['LIC', 'HDFC Life', 'Axis Max Life', 'ICICI Prudential', 'GoDigit', 'Bajaj Life', 'SBI Life'];
const HEALTH_COMPANIES = ['Care', 'Star', 'ICICI Lombard', 'New India', 'United India', 'Chola', 'Reliance', 'Tata AIG', 'National Insurance', 'Royal Sundaram', 'HDFC Ergo'];
const GENERAL_COMPANIES = ['ICICI Lombard', 'New India', 'United India', 'Chola', 'Reliance', 'Tata AIG', 'GoDigit', 'National Insurance', 'Oriental', 'Royal Sundaram', 'Magma'];
const LIFE_CATEGORIES = ['Linked', 'Non Linked'];
const PREMIUM_MODES = ['Annual', 'Semi Annual', 'Quarterly', 'Monthly'];
const POLICY_STATUSES = ['Fresh', 'Renewal', 'Other Company Renewal'];
const POLICY_STATUSES_LIFE = ['Fresh', 'Renewal'];

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

  const policySchema = z.object({
    insurance_type: z.string().min(1, 'Insurance type is required'),
    company: z.string().min(1, 'Company is required'),
    category: z.string().optional(),
    sub_category: z.string().optional(),
    product: z.string().min(1, 'Product is required'),
    customer_name: z.string().min(1, 'Customer name is required'),
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
    policy_status: z.string().min(1, 'Policy status is required'),
    agent_name: z.string().min(1, 'Agent name is required'),
    location: z.string().optional(),
    location_id: z.number().optional(),
  });

type PolicyFormData = z.infer<typeof policySchema>;

export function EditPolicyPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isRenew = searchParams.get('renew') === 'true';
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');
  const [riderValues, setRiderValues] = useState<Record<string, number>>({});
  const [riderEnabled, setRiderEnabled] = useState<Record<string, boolean>>({});
  const [fieldMembers, setFieldMembers] = useState<FieldMember[]>([]);
  const [generalRiders, setGeneralRiders] = useState<GeneralRider[]>([]);
  const [selectedGeneralRiders, setSelectedGeneralRiders] = useState<Record<number, GeneralRiderDraft>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  
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
  });

  const insuranceType = watch('insurance_type');
  const premiumPaymentMode = watch('premium_payment_mode');
  const policyTerm = Number(watch('policy_term')) || 1;
  const basePremium = watch('base_premium') || 0;
  const riderPremium = watch('rider_premium') || 0;
  const startDate = watch('start_date');
  const category = watch('category');

  const companies = insuranceType === 'Life' ? LIFE_COMPANIES 
    : insuranceType === 'Health' ? HEALTH_COMPANIES 
    : insuranceType === 'General' ? GENERAL_COMPANIES 
    : [];

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const policy = await policyService.getPolicy(Number(id));
        setValue('insurance_type', policy.insurance_type);
        setValue('company', policy.company);
        setValue('category', policy.category || '');
        setValue('sub_category', policy.sub_category || '');
        setValue('product', policy.product);
        setValue('customer_name', policy.customer_name);
        setValue('policy_number', policy.policy_number);
        setValue('policy_term', policy.policy_term || 1);
        setValue('premium_payment_mode', policy.premium_payment_mode || 'Regular');
        if (policy.premium_payment_mode === 'Limited' && policy.ppt_term) {
          setValue('ppt_term', policy.ppt_term);
        }
        if (policy.sum_assured != null) {
          setValue('sum_assured', policy.sum_assured);
        }
        if (policy.sum_insured != null) {
          setValue('sum_insured', policy.sum_insured);
        }
        setValue('start_date', policy.start_date);
        setValue('end_date', policy.end_date);
        setValue('premium_mode', policy.premium_mode);
        setValue('base_premium', policy.base_premium);
        setValue('rider_premium', policy.rider_premium);
        setValue('number_of_lives' as any, (policy as any).number_of_lives || undefined);
        if (policy.insurance_type === 'Life') {
          const riderFields = [
            'rider_health_sickness', 'rider_accident_disability', 'rider_term_rider',
            'rider_other_pwb', 'rider_adb', 'rider_atpd', 'rider_permanent_disability',
            'rider_critical_illness', 'rider_waiver_of_premium', 'rider_terminal_illness'
          ];
          riderFields.forEach(field => {
            const val = (policy as any)[field] || 0;
            setValue(field as any, val);
          });
          const riderMap: Record<string, number> = {};
          const enabledMap: Record<string, boolean> = {};
          riderFields.forEach(field => {
            const val = (policy as any)[field] || 0;
            riderMap[field] = val;
            enabledMap[field] = val > 0;
          });
          setRiderValues(riderMap);
          setRiderEnabled(enabledMap);
        }
        if (policy.insurance_type === 'General' && Array.isArray((policy as any).riders)) {
          const riderMap: Record<number, GeneralRiderDraft> = {};
          ((policy as any).riders as any[]).forEach((r: any) => {
            if (r.rider_id) {
              riderMap[r.rider_id] = {
                sum_insured: r.sum_insured || 0,
                premium: r.premium || 0,
                excess_type: r.excess_type || 'percentage',
                excess_value: r.excess_value || 0,
              };
            }
          });
          setSelectedGeneralRiders(riderMap);
        }
        setValue('policy_status', isRenew ? 'Renewal' : policy.policy_status);
        setValue('agent_name', policy.agent_name || '');
        if (policy.location) {
          setValue('location' as any, policy.location);
        }
        if (policy.location_id) {
          setValue('location_id' as any, policy.location_id);
        }
        if (policy.custom_values) {
          const initial: Record<string, string> = {};
          Object.entries(policy.custom_values).forEach(([k, v]) => {
            initial[k] = String(v ?? '');
          });
          setCustomFieldValues(initial);
        }
      } catch (error) {
        console.error('Failed to fetch policy:', error);
        setError('Failed to load policy');
      } finally {
        setIsFetching(false);
      }
    };

    if (id) {
      fetchPolicy();
    }
  }, [id, setValue]);

  useEffect(() => {
    if (premiumPaymentMode !== 'Limited') {
      unregister('ppt_term');
    }
  }, [premiumPaymentMode, unregister]);

  useEffect(() => {
    if (startDate && policyTerm > 0) {
      const s = new Date(startDate);
      s.setFullYear(s.getFullYear() + policyTerm);
      setValue('end_date', s.toISOString().split('T')[0]);
    }
  }, [startDate, policyTerm, setValue]);

  useEffect(() => {
    if (insuranceType === 'Life') {
      const riderMap: Record<string, number> = {};
      const enabledMap: Record<string, boolean> = {};
      LIFE_RIDERS.forEach(rider => {
        const val = Number(watch(rider.key as any)) || 0;
        riderMap[rider.key] = val;
        enabledMap[rider.key] = val > 0;
      });
      setRiderValues(riderMap);
      setRiderEnabled(enabledMap);
    }
  }, [insuranceType]);

  useEffect(() => {
    fieldMemberService.getFieldMembers().then(setFieldMembers).catch(() => {});
  }, []);

  useEffect(() => {
    if (insuranceType === 'General' && category) {
      generalRiderService.getGeneralRiders(category)
        .then(setGeneralRiders)
        .catch(() => setGeneralRiders([]));
    } else {
      setGeneralRiders([]);
      setSelectedGeneralRiders({});
    }
  }, [insuranceType, category]);

  useEffect(() => {
    if (!insuranceType) {
      setCustomFields([]);
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
    return 0;
  };

  const totalPremium = basePremium + riderPremium + calculateGST();

  const onSubmit = async (data: PolicyFormData) => {
    setIsLoading(true);
    setError('');
    
    try {
      const payload: any = { ...data };
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
            setError(`${field.label} is required`);
            setIsLoading(false);
            return;
          }
        }
        payload.custom_values = customValues;
      }
      if (isRenew) {
        await alertService.renewPolicy(Number(id), { renewed: true, ...payload });
        navigate('/alerts');
      } else {
        await policyService.updatePolicy(Number(id), payload);
        navigate('/policies');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isRenew ? 'Failed to renew policy' : 'Failed to update policy'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(isRenew ? '/alerts' : '/policies')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isRenew ? 'Renew Policy' : 'Edit Policy'}</h1>
          <p className="text-muted-foreground">
            {isRenew ? 'Update policy details for renewal' : 'Update policy details'}
          </p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{isRenew ? 'Renewal Details' : 'Policy Details'}</CardTitle>
          <CardDescription>
            {isRenew
              ? 'Update the policy details for the renewed term'
              : 'Update the policy information'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            {isRenew && (
              <div className="mb-4 rounded-md bg-primary/10 p-3 text-sm text-primary">
                Renewal mode: the current policy will be updated in place and its old details will be saved to the
                policy history.
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Type</Label>
                  <Controller
                    name="insurance_type"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} onChange={(e) => field.onChange(e)}>
                        {INSURANCE_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Controller
                    name="company"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} onChange={(e) => field.onChange(e)}>
                        <option value="">Select Company</option>
                        {companies.map((company) => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </Select>
                    )}
                  />
                </div>
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
                        }}>
                          <option value="">Select Category</option>
                          {GENERAL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                  {category && (
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Controller
                        name="sub_category"
                        control={control}
                        render={({ field }) => (
                          <Select {...field} onChange={(e) => field.onChange(e)}>
                            <option value="">Select Product</option>
                            {(GENERAL_SUB_CATEGORIES[category] || []).map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>
                  )}
                </>
              )}

              {insuranceType === 'Life' && watch('category') === 'Group Term Life Insurance(GTLI)' && (
                <div className="space-y-2">
                  <Label>Number of Lives Covered</Label>
                  <Input type="number" {...register('number_of_lives')} min="1" placeholder="Enter number of lives" />
                  {errors.number_of_lives && (
                    <p className="text-sm text-destructive">{errors.number_of_lives.message}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Product</Label>
                <Input {...register('product')} placeholder="Enter product name" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input {...register('customer_name')} />
                  {errors.customer_name && (
                    <p className="text-sm text-destructive">{errors.customer_name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input {...register('policy_number')} />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Term (Years)</Label>
                    <Input type="number" {...register('policy_term')} min="1" />
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
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" {...register('end_date')} disabled={insuranceType === 'Health'} className={insuranceType === 'Health' ? 'bg-muted' : ''} />
                </div>
              </div>

              {insuranceType === 'Health' ? (
                <div className="space-y-2">
                  <Label>Premium (₹)</Label>
                  <Input type="number" {...register('base_premium')} min="0" placeholder="Enter premium" />
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
                  </div>
                  {insuranceType !== 'Life' && (
                    <div className="space-y-2">
                      <Label>Rider Premium (₹)</Label>
                      <Input type="number" {...register('rider_premium')} min="0" />
                    </div>
                  )}
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
                              setValue(rider.key as any, 0);
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
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setRiderValues(prev => ({ ...prev, [rider.key]: val }));
                              setValue(rider.key as any, val);
                            }}
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
                  <Label>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </div>
                  </Label>
                  <Input
                    value={watch('location' as any) || ''}
                    disabled
                    className="bg-muted"
                  />
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
                  {insuranceType === 'General' && (
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

            <div className="flex justify-end gap-4 mt-6">
              <Button type="button" variant="outline" onClick={() => navigate(isRenew ? '/alerts' : '/policies')}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {isRenew ? 'Save Renewal' : 'Update Policy'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}