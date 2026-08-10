"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Clock, Package, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/common/Badge";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { OrderStatus } from "@/types";
import type { PublicOrderDetail } from "@/lib/actions/order-lookup";

function actionLabel(status: OrderStatus): string {
  if (status === "shipping_link_pending") return "Pagar o frete";
  if (status === "completed" || status === "cancelled") return "Ver detalhes";
  return "Acompanhar";
}

interface Props {
  order: PublicOrderDetail;
  onSelect: () => void;
}

export function OrderSummaryCard({ order, onSelect }: Props) {
  // Pedido esperando uma ação do cliente ganha destaque dourado pulsante —
  // é o que mais precisa chamar atenção na lista. Finalizado/cancelado fica
  // discreto (opacidade reduzida), já que é passado.
  const isAction = order.status === "shipping_link_pending";
  const isDone = order.status === "completed" || order.status === "cancelled";

  // Mais de um produto: alterna a miniatura entre eles a cada 3s, pra dar pra
  // ver todos sem precisar abrir o pedido — com um só item, fica parado.
  const [thumbIndex, setThumbIndex] = useState(0);
  useEffect(() => {
    if (order.items.length <= 1) return;
    const interval = setInterval(() => {
      setThumbIndex((i) => (i + 1) % order.items.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [order.items.length]);
  const thumbUrl = order.items[thumbIndex]?.product_image;
  // formatDateTime já usa DD/MM/AAAA, HH:mm — só troca a vírgula por "às"
  // pra ficar mais natural de ler no card.
  const dateLabel = formatDateTime(order.created_at).replace(", ", " às ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        "relative flex items-center gap-4 rounded-2xl border p-4 sm:p-5 cursor-pointer overflow-hidden",
        "shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)] transition-all duration-200",
        isAction
          ? "border-accent/45 bg-gradient-to-br from-accent/10 to-dark-surface animate-glow-pulse hover:border-accent-light"
          : isDone
          ? "border-dark-border bg-dark-surface opacity-70 hover:opacity-90"
          : "border-dark-border bg-dark-surface hover:border-dark-border-light hover:bg-dark-hover hover:-translate-y-0.5",
      ].join(" ")}
    >
      {isAction && (
        <div className="pointer-events-none absolute -top-14 -right-14 w-36 h-36 rounded-full bg-accent/15 blur-3xl" />
      )}

      {/* Miniatura */}
      <div
        className={[
          "relative flex-shrink-0 w-14 h-14 rounded-2xl border overflow-hidden flex items-center justify-center",
          isAction ? "bg-accent/15 border-accent/40" : "bg-dark-alt border-dark-border-light",
        ].join(" ")}
      >
        {thumbUrl ? (
          <Image
            key={thumbIndex}
            src={thumbUrl}
            alt=""
            width={56}
            height={56}
            className="object-cover w-full h-full animate-fade-in"
            unoptimized
          />
        ) : (
          <Package size={22} className={isAction ? "text-accent-light" : "text-muted"} />
        )}
      </div>

      {/* Corpo */}
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <p className="font-mono text-xs text-muted tracking-wide">{order.order_number}</p>
          <StatusBadge status={order.status} size="sm" />
        </div>
        <p className={["text-xl font-extrabold tracking-tight mb-0.5", isAction ? "text-accent-light" : "text-dark-text"].join(" ")}>
          {formatCurrency(order.total)}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted flex-wrap">
          <Clock size={12} className="opacity-75 flex-shrink-0" />
          {dateLabel}
          <span className="opacity-45">·</span>
          {order.items.length} {order.items.length === 1 ? "item" : "itens"}
        </p>
      </div>

      {/* CTA — só visual, o card inteiro já é clicável */}
      <span
        className={[
          "relative flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl whitespace-nowrap",
          isAction
            ? "bg-accent text-dark-bg shadow-[0_8px_20px_-8px_rgba(242,183,5,0.55)]"
            : "bg-dark-alt border border-dark-border-light text-dark-text",
        ].join(" ")}
      >
        {actionLabel(order.status)}
        <ChevronRight size={15} />
      </span>
    </div>
  );
}
