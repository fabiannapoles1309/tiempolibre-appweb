import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import OrdersList from "@/pages/orders";
import NewOrder from "@/pages/order-new";
import OrderDetail from "@/pages/order-detail";
import AdminDispatch from "@/pages/admin";
import Drivers from "@/pages/drivers";
import Reports from "@/pages/reports";
import Finance from "@/pages/finance";
import WalletPage from "@/pages/wallet";
import MapPage from "@/pages/map";
import DriverBenefits from "@/pages/driver-benefits";
import DriverRankingPage from "@/pages/driver-ranking";
import IncidentsPage from "@/pages/incidents";
import AdminSubscriptionsPage from "@/pages/admin-subscriptions";
import SubscriptionPage from "@/pages/subscription";
import AdminUsersPage from "@/pages/admin-users";
import AdminCustomerDeliveriesPage from "@/pages/admin-customer-deliveries";
import AdminCashByCustomerPage from "@/pages/admin-cash-by-customer";
import AdminBenefitsConfigPage from "@/pages/admin-benefits-config";
import AdminBenefitsTrackingPage from "@/pages/admin-benefits-tracking";
import AdminClientesPage from "@/pages/admin-clientes";
import AdminDestinatariosPage from "@/pages/admin-destinatarios";
import AdminPackageRequestsPage from "@/pages/admin-package-requests";
import AdminPricingSettingsPage from "@/pages/admin-pricing-settings";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  // SUPERUSER tiene acceso transversal a cualquier ruta protegida.
  if (roles && user.role !== "SUPERUSER" && !roles.includes(user.role)) return <Redirect to="/" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (user) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={() => <PublicRoute component={Login} />} />
      {/* Registro público deshabilitado: las cuentas se crean desde el panel de admin. */}
      <Route path="/register" component={() => <Redirect to="/login" />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={OrdersList} />} />
      <Route path="/orders/new" component={() => <ProtectedRoute component={NewOrder} roles={["CLIENTE", "ADMIN"]} />} />
      <Route path="/orders/:id" component={() => <ProtectedRoute component={OrderDetail} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDispatch} roles={["ADMIN"]} />} />
      <Route path="/drivers" component={() => <ProtectedRoute component={Drivers} roles={["ADMIN"]} />} />
      <Route path="/map" component={() => <ProtectedRoute component={MapPage} roles={["ADMIN"]} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} roles={["ADMIN"]} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={Finance} roles={["ADMIN"]} />} />
      {/* CLIENTE puede ver su saldo de cobranza en efectivo acumulado por las
          entregas de sus envíos. ADMIN mantiene el acceso para visualización. */}
      <Route path="/wallet" component={() => <ProtectedRoute component={WalletPage} roles={["CLIENTE", "ADMIN"]} />} />
      <Route path="/driver/benefits" component={() => <ProtectedRoute component={DriverBenefits} roles={["DRIVER"]} />} />
      <Route path="/driver/ranking" component={() => <ProtectedRoute component={DriverRankingPage} roles={["DRIVER", "ADMIN"]} />} />
      <Route path="/driver/incidents" component={() => <ProtectedRoute component={IncidentsPage} roles={["DRIVER"]} />} />
      <Route path="/admin/incidents" component={() => <ProtectedRoute component={IncidentsPage} roles={["ADMIN"]} />} />
      <Route path="/admin/subscriptions" component={() => <ProtectedRoute component={AdminSubscriptionsPage} roles={["ADMIN"]} />} />
      <Route path="/subscription" component={() => <ProtectedRoute component={SubscriptionPage} roles={["CLIENTE"]} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsersPage} roles={["ADMIN"]} />} />
      <Route path="/admin/customer-deliveries" component={() => <ProtectedRoute component={AdminCustomerDeliveriesPage} roles={["ADMIN"]} />} />
      <Route path="/admin/cash-by-customer" component={() => <ProtectedRoute component={AdminCashByCustomerPage} roles={["ADMIN"]} />} />
      <Route path="/admin/benefits-config" component={() => <ProtectedRoute component={AdminBenefitsConfigPage} roles={["ADMIN"]} />} />
      <Route path="/admin/benefits-tracking" component={() => <ProtectedRoute component={AdminBenefitsTrackingPage} roles={["ADMIN"]} />} />
      <Route path="/admin/clientes" component={() => <ProtectedRoute component={AdminClientesPage} roles={["ADMIN"]} />} />
      <Route path="/admin/destinatarios" component={() => <ProtectedRoute component={AdminDestinatariosPage} roles={["ADMIN"]} />} />
      <Route path="/admin/solicitudes-paquetes" component={() => <ProtectedRoute component={AdminPackageRequestsPage} roles={["ADMIN"]} />} />
      <Route path="/admin/pricing-settings" component={() => <ProtectedRoute component={AdminPricingSettingsPage} roles={["ADMIN"]} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
