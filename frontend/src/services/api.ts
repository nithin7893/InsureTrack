import axios from 'axios';
import type { User, Policy, PolicyListResponse, PolicyFormData, SummaryData, PremiumByType, MonthlyRevenue, PremiumByCompany, PremiumByMode, AgentPerformance, Company, CompanyFormData, UserFormData, Location, ProductMaster, FieldMember, AlertListResponse, AlertSummary, PolicyHistory } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, {
          headers: {
            'Authorization': `Bearer ${refreshToken}`,
            'Content-Type': 'application/json',
          },
        });

        const { access_token, refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email: string, password: string, location?: string): Promise<{ access_token: string; refresh_token: string; user: User }> => {
    const response = await api.post('/api/auth/login', { email, password, location });
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  },
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Logout even if server call fails
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },
  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('access_token');
  },
};

export const policyService = {
  getPolicies: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    company?: string;
    insurance_type?: string;
    policy_status?: string;
    agent_name?: string;
    location?: string;
    product?: string;
    min_premium?: number;
    max_premium?: number;
    start_date_from?: string;
    start_date_to?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PolicyListResponse> => {
    const response = await api.get('/api/policies', { params });
    return response.data;
  },
  createPolicy: async (data: PolicyFormData): Promise<Policy> => {
    const response = await api.post('/api/policies', data);
    return response.data;
  },
  getPolicy: async (id: number): Promise<Policy> => {
    const response = await api.get(`/api/policies/${id}`);
    return response.data;
  },
  updatePolicy: async (id: number, data: Partial<PolicyFormData>): Promise<Policy> => {
    const response = await api.put(`/api/policies/${id}`, data);
    return response.data;
  },
  deletePolicy: async (id: number): Promise<void> => {
    await api.delete(`/api/policies/${id}`);
  },
  exportPolicies: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/api/policies/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policies_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

export const analyticsService = {
  getSummary: async (): Promise<SummaryData> => {
    const response = await api.get('/api/analytics/summary');
    return response.data;
  },
  getPremiumByType: async (): Promise<PremiumByType[]> => {
    const response = await api.get('/api/analytics/premium-by-type');
    return response.data;
  },
  getMonthlyRevenue: async (): Promise<MonthlyRevenue[]> => {
    const response = await api.get('/api/analytics/monthly-revenue');
    return response.data;
  },
  getPremiumByCompany: async (): Promise<PremiumByCompany[]> => {
    const response = await api.get('/api/analytics/premium-by-company');
    return response.data;
  },
  getPremiumByMode: async (): Promise<PremiumByMode[]> => {
    const response = await api.get('/api/analytics/premium-by-mode');
    return response.data;
  },
  getAgentPerformance: async (): Promise<AgentPerformance[]> => {
    const response = await api.get('/api/analytics/agent-performance');
    return response.data;
  },
};

export const companyService = {
  getCompanies: async (insurance_type?: string): Promise<Company[]> => {
    const params = insurance_type ? { insurance_type } : {};
    const response = await api.get('/api/companies', { params });
    return response.data;
  },
  createCompany: async (data: CompanyFormData): Promise<Company> => {
    const response = await api.post('/api/companies', data);
    return response.data;
  },
  updateCompany: async (id: number, data: Partial<CompanyFormData>): Promise<Company> => {
    const response = await api.put(`/api/companies/${id}`, data);
    return response.data;
  },
  deleteCompany: async (id: number): Promise<void> => {
    await api.delete(`/api/companies/${id}`);
  },
  getInsuranceTypes: async (): Promise<string[]> => {
    const response = await api.get('/api/companies/types');
    return response.data;
  },
};

export const locationService = {
  getLocations: async (includeInactive = false): Promise<Location[]> => {
    const response = await api.get('/api/locations', { params: { include_inactive: includeInactive } });
    return response.data;
  },
  createLocation: async (name: string): Promise<Location> => {
    const response = await api.post('/api/locations', { name });
    return response.data;
  },
  updateLocation: async (id: number, data: { name?: string; is_active?: boolean }): Promise<Location> => {
    const response = await api.put(`/api/locations/${id}`, data);
    return response.data;
  },
  deleteLocation: async (id: number): Promise<void> => {
    await api.delete(`/api/locations/${id}`);
  },
};

export const productService = {
  getProducts: async (params?: {
    insurance_type?: string;
    company_name?: string;
    category?: string;
    sub_category?: string;
    product_category?: string;
    include_inactive?: boolean;
  }): Promise<ProductMaster[]> => {
    const response = await api.get('/api/products', { params });
    return response.data;
  },
  createProduct: async (data: {
    insurance_type: string;
    company_name?: string;
    category?: string;
    sub_category?: string;
    product_category?: string;
    product_name: string;
  }): Promise<ProductMaster> => {
    const response = await api.post('/api/products', data);
    return response.data;
  },
  updateProduct: async (id: number, data: Partial<ProductMaster>): Promise<ProductMaster> => {
    const response = await api.put(`/api/products/${id}`, data);
    return response.data;
  },
  deleteProduct: async (id: number): Promise<void> => {
    await api.delete(`/api/products/${id}`);
  },
};

export const userService = {
  getUsers: async (includeInactive = false): Promise<User[]> => {
    const response = await api.get('/api/users', { params: { include_inactive: includeInactive } });
    return response.data;
  },
  createUser: async (data: UserFormData): Promise<User> => {
    const response = await api.post('/api/users', data);
    return response.data;
  },
  updateUser: async (id: number, data: Partial<UserFormData> & { is_active?: boolean }): Promise<User> => {
    const response = await api.put(`/api/users/${id}`, data);
    return response.data;
  },
  deactivateUser: async (id: number): Promise<void> => {
    await api.delete(`/api/users/${id}`);
  },
};

export const fieldMemberService = {
  getFieldMembers: async (includeInactive = false, includePending = false): Promise<FieldMember[]> => {
    const response = await api.get('/api/field-members', { params: { include_inactive: includeInactive, include_pending: includePending } });
    return response.data;
  },
  getPendingFieldMembers: async (): Promise<FieldMember[]> => {
    const response = await api.get('/api/field-members', { params: { pending_only: true } });
    return response.data;
  },
  getPendingCount: async (): Promise<number> => {
    const response = await api.get('/api/field-members/pending-count');
    return response.data.count;
  },
  createFieldMember: async (data: { name: string; location_id: number }): Promise<FieldMember> => {
    const response = await api.post('/api/field-members', data);
    return response.data;
  },
  approveFieldMember: async (id: number): Promise<FieldMember> => {
    const response = await api.put(`/api/field-members/${id}/approve`);
    return response.data;
  },
  rejectFieldMember: async (id: number): Promise<FieldMember> => {
    const response = await api.put(`/api/field-members/${id}/reject`);
    return response.data;
  },
  updateFieldMember: async (id: number, data: { name?: string; location_id?: number; is_active?: boolean }): Promise<FieldMember> => {
    const response = await api.put(`/api/field-members/${id}`, data);
    return response.data;
  },
  deactivateFieldMember: async (id: number): Promise<void> => {
    await api.delete(`/api/field-members/${id}`);
  },
};

export const alertService = {
  getAlerts: async (params?: { days?: number; type?: string }): Promise<AlertListResponse> => {
    const response = await api.get('/api/alerts', { params });
    return response.data;
  },
  getSummary: async (): Promise<AlertSummary> => {
    const response = await api.get('/api/alerts/summary');
    return response.data;
  },
  renewPolicy: async (id: number, data: { renewed: boolean } & Partial<PolicyFormData>): Promise<{ message: string; policy: Policy }> => {
    const response = await api.post(`/api/alerts/${id}/renew`, data);
    return response.data;
  },
  getPolicyHistory: async (id: number): Promise<{ history: PolicyHistory[] }> => {
    const response = await api.get(`/api/alerts/${id}/history`);
    return response.data;
  },
};

export interface GeneralRider {
  id: number;
  name: string;
  description?: string;
  category: string;
  is_active: boolean;
  created_at?: string;
}

export const generalRiderService = {
  getGeneralRiders: async (category?: string): Promise<GeneralRider[]> => {
    const params: any = {};
    if (category) params.category = category;
    const response = await api.get('/api/general-riders', { params });
    return response.data;
  },
  createGeneralRider: async (data: { name: string; description?: string; category: string }): Promise<GeneralRider> => {
    const response = await api.post('/api/general-riders', data);
    return response.data;
  },
  updateGeneralRider: async (id: number, data: Partial<GeneralRider>): Promise<GeneralRider> => {
    const response = await api.put(`/api/general-riders/${id}`, data);
    return response.data;
  },
  deleteGeneralRider: async (id: number): Promise<void> => {
    await api.delete(`/api/general-riders/${id}`);
  },
};

export default api;
