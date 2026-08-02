"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import { useToastStore } from "@/store/toast-store";

const DURATION_MS = 3000;

export const CartToast = () => {
  const { id, message } = useToastStore();
  const [visible, setVisible] = useState(false);
  const [shrink, setShrink] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    setShrink(false);
    // Começa a barra em 100% e só no próximo frame dispara a transição pra
    // 0% — sem esse delay, o navegador nunca chega a pintar o estado inicial
    // e a transição de largura não anima.
    const raf = requestAnimationFrame(() => setShrink(true));
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [id, message]);

  if (!message) return null;

  return (
    <div
      className={[
        "fixed top-28 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out",
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-3 scale-95 pointer-events-none",
      ].join(" ")}
    >
      <div
        className="relative flex items-center gap-4 pl-4 pr-7 py-4 rounded-2xl overflow-hidden
          bg-dark-surface border border-accent/25
          shadow-[0_0_0_1px_rgba(242,183,5,0.12),0_20px_48px_rgba(0,0,0,0.55)]"
      >
        {/* Brilho sutil no topo */}
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

        <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-success/25 to-success/5 border border-success/30 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={20} className="text-success" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-dark-text tracking-tight">
            Produto adicionado ao carrinho
          </p>
          <p className="text-xs text-accent-light/90 font-medium mt-0.5 flex items-center gap-1.5 truncate">
            <ShoppingBag size={11} className="flex-shrink-0" />
            <span className="truncate">{message}</span>
          </p>
        </div>

        {/* Barra de progresso — mesma duração do auto-dismiss */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-dark-border/60">
          <div
            className="h-full bg-gradient-to-r from-accent to-success"
            style={{
              width: shrink ? "0%" : "100%",
              transition: shrink ? `width ${DURATION_MS}ms linear` : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
};
