import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AppLayout } from "@/components/AppLayout";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import LeadsPage from "@/pages/LeadsPage";
import PipelinePage from "@/pages/PipelinePage";
import ClientsPage from "@/pages/ClientsPage";
import TasksPage from "@/pages/TasksPage";
import ReportsPage from "@/pages/ReportsPage";
import DistributionPage from "@/pages/DistributionPage";
import SettingsPage from "@/pages/SettingsPage";
import AutomationsPage from "@/pages/AutomationsPage";
import HelpPage from "@/pages/HelpPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import WhatsAppConnectionPage from "@/pages/WhatsAppConnectionPage";
import ConversationsPage from "@/pages/ConversationsPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, role, loading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  
  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/dashboard" replace />;
  
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/registro" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
      <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
      <Route path="/distribuicao" element={<ProtectedRoute roles={['admin', 'manager']}><DistributionPage /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/tarefas" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/automacoes" element={<ProtectedRoute roles={['admin']}><AutomationsPage /></ProtectedRoute>} />
      <Route path="/integracoes" element={<ProtectedRoute roles={['admin']}><IntegrationsPage /></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute roles={['admin']}><WhatsAppConnectionPage /></ProtectedRoute>} />
      <Route path="/conversas" element={<ProtectedRoute><ConversationsPage /></ProtectedRoute>} />
      <Route path="/ajuda" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
      
      {/* Super Admin */}
      <Route path="/superadmin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <AppRoutes />
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
