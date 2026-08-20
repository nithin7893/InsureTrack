import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { MapPin } from 'lucide-react';

export function Layout() {
  const { user } = useAuth();
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="text-sm text-muted-foreground">
            Welcome back
            {user?.location && (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <MapPin className="h-3 w-3" />
                {user.location}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-muted-foreground capitalize">{user?.role}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}