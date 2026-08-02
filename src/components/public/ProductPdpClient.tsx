"use client";

import React, { useState } from "react";
import { Package, CheckCircle2 } from "lucide-react";
import { ProductGallery } from "@/components/public/ProductGallery";
import { ProductClientSection } from "@/components/public/ProductClientSection";
import { Badge } from "@/components/common/Badge";
import { AVAILABILITY_LABELS } from "@/types";
import type { Product, ProductVariant, ProductMedia } from "@/types";

interface Props {
  product: Product;
  whatsappNumber?: string;
}

// Tamanhos ativos de uma variante — tamanho desativado no admin nunca
// aparece como opção pro cliente, mesmo que ainda tenha estoque > 0.
function activeSizes(variant?: ProductVariant) {
  return variant?.sizes.filter((s) => s.is_active) ?? [];
}

export function ProductPdpClient({ product, whatsappNumber }: Props) {
  // Cor desativada no admin nunca aparece como opção pro cliente.
  const variants = (product.variants ?? []).filter((v) => v.is_active);
  const hasVariants = variants.length > 0;

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(variants[0]?.id);
  // Nenhum tamanho pré-selecionado — o cliente precisa escolher de propósito
  // antes de comprar, em vez de herdar o primeiro tamanho disponível sem ter
  // clicado em nada.
  const [selectedSizeId, setSelectedSizeId] = useState<string | undefined>(undefined);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedSize = selectedVariant?.sizes.find((s) => s.id === selectedSizeId);

  const handleSelectVariant = (v: ProductVariant) => {
    setSelectedVariantId(v.id);
    // Tamanhos diferem por cor — trocar de cor sempre volta a exigir escolha.
    setSelectedSizeId(undefined);
  };

  // Galeria: fotos da cor selecionada, ou as fotos do produto (legado/sem variação)
  const galleryMedia: ProductMedia[] = hasVariants && selectedVariant
    ? selectedVariant.media.map((m) => ({
        id:            m.id,
        product_id:    product.id,
        type:          "image" as const,
        url:           m.url,
        display_order: m.display_order,
        is_main:       m.is_main,
        created_at:    m.created_at,
      }))
    : (product.media ?? []);

  const colorSoldOut = !!selectedVariant && activeSizes(selectedVariant).every((s) => s.stock <= 0);
  // Disponibilidade da COR selecionada (independe de já ter escolhido
  // tamanho) — evita mostrar "Esgotado" só porque o cliente ainda não clicou
  // em nenhum tamanho.
  const isAvailable = hasVariants
    ? !colorSoldOut
    : product.availability !== "out_of_stock";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 mb-20">

      {/* Gallery — key força reset do índice de imagem ao trocar de cor */}
      <div>
        <ProductGallery key={selectedVariant?.id ?? "legacy"} media={galleryMedia} productName={product.name} />
      </div>

      {/* Info */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {product.category && (
            <span className="eyebrow-label">{product.category.name}</span>
          )}
          {product.is_featured && <Badge variant="gold" label="Destaque" />}
          {product.promotional_active && product.price_promotional && (
            <Badge
              variant="discount"
              label={`-${Math.round(
                ((product.price_promotional - product.price_pix) / product.price_promotional) * 100
              )}%`}
            />
          )}
        </div>

        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-dark-text mb-3 leading-tight tracking-tight">
            {product.name}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
            {hasVariants ? (
              <span className={isAvailable ? "text-success font-semibold" : "text-danger font-semibold"}>
                {isAvailable ? "Em estoque" : "Esgotado"}
              </span>
            ) : (
              <>
                <span className={isAvailable ? "text-success font-semibold" : "text-danger font-semibold"}>
                  {AVAILABILITY_LABELS[product.availability]}
                </span>
                {product.track_stock && product.stock !== null && product.stock > 0 && product.stock <= 5 && (
                  <>
                    <span className="text-dark-border">·</span>
                    <span className="text-warning font-semibold">Apenas {product.stock} restantes</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-muted leading-relaxed text-sm">{product.short_description}</p>

        {hasVariants && (
          <div className="space-y-5 border-t border-b border-dark-border/60 py-5">
            {/* Seletor de cor — só faz sentido mostrar quando há mais de uma
                cor pra escolher; com 1 variante só (produto "tamanho único"),
                não há nada pra selecionar aqui. */}
            {variants.length > 1 && (
              <div>
                <p className="text-xs font-medium text-dark-text mb-2.5">
                  Cor selecionada: <span className="text-accent font-semibold">{selectedVariant?.color_name}</span>
                </p>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVariant(v)}
                      title={v.color_name}
                      aria-label={`Cor ${v.color_name}`}
                      className={[
                        "w-9 h-9 rounded-full border-2 transition-all duration-150",
                        v.id === selectedVariantId
                          ? "border-accent scale-110 shadow-[0_0_0_3px_rgba(242,183,5,0.25)]"
                          : "border-dark-border hover:border-accent/50",
                      ].join(" ")}
                      style={{ backgroundColor: v.color_hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Seletor de tamanho */}
            <div>
              <p className="text-xs font-medium text-dark-text mb-2.5">
                {colorSoldOut
                  ? (variants.length > 1 ? "Cor esgotada" : "Esgotado")
                  : selectedSize
                  ? <>Tamanho selecionado: <span className="text-accent font-semibold">{selectedSize.size}</span></>
                  : "Selecione um tamanho"}
              </p>
              {!colorSoldOut && (
                <div className="flex items-center gap-2 flex-wrap">
                  {activeSizes(selectedVariant).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={s.stock <= 0}
                      onClick={() => setSelectedSizeId(s.id)}
                      className={[
                        "min-w-[44px] h-10 px-3 rounded-lg border text-sm font-medium transition-all duration-150",
                        s.stock <= 0
                          ? "border-dark-border text-muted/40 line-through cursor-not-allowed"
                          : s.id === selectedSizeId
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-dark-border text-dark-text hover:border-accent/50",
                      ].join(" ")}
                    >
                      {s.size}
                    </button>
                  ))}
                </div>
              )}
              {!colorSoldOut && selectedSize && (
                <p className="text-xs text-muted mt-2">
                  Estoque disponível: {selectedSize.stock} unidades
                </p>
              )}
            </div>
          </div>
        )}

        <ProductClientSection
          product={product}
          selectedVariant={selectedVariant}
          selectedSize={selectedSize}
          colorSoldOut={colorSoldOut}
          whatsappNumber={whatsappNumber}
        />

        {/* Trust badges */}
        <div className="flex items-center gap-4 pt-2 border-t border-dark-border/60">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Package size={13} className="text-accent" />
            <span>Entrega discreta</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <CheckCircle2 size={13} className="text-success" />
            <span>Qualidade garantida</span>
          </div>
        </div>
      </div>

    </div>
  );
}
