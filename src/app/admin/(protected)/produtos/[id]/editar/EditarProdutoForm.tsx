"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Trash2, Info, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Toggle } from "@/components/common/Toggle";
import { Modal } from "@/components/common/Modal";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { ProductPreviewCard } from "@/components/admin/ProductPreviewCard";
import { PriceTierEditor } from "@/components/admin/PriceTierEditor";
import { ProductBadgeEditor } from "@/components/admin/ProductBadgeEditor";
import { updateProduct, deleteProduct } from "@/lib/actions/products";
import { saveMediaChanges } from "@/lib/actions/media";
import { routes } from "@/lib/routes";
import { formatCurrency } from "@/lib/formatters";
import { computeCardPrice } from "@/lib/pricing";
import type { ProductFormData } from "@/lib/actions/products";
import type { AdminProduct } from "@/lib/db/admin";
import type { UploadedMedia } from "@/components/admin/MediaUploader";
import type { ProductBadgeValue } from "@/components/admin/ProductBadgeEditor";
import type { PriceTier, ProductMedia, Product, ProductFulfillmentType } from "@/types";
import { FULFILLMENT_TYPE_LABELS } from "@/types";

interface CategoryOption {
  value: string;
  label: string;
}

interface Props {
  product: AdminProduct;
  categoryOptions: CategoryOption[];
}

