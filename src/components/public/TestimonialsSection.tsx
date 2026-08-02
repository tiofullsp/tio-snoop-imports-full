"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Star, Play, MapPin, Truck, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/common/SectionHeader";
import { VideoModal } from "@/components/public/VideoModal";
import { ReviewImage } from "@/components/shared/ReviewImage";
import { extractYoutubeId, formatStateName } from "@/lib/formatters";
import type { Review } from "@/types";

const CARD_MIN_HEIGHT = 460;
const DESKTOP_SPEED_PX_S = 36; // vitrine: lento
const MOBILE_SPEED_PX_S = 20;  // mobile: ainda mais lento

// 1 card visível no mobile, 2 no tablet, 3 no desktop.
function useItemsPerView() {
  const [itemsPerView, setItemsPerView] = useState(1);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setItemsPerView(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return itemsPerView;
}

function TestimonialCard({ review, onPlayVideo }: { review: Review; onPlayVideo: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const videoId = review.video_url ? extractYoutubeId(review.video_url) : null;
  const videoThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  // Aproximação simples para decidir se vale mostrar "Ler mais" — evita o
  // botão aparecer em textos curtos que nunca seriam cortados pelo clamp.
  const isLong = review.comment.length > 160;

  return (
    <div
      className="relative w-full h-full flex flex-col bg-dark-surface border border-dark-border/70 rounded-2xl overflow-hidden transition-all duration-300 hover:border-accent/25 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
      style={{ minHeight: CARD_MIN_HEIGHT }}
    >
      {/* Gold top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent" />

      {/* Mídia — vídeo tem prioridade sobre imagem */}
      {videoThumbnail ? (
        <button
          type="button"
          onClick={() => review.video_url && onPlayVideo(review.video_url)}
          className="relative w-full aspect-[4/3] bg-dark-alt block flex-shrink-0 group/media"
        >
          <Image src={videoThumbnail} alt={review.customer_name} fill className="object-cover transition-transform duration-500 group-hover/media:scale-105" unoptimized draggable={false} />
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/95 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 group-hover/media:scale-110">
              <Play size={18} className="text-dark-bg fill-dark-bg ml-0.5" />
            </div>
          </div>
        </button>
      ) : review.image_url ? (
        <ReviewImage
          src={review.image_url}
          alt={review.customer_name}
          posX={review.image_object_position_x}
          posY={review.image_object_position_y}
          scale={review.image_scale}
          className="flex-shrink-0"
        />
      ) : null}

      {/* Corpo do card */}
      <div className="flex flex-col flex-1 p-5 gap-3.5">
        {/* Stars + badge compra verificada */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={15}
                className={n <= review.rating ? "fill-accent text-accent" : "text-dark-border fill-dark-border"}
              />
            ))}
          </div>
          <span className="text-[10px] font-semibold text-success/80 uppercase tracking-wide">
            ✓ Verificado
          </span>
        </div>

        <div>
          <p className={`text-sm text-dark-text/90 leading-relaxed ${expanded ? "" : "line-clamp-4"}`}>
            {review.comment}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-light transition-colors mt-1.5"
            >
              {expanded ? "Ler menos" : "Ler mais"}
              <ChevronDown size={12} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-3.5 mt-auto border-t border-dark-border/60">
          <div>
            <p className="text-sm font-bold text-dark-text">{review.customer_name}</p>
            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="text-muted/70" /> {formatStateName(review.state)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-success font-semibold flex items-center gap-1 justify-end">
              <Truck size={11} /> {review.delivery_days_label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vitrine contínua — a lista é duplicada (2x) e desliza via requestAnimationFrame,
// não por troca de "página". O offset é um único valor contínuo (ref, sem
// re-render por frame): autoplay, hover-pause e arraste manual todos só leem/
// escrevem essa mesma variável, então nunca há salto ao alternar entre eles.
// ---------------------------------------------------------------------------

function ContinuousMarquee({
  reviews,
  itemsPerView,
  onPlayVideo,
}: {
  reviews: Review[];
  itemsPerView: number;
  onPlayVideo: (url: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Largura do card calculada em px via JS (não percentual) — evita qualquer
  // ambiguidade de como o navegador resolve largura de filho percentual
  // dentro de um flex container, e garante que a matemática do offset
  // (rAF) bata exatamente com o que é renderizado.
  const [cardWidthPx, setCardWidthPx] = useState(0);

  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0); // largura de UMA volta completa (lista original, em px)
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const speed = itemsPerView === 1 ? MOBILE_SPEED_PX_S : DESKTOP_SPEED_PX_S;

  const applyTransform = () => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
    }
  };

  const measure = useCallback(() => {
    if (!wrapperRef.current) return;
    const containerWidth = wrapperRef.current.getBoundingClientRect().width;
    const cardWidth = containerWidth / itemsPerView;
    setCardWidthPx(cardWidth);
    loopWidthRef.current = cardWidth * reviews.length;
    applyTransform();
  }, [itemsPerView, reviews.length]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Loop de animação — único responsável por avançar o offset continuamente.
  useEffect(() => {
    const step = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (!pausedRef.current && !draggingRef.current && loopWidthRef.current > 0) {
        offsetRef.current += speed * dt;
        const loop = loopWidthRef.current;
        offsetRef.current = ((offsetRef.current % loop) + loop) % loop;
        applyTransform();
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [speed]);

  const wrapOffset = () => {
    const loop = loopWidthRef.current;
    if (loop > 0) offsetRef.current = ((offsetRef.current % loop) + loop) % loop;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    lastPointerXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointerXRef.current;
    lastPointerXRef.current = e.clientX;
    // Arrastar para a direita revela os cards anteriores → offset diminui.
    offsetRef.current -= dx;
    wrapOffset();
    applyTransform();
  };

  const endDrag = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
  };

  const nudge = (direction: 1 | -1) => {
    if (!cardWidthPx) return;
    offsetRef.current += direction * cardWidthPx;
    wrapOffset();
    applyTransform();
  };

  const doubled = [...reviews, ...reviews];

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div
        className="overflow-hidden touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={trackRef}
          className="flex"
          style={{ transform: "translateX(0px)", willChange: "transform" }}
        >
          {doubled.map((r, i) => (
            <div
              key={`${r.id}-${i}`}
              className="flex-shrink-0 px-2.5 box-border"
              style={{ width: cardWidthPx || `${100 / itemsPerView}%` }}
            >
              <TestimonialCard review={r} onPlayVideo={onPlayVideo} />
            </div>
          ))}
        </div>
      </div>

      {reviews.length > itemsPerView && (
        <>
          <button
            onClick={() => nudge(-1)}
            aria-label="Depoimentos anteriores"
            className="hidden sm:flex absolute -left-4 lg:-left-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-dark-surface border border-dark-border hover:border-accent/50 items-center justify-center transition-all shadow-lg"
          >
            <ChevronLeft size={18} className="text-dark-text" />
          </button>
          <button
            onClick={() => nudge(1)}
            aria-label="Mais depoimentos"
            className="hidden sm:flex absolute -right-4 lg:-right-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-dark-surface border border-dark-border hover:border-accent/50 items-center justify-center transition-all shadow-lg"
          >
            <ChevronRight size={18} className="text-dark-text" />
          </button>
        </>
      )}
    </div>
  );
}

export function TestimonialsSection({ reviews }: { reviews: Review[] }) {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const itemsPerView = useItemsPerView();

  if (reviews.length === 0) return null;

  // A vitrine contínua duplica a lista para fazer o loop infinito parecer
  // contínuo (ver ContinuousMarquee). Com exatamente 1 depoimento, essa
  // duplicação mostra o MESMO card duas vezes lado a lado — parece um
  // cadastro duplicado, mas não é. Com 2 ou mais, sempre há variedade
  // suficiente para o movimento continuar valendo a pena.
  const needsMarquee = reviews.length > 1;

  return (
    <section className="relative py-24 bg-dark-bg overflow-hidden">
      {/* Brilho radial de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(242,183,5,0.04) 0%, transparent 65%)" }}
      />
      <Container className="relative">
        <div className="flex justify-center">
          <div className="inline-flex items-center px-7 py-3.5 rounded-full border border-accent/30 bg-accent/5 shadow-[0_0_30px_rgba(242,183,5,0.1)]">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-text tracking-tight text-center">
              O QUE NOSSOS CLIENTES DIZEM:
            </h2>
          </div>
        </div>

        <div className="mt-12">
          {needsMarquee ? (
            <ContinuousMarquee reviews={reviews} itemsPerView={itemsPerView} onPlayVideo={setPlayingVideo} />
          ) : (
            <div className="flex flex-wrap justify-center gap-5">
              {reviews.map((r) => (
                <div key={r.id} className="w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)] max-w-sm">
                  <TestimonialCard review={r} onPlayVideo={setPlayingVideo} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>

      {playingVideo && (
        <VideoModal videoUrl={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </section>
  );
}
