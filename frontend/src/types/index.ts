export interface User {
  id: number;
  email: string;
  role: string;
  name: string;
  location?: string;
  location_id?: number;
  is_active: boolean;
  created_at?: string;
}

export interface Company {
  id: number;
  name: string;
  insurance_type: string;
  is_active: boolean;
  created_at?: string;
}

export interface Vehicle {
  id: number;
  vehicle_number: string;
  vehicle_year: number | null;
  vehicle_model: string | null;
  owner_name: string | null;
  created_at: string;
}

export interface PolicyCover {
  id?: number;
  policy_id?: number;
  category: string;
  sub_category: string;
  sum_insured?: number | null;
  premium: number;
}

export interface CustomField {
  id: number;
  label: string;
  insurance_type: string | null;
  field_type: 'text' | 'number' | 'date' | 'select';
  options: string[];
  is_required: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface Policy {
  id: number;
  insurance_type: string;
  company: string;
  category: string;
  sub_category?: string;
  product: string;
  customer_name: string;
  primary_phone: string;
  alternate_phone?: string;
  policy_number: string;
  policy_term: number | null;
  premium_payment_mode: string | null;
  ppt_term: number | null;
  sum_assured: number | null;
  sum_insured: number | null;
  start_date: string;
  end_date: string;
  premium_mode: string;
  base_premium: number;
  rider_premium: number;
  rider_health_sickness: number;
  rider_accident_disability: number;
  rider_term_rider: number;
  rider_other_pwb: number;
  rider_adb: number;
  rider_atpd: number;
  rider_permanent_disability: number;
  rider_critical_illness: number;
  rider_waiver_of_premium: number;
  rider_terminal_illness: number;
  number_of_lives?: number;
  health_rider?: string;
  gst: number;
  total_premium: number;
  policy_status: string;
  agent_name: string;
  location?: string;
  location_id?: number;
  vehicle?: Vehicle;
  covers: PolicyCover[];
  custom_values?: Record<string, string>;
  created_at: string;
}

export interface PolicyFormData {
  insurance_type: string;
  company: string;
  category: string;
  sub_category?: string;
  product: string;
  customer_name: string;
  primary_phone: string;
  alternate_phone?: string;
  policy_number: string;
  policy_term: number;
  premium_payment_mode: string;
  ppt_term?: number;
  sum_assured?: number;
  sum_insured?: number;
  start_date: string;
  end_date: string;
  premium_mode: string;
  base_premium: number;
  rider_premium: number;
  covers?: PolicyCover[];
  rider_health_sickness?: number;
  rider_accident_disability?: number;
  rider_term_rider?: number;
  rider_other_pwb?: number;
  rider_adb?: number;
  rider_atpd?: number;
  rider_permanent_disability?: number;
  rider_critical_illness?: number;
  rider_waiver_of_premium?: number;
  rider_terminal_illness?: number;
  number_of_lives?: number;
  health_rider?: string;
  policy_status: string;
  agent_name: string;
  location?: string;
  location_id?: number;
  vehicle_number?: string;
  vehicle_year?: number;
  vehicle_model?: string;
  owner_name?: string;
  custom_values?: Record<string, string>;
}

export interface PolicyListResponse {
  policies: Policy[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SummaryData {
  total_policies: number;
  total_premium: number;
  life_count: number;
  health_count: number;
  general_count: number;
}

export interface PremiumByType {
  type: string;
  premium: number;
  count: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  count: number;
}

export interface PremiumByCompany {
  company: string;
  premium: number;
  count: number;
}

export interface PremiumByMode {
  mode: string;
  premium: number;
  count: number;
}

export interface AgentPerformance {
  agent: string;
  premium: number;
  count: number;
}

export interface UserFormData {
  email: string;
  password: string;
  name: string;
  role: 'central_admin' | 'branch_admin' | 'agent';
  location_id?: number;
}

export interface Location {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface ProductMaster {
  id: number;
  insurance_type: string;
  company_name?: string;
  category?: string;
  sub_category?: string;
  product_category?: string;
  product_name: string;
  is_active: boolean;
  created_at?: string;
}

export interface GeneralRider {
  id: number;
  name: string;
  description?: string;
  category: string;
  is_active: boolean;
  created_at?: string;
}

export interface FieldMember {
  id: number;
  name: string;
  location: string;
  location_id?: number;
  is_active: boolean;
  approval_status?: string;
  requested_by?: number;
  requested_by_name?: string;
  created_at?: string;
}

export interface CompanyFormData {
  name: string;
  insurance_type: string;
}

export interface Alert {
  policy_id: number;
  customer_name: string;
  primary_phone: string;
  policy_number: string;
  insurance_type: string;
  company: string;
  product: string;
  renewal_date: string;
  days_until_renewal: number;
  total_premium: number;
  status: 'urgent' | 'upcoming' | 'grace' | 'lapsed';
  location: string | null;
  year: number | null;
  grace_until?: string;
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  days_ahead: number;
}

export interface AlertSummary {
  urgent: number;
  upcoming: number;
  grace: number;
  lapsed: number;
  total: number;
}

export interface PolicyHistory {
  id: number;
  policy_id: number;
  action: 'renewed' | 'not_renewed';
  details: Record<string, unknown>;
  renewed_by?: number;
  renewed_by_name?: string;
  created_at: string;
}