function HelpText({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1">
      <Info size={12} className="text-muted flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-dark-text">{title}</h2>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function EditarProdutoForm({ product, categoryOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [mediaItems, setMediaItems] = useState<UploadedMedia[]>([]);
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([]);

  const handleMediaChange = (items: UploadedMedia[], removed: string[]) => {
    setMediaItems(items);
    setRemovedDbIds(removed);
  };

  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [isActive, setIsActive] = useState(product.is_active);
  const [shortDesc, setShortDesc] = useState(product.short_description);
  const [pricePix, setPricePix] = useState(product.price_pix.toString());
  // Preço no cartão nunca é digitado — sempre 18% sobre o Pix (ver computeCardPrice).
  const priceCard = computeCardPrice(parseFloat(pricePix) || 0);
  const [pricePromo, setPricePromo] = useState(
    product.price_promotional?.toString() ?? ""
  );
  const [promotionalActive, setPromotionalActive] = useState(
    product.promotional_active
  );
  const [quantityPricingEnabled, setQuantityPricingEnabled] = useState(
    product.quantity_pricing_enabled
  );
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>(product.price_tiers ?? []);
  const [allowWhatsapp, setAllowWhatsapp] = useState(product.allow_whatsapp);
  const [showIllustrativeBadge, setShowIllustrativeBadge] = useState(product.show_illustrative_badge);
  const [fulfillmentType, setFulfillmentType] = useState<ProductFulfillmentType | null>(
    product.fulfillment_type ?? null
  );

  const [badge, setBadge] = useState<ProductBadgeValue | null>(
    product.badge_image_url
      ? {
          url:         product.badge_image_url,
          storagePath: product.badge_storage_path ?? "",
          posX:        product.badge_position_x ?? 50,
          posY:        product.badge_position_y ?? 50,
          widthPct:    product.badge_width_pct  ?? 25,
        }
      : null
  );

  const selectedCat = categoryOptions.find((c) => c.value === categoryId);

  // ---------------------------------------------------------------------------
  // Detecção de alterações não salvas — compara o estado atual do formulário
  // com um snapshot do que está realmente salvo no banco (capturado uma única
  // vez, a partir de `product`, e atualizado após cada save bem-sucedido).
  // Usado para avisar o admin antes de sair da página com edições pendentes.
  // ---------------------------------------------------------------------------
  const initialSnapshotRef = useRef(
    JSON.stringify({
      name: product.name,
      slug: product.slug,
      categoryId: product.category_id,
      isActive: product.is_active,
      shortDesc: product.short_description,
      pricePix: product.price_pix.toString(),
      pricePromo: product.price_promotional?.toString() ?? "",
      promotionalActive: product.promotional_active,
      quantityPricingEnabled: product.quantity_pricing_enabled,
      priceTiers: product.price_tiers ?? [],
      allowWhatsapp: product.allow_whatsapp,
      showIllustrativeBadge: product.show_illustrative_badge,
      fulfillmentType: product.fulfillment_type ?? null,
      badge,
      media: (product.media ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((m) => ({ url: m.url, type: m.type, alt_text: m.alt_text ?? "" })),
    })
  );

  const currentSnapshot = JSON.stringify({
    name, slug, categoryId, isActive, shortDesc,
    pricePix, pricePromo, promotionalActive,
    quantityPricingEnabled, priceTiers, allowWhatsapp, showIllustrativeBadge, fulfillmentType, badge,
    media: mediaItems
      .filter((m) => !m.uploading && !m.uploadError)
      .map((m) => ({ url: m.url, type: m.type, alt_text: m.alt_text ?? "" })),
  });

  const isDirty = currentSnapshot !== initialSnapshotRef.current;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Fechar a aba, atualizar a página ou digitar outra URL com edições pendentes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Navegar para qualquer outro link da página (voltar, menu lateral, topo)
  // com edições pendentes — intercepta no capture phase, antes do Next.js
  // processar a navegação client-side do <Link>, e abre o modal de
  // confirmação em vez do diálogo nativo do navegador.
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingNavHref(href);
    };
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, []);

  const previewMedia = mediaItems
    .filter((m) => !m.uploading && !m.uploadError)
    .map((m) => ({ url: m.url, type: m.type }));

  // Produto "ao vivo" a partir do estado atual do formulário, SEM os campos
  // de badge — usado apenas para a renderização de contexto do
  // ProductBadgeEditor (o selo em si é desenhado por cima, arrastável).
  const badgePreviewMedia: ProductMedia[] = mediaItems
    .filter((m) => !m.uploading && !m.uploadError)
    .map((m, i) => ({
      id:            m.dbId ?? m.localId,
      product_id:    product.id,
      type:          m.type,
      url:           m.url,
      alt_text:      m.alt_text,
      display_order: i,
      is_main:       i === 0,
      created_at:    product.created_at,
    }));

  const badgePreviewProduct: Product = {
    id:                  product.id,
    name:                name || "Nome do produto",
    slug:                slug || "produto",
    sku:                 product.sku,
    category_id:         categoryId,
    display_order:       product.display_order,
    price_pix:           parseFloat(pricePix)  || 0,
    price_card:          priceCard,
    price_promotional:   parseFloat(pricePromo) || undefined,
    promotional_active:  promotionalActive,
    is_active:           isActive,
    is_featured:         product.is_featured,
    short_description:   shortDesc,
    description:         product.description,
    specifications:      product.specifications,
    media:               badgePreviewMedia,
    stock:               null,
    stock_minimum:       2,
    availability:        "in_stock",
    track_stock:         false,
    quantity_pricing_enabled: quantityPricingEnabled,
    price_tiers:         priceTiers,
    weight_kg:           product.weight_kg,
    height_cm:           product.height_cm,
    width_cm:            product.width_cm,
    length_cm:           product.length_cm,
    extra_handling_days: product.extra_handling_days,
    allow_whatsapp:      allowWhatsapp,
    show_illustrative_badge: showIllustrativeBadge,
    fulfillment_type:    fulfillmentType,
    created_at:          product.created_at,
    updated_at:          product.updated_at,
  };

  // Campos que saíram do formulário (SKU, descrição completa, benefícios,
  // avisos, especificações, peso/dimensões) continuam sendo enviados com o
  // valor que já estava salvo — não são mais editáveis aqui, mas editar
  // outra coisa no produto não pode apagar esse conteúdo.
  const buildPayload = (): ProductFormData => ({
    name,
    slug,
    sku:                 product.sku,
    stock_item_id:       product.stock_item_id ?? null,
    category_id:         categoryId,
    price_pix:           parseFloat(pricePix)  || 0,
    price_card:          priceCard,
    price_promotional:   parseFloat(pricePromo) || null,
    promotional_active:  promotionalActive,
    is_active:           isActive,
    is_featured:         product.is_featured,
    short_description:   shortDesc,
    description:         product.description,
    benefits:            product.benefits,
    warnings:            product.warnings,
    specifications:      product.specifications,
    stock:               null,
    stock_minimum:       2,
    track_stock:         false,
    quantity_pricing_enabled: quantityPricingEnabled,
    price_tiers:         priceTiers,
    weight_kg:           product.weight_kg,
    height_cm:           product.height_cm,
    width_cm:            product.width_cm,
    length_cm:           product.length_cm,
    extra_handling_days: product.extra_handling_days,
    allow_whatsapp:      allowWhatsapp,
    show_illustrative_badge: showIllustrativeBadge,
    fulfillment_type:    fulfillmentType,
    badge_image_url:     badge?.url         ?? null,
    badge_storage_path:  badge?.storagePath ?? null,
    badge_position_x:    badge?.posX,
    badge_position_y:    badge?.posY,
    badge_width_pct:     badge?.widthPct,
  });

  const handleSave = () => {
    setError(null);
    setSaved(false);

    const imageCount = mediaItems.filter((m) => m.type === "image" && !m.uploadError).length;
    if (imageCount < 1) {
      setError("Adicione pelo menos 1 imagem do produto.");
      return;
    }

    startTransition(async () => {
      const result = await updateProduct(product.id, buildPayload());
      if (result.error) { setError(result.error); return; }

      const mediaResult = await saveMediaChanges(product.id, mediaItems, removedDbIds);
      if (mediaResult.error) { setError(mediaResult.error); return; }

      // Recarrega os dados do servidor (product.media atualizado) e confirma
      // visualmente o sucesso — antes não havia nenhum feedback após salvar,
      // o que mascarava falhas silenciosas como a do bug de imagem.
      router.refresh();
      // Move a "linha de base" do que está salvo para o estado atual, senão
      // o aviso de alterações não salvas continuaria disparando após salvar.
      initialSnapshotRef.current = currentSnapshot;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  const confirmLeave = () => {
    const href = pendingNavHref;
    setPendingNavHref(null);
    if (href) router.push(href);
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Excluir o produto "${product.name}"? Esta ação não pode ser desfeita.`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(routes.admin.produtos);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center hover:bg-dark-hover transition-colors"
          >
            <ArrowLeft size={15} className="text-muted" />
          </button>
          <h1 className="text-xl font-bold text-dark-text">Editar produto</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={handleDelete}
            isLoading={isPending}
          >
            Excluir
          </Button>
          <Button
            variant="accent"
            size="sm"
            leftIcon={<Save size={14} />}
            onClick={handleSave}
            isLoading={isPending}
          >
            Salvar
          </Button>
        </div>
      </div>

      {/* Botão Salvar flutuante — sempre acessível, mesmo rolado para baixo */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-accent text-dark-bg font-semibold text-sm shadow-2xl shadow-accent/30 hover:bg-accent-light hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
      >
        {isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Save size={16} />
        )}
        Salvar
      </button>

      <Modal isOpen={pendingNavHref !== null} onClose={() => setPendingNavHref(null)} size="sm">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-warning/15 flex items-center justify-center">
            <AlertTriangle size={26} className="text-warning" />
          </div>
          <div>
            <h3 className="text-base font-bold text-dark-text">Alterações não salvas</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Este produto foi modificado e as alterações ainda não foram salvas.
              Se você sair agora, elas serão perdidas.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setPendingNavHref(null)}
            >
              Continuar editando
            </Button>
            <Button variant="danger" className="flex-1" onClick={confirmLeave}>
              Sair sem salvar
            </Button>
          </div>
        </div>
      </Modal>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}

      {saved && (
        <div className="fixed top-6 right-6 z-[60] flex items-center gap-3 pl-3 pr-5 py-3 rounded-xl border border-success/30 bg-dark-surface shadow-2xl shadow-black/40 animate-slide-in-right">
          <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={16} className="text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-dark-text">Produto salvo</p>
            <p className="text-xs text-muted">Alterações publicadas com sucesso.</p>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-xl text-sm text-warning">
          <EyeOff size={16} className="flex-shrink-0 mt-0.5" />
          <p>
            Este produto está <strong>inativo</strong> e não aparece em nenhuma página
            do site (Home, Catálogo, busca ou link direto). Ative o toggle &quot;Ativo&quot;
            abaixo e salve para publicá-lo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">

          <SectionCard title="Informações básicas">
            <Input
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              label="Categoria"
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Selecione a categoria"
            />
            <div className="flex gap-6">
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">Ativo</p>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Descrição">
            <Input
              label="Descrição curta"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
            />
          </SectionCard>

          <SectionCard title="Preços">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Preço Pix (R$)"
                type="number"
                value={pricePix}
                onChange={(e) => setPricePix(e.target.value)}
              />
              <div>
                <Input
                  label="Preço Cartão (R$)"
                  value={formatCurrency(priceCard)}
                  disabled
                  readOnly
                />
                <HelpText text="Calculado automaticamente: Pix + 18%" />
              </div>
              <div>
                <Input
                  label="Preço anterior (R$)"
                  type="number"
                  value={pricePromo}
                  onChange={(e) => setPricePromo(e.target.value)}
                  placeholder="—"
                />
                <HelpText text="Aparece riscado (promoção)" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-dark-text mb-1.5">Promoção ativa</p>
              <Toggle checked={promotionalActive} onChange={setPromotionalActive} />
            </div>
            <PriceTierEditor
              enabled={quantityPricingEnabled}
              onEnabledChange={setQuantityPricingEnabled}
              tiers={priceTiers}
              onTiersChange={setPriceTiers}
              basePrice={parseFloat(pricePix) || 0}
            />
          </SectionCard>

          <SectionCard title="Foto principal" hint="Foto de capa do produto">
            {/* key=updated_at força remontagem após cada salvar bem-sucedido.
                Sem isso, o MediaUploader nunca aprende o dbId de uma imagem
                recém-inserida — ele inicializa seu estado interno UMA VEZ no
                mount e ignora mudanças posteriores na prop initialMedia.
                Resultado: a cada novo clique em "Salvar", a mesma imagem
                "nova" (sem dbId) era inserida de novo, duplicando-a no banco.
                product.updated_at sempre muda a cada updateProduct(), então
                serve como gatilho confiável de remontagem com dados frescos. */}
            <MediaUploader
              key={product.updated_at}
              productId={product.id}
              initialMedia={product.media}
              onChange={handleMediaChange}
              maxImages={5}
            />
            <div className="pt-2 border-t border-dark-border">
              <p className="text-xs font-medium text-dark-text mb-1.5">Aviso &quot;Imagem meramente ilustrativa&quot;</p>
              <Toggle checked={showIllustrativeBadge} onChange={setShowIllustrativeBadge} />
              <HelpText text="Mostra o aviso sobre a foto do produto no card." />
            </div>
          </SectionCard>

          <SectionCard title="Selo de disponibilidade" hint="Selo exibido no card do produto — só um dos dois pode estar ativo por vez">
            <div className="flex gap-2 flex-wrap">
              {(["pronta_entrega", "sob_encomenda"] as ProductFulfillmentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFulfillmentType(fulfillmentType === type ? null : type)}
                  className={[
                    "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    fulfillmentType === type
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-dark-alt border-dark-border-light text-muted hover:text-dark-text",
                  ].join(" ")}
                >
                  {FULFILLMENT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <HelpText text="Clique de novo no selo ativo para remover (nenhum selo)." />
          </SectionCard>

          <SectionCard title="Selo do produto">
            <HelpText text="Imagem opcional (ex: promoção, lançamento, selo próprio) posicionada livremente sobre o card, exatamente como aparece no site." />
            <ProductBadgeEditor
              productId={product.id}
              value={badge}
              onChange={setBadge}
              previewProduct={badgePreviewProduct}
            />
          </SectionCard>

          <SectionCard title="Comportamento">
            <div className="flex gap-8 flex-wrap">
              <div>
                <p className="text-xs font-medium text-dark-text mb-1.5">WhatsApp</p>
                <Toggle checked={allowWhatsapp} onChange={setAllowWhatsapp} />
              </div>
            </div>
          </SectionCard>

        </div>

        {/* Preview */}
        <div className="sticky top-6 space-y-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Preview
          </p>
          <ProductPreviewCard
            name={name}
            short_description={shortDesc}
            price_pix={parseFloat(pricePix) || product.price_pix}
            price_card={priceCard}
            price_promotional={parseFloat(pricePromo) || undefined}
            promotional_active={promotionalActive}
            category_name={selectedCat?.label}
            media={previewMedia}
          />
        </div>
      </div>
    </div>
  );
}
