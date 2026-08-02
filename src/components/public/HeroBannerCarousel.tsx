"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BannerSlide } from "@/components/shared/BannerSlide";
import type { HomeBanner } from "@/types";

interface HeroBannerCarouselProps {
  banners: HomeBanner[];
}

const AUTOPLAY_INTERVAL = 5000;
const SWIPE_THRESHOLD   = 50;

export const HeroBannerCarousel = ({ banners }: HeroBannerCarouselProps) => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX           = useRef(0);
  const touchStartY           = useRef(0);

  const total = banners.length;

  const goTo = useCallback(
    (index: number) => setCurrent(((index % total) + total) % total),
    [total]
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  useEffect(() => {
    if (paused || total <= 1) return;
    timerRef.current = setTimeout(next, AUTOPLAY_INTERVAL);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, total, next]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  // Em telas de toque, o navegador às vezes dispara um mouseenter sintético
  // sem o mouseleave correspondente (emulação de :hover) — o autoplay ficava
  // pausado pra sempre depois do primeiro toque. Garante que nunca fica
  // travado em "pausado" por causa disso.
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      e.preventDefault();
      dx > 0 ? next() : prev();
    }
    setPaused(false);
  };

  if (total === 0) return null;

  return (
    /*
     * aspect-[16/9]  → proporção 1280×720 em mobile — faixa curta, não domina a tela
     * sm:aspect-[3/1] → proporção 1800×600 em desktop — mesma ideia, mais larga
     * Contido dentro do Container da Home (não é full-bleed) e com cantos
     * arredondados, igual aos outros cards do site. Essas são as mesmas
     * proporções usadas no BannerPreview do admin, garantindo que o que você
     * vê no admin é idêntico ao site publicado.
     */
    <section
      className="relative aspect-[16/9] sm:aspect-[3/1] overflow-hidden select-none rounded-2xl border border-dark-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides — pré-carrega todos, exibe apenas o atual */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          aria-hidden={i !== current}
          className={[
            "absolute inset-0 transition-opacity duration-700",
            i === current ? "opacity-100" : "opacity-0 pointer-events-none",
          ].join(" ")}
        >
          <BannerSlide
            imageUrl={b.image_url}
            mobileImageUrl={b.image_mobile_url}
            desktopPosX={b.desktop_object_position_x ?? 50}
            desktopPosY={b.desktop_object_position_y ?? 50}
            desktopScale={b.desktop_scale ?? 1}
            mobilePosX={b.mobile_object_position_x ?? (b.desktop_object_position_x ?? 50)}
            mobilePosY={b.mobile_object_position_y ?? (b.desktop_object_position_y ?? 50)}
            mobileScale={b.mobile_scale ?? (b.desktop_scale ?? 1)}
            title={b.title}
            subtitle={b.subtitle}
            linkUrl={b.link_url}
            quantityPricing={b.linked_product}
          />
        </div>
      ))}

      {/* Setas — só com > 1 banner */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Banner anterior"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full backdrop-blur-sm bg-black/30 hover:bg-black/55 active:bg-black/70 border border-white/20 hover:border-accent/60 hover:shadow-[0_0_16px_rgba(242,183,5,0.3)] flex items-center justify-center text-white transition-all duration-200 touch-manipulation"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            aria-label="Próximo banner"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full backdrop-blur-sm bg-black/30 hover:bg-black/55 active:bg-black/70 border border-white/20 hover:border-accent/60 hover:shadow-[0_0_16px_rgba(242,183,5,0.3)] flex items-center justify-center text-white transition-all duration-200 touch-manipulation"
          >
            <ChevronRight size={22} />
          </button>

          {/* Indicadores / dots */}
          <div className="absolute bottom-5 sm:bottom-7 left-0 right-0 z-20 flex justify-center gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Ir para banner ${i + 1}`}
                className={[
                  "rounded-full transition-all duration-300 touch-manipulation",
                  i === current
                    ? "w-6 h-2.5 bg-accent"
                    : "w-2.5 h-2.5 bg-white/40 hover:bg-white/70",
                ].join(" ")}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
