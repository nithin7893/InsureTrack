import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { analyticsService } from '../services/api';
import { formatCurrency } from '../utils';
import type { PremiumByCompany, PremiumByType, MonthlyRevenue, AgentPerformance, PremiumByMode } from '../types';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export function AnalyticsPage() {
  const [premiumByCompany, setPremiumByCompany] = useState<PremiumByCompany[]>([]);
  const [premiumByType, setPremiumByType] = useState<PremiumByType[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [premiumByMode, setPremiumByMode] = useState<PremiumByMode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [companyData, typeData, revenueData, agentData, modeData] = await Promise.all([
          analyticsService.getPremiumByCompany(),
          analyticsService.getPremiumByType(),
          analyticsService.getMonthlyRevenue(),
          analyticsService.getAgentPerformance(),
          analyticsService.getPremiumByMode(),
        ]);
        
        setPremiumByCompany(companyData);
        setPremiumByType(typeData);
        setMonthlyRevenue(revenueData);
        setAgentPerformance(agentData);
        setPremiumByMode(modeData);
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Detailed business analytics and insights</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Premium by Company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={premiumByCompany} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(value) => `₹${value / 1000}k`} />
                  <YAxis type="category" dataKey="company" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="premium" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Premium by Insurance Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={premiumByType}
                    dataKey="premium"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
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
            <CardTitle>Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="agent" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="premium" fill="#8b5cf6" name="Premium" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="count" fill="#ec4899" name="Policies" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    name="Revenue"
                    dot={{ fill: '#6366f6', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#ec4899" 
                    strokeWidth={2}
                    name="Policies"
                    dot={{ fill: '#ec4899', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Premium by Payment Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={premiumByMode}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mode" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="premium" fill="#6366f1" name="Premium" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" fill="#10b981" name="Policies" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {premiumByCompany.slice(0, 6).map((company, index) => (
              <div key={company.company} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{company.company}</span>
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                </div>
                <div className="text-2xl font-bold">{formatCurrency(company.premium)}</div>
                <div className="text-sm text-muted-foreground">{company.count} policies</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}