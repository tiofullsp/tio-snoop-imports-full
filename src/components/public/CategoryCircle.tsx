"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Category } from "@/types";
import { routes } from "@/lib/routes";

interface CategoryCircleProps {
  category: Category;
}

export const CategoryCircle = ({ category }: CategoryCircleProps) => {
  const resolvedImage = category.image_url ?? category.first_product_image_url;
  // Mesmo enquadramento (posição + zoom) configurado no editor de imagem
  // desktop do admin — mantém o avatar circular fiel ao ajuste feito lá.
  const posX  = category.image_object_position_x ?? 50;
  const posY  = category.image_object_position_y ?? 50;
  const scale = category.image_scale              ?? 1;

  return (
    <Link
      href={routes.categoria(category.slug)}
      className="group flex flex-col items-center gap-4"
    >
      {/* Círculo — tamanho responsivo */}
      <div
        className="
          relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 xl:w-40 xl:h-40
          rounded-full overflow-hidden flex-shrink-0
          border-2 border-accent/45
          transition-all duration-300 ease-out
          group-hover:border-accent
          group-hover:scale-105
          group-hover:shadow-[0_0_28px_rgba(242,183,5,0.55),_0_0_0_1px_rgba(242,183,5,0.2)]
        "
      >
        {resolvedImage ? (
          // <img> em vez de next/image: precisamos de objectPosition/transform
          // inline para refletir o enquadramento exato configurado no admin
          // (mesma técnica usada em CategoryImage/ReviewImage).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImage}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
            style={{
              objectPosition:  `${posX}% ${posY}%`,
              transform:       `scale(${scale})`,
              transformOrigin: `${posX}% ${posY}%`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-dark-alt flex items-center justify-center">
            <span className="text-3xl font-black text-accent select-none">
              {category.name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Nome e CTA */}
      <div className="text-center space-y-1 px-1">
        <h3 className="font-bold text-accent text-sm md:text-base tracking-wide leading-tight">
          {category.name}
        </h3>
        <p className="text-xs text-muted flex items-center justify-center gap-1 group-hover:text-dark-text transition-colors duration-200">
          Explorar coleção
          <ArrowRight
            size={11}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </p>
      </div>
    </Link>
  );
};
