"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, Megaphone, Tag, Info, Copy, Check } from "lucide-react";
import type { Announcement, AnnouncementType } from "@/types";

interface Props {
  announcements: Announcement[];
}

const TYPE_ICON: Record<AnnouncementType, typeof Megaphone> = {
  promocao: Megaphone,
  cupom:    Tag,
  aviso:    Info,
};

const TYPE_STYLE: Record<AnnouncementType, { bg: string; text: string }> = {
  promocao: { bg: "bg-accent/15 border-accent/30", text: "text-accent" },
  cupom:    { bg: "bg-success/15 border-success/30", text: "text-success" },
  aviso:    { bg: "bg-dark-alt border-dark-border-light", text: "text-muted" },
};

export const AnnouncementBell = ({ announcements }: Props) => {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleCopyCoupon = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 2000);
    } catch {
      // clipboard indisponível — sem feedback, não é crítico
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (announcements.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Avisos e promoções"
        className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-dark-surface border border-dark-border text-dark-text/70 hover:text-accent hover:border-accent/50 hover:shadow-[0_0_16px_rgba(242,183,5,0.25)] transition-all duration-200"
      >
        <Bell size={20} />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-50" />
          <span className="relative w-1.5 h-1.5 rounded-full bg-dark-bg" />
        </span>
      </button>

      {open && (
        <div
          className="fixed top-24 inset-x-4 mt-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:left-auto sm:mt-3 sm:w-96 z-50 animate-fade-in"
        >
          <div className="relative rounded-2xl overflow-hidden bg-dark-surface border border-accent/25 shadow-[0_0_0_1px_rgba(242,183,5,0.1),0_24px_64px_rgba(0,0,0,0.55)]">
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

            <div className="px-4 py-3.5 border-b border-dark-border flex items-center gap-2">
              <Bell size={14} className="text-accent" />
              <span className="text-sm font-bold text-dark-text">Avisos e promoções</span>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-dark-border">
              {announcements.map((a) => {
                const Icon = TYPE_ICON[a.type];
                const style = TYPE_STYLE[a.type];

                if (a.type === "cupom" && a.coupon_code) {
                  const copied = copiedId === a.id;
                  return (
                    <div key={a.id} className="px-4 py-3.5 hover:bg-dark-alt/40 transition-colors">
                      <div className="flex items-start gap-3 mb-2.5">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                          <Icon size={14} className={style.text} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dark-text leading-snug">{a.title}</p>
                          <p className="text-xs text-muted mt-0.5 leading-relaxed">{a.message}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyCoupon(a.id, a.coupon_code!)}
                        className="relative w-full flex items-center justify-between gap-3 pl-4 pr-3 py-2.5 rounded-xl overflow-hidden
                          bg-gradient-to-r from-success/10 via-success/5 to-success/10 border border-dashed border-success/40
                          hover:border-success/70 hover:from-success/15 hover:to-success/15 transition-all duration-200 group/coupon"
                      >
                        <span className="font-mono font-bold text-sm tracking-[0.15em] text-success">
                          {a.coupon_code}
                        </span>
                        <span
                          className={[
                            "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all flex-shrink-0",
                            copied
                              ? "bg-success text-dark-bg"
                              : "bg-success/15 text-success group-hover/coupon:bg-success/25",
                          ].join(" ")}
                        >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          {copied ? "Copiado!" : "Copiar"}
                        </span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-dark-alt/40 transition-colors">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Icon size={14} className={style.text} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark-text leading-snug">{a.title}</p>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed">{a.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
