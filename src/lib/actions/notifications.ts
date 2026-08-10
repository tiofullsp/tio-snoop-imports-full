"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { routes } from "@/lib/routes";

export type AdminNotificationType = "order" | "coupon";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  severity: "danger" | "warning";
  title: string;
  subtitle: string;
  href: string;
  date: string; // só pra ordenar — não exibido
}

const PENDING_ORDER_STATUSES = ["pending_payment", "shipping_paid"] as const;
const COUPON_EXPIRING_WINDOW_DAYS = 7;
const MAX_PER_TYPE = 8;
const MAX_TOTAL = 20;

// ---------------------------------------------------------------------------
// DADOS DE TESTE — notificações fake pra validar o sino (badge verde, som
// ao chegar, marcar como lida) sem precisar de pedidos/cupons reais.
// Troque para `false` (ou apague o bloco) quando terminar de testar.
// ---------------------------------------------------------------------------
const INCLUDE_TEST_NOTIFICATIONS = true;

function buildTestNotifications(): AdminNotification[] {
  const now = new Date().toISOString();
  return [
    { id: "test-order-1", type: "order", severity: "danger", title: "Pedido #1042", subtitle: "Aguardando etiqueta de envio · Maria Silva", href: routes.admin.pedidos, date: now },
    { id: "test-order-2", type: "order", severity: "warning", title: "Pedido #1041", subtitle: "Pagamento pendente · João Pereira", href: routes.admin.pedidos, date: now },
    { id: "test-coupon-1", type: "coupon", severity: "warning", title: "Cupom BLACKFRIDAY10", subtitle: "Expira em até 7 dias", href: routes.admin.cupons, date: now },
  ];
}

// ---------------------------------------------------------------------------
// Notificações do sino do Admin — sempre o estado ATUAL (não é uma caixa de
// entrada com "lido/não lido"): pedidos que ainda precisam de ação, cupons
// expirando. Some da lista quando o problema é resolvido (pedido confirmado,
// cupom desativado/renovado), não quando o admin só abre o sino.
// ---------------------------------------------------------------------------

export async function getAdminNotifications(): Promise<AdminNotification[] | { error: string }> {
  await requireAdmin(); // leitura — qualquer papel autenticado, inclusive viewer
  const service = createServiceClient();

  const notifications: AdminNotification[] = [];

  // --- Pedidos pendentes ----------------------------------------------------
  const { data: orders } = await service
    .from("orders")
    .select("id, order_number, customer_name, status, created_at")
    .in("status", PENDING_ORDER_STATUSES)
    .order("created_at", { ascending: false })
    .limit(MAX_PER_TYPE);

  for (const o of orders ?? []) {
    notifications.push({
      id: `order-${o.id}`,
      type: "order",
      severity: o.status === "shipping_paid" ? "danger" : "warning",
      title: `Pedido #${o.order_number}`,
      subtitle:
        o.status === "shipping_paid"
          ? `Aguardando etiqueta de envio · ${o.customer_name}`
          : `Pagamento pendente · ${o.customer_name}`,
      href: routes.admin.pedido(o.id),
      date: o.created_at,
    });
  }

  // --- Cupons expirando --------------------------------------------------
  const expiringBefore = new Date(Date.now() + COUPON_EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: coupons } = await service
    .from("coupons")
    .select("id, code, expiration_date")
    .eq("is_active", true)
    .not("expiration_date", "is", null)
    .lte("expiration_date", expiringBefore)
    .order("expiration_date", { ascending: true })
    .limit(MAX_PER_TYPE);

  const now = Date.now();
  for (const c of coupons ?? []) {
    const expired = new Date(c.expiration_date!).getTime() < now;
    notifications.push({
      id: `coupon-${c.id}`,
      type: "coupon",
      severity: expired ? "danger" : "warning",
      title: `Cupom ${c.code}`,
      subtitle: expired ? "Expirado, ainda ativo" : "Expira em até 7 dias",
      href: routes.admin.cupons,
      date: c.expiration_date!,
    });
  }

  if (INCLUDE_TEST_NOTIFICATIONS) notifications.push(...buildTestNotifications());

  notifications.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "danger" ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return notifications.slice(0, MAX_TOTAL);
}
