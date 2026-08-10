"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Package, ArrowLeft, ChevronDown, CreditCard, LogOut } from "lucide-react";
import { Container } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Toggle } from "@/components/common/Toggle";
import { EmptyState } from "@/components/common/EmptyState";
import { OrderDetailView } from "@/components/public/OrderDetailView";
import { OrderSummaryCard } from "@/components/public/OrderSummaryCard";
import { maskCpf } from "@/lib/utils";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import { lookupOrdersByCpf, refreshOrdersByCpf, type PublicOrderDetail } from "@/lib/actions/order-lookup";

type SearchResult =
  | { kind: "single"; order: PublicOrderDetail }
  | { kind: "list"; orders: PublicOrderDetail[] };

interface Props {
  whatsappNumber?: string;
  whatsappMessage?: string;
}

// "Sessão" leve neste navegador — guarda só o CPF (o mesmo "segredo" já usado
// pra destravar a busca) com validade de 30 dias, pra não pedir o CPF de
// novo a cada visita neste dispositivo. Não é autenticação de verdade (não
// existe senha no site), só evita redigitar; sair também é imediato.
const SAVED_CPF_KEY = "tsf_saved_cpf";
const SAVED_CPF_DAYS = 30;

function readSavedCpf(): string | null {
  try {
    const raw = window.localStorage.getItem(SAVED_CPF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cpf: string; savedAt: number };
    const expired = Date.now() - parsed.savedAt > SAVED_CPF_DAYS * 24 * 60 * 60 * 1000;
    if (expired) {
      window.localStorage.removeItem(SAVED_CPF_KEY);
      return null;
    }
    return parsed.cpf;
  } catch {
    return null;
  }
}

function writeSavedCpf(cpf: string) {
  try {
    window.localStorage.setItem(SAVED_CPF_KEY, JSON.stringify({ cpf, savedAt: Date.now() }));
  } catch {
    // localStorage indisponível (modo privado etc.) — só não salva, sem crash
  }
}

function clearSavedCpf() {
  try {
    window.localStorage.removeItem(SAVED_CPF_KEY);
  } catch {
    // idem
  }
}

