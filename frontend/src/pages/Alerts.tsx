import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, AlertCircle, Hourglass, History, CheckCircle2, X, Phone, MapPin } from 'lucide-react';
import { alertService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Toast } from '../components/ui/toast';
import { formatCurrency, formatDate, cn } from '../utils';
import { useAuth } from '../hooks/useAuth';
import type { Alert, AlertSummary, PolicyHistory } from '../types';

const HISTORY_LABELS: Record<string, string> = {
  insurance_type: 'Insurance Type',
  company: 'Company',
  category: 'Category',
  sub_category: 'Sub Category',
  product: 'Product',
  customer_name: 'Customer Name',
  primary_phone: 'Primary Phone',
  alternate_phone: 'Alternate Phone',
  policy_number: 'Policy Number',
  policy_term: 'Policy Term (yrs)',
  premium_payment_mode: 'Premium Payment Mode',
  ppt_term: 'PPT Term',
  number_of_lives: 'Number of Lives',
  sum_assured: 'Sum Assured',
  sum_insured: 'Sum Insured',
  start_date: 'Start Date',
  end_date: 'End Date',
  premium_mode: 'Premium Mode',
  base_premium: 'Base Premium',
  rider_premium: 'Rider Premium',
  gst: 'GST',
  total_premium: 'Total Premium',
  policy_status: 'Policy Status',
  agent_name: 'Agent Name',
  location: 'Location',
};

const DATE_FIELDS = new Set(['start_date', 'end_date', 'created_at']);
const MONEY_FIELDS = new Set(['base_premium', 'rider_premium', 'gst', 'total_premium', 'sum_assured', 'sum_insured']);

