"use client";

import React from "react";
import Image from "next/image";
import { Trash2, Plus, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/cart-store";
import type { CartItem as CartItemType } from "@/types";

interface CartItemProps {
  item: CartItemType;
}

export const CartItem = ({ item }: CartItemProps) => {
  const removeItem     = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  // Economia por desconto de quantidade: base vs unit price efetivo
  const unitSavings     = Math.max(0, item.base_price_pix - item.price_pix);
  const totalSavings    = unitSavings * item.quantity;
  const hasQtyDiscount  = unitSavings > 0;

  return (
    <div className="flex gap-4 py-4 border-b border-dark-border last:border-0">
      {/* Imagem */}
      <div className="relative w-16 h-16 flex-shrink-0 bg-dark-alt rounded-xl overflow-hidden">
        {item.product_image ? (
          <Image
            src={item.product_image}
            alt={item.product_name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
            Sem foto
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-dark-text truncate">{item.product_name}</div>
        {item.variant_size_id && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted">
            {/* "Padrão" é o nome interno usado quando o produto não tem cor
                real (só tamanho) — nunca mostrado pro cliente. */}
            {item.variant_color_name && item.variant_color_name !== "Padrão" && (
              <>
                <span
                  className="w-3 h-3 rounded-full border border-dark-border-light flex-shrink-0"
                  style={{ backgroundColor: item.variant_color_hex }}
                />
                <span>Cor: {item.variant_color_name}</span>
                <span className="text-dark-border">·</span>
              </>
            )}
            <span>Tamanho: {item.variant_size}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {/* Controles de quantidade */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.variant_size_id)}
              className="w-6 h-6 rounded-lg border border-dark-border flex items-center justify-center hover:border-accent/40 hover:bg-dark-hover transition-all"
            >
              <Minus size={12} className="text-muted" />
            </button>
            <span className="w-7 text-center text-sm font-medium text-dark-text tabular-nums">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.variant_size_id)}
              disabled={item.track_stock && item.quantity >= (item.stock ?? 0)}
              className="w-6 h-6 rounded-lg border border-dark-border flex items-center justify-center hover:border-accent/40 hover:bg-dark-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={12} className="text-muted" />
            </button>
          </div>

          {/* Preço */}
          <div className="text-right">
            <div className="text-sm font-bold text-dark-text">
              {formatCurrency(item.price_pix * item.quantity)}
            </div>
            {item.quantity > 1 && (
              <div className="text-xs text-muted">{formatCurrency(item.price_pix)} un.</div>
            )}
            {hasQtyDiscount && (
              <div className="text-xs text-success font-semibold mt-0.5">
                −{formatCurrency(totalSavings)} desc. qty
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Remover */}
      <button
        onClick={() => removeItem(item.product_id, item.variant_size_id)}
        className="self-start text-muted hover:text-danger transition-colors p-1"
        aria-label="Remover item"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};
