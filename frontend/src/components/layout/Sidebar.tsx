import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  BarChart3, 
  LogOut,
  Shield,
  Building2,
  Users,
  MapPin,
  Package,
  UserCheck,
  Bell,
  FormInput,
  ClipboardCheck
} from 'lucide-react';
import { cn } from '../../utils';
import { useAuth } from '../../hooks/useAuth';
import { policyApprovalService } from '../../services/api';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/add-policy', label: 'Add Policy', icon: PlusCircle },
  { path: '/policies', label: 'Policies', icon: FileText },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/alerts', label: 'Alerts', icon: Bell },
];

const adminItems = [
  { path: '/companies', label: 'Companies', icon: Building2 },
  { path: '/field-members', label: 'Field Members', icon: UserCheck },
  { path: '/locations', label: 'Locations', icon: MapPin },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/general-riders', label: 'General Riders', icon: Shield },
];

const centralAdminItems = [
  { path: '/users', label: 'Users', icon: Users },
  { path: '/custom-fields', label: 'Custom Fields', icon: FormInput },
  { path: '/policy-approvals', label: 'Policy Approvals', icon: ClipboardCheck },
];

export function Sidebar() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const isAdmin = user?.role === 'central_admin' || user?.role === 'branch_admin';
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (user?.role !== 'central_admin') {
      setPendingApprovals(0);
      return;
    }
    policyApprovalService.getPendingCount().then(setPendingApprovals).catch(() => {});
  }, [user?.role, location.pathname]);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Shield className="h-8 w-8 text-primary" />
        <span className="text-lg font-bold">InsureTrack</span>
      </div>
      
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
                isActive 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        
        {isAdmin && (
          <>
            <div className="my-4 border-t border-border" />
            <p className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              Admin
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
                    isActive 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            {user?.role === 'central_admin' && (
              <>
                <div className="my-4 border-t border-border" />
                <p className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  Central Admin
                </p>
                {centralAdminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
                        isActive 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                      {item.path === '/policy-approvals' && pendingApprovals > 0 && (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                          {pendingApprovals > 99 ? '99+' : pendingApprovals}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </>
            )}
          </>
        )}
      </nav>
      
      <div className="border-t border-border p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}