export function AlertsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(90);
  const [typeFilter, setTypeFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<{ policyId: number; customer: string; items: PolicyHistory[]; loading: boolean } | null>(null);

  const isCentralAdmin = user?.role === 'central_admin';

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await alertService.getAlerts({ days: daysFilter, type: typeFilter });
      setAlerts(data.alerts);
    } catch {
      setToast({ message: 'Failed to load alerts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await alertService.getSummary();
      setSummary(data);
    } catch {
      console.error('Failed to load summary');
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [daysFilter, typeFilter]);

  useEffect(() => {
    loadSummary();
  }, []);

  const activeAlerts = typeFilter === 'all' ? alerts.filter(a => a.status !== 'lapsed') : alerts;
  const lapsedAlerts = alerts.filter(a => a.status === 'lapsed');

  const handleNotRenewed = async (alert: Alert) => {
    if (!confirm(`Mark policy ${alert.policy_number} (${alert.customer_name}) as not renewed?`)) return;
    try {
      await alertService.renewPolicy(alert.policy_id, { renewed: false });
      setToast({ message: 'Policy marked as not renewed', type: 'success' });
      loadAlerts();
      loadSummary();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Failed to mark policy as not renewed', type: 'error' });
    }
  };

  const openHistory = async (alert: Alert) => {
    setHistory({ policyId: alert.policy_id, customer: alert.customer_name, items: [], loading: true });
    try {
      const data = await alertService.getPolicyHistory(alert.policy_id);
      setHistory({ policyId: alert.policy_id, customer: alert.customer_name, items: data.history, loading: false });
    } catch {
      setHistory(null);
      setToast({ message: 'Failed to load history', type: 'error' });
    }
  };

  const statusConfig: Record<Alert['status'], { label: string; color: string; icon: typeof Clock }> = {
    urgent: { label: 'Urgent', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
    upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
    grace: { label: 'Grace Period', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Hourglass },
    lapsed: { label: 'Lapsed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  };

  const summaryCards = [
    { key: 'upcoming', label: 'Upcoming', icon: Clock, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { key: 'urgent', label: 'Urgent', icon: AlertTriangle, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    { key: 'grace', label: 'Grace Period', icon: Hourglass, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    { key: 'lapsed', label: 'Lapsed', icon: AlertCircle, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    { key: 'total', label: 'Total Alerts', icon: Bell, color: 'bg-primary/10 text-primary' },
  ];

  const renderDaysLeft = (alert: Alert) => {
    const d = alert.days_until_renewal;
    if (alert.status === 'grace') {
      return (
        <span className="font-medium text-orange-600 dark:text-orange-400">
          {Math.abs(d)}d overdue
          {alert.grace_until && (
            <span className="block text-xs text-muted-foreground">grace till {formatDate(alert.grace_until)}</span>
          )}
        </span>
      );
    }
    if (alert.status === 'lapsed') {
      return <span className="font-medium text-red-600 dark:text-red-400">{Math.abs(d)}d lapsed</span>;
    }
    return (
      <span className={cn(
        'font-medium',
        d <= 0 ? 'text-red-600 dark:text-red-400' :
        d <= 30 ? 'text-amber-600 dark:text-amber-400' :
        'text-muted-foreground'
      )}>
        {d <= 0 ? `${Math.abs(d)}d overdue` : `${d}d`}
      </span>
    );
  };

  const renderTable = (rows: Alert[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Policy Number</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
            {isCentralAdmin && (
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Branch</th>
            )}
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Renewal Date</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Days Left</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Premium</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={isCentralAdmin ? 12 : 11} className="px-4 py-10 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((alert, idx) => {
              const cfg = statusConfig[alert.status];
              const StatusIcon = cfg.icon;
              return (
                <tr
                  key={`${alert.policy_id}-${alert.year ?? 'g'}-${idx}`}
                  className="border-b border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      cfg.color
                    )}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{alert.customer_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {alert.primary_phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{alert.policy_number}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                      {alert.insurance_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{alert.company}</td>
                  {isCentralAdmin && (
                    <td className="px-4 py-3">
                      {alert.location && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {alert.location}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">{formatDate(alert.renewal_date)}</td>
                  <td className="px-4 py-3">{renderDaysLeft(alert)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(alert.total_premium)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/edit-policy/${alert.policy_id}?renew=true`)}
                        title="Mark as renewed and update policy details"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Renewed
                      </Button>
                      {alert.status !== 'lapsed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => handleNotRenewed(alert)}
                          title="Mark this policy as not renewed"
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Not Renewed
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openHistory(alert)}
                        title="View previous policy details"
                      >
                        <History className="mr-1 h-3.5 w-3.5" />
                        History
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policy Renewal Alerts</h1>
          <p className="text-muted-foreground">
            {isCentralAdmin ? 'All branch renewal alerts' : 'Branch renewal alerts'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map(({ key, label, icon: Icon, color }) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary[key as keyof AlertSummary] ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Renewal Alerts</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full sm:w-40"
              >
                <option value="all">All Types</option>
                <option value="upcoming">Upcoming</option>
                <option value="urgent">Urgent</option>
                <option value="grace">Grace Period</option>
              </Select>
              <Select
                value={String(daysFilter)}
                onChange={e => setDaysFilter(Number(e.target.value))}
                className="w-full sm:w-40"
              >
                <option value="30">Next 30 days</option>
                <option value="60">Next 60 days</option>
                <option value="90">Next 90 days</option>
                <option value="180">Next 6 months</option>
                <option value="365">Next 1 year</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="mb-3 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">No alerts found</p>
              <p className="text-sm">No policies require renewal in the selected period.</p>
            </div>
          ) : (
            renderTable(activeAlerts, 'No alerts found')
          )}
        </CardContent>
      </Card>

      {typeFilter === 'all' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <CardTitle className="text-lg">Lapsed Policies</CardTitle>
              </div>
              {lapsedAlerts.length > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {lapsedAlerts.length} policy{lapsedAlerts.length !== 1 ? 'ies' : 'y'}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Policies not renewed beyond the 30-day grace period. You can still renew a lapsed policy.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : lapsedAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="mb-3 h-10 w-10 opacity-50" />
                <p className="text-sm">No lapsed policies.</p>
              </div>
            ) : (
              renderTable(lapsedAlerts, 'No lapsed policies')
            )}
          </CardContent>
        </Card>
      )}

      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Policy History</h2>
                <p className="text-sm text-muted-foreground">{history.customer} — previously stored policy details</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setHistory(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {history.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : history.items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-lg font-medium">No history found</p>
                <p className="text-sm">No previous policy details have been stored for this policy.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.items.map(item => (
                  <div key={item.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        item.action === 'renewed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        {item.action === 'renewed' ? 'Renewed' : 'Not Renewed'}
                      </span>
                      {item.renewed_by_name && (
                        <span className="text-muted-foreground">by {item.renewed_by_name}</span>
                      )}
                      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                      {Object.entries(HISTORY_LABELS).map(([key, label]) => {
                        const val = item.details?.[key];
                        if (val === null || val === undefined || val === '') return null;
                        return (
                          <div key={key}>
                            <div className="text-xs text-muted-foreground">{label}</div>
                            <div className="font-medium">
                              {DATE_FIELDS.has(key) ? formatDate(String(val)) :
                               MONEY_FIELDS.has(key) ? formatCurrency(Number(val)) :
                               String(val)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
