"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { X, Save, Loader2, Upload, Trash2, Monitor, Smartphone, Circle, Info, RefreshCw } from "lucide-react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Toggle } from "@/components/common/Toggle";
import { Button } from "@/components/common/Button";
import { CategoryCircle } from "@/components/public/CategoryCircle";
import { ImageFramingEditor } from "@/components/admin/ImageFramingEditor";
import { createCategory, updateCategory } from "@/lib/actions/categories";
import type { CategoryFormData } from "@/lib/actions/categories";
import type { Category } from "@/types";

interface Props {
  category?: Category;
  parentOptions: { value: string; label: string }[];
  onClose: () => void;
}

const DESKTOP_ASPECT = "1400 / 900";
const MOBILE_ASPECT = "1080 / 1350";

const autoSlug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function CategoryModal({ category, parentOptions, onClose }: Props) {
  const isEdit = !!category;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Basic fields
  const [parentId, setParentId]       = useState(category?.parent_id          ?? "");
  const [name, setName]               = useState(category?.name               ?? "");
  const [slug, setSlug]               = useState(category?.slug               ?? "");
  const [shortDesc, setShortDesc]     = useState(category?.short_description  ?? "");
  const [fullDesc, setFullDesc]       = useState(category?.full_description   ?? "");
  const [icon, setIcon]               = useState(category?.icon               ?? "");
  const [gradient, setGradient]       = useState(category?.gradient           ?? "");
  const [colorAccent, setColorAccent] = useState(category?.color_accent       ?? "");
  const [displayOrder, setDisplayOrder] = useState(category?.display_order?.toString() ?? "0");
  const [isActive, setIsActive]           = useState(category?.is_active         ?? true);
  const [isFeaturedHome, setIsFeaturedHome] = useState(category?.is_featured_home ?? false);

  // Imagem desktop — URL/path + enquadramento
  const [desktopUrl,  setDesktopUrl]  = useState(category?.image_url               ?? "");
  const [desktopPath, setDesktopPath] = useState(category?.image_storage_path       ?? "");
  const [desktopPosX, setDesktopPosX] = useState(category?.image_object_position_x ?? 50);
  const [desktopPosY, setDesktopPosY] = useState(category?.image_object_position_y ?? 50);
  const [desktopScale, setDesktopScale] = useState(category?.image_scale ?? 1);
  const [desktopUploading, setDesktopUploading] = useState(false);

  // Imagem mobile — URL/path + enquadramento
  const [mobileUrl,   setMobileUrl]   = useState(category?.mobile_image_url         ?? "");
  const [mobilePath,  setMobilePath]  = useState(category?.mobile_image_storage_path ?? "");
  const [mobilePosX, setMobilePosX] = useState(category?.mobile_image_object_position_x ?? 50);
  const [mobilePosY, setMobilePosY] = useState(category?.mobile_image_object_position_y ?? 50);
  const [mobileScale, setMobileScale] = useState(category?.mobile_image_scale ?? 1);
  const [mobileUploading,  setMobileUploading]  = useState(false);

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!isEdit) setSlug(autoSlug(v));
  };

  const uploadImage = async (file: File): Promise<{ url: string; storagePath: string } | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload-category", { method: "POST", body: fd });
    const json = await res.json() as { url?: string; storagePath?: string; error?: string };
    if (json.error || !json.url) {
      setError(json.error ?? "Erro ao fazer upload.");
      return null;
    }
    return { url: json.url, storagePath: json.storagePath! };
  };

  const handleDesktopFile = async (file: File) => {
    setDesktopUploading(true);
    setError(null);
    const previousPath = desktopPath;
    const result = await uploadImage(file);
    if (result) {
      // Atualiza o estado local IMEDIATAMENTE com a nova URL — o preview
      // (ImageFramingEditor e o card abaixo) usa este mesmo estado, então
      // troca na hora, sem precisar salvar primeiro.
      setDesktopUrl(result.url);
      setDesktopPath(result.storagePath);
      setDesktopPosX(50);
      setDesktopPosY(50);
      setDesktopScale(1);
      // Limpa a imagem antiga do bucket ao substituir, para não acumular
      // arquivos órfãos. Não bloqueia a UI se falhar.
      if (previousPath && previousPath !== result.storagePath) {
        fetch(`/api/admin/upload-category?path=${encodeURIComponent(previousPath)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    }
    setDesktopUploading(false);
  };

  const handleDesktopRemove = async () => {
    setDesktopUploading(true);
    if (desktopPath) {
      await fetch(`/api/admin/upload-category?path=${encodeURIComponent(desktopPath)}`, { method: "DELETE" });
    }
    setDesktopUrl(""); setDesktopPath("");
    setDesktopPosX(50); setDesktopPosY(50); setDesktopScale(1);
    if (desktopInputRef.current) desktopInputRef.current.value = "";
    setDesktopUploading(false);
  };

  const handleMobileFile = async (file: File) => {
    setMobileUploading(true);
    setError(null);
    const previousPath = mobilePath;
    const result = await uploadImage(file);
    if (result) {
      setMobileUrl(result.url);
      setMobilePath(result.storagePath);
      setMobilePosX(50);
      setMobilePosY(50);
      setMobileScale(1);
      if (previousPath && previousPath !== result.storagePath) {
        fetch(`/api/admin/upload-category?path=${encodeURIComponent(previousPath)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    }
    setMobileUploading(false);
  };

  const handleMobileRemove = async () => {
    setMobileUploading(true);
    if (mobilePath) {
      await fetch(`/api/admin/upload-category?path=${encodeURIComponent(mobilePath)}`, { method: "DELETE" });
    }
    setMobileUrl(""); setMobilePath("");
    setMobilePosX(50); setMobilePosY(50); setMobileScale(1);
    if (mobileInputRef.current) mobileInputRef.current.value = "";
    setMobileUploading(false);
  };

  // Categoria construída a partir do estado atual — usada no preview real
  // (mesmo componente CategoryCard do site público).
  const previewCategory: Category = {
    id:                        category?.id ?? "preview",
    parent_id:                 parentId   || undefined,
    name:                      name       || "Nome da categoria",
    slug:                      slug       || "categoria",
    short_description:         shortDesc  || "Descrição curta da categoria",
    full_description:          fullDesc   || undefined,
    icon:                      icon       || undefined,
    image_url:                 desktopUrl || undefined,
    image_storage_path:        desktopPath || undefined,
    image_object_position_x:   desktopPosX,
    image_object_position_y:   desktopPosY,
    image_scale:               desktopScale,
    mobile_image_url:          mobileUrl  || undefined,
    mobile_image_storage_path: mobilePath || undefined,
    mobile_image_object_position_x: mobilePosX,
    mobile_image_object_position_y: mobilePosY,
    mobile_image_scale:              mobileScale,
    gradient:                  gradient   || undefined,
    color_accent:              colorAccent || undefined,
    display_order:             parseInt(displayOrder) || 0,
    is_active:                 isActive,
    is_featured_home:          isFeaturedHome,
    product_count:             category?.product_count ?? 0,
    created_at:                category?.created_at ?? new Date().toISOString(),
    updated_at:                category?.updated_at ?? new Date().toISOString(),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const data: CategoryFormData = {
      parent_id: parentId || null,
      name,
      slug,
      short_description:         shortDesc,
      full_description:          fullDesc    || undefined,
      icon:                      icon        || undefined,
      gradient:                  gradient    || undefined,
      color_accent:              colorAccent || undefined,
      display_order:             parseInt(displayOrder) || 0,
      is_active:                 isActive,
      is_featured_home:          isFeaturedHome,
      image_url:                 desktopUrl  || undefined,
      image_storage_path:        desktopPath || undefined,
      image_object_position_x:   desktopPosX,
      image_object_position_y:   desktopPosY,
      image_scale:               desktopScale,
      mobile_image_url:          mobileUrl   || undefined,
      mobile_image_storage_path: mobilePath  || undefined,
      mobile_image_object_position_x: mobilePosX,
      mobile_image_object_position_y: mobilePosY,
      mobile_image_scale:              mobileScale,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateCategory(category!.id, data)
        : await createCategory(data);

      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-dark-surface border border-dark-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <h2 className="text-base font-bold text-dark-text">
            {isEdit ? "Editar categoria" : "Nova categoria"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-dark-alt hover:bg-dark-hover border border-dark-border flex items-center justify-center transition-colors"
          >
            <X size={15} className="text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ── Informações básicas ── */}
          <div className="space-y-4">
            <Select
              label="Categoria pai"
              value={parentId}
              onChange={setParentId}
              options={parentOptions}
              placeholder="Nenhuma — categoria de topo (ex: Masculino, Feminino)"
            />
            <Input
              label="Nome"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Camisa"
              required
            />
            <Input
              label="Slug (URL)"
              value={slug}
              onChange={(e) => setSlug(autoSlug(e.target.value))}
              placeholder="peptideos"
              required
            />
            <Input
              label="Descrição curta"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Aparece nos cards e listagens"
              required
            />
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1.5">
                Descrição completa
              </label>
              <textarea
                value={fullDesc}
                onChange={(e) => setFullDesc(e.target.value)}
                placeholder="Descrição longa para a página da categoria"
                rows={2}
                className="w-full bg-dark-alt border border-dark-border-light rounded-xl px-3 py-2.5 text-sm text-dark-text placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 resize-none transition-all"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Ícone (emoji)"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="💊"
              />
              <Input
                label="Gradiente (CSS)"
                value={gradient}
                onChange={(e) => setGradient(e.target.value)}
                placeholder="from-blue-500 to-purple-500"
              />
              <Input
                label="Cor accent"
                value={colorAccent}
                onChange={(e) => setColorAccent(e.target.value)}
                placeholder="#F2B705"
              />
            </div>
            <Input
              label="Ordem de exibição"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="border-t border-dark-border" />

          {/* ── Imagens ── */}
          <div className="space-y-6">
            <p className="text-xs font-semibold text-dark-text uppercase tracking-widest">Imagens do card</p>

            {/* Desktop */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-2">
                  <Monitor size={14} className="text-muted" />
                  <span className="text-sm font-medium text-dark-text">Imagem Desktop</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Info size={12} />
                  Recomendado: 1400×900px (proporção 3:2)
                </span>
              </div>

              {desktopUrl ? (
                <div className="space-y-4">
                  <ImageFramingEditor
                    imageUrl={desktopUrl}
                    posX={desktopPosX}
                    posY={desktopPosY}
                    scale={desktopScale}
                    aspect={DESKTOP_ASPECT}
                    onChange={(next) => {
                      setDesktopPosX(next.posX);
                      setDesktopPosY(next.posY);
                      setDesktopScale(next.scale);
                    }}
                  />

                  {/* Editor circular — MESMO posX/posY/scale do card desktop.
                      Arrastar aqui também move o card acima, e vice-versa,
                      pois compartilham o mesmo estado. Mostra exatamente o
                      recorte redondo usado no avatar da Home. */}
                  <div className="border-t border-dark-border pt-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted mb-2">
                      <Circle size={11} />
                      Como aparece no círculo da Home (arraste para ajustar)
                    </p>
                    <ImageFramingEditor
                      imageUrl={desktopUrl}
                      posX={desktopPosX}
                      posY={desktopPosY}
                      scale={desktopScale}
                      shape="circle"
                      size="140px"
                      onChange={(next) => {
                        setDesktopPosX(next.posX);
                        setDesktopPosY(next.posY);
                        setDesktopScale(next.scale);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => desktopInputRef.current?.click()}
                      disabled={desktopUploading}
                      className="flex items-center gap-1.5 text-accent hover:text-accent/80 text-xs font-medium transition-colors"
                    >
                      {desktopUploading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Trocar imagem desktop
                    </button>
                    <button
                      type="button"
                      onClick={handleDesktopRemove}
                      disabled={desktopUploading}
                      className="flex items-center gap-1.5 text-danger hover:text-danger/80 text-xs font-medium transition-colors"
                    >
                      <Trash2 size={12} />
                      Remover imagem desktop
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => desktopInputRef.current?.click()}
                  disabled={desktopUploading}
                  className="w-full border-2 border-dashed border-dark-border hover:border-accent/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors group"
                  style={{ aspectRatio: DESKTOP_ASPECT }}
                >
                  {desktopUploading ? (
                    <Loader2 size={24} className="text-muted animate-spin" />
                  ) : (
                    <>
                      <Upload size={24} className="text-muted group-hover:text-accent transition-colors" />
                      <span className="text-sm text-muted group-hover:text-accent transition-colors">
                        Clique para enviar a imagem desktop
                      </span>
                      <span className="text-xs text-muted/70 text-center px-4">
                        JPEG / PNG / WEBP, máx. 5 MB — alimenta o card do catálogo E o círculo da Home
                      </span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={desktopInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDesktopFile(f); }}
              />
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-2">
                  <Smartphone size={14} className="text-muted" />
                  <span className="text-sm font-medium text-dark-text">
                    Imagem Mobile <span className="text-muted font-normal">(opcional)</span>
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Info size={12} />
                  Recomendado: 1080×1350px (proporção 4:5)
                </span>
              </div>

              {mobileUrl ? (
                <div className="space-y-2 max-w-[320px]">
                  <ImageFramingEditor
                    imageUrl={mobileUrl}
                    posX={mobilePosX}
                    posY={mobilePosY}
                    scale={mobileScale}
                    aspect={MOBILE_ASPECT}
                    onChange={(next) => {
                      setMobilePosX(next.posX);
                      setMobilePosY(next.posY);
                      setMobileScale(next.scale);
                    }}
                  />
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => mobileInputRef.current?.click()}
                      disabled={mobileUploading}
                      className="flex items-center gap-1.5 text-accent hover:text-accent/80 text-xs font-medium transition-colors"
                    >
                      {mobileUploading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Trocar imagem mobile
                    </button>
                    <button
                      type="button"
                      onClick={handleMobileRemove}
                      disabled={mobileUploading}
                      className="flex items-center gap-1.5 text-danger hover:text-danger/80 text-xs font-medium transition-colors"
                    >
                      <Trash2 size={12} />
                      Remover imagem mobile
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => mobileInputRef.current?.click()}
                  disabled={mobileUploading}
                  className="w-full max-w-[320px] border-2 border-dashed border-dark-border hover:border-accent/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors group"
                  style={{ aspectRatio: MOBILE_ASPECT }}
                >
                  {mobileUploading ? (
                    <Loader2 size={20} className="text-muted animate-spin" />
                  ) : (
                    <>
                      <Upload size={20} className="text-muted group-hover:text-accent transition-colors" />
                      <span className="text-sm text-muted group-hover:text-accent transition-colors text-center px-4">
                        Clique para enviar a imagem mobile
                      </span>
                      <span className="text-xs text-muted/70">Sem imagem: usa a desktop como fallback</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={mobileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMobileFile(f); }}
              />
            </div>
          </div>

          {/* ── Preview real (mesmo componente usado na Home e na página de categoria) ──
              IMPORTANTE: o site público só exibe categorias no formato
              círculo (CategoryCircle). O card retangular NÃO é usado em
              nenhuma página pública hoje, então não existe "preview
              desktop/mobile" fiel para mostrar além deste círculo. Mostrar
              qualquer outro formato aqui seria uma mentira sobre o que o
              cliente realmente vê no site. */}
          <div className="border-t border-dark-border pt-4">
            <p className="text-xs font-semibold text-dark-text uppercase tracking-widest mb-3">
              Preview — exatamente como aparece no site
            </p>
            {!desktopUrl && (
              <div className="flex items-start gap-1.5 mb-3 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2">
                <Info size={13} className="text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Nenhuma imagem desktop enviada — mostrando a imagem de um produto
                  da categoria como substituta. Envie uma imagem desktop acima para
                  controlar exatamente o que aparece aqui.
                </p>
              </div>
            )}
            <div className="w-full flex justify-center py-2 pointer-events-none">
              <CategoryCircle category={previewCategory} />
            </div>
          </div>

          <div className="border-t border-dark-border" />

          {/* ── Configurações ── */}
          <div className="flex gap-8">
            <div>
              <p className="text-xs font-medium text-dark-text mb-1.5">Ativa</p>
              <Toggle checked={isActive} onChange={setIsActive} />
            </div>
            <div>
              <p className="text-xs font-medium text-dark-text mb-1.5">Destaque home</p>
              <Toggle checked={isFeaturedHome} onChange={setIsFeaturedHome} />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="accent"
              fullWidth
              isLoading={isPending}
              leftIcon={isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            >
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
