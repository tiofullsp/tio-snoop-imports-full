"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, ShoppingCart, Tag, Volume2, VolumeX, Check } from "lucide-react";
import { getAdminNotifications, type AdminNotification, type AdminNotificationType } from "@/lib/actions/notifications";
import { playNotificationSound } from "@/lib/notification-sound";

const POLL_MS = 30000;
const MUTE_KEY = "admin_notifications_muted";
const DISMISSED_KEY = "admin_notifications_dismissed";

const TYPE_ICON: Record<AdminNotificationType, typeof ShoppingCart> = {
  order: ShoppingCart,
  coupon: Tag,
};

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
}

export function NotificationBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // null = ainda não buscamos nenhuma vez — usado pra não tocar som na
  // primeira carga (senão todo refresh de página tocaria som pros mesmos
  // pedidos/avisos que já existiam antes de abrir o Admin).
  const seenIdsRef = useRef<Set<string> | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMuted(localStorage.getItem(MUTE_KEY) === "1");
    dismissedRef.current = loadDismissed();
  }, []);

  const fetchNotifications = useCallback(async () => {
    const result = await getAdminNotifications();
    if ("error" in result) return;

    // Detecta novidade pelo conjunto BRUTO (antes de filtrar lidas) — uma
    // notificação que já foi vista/marcada como lida não deve tocar som de
    // novo só porque o polling buscou ela outra vez.
    const rawIds = new Set(result.map((n) => n.id));
    if (seenIdsRef.current !== null) {
      const hasNew = result.some((n) => !seenIdsRef.current!.has(n.id));
      if (hasNew && !mutedRef.current) playNotificationSound();
    }
    seenIdsRef.current = rawIds;

    // Limpa do "lidas" qualquer id que não existe mais na busca atual (o
    // problema foi resolvido) — evita que a lista de lidas cresça pra sempre.
    const prunedDismissed = new Set(
      Array.from(dismissedRef.current).filter((id) => rawIds.has(id))
    );
    dismissedRef.current = prunedDismissed;
    saveDismissed(prunedDismissed);

    setItems(result.filter((n) => !prunedDismissed.has(n.id)));
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  };

  // Marca como lida — some da lista (com uma transição rápida) e fica
  // lembrado mesmo se a mesma notificação aparecer de novo num próximo
  // polling, até o problema em si ser resolvido.
  const markAsRead = (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      const next = new Set(dismissedRef.current).add(id);
      dismissedRef.current = next;
      saveDismissed(next);
      setItems((prev) => prev.filter((n) => n.id !== id));
      setRemovingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }, 200);
  };

  const count = items.length;
  const hasNotifications = count > 0;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
          hasNotifications
            ? "bg-success/15 border-success/40 hover:bg-success/20"
            : "bg-dark-alt hover:bg-dark-hover border-dark-border",
        ].join(" ")}
        title="Notificações"
      >
        <Bell size={16} className={hasNotifications ? "text-success" : "text-muted"} />
        {hasNotifications && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative min-w-[19px] h-[19px] px-1 rounded-full bg-success text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-success/40">
              {count > 9 ? "9+" : count}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-dark-surface border border-dark-border-light rounded-2xl shadow-2xl z-30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
            <p className="text-sm font-semibold text-dark-text">Notificações</p>
            <button
              onClick={toggleMute}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-dark-text transition-colors px-2 py-1 rounded-lg hover:bg-dark-hover"
              title={muted ? "Ativar som de notificação" : "Silenciar som de notificação"}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {muted ? "Silenciado" : "Som ativo"}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted px-4">
                <BellOff size={20} className="mx-auto mb-2 opacity-50" />
                Nenhuma notificação por aqui.
              </div>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICON[n.type];
                const removing = removingIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={[
                      "flex items-center gap-2 pl-3 pr-2 border-b border-dark-border last:border-0 transition-all duration-200",
                      removing ? "opacity-0 scale-95 max-h-0 py-0 overflow-hidden" : "opacity-100",
                    ].join(" ")}
                  >
                    <button
                      onClick={() => markAsRead(n.id)}
                      title="Marcar como lida"
                      className="w-5 h-5 rounded-md border-2 border-dark-border-light hover:border-success flex items-center justify-center flex-shrink-0 transition-colors group"
                    >
                      <Check size={12} className="text-transparent group-hover:text-success transition-colors" />
                    </button>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 flex-1 min-w-0 py-3 hover:bg-dark-hover rounded-lg transition-colors -ml-1 pl-1 pr-2"
                    >
                      <div
                        className={[
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          n.severity === "danger" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning",
                        ].join(" ")}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-text break-words">{n.title}</p>
                        <p className="text-xs text-muted break-words">{n.subtitle}</p>
                      </div>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
