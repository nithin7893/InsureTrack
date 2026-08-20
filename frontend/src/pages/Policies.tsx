import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Trash2, Edit, ChevronLeft, ChevronRight, Filter, X, MapPin } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { policyService } from '../services/api';
import { formatCurrency, formatDate } from '../utils';
import { useAuth } from '../hooks/useAuth';
import type { Policy, PolicyListResponse } from '../types';

export function PolicyListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [insuranceType, setInsuranceType] = useState('');
  const [policyStatus, setPolicyStatus] = useState('');
  const [agentName, setAgentName] = useState('');
  const [location, setLocation] = useState('');
  const [minPremium, setMinPremium] = useState('');
  const [maxPremium, setMaxPremium] = useState('');
  const [startDateFrom, setStartDateFrom] = useState('');
  const [startDateTo, setStartDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchPolicies();
  }, [page, sortBy, sortOrder]);

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const response: PolicyListResponse = await policyService.getPolicies({
        page,
        per_page: 10,
        search: search || undefined,
        company: company || undefined,
        insurance_type: insuranceType || undefined,
        policy_status: policyStatus || undefined,
        agent_name: agentName || undefined,
        location: location || undefined,
        min_premium: minPremium ? parseFloat(minPremium) : undefined,
        max_premium: maxPremium ? parseFloat(maxPremium) : undefined,
        start_date_from: startDateFrom || undefined,
        start_date_to: startDateTo || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setPolicies(response.policies);
      setTotal(response.total);
      setTotalPages(response.pages);
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchPolicies();
  };

  const clearFilters = () => {
    setSearch('');
    setCompany('');
    setInsuranceType('');
    setPolicyStatus('');
    setAgentName('');
    setLocation('');
    setMinPremium('');
    setMaxPremium('');
    setStartDateFrom('');
    setStartDateTo('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
    fetchPolicies();
  };

  const hasActiveFilters = company || insuranceType || policyStatus || agentName || location || minPremium || maxPremium || startDateFrom || startDateTo;

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    if (!confirm('This action cannot be undone. Are you absolutely sure?')) return;
    try {
      await policyService.deletePolicy(id);
      fetchPolicies();
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  };

  const handleExport = () => {
    policyService.exportPolicies();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-muted-foreground">Manage all insurance policies</p>
          {user?.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>Location: <strong>{user.location}</strong></span>
            </div>
          )}
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or policy number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch}>Search</Button>
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4 mr-2" />
                  Filters {hasActiveFilters && <span className="ml-2 h-2 w-2 rounded-full bg-primary" />}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Company</Label>
                  <Select value={company} onChange={e => setCompany(e.target.value)}>
                    <option value="">All Companies</option>
                    <option value="LIC">LIC</option>
                    <option value="HDFC Life">HDFC Life</option>
                    <option value="SBI Life">SBI Life</option>
                    <option value="ICICI Lombard">ICICI Lombard</option>
                    <option value="Care">Care</option>
                    <option value="Star Health">Star Health</option>
                    <option value="New India">New India</option>
                    <option value="Tata AIG">Tata AIG</option>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Insurance Type</Label>
                  <Select value={insuranceType} onChange={e => setInsuranceType(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="Life">Life</option>
                    <option value="Health">Health</option>
                    <option value="General">General</option>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Policy Status</Label>
                  <Select value={policyStatus} onChange={e => setPolicyStatus(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="Fresh">Fresh</option>
                    <option value="Renewal">Renewal</option>
                    <option value="Other Company Renewal">Other Company Renewal</option>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Agent Name</Label>
                  <Input
                    placeholder="Filter by agent..."
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                </div>
                {user?.role === 'central_admin' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Input
                    placeholder="Filter by location..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Min Premium</Label>
                  <Input
                    type="number"
                    placeholder="Min amount"
                    value={minPremium}
                    onChange={(e) => setMinPremium(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Premium</Label>
                  <Input
                    type="number"
                    placeholder="Max amount"
                    value={maxPremium}
                    onChange={(e) => setMaxPremium(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Start Date From</Label>
                  <Input
                    type="date"
                    value={startDateFrom}
                    onChange={(e) => setStartDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Start Date To</Label>
                  <Input
                    type="date"
                    value={startDateTo}
                    onChange={(e) => setStartDateTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <select value={`${sortBy}-${sortOrder}`} onChange={(e) => {
                const val = e.target.value;
                const [s, o] = val.split('-');
                setSortBy(s);
                setSortOrder(o);
                setPage(1);
                fetchPolicies();
              }} className="h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="premium-desc">Premium (High to Low)</option>
                <option value="premium-asc">Premium (Low to High)</option>
                <option value="customer_name-asc">Customer (A-Z)</option>
                <option value="customer_name-desc">Customer (Z-A)</option>
                <option value="start_date-desc">Start Date (Newest)</option>
                <option value="start_date-asc">Start Date (Oldest)</option>
              </select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Policy No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>PPT Mode</TableHead>
                  <TableHead>PPT</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : policies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No policies found
                    </TableCell>
                  </TableRow>
                ) : (
                  policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">{policy.customer_name}</TableCell>
                      <TableCell>{policy.policy_number}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                          ${policy.insurance_type === 'Life' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' : 
                            policy.insurance_type === 'Health' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 
                            'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'}`}>
                          {policy.insurance_type}
                        </span>
                      </TableCell>
                      <TableCell>{policy.company}</TableCell>
                      <TableCell>{policy.product}</TableCell>
                      <TableCell>
                        <span className="text-xs">{policy.premium_payment_mode || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{policy.ppt_term != null ? `${policy.ppt_term}y` : '-'}</span>
                      </TableCell>
                      <TableCell>
                        {policy.location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {policy.location}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(policy.total_premium)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                          ${policy.policy_status === 'Fresh' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                            policy.policy_status === 'Renewal' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                          {policy.policy_status}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(policy.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/edit-policy/${policy.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(policy.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, total)} of {total} policies
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}