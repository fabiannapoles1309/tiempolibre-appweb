import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout, UserRole } from "@workspace/api-client-react";
import { Package, LayoutDashboard, Truck, Settings, FileText, LogOut, Loader2, Users, DollarSign, Map as MapIcon, AlertTriangle, Trophy, Gift, Crown, UserPlus, BarChart3, Banknote, Award, Wallet, BookUser, PackagePlus, Settings2, ShieldCheck, FileSpreadsheet, MessageSquareWarning, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.CLIENTE, UserRole.DRIVER] },
  { title: "Mis envíos", href: "/orders", icon: Package, roles: [UserRole.CLIENTE] },
  { title: "Crear envío", href: "/orders/new", icon: Package, roles: [UserRole.CLIENTE] },
  { title: "Mi billetera", href: "/wallet", icon: Wallet, roles: [UserRole.CLIENTE] },
  { title: "Repartos", href: "/orders", icon: Package, roles: [UserRole.ADMIN] },
  { title: "Asignación", href: "/admin", icon: Settings, roles: [UserRole.ADMIN] },
  { title: "Mapa de zonas", href: "/map", icon: MapIcon, roles: [UserRole.ADMIN] },
  { title: "Repartidores", href: "/drivers", icon: Users, roles: [UserRole.ADMIN] },
  { title: "Mis entregas", href: "/orders", icon: Truck, roles: [UserRole.DRIVER] },
  { title: "Mis beneficios", href: "/driver/benefits", icon: Gift, roles: [UserRole.DRIVER] },
  { title: "Ranking", href: "/driver/ranking", icon: Trophy, roles: [UserRole.DRIVER] },
  { title: "Incidentes", href: "/driver/incidents", icon: AlertTriangle, roles: [UserRole.DRIVER] },
  { title: "Reportes", href: "/reports", icon: FileText, roles: [UserRole.ADMIN] },
  { title: "Finanzas", href: "/finance", icon: DollarSign, roles: [UserRole.ADMIN] },
  { title: "Clientes", href: "/admin/clientes", icon: Users, roles: [UserRole.ADMIN] },
  { title: "Destinatarios", href: "/admin/destinatarios", icon: BookUser, roles: [UserRole.ADMIN] },
  { title: "Solicitudes de paquete", href: "/admin/solicitudes-paquetes", icon: PackagePlus, roles: [UserRole.ADMIN] },
  { title: "Configuración de precios", href: "/admin/pricing-settings", icon: Settings2, roles: [UserRole.ADMIN] },
  { title: "Suscripciones", href: "/admin/subscriptions", icon: Crown, roles: [UserRole.ADMIN] },
  { title: "Envíos por cliente", href: "/admin/customer-deliveries", icon: BarChart3, roles: [UserRole.ADMIN] },
  { title: "Cash por cliente", href: "/admin/cash-by-customer", icon: Banknote, roles: [UserRole.ADMIN] },
  { title: "Beneficios", href: "/admin/benefits-config", icon: Award, roles: [UserRole.ADMIN] },
  { title: "Seguimiento Beneficios", href: "/admin/benefits-tracking", icon: Award, roles: [UserRole.ADMIN] },
  { title: "Crear usuario", href: "/admin/users", icon: UserPlus, roles: [UserRole.ADMIN] },
  { title: "Personal interno", href: "/admin/staff", icon: ShieldCheck, roles: [UserRole.ADMIN] },
  { title: "Reporte combinado", href: "/admin/reports-combined", icon: FileSpreadsheet, roles: [UserRole.ADMIN] },
  { title: "Buzón de quejas", href: "/admin/feedback", icon: Inbox, roles: [UserRole.ADMIN] },
  { title: "Incidentes", href: "/admin/incidents", icon: AlertTriangle, roles: [UserRole.ADMIN] },
  // Quejas y sugerencias accesible a cualquier usuario logueado (cliente / driver / admin).
  { title: "Quejas y sugerencias", href: "/feedback", icon: MessageSquareWarning, roles: [UserRole.CLIENTE, UserRole.DRIVER] },
  // El CLIENTE accede a "Mi billetera" para ver el saldo acumulado por
  // cobros en efectivo que los repartidores hacen al entregar sus envíos.
  // No puede recargar ni gastar saldo: es sólo visualización de cobranza.
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout: clearAuth } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();

  if (!user) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      clearAuth();
    }
  };

  // SUPERUSER (Soporte): perfil de gestión, no operativo. Sólo ve lo que
  // ve un ADMIN. Excluye ítems personales (Mi suscripción, Mis pedidos,
  // Mis beneficios, Billetera) y específicos de DRIVER/CLIENTE.
  const filteredNav =
    user.role === "SUPERUSER"
      ? navItems.filter((item) => item.roles.includes(UserRole.ADMIN))
      : navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#00B5E2] text-white">
        <div className="h-20 flex items-center px-5 bg-white border-b border-[#0096BD]">
          <Logo variant="wordmark" heightPx={36} />
        </div>
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? "bg-white text-[#0096BD] font-semibold shadow-sm"
                    : "text-white/90 hover:bg-white/15 hover:text-white"
                }`}>
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/20">
          <div className="mb-4">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-white/80 truncate">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-[#0096BD]">
              {user.role}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start bg-transparent border-white/40 text-white hover:bg-white hover:text-destructive hover:border-white"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-2 h-14 px-6 border-b bg-background">
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
