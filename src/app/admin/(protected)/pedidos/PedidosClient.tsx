"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { Select } from "@/components/common/Select";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { formatCurrency, formatDate, formatTime } from "@/lib/formatters";
import { updateOrderStatus } from "@/lib/actions/orders";
import { routes } from "@/lib/routes";
import { ORDER_STATUS_LABELS } from "@/types";
import type { OrderStatus } from "@/types";
import type { AdminOrder } from "@/lib/db/orders";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "pending_payment",       label: ORDER_STATUS_LABELS.pending_payment },
  { value: "payment_confirmed",     label: ORDER_STATUS_LABELS.payment_confirmed },
  { value: "shipping_link_pending", label: ORDER_STATUS_LABELS.shipping_link_pending },
  { value: "shipping_paid",         label: ORDER_STATUS_LABELS.shipping_paid },
  { value: "label_issued",          label: ORDER_STATUS_LABELS.label_issued },
  { value: "completed",             label: ORDER_STATUS_LABELS.completed },
  { value: "cancelled",             label: ORDER_STATUS_LABELS.cancelled },
];

interface Props {
  initialOrders: AdminOrder[];
}

export function PedidosClient({ initialOrders }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Mesmo motivo do PedidoClient (detalhe do pedido): status muda pelo lado
  // do cliente a qualquer momento, o admin não deveria precisar de F5 pra ver.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5_000);
    const handleVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [router]);

  // "Aguardando pagamento", "Pedido Finalizado" e "Cancelado" só aparecem na
  // lista quando o admin filtra especificamente por esse status — na visão
  // geral (sem filtro) ficam escondidos, pra não poluir a lista com pedidos
  // que ainda não pagaram, já foram concluídos ou foram cancelados.
  const HIDDEN_BY_DEFAULT: OrderStatus[] = ["pending_payment", "completed", "cancelled"];

  const filtered = initialOrders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q);
    const matchStatus = statusFilter
      ? o.status === statusFilter
      : !HIDDEN_BY_DEFAULT.includes(o.status);
    return matchSearch && matchStatus;
  });

  const handleStatusChange = (orderId: string) => async (newStatus: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(orderId, newStatus);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Pedidos</h1>
        <p className="text-sm text-muted mt-1">
          {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por pedido, cliente ou e-mail..."
          className="flex-1"
        />
        <div className="w-full sm:w-52">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="Filtrar status"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-dark-alt">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Itens</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-dark-text">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-dark-text">{order.customer_name}</div>
                    <div className="text-xs text-muted">{order.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    {formatDate(order.created_at)}
                    <div className="text-[11px] text-muted/70">{formatTime(order.created_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {order.item_count} {order.item_count === 1 ? "item" : "itens"}
                  </td>
                  <td className="px-4 py-3 font-bold text-dark-text whitespace-nowrap">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect
                      currentStatus={order.status}
                      onStatusChange={handleStatusChange(order.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={routes.admin.pedido(order.id)}>
                      <button className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors">
                        <Eye size={14} />
                        Ver
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
