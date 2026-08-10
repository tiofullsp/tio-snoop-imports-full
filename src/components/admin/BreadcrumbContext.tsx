"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

// Rotas dinâmicas (ex: /admin/pedidos/[id]) só têm o UUID disponível na URL —
// esse contexto deixa a página de detalhe "publicar" um rótulo legível (ex:
// o número do pedido) pro AdminTopbar usar no lugar do UUID cru.
type BreadcrumbLabels = Record<string, string>;

const BreadcrumbContext = createContext<{
  labels: BreadcrumbLabels;
  setLabel: (path: string, label: string) => void;
  clearLabel: (path: string) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<BreadcrumbLabels>({});

  const setLabel = useCallback((path: string, label: string) => {
    setLabels((prev) => (prev[path] === label ? prev : { ...prev, [path]: label }));
  }, []);

  const clearLabel = useCallback((path: string) => {
    setLabels((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  // Memoizado: sem isso, todo render do Provider cria um objeto novo, o que
  // por si só só custaria re-renders extras — mas combinado com o efeito de
  // useBreadcrumbLabel (que depende da identidade desse objeto) virava um
  // loop infinito: cada re-render trocava a identidade, disparando de novo o
  // cleanup+efeito, que removia e recolocava o label, gerando outro
  // re-render, para sempre.
  const value = useMemo(() => ({ labels, setLabel, clearLabel }), [labels, setLabel, clearLabel]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabels(): BreadcrumbLabels {
  const ctx = useContext(BreadcrumbContext);
  return ctx?.labels ?? {};
}

// Chamado pela própria página de detalhe assim que souber o rótulo real
// (ex: order_number) — remove o registro ao desmontar, pra não vazar pra
// outras páginas.
export function useBreadcrumbLabel(path: string, label: string | undefined) {
  const ctx = useContext(BreadcrumbContext);
  // Depende só de setLabel/clearLabel (estáveis via useCallback), nunca do
  // objeto `ctx` em si — senão o efeito re-executaria a cada render do
  // Provider, mesmo sem path/label terem mudado de verdade.
  const setLabel = ctx?.setLabel;
  const clearLabel = ctx?.clearLabel;
  useEffect(() => {
    if (!setLabel || !clearLabel || !label) return;
    setLabel(path, label);
    return () => clearLabel(path);
  }, [setLabel, clearLabel, path, label]);
}
