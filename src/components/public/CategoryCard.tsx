"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Zap,
  Sparkles,
  Heart,
  Cpu,
  FlaskConical,
  Dna,
} from "lucide-react";
import type { Category } from "@/types";
import { routes } from "@/lib/routes";
import { CategoryImage } from "@/components/shared/CategoryImage";

type IconComp = React.ComponentType<{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}>;

const ICON_MAP: Record<string, IconComp> = {
  Flask:        FlaskConical,
  FlaskConical,
  Zap,
  Dna,
  Sparkles,
  Heart,
  Cpu,
};

interface CategoryCardProps {
  category: Category;
  /**
   * Força a exibição desktop ou mobile independente do viewport real —
   * usado pelo preview do Admin (abas Desktop/Mobile). undefined = responsivo
   * normal (comportamento do site público).
   */
  previewMode?: "desktop" | "mobile";
}

export const CategoryCard = ({ category, previewMode }: CategoryCardProps) => {
  const resolvedImage = category.image_url ?? category.first_product_image_url;
  const accentColor   = category.color_accent || "#f2b705";
  const Icon: IconComp =
    (category.icon ? ICON_MAP[category.icon] : undefined) ?? Package;

  const aspectClass = previewMode === "mobile"
    ? "aspect-[1080/1350]"
    : previewMode === "desktop"
    ? "aspect-[1400/900]"
    : "aspect-[1080/1350] sm:aspect-[1400/900]";

  return (
    <Link
      href={routes.categoria(category.slug)}
      className={`group relative block overflow-hidden rounded-2xl border border-white/[0.07] hover:border-accent/35 transition-all duration-500 ease-out ${aspectClass} hover:-translate-y-2 hover:shadow-[0_24px_64px_rgba(0,0,0,0.7)] hover:ring-1 hover:ring-accent/15`}
    >

      {/* ── IMAGEM OU FALLBACK ──────────────────────────────── */}
      {resolvedImage ? (
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.06]">
          <CategoryImage
            desktopUrl={resolvedImage}
            mobileUrl={category.mobile_image_url}
            desktopPosX={category.image_object_position_x}
            desktopPosY={category.image_object_position_y}
            desktopScale={category.image_scale}
            mobilePosX={category.mobile_image_object_position_x}
            mobilePosY={category.mobile_image_object_position_y}
            mobileScale={category.mobile_image_scale}
            alt={category.name}
            mode={previewMode}
          />
        </div>
      ) : (
        /* Fallback premium — fundo rico, não parece vazio */
        <div className="absolute inset-0 bg-dark-bg">
          {/* Base colorida com a cor da categoria */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 72% 45%, ${accentColor}42 0%, ${accentColor}10 40%, transparent 68%)`,
            }}
          />
          {/* Camada direcional que concentra cor à direita */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, var(--color-dark-bg) 30%, ${accentColor}18 65%, ${accentColor}28 100%)`,
            }}
          />
          {/* Textura de pontos */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Ícone grande à direita — visível e intencional */}
          <div
            className="absolute right-6 top-1/2 -translate-y-1/2 opacity-25"
            style={{ color: accentColor }}
          >
            <Icon size={140} />
          </div>
          {/* Linha decorativa horizontal */}
          <div
            className="absolute left-7 right-[40%] bottom-[96px] h-px"
            style={{ background: `linear-gradient(to right, ${accentColor}60, transparent)` }}
          />
        </div>
      )}

      {/* ── OVERLAY DUPLO — intensidade diferente para imagem vs fallback ── */}
      {resolvedImage ? (
        <>
          {/* Com imagem: overlay pesado para legibilidade do texto */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/52 to-black/8" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/24 to-transparent" />
        </>
      ) : (
        <>
          {/* Sem imagem: overlay mais leve para o fallback aparecer */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/42 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        </>
      )}

      {/* ── CONTEÚDO ────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col justify-between p-7">

        {/* Topo esquerdo: ícone badge */}
        <div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center border border-accent/28 backdrop-blur-sm transition-colors duration-300 group-hover:border-accent/50"
            style={{ backgroundColor: `${accentColor}1a` }}
          >
            <Icon size={20} style={{ color: accentColor }} />
          </div>
        </div>

        {/* Rodapé esquerdo: nome + count + CTA */}
        <div className="space-y-2.5">

          {/* Nome */}
          <h3 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
            {category.name}
          </h3>

          {/* Contagem de produtos */}
          {category.product_count !== undefined && (
            <p className="text-sm text-accent/65 font-medium tracking-wide">
              {category.product_count}{" "}
              {category.product_count === 1 ? "produto" : "produtos"}
            </p>
          )}

          {/* CTA */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm sm:text-base font-medium text-white/60 group-hover:text-white/90 transition-colors duration-300">
              Explorar coleção
            </span>
            <div className="w-9 h-9 rounded-full border border-white/22 group-hover:border-accent/65 group-hover:bg-accent/12 flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110">
              <ArrowRight
                size={15}
                className="text-white/50 group-hover:text-accent transition-colors duration-300"
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