export default function AcompanharPedidoClient({ whatsappNumber, whatsappMessage }: Props) {
  const [cpf, setCpf] = useState("");
  const [keepSaved, setKeepSaved] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [formError, setFormError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PublicOrderDetail | null>(null);
  const [showFinished, setShowFinished] = useState(false);

  const resetSearchState = () => {
    setFormError("");
    setLookupError("");
    setResult(null);
    setViewingOrder(null);
    setShowFinished(false);
  };

  const handleSearch = useCallback(async (cpfOverride?: string) => {
    const cpfToUse = cpfOverride ?? cpf;
    resetSearchState();
    if (!cpfToUse.trim()) {
      setFormError("Preencha o CPF.");
      return;
    }
    setLoading(true);
    try {
      const res = await lookupOrdersByCpf(cpfToUse);
      if ("error" in res) {
        setLookupError(res.error);
        clearSavedCpf();
        return;
      }
      // "Aguardando pagamento" e "Cancelado" não aparecem aqui — poluem a
      // tela do cliente sem serem úteis (não dá nada pra acompanhar num
      // pedido que nunca foi pago ou que foi cancelado). Continuam existindo
      // no banco normalmente, só não aparecem nessa lista.
      const visibleOrders = res.orders.filter(
        (o) => o.status !== "pending_payment" && o.status !== "cancelled"
      );
      if (visibleOrders.length === 0) {
        setLookupError("Você ainda não tem pedidos pra acompanhar por aqui.");
        return;
      }
      setResult(visibleOrders.length === 1 ? { kind: "single", order: visibleOrders[0] } : { kind: "list", orders: visibleOrders });
      if (keepSaved) writeSavedCpf(cpfToUse);
      else clearSavedCpf();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpf, keepSaved]);

  // Ao carregar a página, tenta reaproveitar o CPF salvo neste dispositivo
  // (se ainda válido) e já busca os pedidos direto, sem o cliente digitar nada.
  useEffect(() => {
    const saved = readSavedCpf();
    if (saved) {
      setCpf(saved);
      handleSearch(saved).finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sem cron: quem "libera" o link de frete/atualiza status é o próprio load
  // desta página (ver lookupOrdersByCpf) — sem repetir a busca, o cliente só
  // vê a mudança dando F5 na mão. Repete em segundo plano, sem loading/spinner
  // e sem resetar o que o cliente já está vendo (lista aberta, pedido aberto,
  // "ver finalizados" etc), só troca os dados por baixo.
  const refreshQuietly = useCallback(async () => {
    const res = await refreshOrdersByCpf(cpf);
    if ("error" in res) return;
    const visibleOrders = res.orders.filter(
      (o) => o.status !== "pending_payment" && o.status !== "cancelled"
    );
    if (visibleOrders.length === 0) return;
    setResult(
      visibleOrders.length === 1
        ? { kind: "single", order: visibleOrders[0] }
        : { kind: "list", orders: visibleOrders }
    );
    setViewingOrder((prev) =>
      prev ? visibleOrders.find((o) => o.order_number === prev.order_number) ?? prev : prev
    );
  }, [cpf]);

  useEffect(() => {
    if (!result) return;
    const interval = setInterval(refreshQuietly, 5_000);
    return () => clearInterval(interval);
  }, [result, refreshQuietly]);

  // Além do polling, atualiza na hora assim que a aba volta a ficar visível
  // (ex: cliente saiu pro app do banco pagar e voltou) — sem isso, dava pra
  // ficar até 5s olhando pra tela desatualizada, ou pior, cair bem no
  // intervalo em que o admin liberou algo um instante antes de voltar.
  useEffect(() => {
    if (!result) return;
    const handleVisible = () => {
      if (document.visibilityState === "visible") refreshQuietly();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [result, refreshQuietly]);

  const handleLogout = () => {
    clearSavedCpf();
    setCpf("");
    resetSearchState();
  };

  const showingDetail = result?.kind === "single" ? result.order : viewingOrder;
  const customerName = result?.kind === "single" ? result.order.customer_name : result?.orders[0]?.customer_name;

  return (
    <div className="py-12">
      <Container size="sm">
        {!result ? (
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-dark-text mb-2">Acompanhar pedido</h1>
            <p className="text-muted">Sem login, sem senha. Informe o CPF usado na compra pra ver seus pedidos.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Package size={22} className="text-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-dark-text truncate">Olá, {customerName}</h1>
                <p className="text-xs text-muted">Estes são os pedidos vinculados ao seu acesso</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-alt border border-dark-border text-xs font-medium text-dark-text hover:border-accent/40 transition-colors flex-shrink-0"
            >
              <LogOut size={14} />
              Sair deste dispositivo
            </button>
          </div>
        )}

        {initializing && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {/* Esconde a busca quando já está vendo o detalhe de um pedido vindo de uma lista */}
        {!initializing && !showingDetail && !result && (
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4 mb-8">
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              maxLength={14}
              leftIcon={<CreditCard size={15} />}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />

            <Toggle
              checked={keepSaved}
              onChange={setKeepSaved}
              label="Manter acesso salvo neste dispositivo por 30 dias"
              description="Assim você não precisa digitar o CPF toda vez que visitar esta página neste navegador."
            />

            {formError && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{formError}</p>
            )}

            <Button variant="accent" fullWidth onClick={() => handleSearch()} isLoading={loading} leftIcon={<Search size={16} />}>
              Buscar meus pedidos
            </Button>
          </div>
        )}

        {/* Resultado: detalhe direto (1 pedido) */}
        {showingDetail && (
          <div className="space-y-4">
            {result?.kind === "list" && (
              <button
                onClick={() => setViewingOrder(null)}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
              >
                <ArrowLeft size={14} />
                Voltar para meus pedidos
              </button>
            )}
            <OrderDetailView key={showingDetail.order_number} order={showingDetail} cpf={cpf} />
          </div>
        )}

        {/* Resultado: lista "Meus pedidos" — os em andamento ficam sempre
            visíveis direto; os finalizados só aparecem se o cliente quiser,
            clicando pra expandir (sem virar uma "categoria" fixa na tela). */}
        {result?.kind === "list" && !viewingOrder && (() => {
          const ongoing = result.orders.filter((o) => o.status !== "completed");
          const finished = result.orders.filter((o) => o.status === "completed");

          return (
            <div className="space-y-3 animate-fade-in">
              {ongoing.map((order) => (
                <OrderSummaryCard key={order.order_number} order={order} onSelect={() => setViewingOrder(order)} />
              ))}

              {finished.length > 0 && (
                <>
                  {!showFinished ? (
                    <button
                      onClick={() => setShowFinished(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted hover:text-accent transition-colors"
                    >
                      Ver pedidos finalizados ({finished.length})
                      <ChevronDown size={15} />
                    </button>
                  ) : (
                    finished.map((order) => (
                      <OrderSummaryCard key={order.order_number} order={order} onSelect={() => setViewingOrder(order)} />
                    ))
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Sem resultado: mensagem elegante + WhatsApp, conforme pedido */}
        {lookupError && (
          <EmptyState
            title={lookupError}
            action={{
              label: "Falar no WhatsApp",
              onClick: () => window.open(generateStoreWhatsAppLink(whatsappNumber, whatsappMessage), "_blank"),
              variant: "accent",
            }}
          />
        )}
      </Container>
    </div>
  );
}
