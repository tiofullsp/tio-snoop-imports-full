"use client";

import React from "react";
import Image from "next/image";
import { ShoppingBag, PackageCheck, Clock } from "lucide-react";
import type { Product } from "@/types";
import { FULFILLMENT_TYPE_LABELS } from "@/types";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { formatCurrency } from "@/lib/formatters";
import { useCartStore } from "@/store/cart-store";
import { useToastStore } from "@/store/toast-store";
import { resolveBasePrice } from "@/lib/pricing";
import { ProductBadge } from "@/components/shared/ProductBadge";

interface ProductCardProps {
  product: Product;
  showCategory?: boolean;
}

export const ProductCard = ({ product, showCategory = false }: ProductCardProps) => {
  const addItem = useCartStore((s) => s.addItem);
  const showToast = useToastStore((s) => s.show);

  const mainImage = product.media?.find((m) => m.is_main && m.type === "image");
  const cardImageShown = mainImage?.url;
  const pixPrice = product.price_pix;
  const hasDiscount =
    product.promotional_active &&
    !!product.price_promotional &&
    product.price_promotional > pixPrice;

  const handleAddToCart = () => {
    if (product.availability === "out_of_stock") return;
    const baseUnitPrice = resolveBasePrice(product);
    addItem({
      product_id:     product.id,
      product_name:   product.name,
      product_slug:   product.slug,
      product_sku:    product.sku,
      product_image:  mainImage?.url,
      price_pix:      baseUnitPrice,
      base_price_pix: baseUnitPrice,
      price_tiers:    product.quantity_pricing_enabled ? product.price_tiers : undefined,
      price_card:     product.price_card,
      quantity:       1,
      track_stock:    product.track_stock,
      stock:          product.stock,
    });
    showToast(product.name);
  };

  return (
    <div
      className="group relative flex flex-col bg-dark-surface border border-dark-border-light rounded-2xl overflow-hidden
        transition-all duration-300 ease-out
        shadow-[0_0_0_1px_rgba(242,183,5,0.08),0_8px_24px_rgba(0,0,0,0.4)]
        hover:border-accent/40 hover:-translate-y-2
        hover:shadow-[0_28px_72px_rgba(0,0,0,0.6),_0_0_0_1px_rgba(242,183,5,0.25)]"
    >
      {/* Topo com brilho sutil no hover */}
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent/40 transition-all duration-500 z-10" />

      {/* Image — proporção 4:5 para mais presença visual */}
      <div className="relative aspect-[4/5] bg-dark-alt overflow-hidden">
        {/* Selo/badge customizado — posição/tamanho livres, configurados no
            admin. Fica DENTRO da área da imagem (que tem overflow-hidden),
            então nunca pode visualmente "escapar" para a seção de texto. */}
        {product.badge_image_url && (
          <ProductBadge
            url={product.badge_image_url}
            posX={product.badge_position_x ?? 50}
            posY={product.badge_position_y ?? 50}
            widthPct={product.badge_width_pct ?? 25}
            className="z-30 pointer-events-none"
          />
        )}

        {cardImageShown ? (
          <Image
            src={cardImageShown}
            alt={mainImage?.alt_text || product.name}
            fill
            className="object-cover group-hover:scale-107 transition-transform duration-700 ease-out"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-3">
            <ShoppingBag size={44} strokeWidth={1} />
            <span className="text-xs text-muted/60">Sem imagem</span>
          </div>
        )}

        {/* Overlay gradiente inferior para legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-surface/80 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.fulfillment_type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark-bg/80 border border-accent/40 text-accent text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">
              {product.fulfillment_type === "pronta_entrega" ? (
                <PackageCheck size={11} />
              ) : (
                <Clock size={11} />
              )}
              {FULFILLMENT_TYPE_LABELS[product.fulfillment_type]}
            </span>
          )}
          {product.is_featured && (
            <Badge label="Destaque" variant="gold" size="sm" />
          )}
          {hasDiscount && (
            <Badge
              label={`-${Math.round(((product.price_promotional! - pixPrice) / product.price_promotional!) * 100)}%`}
              variant="discount"
              size="sm"
            />
          )}
        </div>

        {/* Aviso — imagem meramente ilustrativa (liga/desliga por produto) */}
        {product.show_illustrative_badge && (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <span className="block text-center py-1 rounded-full bg-dark-bg/85 text-danger text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">
              Imagem meramente ilustrativa
            </span>
          </div>
        )}

        {/* Availability overlay for out of stock */}
        {product.availability === "out_of_stock" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <span className="text-white/90 text-sm font-semibold bg-dark-bg/90 px-4 py-2 rounded-xl border border-white/10">
              Indisponível
            </span>
          </div>
        )}

        {/* Low stock */}
        {product.availability === "low_stock" && (
          <div className="absolute bottom-10 left-3 z-10">
            <Badge label="Últimas unidades" variant="warning" size="sm" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 sm:p-4 gap-1.5">
        {showCategory && product.category && (
          <span className="text-[10px] text-accent/70 font-bold uppercase tracking-widest">
            {product.category.name}
          </span>
        )}

        <h3 className="text-xs sm:text-sm font-bold uppercase text-dark-text line-clamp-2 group-hover:text-accent transition-colors duration-200 leading-snug text-center">
          {product.name}
        </h3>

        <p className="text-[11px] text-accent-light/80 leading-relaxed min-h-[2.25rem]">
          {product.short_description}
        </p>

        {/* Preço — Pix em destaque, cartão como referência abaixo */}
        <div className="mt-2">
          <span className="text-base sm:text-xl font-bold text-dark-text tracking-tight">
            {formatCurrency(pixPrice)}
          </span>
          <p className="text-[11px] text-muted/70 mt-0.5">
            ou {formatCurrency(product.price_card)} no cartão
          </p>
        </div>

        <Button
          size="sm"
          fullWidth
          onClick={handleAddToCart}
          disabled={product.availability === "out_of_stock"}
          leftIcon={<ShoppingBag size={13} />}
          className="mt-auto bg-whatsapp text-dark-bg font-bold border-0 hover:bg-whatsapp-dark
            shadow-[0_4px_16px_rgba(37,211,102,0.25)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.4)]"
        >
          {product.availability === "out_of_stock"
            ? "Indisponível"
            : "Adicionar"}
        </Button>
      </div>
    </div>
  );
};
