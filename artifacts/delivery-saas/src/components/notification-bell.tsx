﻿import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  unread: number;
  items: NotificationItem[];
}

const API = import.meta.env.VITE_API_URL ?? "";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("tiempolibre_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await apiFetch("/api/me/notifications?limit=20", {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error("notifications fetch failed");
      return r.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/me/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
        headers: authHeaders(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiFetch("/api/me/notifications/read-all", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    return () => setOpen(false);
  }, []);

  const handleClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      try {
        await markRead.mutateAsync(n.id);
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground hover:bg-accent"
          aria-label="Notificaciones"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
              data-testid="badge-notifications-unread"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] p-0"
        data-testid="panel-notifications"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Notificaciones</div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              data-testid="button-mark-all-read"
            >
              {markAllRead.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent transition-colors ${
                  n.isRead ? "opacity-70" : "bg-cyan-50/40"
                }`}
                data-testid={`notification-item-${n.id}`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                      n.isRead ? "bg-transparent" : "bg-[#00B5E2]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1.5">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



