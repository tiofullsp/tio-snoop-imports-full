"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Badge } from "@/components/common/Badge";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { getCouponUsages } from "@/lib/actions/coupons";
import type { AdminCoupon, CouponUsageRow } from "@/lib/actions/coupons";

interface Props {
  coupon: AdminCoupon | null;
  onClose: () => void;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment:    "Aguardando pagamento",
  payment_confirmed:  "Pagamento confirmado",
  processing:         "Em processamento",
  shipped:            "Enviado",
  delivered:          "Entregue",
  cancelled:          "Cancelado",
  refunded:           "Reembolsado",
};

const ORDER_STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "gold" | "danger"> = {
  pending_payment:   "warning",
  payment_confirmed: "success",
  processing:        "gold",
  shipped:           "gold",
  delivered:         "success",
  cancelled:         "danger",
  refunded:          "neutral",
};

export function UsageHistoryModal({ coupon, onClose }: Props) {
  const [rows, setRows]       = useState<CouponUsageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coupon) return;
    setLoading(true);
    getCouponUsages(coupon.id)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [coupon]);

  const title = coupon
    ? `Histórico: ${coupon.code} — ${coupon.uses_count} uso${coupon.uses_count !== 1 ? "s" : ""}`
    : "Histórico";

  return (
    <Modal
      isOpen={!!coupon}
      onClose={onClose}
      title={title}
      size="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-12 text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando histórico…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">Nenhum uso registrado para este cupom.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-dark-border bg-dark-alt p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-dark-text">
                    #{row.order_number}
                  </span>
                  <Badge
                    label={ORDER_STATUS_LABELS[row.order_status] ?? row.order_status}
                    variant={ORDER_STATUS_VARIANT[row.order_status] ?? "neutral"}
                    size="sm"
                  />
                </div>
                <span className="text-xs text-muted">{formatDateTime(row.created_at)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-muted">Cliente</p>
                  <p className="text-dark-text font-medium truncate">{row.customer_name}</p>
                  <p className="text-muted truncate">{row.customer_email}</p>
                </div>
                <div>
                  <p className="text-muted">Subtotal</p>
                  <p className="text-dark-text font-semibold">{formatCurrency(row.order_subtotal)}</p>
                </div>
                <div>
                  <p className="text-muted">Desconto</p>
                  <p className="text-success font-semibold">−{formatCurrency(row.discount_applied)}</p>
                </div>
                <div>
                  <p className="text-muted">Total pago</p>
                  <p className="text-dark-text font-bold">{formatCurrency(row.order_total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
