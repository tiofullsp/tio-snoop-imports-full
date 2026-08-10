"use client";

import React, { useState, useOptimistic, useTransition } from "react";
import {
  Plus, Edit2, Trash2, Copy, History, ToggleLeft, ToggleRight, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { Toggle } from "@/components/common/Toggle";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { COUPON_TYPE_LABELS } from "@/types";
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponActive,
} from "@/lib/actions/coupons";
import { CouponFormModal } from "./CouponFormModal";
import { UsageHistoryModal } from "./UsageHistoryModal";
import type { AdminCoupon, CouponFormInput } from "@/lib/actions/coupons";

interface Props {
  initialCoupons: AdminCoupon[];
}

function formatValue(type: string, value: number): string {
  if (type === "percentage")   return `${value}%`;
  if (type === "fixed")        return formatCurrency(value);
  if (type === "free_shipping") return "Frete grátis";
  return String(value);
}

function couponStatus(coupon: AdminCoupon): { label: string; variant: "success" | "neutral" | "warning" } {
  const now = new Date();
  if (!coupon.is_active) return { label: "Inativo", variant: "neutral" };
  if (coupon.expiration_date) {
    // Parse como data local e considerar válido até o FIM do dia selecionado.
    // new Date(y, m-1, d+1) = início do dia seguinte local = exato limite de expiração.
    const [y, m, d] = coupon.expiration_date.split("-").map(Number);
    const endOfDay = new Date(y, m - 1, d + 1); // início do próximo dia local
    if (endOfDay <= now) return { label: "Expirado", variant: "warning" };
  }
  if (coupon.max_uses_total != null && coupon.uses_count >= coupon.max_uses_total)
    return { label: "Esgotado", variant: "warning" };
  return { label: "Ativo", variant: "success" };
}

