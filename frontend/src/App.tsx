import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { AddPolicyPage } from './pages/AddPolicy';
import { PolicyListPage } from './pages/Policies';
import { AnalyticsPage } from './pages/Analytics';
import { EditPolicyPage } from './pages/EditPolicy';
import { Companies } from './pages/Companies';
import { UsersManagement } from './pages/Users';
import { LocationsManagement } from './pages/Locations';
import { ProductsManagement } from './pages/Products';
import { FieldMembersManagement } from './pages/FieldMembers';
import { AlertsPage } from './pages/Alerts';
import { GeneralRidersPage } from './pages/GeneralRiders';
import { CustomFields } from './pages/CustomFields';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user?.role !== 'central_admin' && user?.role !== 'branch_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function CentralAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user?.role !== 'central_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="add-policy" element={<AddPolicyPage />} />
        <Route path="policies" element={<PolicyListPage />} />
        <Route path="edit-policy/:id" element={<EditPolicyPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="companies" element={
          <AdminRoute><Companies /></AdminRoute>
        } />
        <Route path="users" element={
          <AdminRoute><UsersManagement /></AdminRoute>
        } />
        <Route path="locations" element={
          <AdminRoute><LocationsManagement /></AdminRoute>
        } />
        <Route path="products" element={
          <AdminRoute><ProductsManagement /></AdminRoute>
        } />
        <Route path="field-members" element={
          <AdminRoute><FieldMembersManagement /></AdminRoute>
        } />
        <Route path="general-riders" element={
          <AdminRoute><GeneralRidersPage /></AdminRoute>
        } />
        <Route path="custom-fields" element={
          <CentralAdminRoute><CustomFields /></CentralAdminRoute>
        } />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
