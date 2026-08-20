import { useState, useEffect } from 'react';
import { 
  FileText, 
  DollarSign, 
  Heart, 
  Activity, 
  Shield 
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { analyticsService, policyService } from '../services/api';
import { formatCurrency, formatDate } from '../utils';
import type { SummaryData, PremiumByType, MonthlyRevenue, Policy } from '../types';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899'];

export function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [premiumByType, setPremiumByType] = useState<PremiumByType[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [recentPolicies, setRecentPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, premiumData, revenueData, policiesData] = await Promise.all([
          analyticsService.getSummary(),
          analyticsService.getPremiumByType(),
          analyticsService.getMonthlyRevenue(),
          policyService.getPolicies({ per_page: 5, sort_by: 'created_at', sort_order: 'desc' })
        ]);
        
        setSummary(summaryData);
        setPremiumByType(premiumData);
        setMonthlyRevenue(revenueData);
        setRecentPolicies(policiesData.policies);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = [
    { 
      title: 'Total Policies', 
      value: summary?.total_policies || 0, 
      icon: FileText,
      color: 'text-primary'
    },
    { 
      title: 'Total Premium', 
      value: formatCurrency(summary?.total_premium || 0), 
      icon: DollarSign,
      color: 'text-green-500'
    },
    { 
      title: 'Life Insurance', 
      value: summary?.life_count || 0, 
      icon: Heart,
      color: 'text-pink-500'
    },
    { 
      title: 'Health Insurance', 
      value: summary?.health_count || 0, 
      icon: Activity,
      color: 'text-orange-500'
    },
    { 
      title: 'General Insurance', 
      value: summary?.general_count || 0, 
      icon: Shield,
      color: 'text-purple-500'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your insurance business</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="transition-all hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-lg p-3 ${stat.color} bg-opacity-10`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Policy Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={premiumByType}
                    dataKey="premium"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ type, count }) => `${type}: ${count}`}
                  >
                    {premiumByType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Premium by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={premiumByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${value / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="premium" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Policy No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPolicies.map((policy) => (
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
                  <TableCell className="font-medium">{formatCurrency(policy.total_premium)}</TableCell>
                  <TableCell>{formatDate(policy.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}