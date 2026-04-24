import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout, UserRole } from "@workspace/api-client-react";
import { Package, LayoutDashboard, Truck, Settings, FileText, Wallet, LogOut, Loader2, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.CLIENTE, UserRole.DRIVER] },
  { title: "Mis pedidos", href: "/orders", icon: Package, roles: [UserRole.CLIENTE] },
  { title: "Crear pedido", href: "/orders/new", icon: Package, roles: [UserRole.CLIENTE] },
  { title: "Pedidos", href: "/orders", icon: Package, roles: [UserRole.ADMIN] },
  { title: "Asignación", href: "/admin", icon: Settings, roles: [UserRole.ADMIN] },
  { title: "Repartidores", href: "/drivers", icon: Users, roles: [UserRole.ADMIN] },
  { title: "Mis entregas", href: "/orders", icon: Truck, roles: [UserRole.DRIVER] },
  { title: "Reportes", href: "/reports", icon: FileText, roles: [UserRole.ADMIN] },
  { title: "Finanzas", href: "/finance", icon: DollarSign, roles: [UserRole.ADMIN] },
  { title: "Billetera", href: "/wallet", icon: Wallet, roles: [UserRole.CLIENTE] },
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

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <Truck className="w-6 h-6" />
            <span>RAPIDOO</span>
          </div>
        </div>
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border">
          <div className="mb-4">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary">
              {user.role}
            </span>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
