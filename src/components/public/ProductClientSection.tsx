"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart, Plus, Minus, CheckCircle2, MessageCircle, Tag, Sparkles, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { useCartStore } from "@/store/cart-store";
import { useToastStore } from "@/store/toast-store";
import { resolveBasePrice, calculateQuantityDiscountPrice } from "@/lib/pricing";
import { formatCurrency } from "@/lib/formatters";
import { generateProductPurchaseWhatsAppLink } from "@/lib/whatsapp";
import type { Product, ProductVariant, ProductVariantSize } from "@/types";

const UNLIMITED_STOCK_CAP = 9999;
const SIZE_REQUIRED_MESSAGE = "Selecione um tamanho para continuar.";

interface ProductClientSectionProps {
  product: Product;
  selectedVariant?: ProductVariant;
  selectedSize?: ProductVariantSize;
  colorSoldOut: boolean;
  whatsappNumber?: string;
}

export const ProductClientSection = ({ product, selectedVariant, selectedSize, colorSoldOut, whatsappNumber }: ProductClientSectionProps) => {
  const [qty, setQty]     = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeWarning, setSizeWarning] = useState(false);
  const { addItem, items } = useCartStore();
  const showToast = useToastStore((s) => s.show);

  const hasVariants = !!product.variants?.length;
  // Cor tem estoque, mas o cliente ainda não escolheu em qual tamanho —
  // trava quantidade/compra até ele escolher, em vez de assumir um tamanho.
  const sizeRequired = hasVariants && !selectedSize;

  const isAvailable = hasVariants
    ? !colorSoldOut
    : product.availability !== "out_of_stock";
  const inCart = items.find(
    (i) => i.product_id === product.id && (i.variant_size_id ?? null) === (selectedSize?.id ?? null)
  )?.quantity ?? 0;
  const stockLimit = hasVariants
    ? (selectedSize?.stock ?? 0)
    : product.track_stock ? (product.stock ?? 0) : UNLIMITED_STOCK_CAP;
  const maxAddable  = sizeRequired ? 1 : Math.max(0, stockLimit - inCart);

  // Volta a quantidade para 1 ao trocar de cor/tamanho — evita carregar uma
  // quantidade que excede o estoque da nova variação selecionada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setQty(1); }, [selectedSize?.id]);

  // O aviso de tamanho some sozinho assim que o cliente escolhe um.
  useEffect(() => {
    if (selectedSize) setSizeWarning(false);
  }, [selectedSize]);

  // ── Preço base efetivo (mesma lógica usada pelo cart-store e checkout) ────
  // Nunca usa price_tiers para derivar step — o step é sempre 10.
  const basePrice = resolveBasePrice(product);
  const hasTiers  = product.quantity_pricing_enabled && (product.price_tiers?.length ?? 0) > 0;

  const result = calculateQuantityDiscountPrice({
    basePrice,
    quantity:         qty,
    discountPerLevel: hasTiers ? 10 : 0,
  });

  // Preço cartão (sem desconto por quantidade — benefício exclusivo Pix)
  const totalCard = product.price_card * qty;

  // Economia Pix vs cartão
  const pixVsCardSavings = (product.price_card - result.unitPrice) * qty;

  const variantImage = selectedVariant?.media.find((m) => m.is_main) ?? selectedVariant?.media[0];
  const mainImage = product.media?.find((m) => m.type === "image" && m.is_main) ?? product.media?.[0];

  // ── Add to cart ──────────────────────────────────────────────────────────
  // base_price_pix = preço para qty=1 (fonte de verdade do cart-store).
  // cart-store recalcula price_pix com calculateQuantityDiscountPrice a cada
  // mudança de quantidade, garantindo consistência.
  const handleAdd = () => {
    if (hasVariants && (!selectedVariant || !selectedSize)) {
      setSizeWarning(true);
      return;
    }
    const qtyToAdd = Math.min(qty, maxAddable);
    if (qtyToAdd <= 0) return;
    addItem({
      product_id:     product.id,
      product_name:   product.name,
      product_slug:   product.slug,
      product_sku:    product.sku,
      product_image:  hasVariants ? variantImage?.url : mainImage?.url,
      price_pix:      basePrice,
      base_price_pix: basePrice,
      price_tiers:    product.quantity_pricing_enabled ? product.price_tiers : undefined,
      price_card:     product.price_card,
      quantity:       qtyToAdd,
      track_stock:    hasVariants ? true : product.track_stock,
      stock:          hasVariants ? (selectedSize?.stock ?? 0) : product.stock,
      variant_size_id:    selectedSize?.id,
      variant_color_name: selectedVariant?.color_name,
      variant_color_hex:  selectedVariant?.color_hex,
      variant_size:       selectedSize?.size,
      variant_sku:        selectedSize?.sku,
    });
    setQty(1);
    setAdded(true);
    showToast(product.name);
    setTimeout(() => setAdded(false), 2000);
  };

  // ── Bloco de preço — atualiza em tempo real a cada mudança de qty ────────
  const priceBlock = (
    <div className="pl-4 border-l-2 border-accent/60 py-3 pr-5 bg-dark-surface/60 rounded-r-2xl border border-dark-border space-y-1.5">

      {/* Preço PIX total */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-dark-text">{formatCurrency(result.total)}</span>
        <span className="text-sm text-muted font-medium">no Pix</span>
      </div>

      {/* Economia Pix vs cartão */}
      {pixVsCardSavings > 0 && (
        <p className="text-sm text-success font-medium">
          Economize {formatCurrency(pixVsCardSavings)} pagando no Pix
        </p>
      )}

      {/* Preço cartão */}
      <p className="text-sm text-muted">{formatCurrency(totalCard)} no cartão de crédito</p>

      {/* Detalhes quando qty > 1 */}
      {qty > 1 && (
        <div className="pt-1.5 border-t border-dark-border/40 space-y-0.5">
          <p className="text-xs text-muted">
            Preço unitário:{" "}
            <span className="font-semibold text-dark-text">{formatCurrency(result.unitPrice)}</span>
          </p>
          <p className="text-xs text-muted">
            Total para {qty} unidades:{" "}
            <span className="font-semibold text-dark-text">{formatCurrency(result.total)}</span>
          </p>
          {result.savings > 0 && (
            <p className="text-xs text-success font-semibold">
              Você economiza {formatCurrency(result.savings)} neste combo
            </p>
          )}
        </div>
      )}

      {/* Badge de desconto por quantidade */}
      {result.unitSavings > 0 && (
        <div className="flex items-start gap-1.5 pt-1 border-t border-dark-border/50">
          <Tag size={12} className="text-accent flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-accent leading-snug">
            Desconto por quantidade aplicado
          </p>
        </div>
      )}
    </div>
  );

  // ── Botão WhatsApp ───────────────────────────────────────────────────────
  // Mensagem já inclui cor/tamanho escolhidos, quantidade e valor — não é
  // mais a dúvida genérica de antes.
  const whatsappHref = generateProductPurchaseWhatsAppLink({
    productName: product.name,
    colorName:   selectedVariant?.color_name,
    size:        selectedSize?.size,
    quantity:    qty,
    total:       result.total,
    storePhone:  whatsappNumber,
  });

  const whatsappBtn = product.allow_whatsapp && (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-whatsapp/25 text-whatsapp hover:bg-whatsapp/10 hover:border-whatsapp/40 transition-all text-sm font-semibold"
    >
      <MessageCircle size={17} />
      Comprar via WhatsApp
    </a>
  );

  // No fluxo normal de compra, exige tamanho antes de abrir o WhatsApp — mas
  // continua sendo um <a> de verdade (abre em nova aba, pode copiar link),
  // só intercepta o clique quando falta escolher o tamanho.
  const handleWhatsAppClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (sizeRequired) {
      e.preventDefault();
      setSizeWarning(true);
    }
  };

  if (!isAvailable) {
    return (
      <div className="space-y-4">
        {priceBlock}
        <Button variant="secondary" fullWidth size="lg" disabled>Produto indisponível</Button>
        {whatsappBtn}
      </div>
    );
  }

  if (!sizeRequired && maxAddable <= 0) {
    return (
      <div className="space-y-4">
        {priceBlock}
        <Button variant="secondary" fullWidth size="lg" disabled>Quantidade máxima no carrinho</Button>
        {whatsappBtn}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {priceBlock}

      {/* Seletor de quantidade */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted">Quantidade:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQty((p) => Math.max(1, p - 1))}
            disabled={qty <= 1}
            className="w-9 h-9 rounded-lg border border-dark-border flex items-center justify-center hover:border-accent/40 hover:bg-dark-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus size={14} className="text-muted" />
          </button>
          <span className="w-10 text-center font-bold text-dark-text tabular-nums text-base">{qty}</span>
          <button
            onClick={() => setQty((p) => Math.min(maxAddable, p + 1))}
            disabled={qty >= maxAddable}
            className="w-9 h-9 rounded-lg border border-dark-border flex items-center justify-center hover:border-accent/40 hover:bg-dark-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} className="text-muted" />
          </button>
        </div>
        <span className="text-xs text-muted">
          {sizeRequired
            ? "Selecione um tamanho para ver o estoque"
            : !hasVariants && !product.track_stock
            ? "Estoque ilimitado"
            : inCart > 0
            ? `${maxAddable} disponíveis (${inCart} no carrinho)`
            : `${hasVariants ? selectedSize?.stock ?? 0 : product.stock} em estoque`}
        </span>
      </div>

      {/* Aviso de tamanho obrigatório */}
      {sizeWarning && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5">
          <AlertCircle size={15} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger font-medium">{SIZE_REQUIRED_MESSAGE}</p>
        </div>
      )}

      {/* Frase explicativa */}
      {hasTiers && (
        <div className="flex items-start gap-1.5 rounded-xl border border-dark-border bg-dark-surface/50 px-3 py-2.5">
          <Sparkles size={12} className="text-accent flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-snug">
            Cada caixa fica{" "}
            <span className="font-semibold text-accent">{formatCurrency(10)}</span>{" "}
            mais barata por nível de quantidade.
          </p>
        </div>
      )}

      {/* CTA */}
      <Button
        variant={added ? "secondary" : "accent"}
        fullWidth
        size="lg"
        onClick={handleAdd}
        leftIcon={added ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
        className="shadow-[0_6px_24px_rgba(242,183,5,0.3)]"
      >
        {added
          ? "Adicionado ao carrinho!"
          : qty === 1
          ? "Adicionar ao carrinho"
          : `Adicionar ${qty} unidades — ${formatCurrency(result.total)}`}
      </Button>

      {product.allow_whatsapp && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-whatsapp/25 text-whatsapp hover:bg-whatsapp/10 hover:border-whatsapp/40 transition-all text-sm font-semibold"
        >
          <MessageCircle size={17} />
          Comprar via WhatsApp
        </a>
      )}
    </div>
  );
};