export function CuponsClient({ initialCoupons }: Props) {
  const [coupons, setOptimisticCoupons] = useOptimistic(initialCoupons);
  const [, startTransition]             = useTransition();

  const [formOpen, setFormOpen]             = useState(false);
  const [editing, setEditing]               = useState<AdminCoupon | null>(null);
  const [historyTarget, setHistoryTarget]   = useState<AdminCoupon | null>(null);
  const [copied, setCopied]                 = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null);
  const [actionError, setActionError]       = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const copy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const openCreate = () => {
    setEditing(null);
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditing(coupon);
    setActionError(null);
    setFormOpen(true);
  };

  // ── Server action wrappers ─────────────────────────────────────────────────
  const handleSave = async (input: CouponFormInput): Promise<{ error?: string }> => {
    if (editing) {
      const res = await updateCoupon(editing.id, input);
      if (!res.error) {
        startTransition(() => {
          setOptimisticCoupons((prev) =>
            prev.map((c) =>
              c.id === editing.id
                ? {
                    ...c,
                    code:                  input.code.trim().toUpperCase(),
                    description_internal:  input.description_internal.trim() || null,
                    type:                  input.type,
                    value:                 input.type === "free_shipping" ? 0 : parseFloat(input.value) || 0,
                    is_active:             input.is_active,
                    start_date:            input.start_date || null,
                    expiration_date:       input.expiration_date || null,
                    max_uses_total:        input.max_uses_total ? parseInt(input.max_uses_total, 10) : null,
                    max_uses_per_customer: input.max_uses_per_customer ? parseInt(input.max_uses_per_customer, 10) : null,
                    min_order_value:       input.min_order_value ? parseFloat(input.min_order_value) : null,
                  }
                : c
            )
          );
        });
      }
      return res;
    } else {
      const res = await createCoupon(input);
      return res;
    }
  };

  const handleToggle = (coupon: AdminCoupon) => {
    const next = !coupon.is_active;
    startTransition(async () => {
      setOptimisticCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: next } : c))
      );
      const res = await toggleCouponActive(coupon.id, next);
      if (res.error) setActionError(res.error);
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      setOptimisticCoupons((prev) => prev.filter((c) => c.id !== id));
      const res = await deleteCoupon(id);
      if (res.error) setActionError(res.error);
    });
    setDeleteConfirm(null);
  };

  const activeCoupons   = coupons.filter((c) => c.is_active).length;
  const totalUses       = coupons.reduce((a, c) => a + c.uses_count, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Cupons</h1>
          <p className="text-sm text-muted mt-1">
            {coupons.length} cupons · {activeCoupons} ativos · {totalUses} usos totais
          </p>
        </div>
        <Button variant="accent" leftIcon={<Plus size={16} />} onClick={openCreate}>
          Novo cupom
        </Button>
      </div>

      {/* ── Error feedback ── */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          <AlertCircle size={15} className="flex-shrink-0" />
          {actionError}
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-danger/60 hover:text-danger text-xs underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
        {coupons.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted text-sm">Nenhum cupom cadastrado.</p>
            <button
              onClick={openCreate}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Criar o primeiro cupom
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-alt">
                  {[
                    "Código", "Tipo", "Valor", "Validade",
                    "Usos", "Status", "Ativo", "Ações",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const status = couponStatus(coupon);
                  return (
                    <tr
                      key={coupon.id}
                      className="border-b border-dark-border last:border-0 hover:bg-dark-hover transition-colors"
                    >
                      {/* Código */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-dark-text">
                            {coupon.code}
                          </span>
                          <button
                            onClick={() => copy(coupon.code)}
                            className="text-muted hover:text-accent transition-colors flex-shrink-0"
                            title="Copiar código"
                          >
                            <Copy size={12} />
                          </button>
                          {copied === coupon.code && (
                            <span className="text-xs text-success">Copiado!</span>
                          )}
                        </div>
                        {coupon.description_internal && (
                          <p className="text-xs text-muted mt-0.5 truncate max-w-[180px]">
                            {coupon.description_internal}
                          </p>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {COUPON_TYPE_LABELS[coupon.type]}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3 font-bold text-dark-text whitespace-nowrap">
                        {formatValue(coupon.type, coupon.value)}
                      </td>

                      {/* Validade */}
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {coupon.start_date || coupon.expiration_date ? (
                          <div>
                            {coupon.start_date && (
                              <p>De: {formatDateShort(coupon.start_date)}</p>
                            )}
                            {coupon.expiration_date && (
                              <p>Até: {formatDateShort(coupon.expiration_date)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted/60">Sem validade</span>
                        )}
                      </td>

                      {/* Usos */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-dark-text">
                          {coupon.uses_count}
                          <span className="text-muted font-normal">
                            {" / "}
                            {coupon.max_uses_total ?? "∞"}
                          </span>
                        </div>
                        {coupon.min_order_value != null && (
                          <p className="text-xs text-muted mt-0.5">
                            mín. {formatCurrency(coupon.min_order_value)}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge label={status.label} variant={status.variant} size="sm" />
                      </td>

                      {/* Toggle ativo */}
                      <td className="px-4 py-3">
                        <Toggle
                          checked={coupon.is_active}
                          onChange={() => handleToggle(coupon)}
                          size="sm"
                        />
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Histórico */}
                          <button
                            onClick={() => setHistoryTarget(coupon)}
                            className="text-muted hover:text-accent transition-colors"
                            title="Ver histórico de uso"
                          >
                            <History size={14} />
                          </button>

                          {/* Editar */}
                          <button
                            onClick={() => openEdit(coupon)}
                            className="text-muted hover:text-accent transition-colors"
                            title="Editar cupom"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Excluir */}
                          {deleteConfirm === coupon.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDelete(coupon.id)}
                                className="text-xs text-danger font-semibold hover:underline"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs text-muted hover:text-dark-text"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(coupon.id)}
                              className="text-muted hover:text-danger transition-colors"
                              title="Excluir cupom"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <CouponFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSave={handleSave}
      />

      <UsageHistoryModal
        coupon={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
