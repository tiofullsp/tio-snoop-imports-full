"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Truck, MessageCircle, Copy, Check, ImageIcon, ExternalLink, CheckCircle2, FileText, X, Download, Clock, HelpCircle, Clipboard, ChevronDown, AlertTriangle } from "lucide-react";
import { OrderStatusTimeline } from "@/components/public/OrderStatusTimeline";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { StatusBadge, Badge } from "@/components/common/Badge";
import { formatCurrency, formatDate, formatTime } from "@/lib/formatters";
import { maskCpfDisplay } from "@/lib/mask";
import { generateOrderWhatsAppLink } from "@/lib/whatsapp";
import { capitalizeWords } from "@/lib/name";
import { confirmShippingPayment, confirmLabelReceived } from "@/lib/actions/shipping-confirmation";
import type { OrderStatus } from "@/types";
import type { PublicOrderDetail } from "@/lib/actions/order-lookup";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  failed: "Falhou",
  refunded: "Estornado",
  pending: "Pendente",
};

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  confirmed: "success",
  failed: "danger",
  refunded: "warning",
  pending: "neutral",
};

interface Props {
  order: PublicOrderDetail;
  cpf: string;
}

const LABEL_CONFIRMATION_WINDOW_HOURS = 24;

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

// Contagem "d h min" pra prazos longos (o cartão libera em até 7 dias) —
// diferente de formatRemaining, que só mostra h/min (bom o bastante pra
// janela de 24h da confirmação da etiqueta).
function formatCountdownLong(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}min`);
  return parts.join(" ");
}

function formatPremiumDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function OrderDetailView({ order, cpf }: Props) {
  const [copied, setCopied] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  // Override local de status — depois que o cliente confirma o pagamento do
  // frete, atualiza a tela na hora (timeline, mensagem) sem esperar o próximo
  // ciclo de atualização automática. Mas precisa "soltar" assim que o prop
  // real (order.status, vindo do polling em AcompanharPedidoClient) já
  // avançou de verdade — senão fica travado pra sempre mostrando "aguardando
  // etiqueta" mesmo depois do admin já ter emitido a etiqueta (bug real
  // encontrado em produção: o card da etiqueta aparecia, mas a mensagem e a
  // timeline continuavam presas no passo anterior).
  const [shippingPaidOverride, setShippingPaidOverride] = useState(false);
  const [labelConfirmedOverride, setLabelConfirmedOverride] = useState(false);

  useEffect(() => {
    if (shippingPaidOverride && order.status !== "shipping_link_pending") {
      setShippingPaidOverride(false);
    }
  }, [order.status, shippingPaidOverride]);

  const effectiveStatus: OrderStatus = labelConfirmedOverride
    ? "completed"
    : shippingPaidOverride
    ? "shipping_paid"
    : order.status;

  const [labelOpen, setLabelOpen] = useState(false);
  const [shopeeName, setShopeeName] = useState("");
  const [shopeeOrderId, setShopeeOrderId] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [shippingConfirmModalOpen, setShippingConfirmModalOpen] = useState(false);
  const [idHelpOpen, setIdHelpOpen] = useState(false);
  const [pasteError, setPasteError] = useState("");

  // ID do pedido na Shopee sempre começa com número e tem no máximo 14
  // caracteres — avisa e bloqueia o envio antes de mandar pro servidor, em
  // vez de só descobrir depois (ou pior, cortar em silêncio o que foi colado).
  const shopeeIdTrimmed = shopeeOrderId.trim();
  const shopeeIdInvalid = shopeeIdTrimmed.length > 0 && !/^\d/.test(shopeeIdTrimmed);
  const shopeeIdTooLong = shopeeIdTrimmed.length > 14;

  // Nome só com um "termo" (sem sobrenome) costuma ser digitação apressada —
  // exige nome + sobrenome antes de liberar o envio.
  const shopeeNameTrimmed = shopeeName.trim();
  const shopeeNameWordCount = shopeeNameTrimmed.split(/\s+/).filter(Boolean).length;
  const shopeeNameInvalid = shopeeNameTrimmed.length > 0 && shopeeNameWordCount < 2;

  const shippingFormValid =
    shopeeNameWordCount >= 2 && shopeeIdTrimmed.length > 0 && !shopeeIdInvalid && !shopeeIdTooLong;

  const handlePasteShopeeId = async () => {
    setPasteError("");
    if (!navigator.clipboard?.readText) {
      setPasteError("Seu navegador não permite colar automaticamente. Copie o ID na Shopee e tente de novo.");
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setPasteError("Sua área de transferência está vazia. Copie o ID do pedido na Shopee primeiro.");
        return;
      }
      // Nunca corta em silêncio: se veio maior que o ID real da Shopee (14
      // caracteres), cola inteiro mesmo — o aviso abaixo (shopeeIdTooLong)
      // avisa que tem coisa errada, em vez de mandar um ID cortado sem avisar.
      setShopeeOrderId(text);
    } catch {
      setPasteError("Não conseguimos acessar sua área de transferência. Permita o acesso e tente de novo.");
    }
  };

  const [labelConfirmSubmitting, setLabelConfirmSubmitting] = useState(false);
  const [labelConfirmError, setLabelConfirmError] = useState("");
  const [labelConfirmModalOpen, setLabelConfirmModalOpen] = useState(false);

  // Contador regressivo (auto-finalização em 24h da etiqueta, ou liberação do
  // link de frete) — só precisa "tickar" enquanto uma dessas duas telas
  // estiver realmente ativa.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const hasLinkCountdown = effectiveStatus === "payment_confirmed" && !!order.shipping_link_eta;
    if (effectiveStatus !== "label_issued" && !hasLinkCountdown) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [effectiveStatus, order.shipping_link_eta]);

  const labelDeadline = order.label_issued_at
    ? new Date(order.label_issued_at).getTime() + LABEL_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000
    : null;
  const labelMsRemaining = labelDeadline ? labelDeadline - now : null;

  const shippingLinkMsRemaining = order.shipping_link_eta
    ? new Date(order.shipping_link_eta).getTime() - now
    : null;

  const handleOpenShippingConfirmModal = () => {
    setConfirmError("");
    if (!shopeeName.trim() || !shopeeOrderId.trim()) {
      setConfirmError("Preencha nome completo e ID do pedido.");
      return;
    }
    if (shopeeNameWordCount < 2) {
      setConfirmError("Coloque nome e sobrenome.");
      return;
    }
    if (shopeeIdTooLong) {
      setConfirmError("O ID do pedido colado é maior que 14 caracteres. Confira o que você copiou.");
      return;
    }
    if (shopeeIdInvalid) {
      setConfirmError("O ID do pedido da Shopee começa com número. Confira e tente de novo.");
      return;
    }
    setShippingConfirmModalOpen(true);
  };

  const handleConfirmShipping = async () => {
    setConfirmError("");
    setConfirmSubmitting(true);
    const result = await confirmShippingPayment(order.order_number, cpf, shopeeName, shopeeOrderId);
    setConfirmSubmitting(false);
    if ("error" in result) {
      setConfirmError(result.error);
      setShippingConfirmModalOpen(false);
      return;
    }
    setShippingConfirmModalOpen(false);
    setShippingPaidOverride(true);
  };

  const handleConfirmLabel = async () => {
    setLabelConfirmError("");
    setLabelConfirmSubmitting(true);
    const result = await confirmLabelReceived(order.order_number, cpf);
    setLabelConfirmSubmitting(false);
    if ("error" in result) {
      setLabelConfirmError(result.error);
      return;
    }
    setLabelConfirmModalOpen(false);
    setLabelConfirmedOverride(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(order.order_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível — sem feedback, não é crítico
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Resumo do pedido — cabeçalho, produtos, pagamento e dados da compra
          juntos num único card "premium", pra dar uma visão completa do
          pedido de uma vez só, sem precisar rolar por vários blocos soltos. */}
      <div className="bg-dark-surface rounded-2xl border border-accent/20 shadow-[0_8px_30px_-12px_rgba(242,183,5,0.15)] overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted mb-1">Pedido</p>
            <div className="flex items-center gap-2">
              <p className="font-bold font-mono text-dark-text text-lg">{order.order_number}</p>
              <button
                onClick={handleCopy}
                title="Copiar número do pedido"
                className="text-muted hover:text-accent transition-colors p-1"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted mt-1">
              {formatDate(order.created_at)} às {formatTime(order.created_at)}
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={effectiveStatus} />
            <p className="text-lg font-bold text-dark-text mt-2">{formatCurrency(order.total)}</p>
          </div>
        </div>

        {/* Produtos */}
        <div className="px-6 pb-5 pt-1 border-t border-dark-border">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mt-4 mb-2">Produtos</h2>
          <div className="space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 border-b border-dark-border last:border-0">
                <div className="w-12 h-12 rounded-lg bg-dark-alt border border-dark-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.product_image ? (
                    <Image src={item.product_image} alt={item.product_name} width={48} height={48} className="object-cover w-full h-full" unoptimized />
                  ) : (
                    <ImageIcon size={16} className="text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-text truncate">{item.product_name}</p>
                  {item.variant_color_name && item.variant_size && (
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      {item.variant_color_hex && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.variant_color_hex }} />
                      )}
                      {item.variant_color_name} · {item.variant_size}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-0.5">Qtd: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-dark-text flex-shrink-0">{formatCurrency(item.subtotal)}</p>
              </div>
            ))}
          </div>

        </div>

        {/* Financeiro, pagamento e dados da compra — escondidos por padrão pra
            não poluir a tela; o cliente abre só se quiser conferir. */}
        {showMoreInfo && (
          <>
            <div className="px-6 pb-5 pt-1 border-t border-dark-border">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="text-dark-text">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.coupon_discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Cupom</span>
                    <span className="text-success">-{formatCurrency(order.coupon_discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Frete</span>
                  <span className="text-dark-text">
                    {order.shipping_value > 0 ? formatCurrency(order.shipping_value) : "Pago à parte"}
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span className="text-dark-text">Total</span>
                  <span className="text-dark-text text-lg">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 pt-4 border-t border-dark-border space-y-2">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Pagamento</h2>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Forma de pagamento</span>
                <span className="text-dark-text">{order.payment_method === "pix" ? "Pix" : "Cartão"}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted">Status do pagamento</span>
                <Badge
                  variant={PAYMENT_STATUS_VARIANT[order.payment_status] ?? "neutral"}
                  label={PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
                  size="sm"
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-dark-border space-y-2">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Dados da compra</h2>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted flex-shrink-0">Nome</span>
                <span className="text-dark-text text-right truncate">{order.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted flex-shrink-0">CPF</span>
                <span className="text-dark-text text-right">{maskCpfDisplay(cpf) ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted flex-shrink-0">E-mail</span>
                <span className="text-dark-text text-right truncate">{order.customer_email_masked}</span>
              </div>
              {order.customer_phone_masked && (
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted flex-shrink-0">Telefone</span>
                  <span className="text-dark-text text-right">{order.customer_phone_masked}</span>
                </div>
              )}
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted flex-shrink-0">Estado</span>
                <span className="text-dark-text text-right">{order.shipping_state || "—"}</span>
              </div>
            </div>
          </>
        )}

        {/* Toggle — some com subtotal/pagamento/dados por padrão, só abre se
            o cliente quiser conferir os detalhes. */}
        <button
          onClick={() => setShowMoreInfo((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-dark-border text-xs font-semibold text-muted hover:text-accent transition-colors"
        >
          {showMoreInfo ? "Ver menos informações" : "Ver mais informações"}
          <ChevronDown size={14} className={showMoreInfo ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      {/* Timeline */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border p-6">
        <h2 className="text-sm font-bold text-dark-text mb-4">Status do pedido</h2>
        <OrderStatusTimeline currentStatus={effectiveStatus} history={order.status_history} />
      </div>

      {/* Aviso de prazo do link de frete — sempre no cartão (7 dias), e no
          Pix só quando a confirmação caiu numa sexta/sábado/domingo (senão
          libera na hora, sem precisar de aviso nenhum). */}
      {effectiveStatus === "payment_confirmed" && order.shipping_link_eta && (
        <div className="relative bg-dark-surface rounded-2xl border border-accent/30 p-6 space-y-4 overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/40 w-fit mx-auto animate-pulse-accent">
            <Clock size={14} className="text-accent" />
            <p className="text-sm font-bold text-accent uppercase tracking-wide">Pagamento confirmado</p>
          </div>
          <p className="relative text-sm text-muted text-center">
            {order.payment_method === "card" ? (
              <>
                Como o pagamento foi no cartão de crédito, o link de pagamento do frete é liberado
                automaticamente em até 7 dias após a confirmação, sempre pela manhã. Sexta, sábado e
                domingo não têm expedição — se o prazo cair nesses dias, a liberação passa pra próxima
                segunda-feira.
              </>
            ) : (
              <>
                Seu Pix foi confirmado numa sexta, sábado ou domingo — dias sem expedição. O link de
                pagamento do frete é liberado automaticamente no próximo dia útil, sempre pela manhã.
              </>
            )}
          </p>

          {shippingLinkMsRemaining !== null && shippingLinkMsRemaining > 0 ? (
            <div className="relative flex flex-col items-center gap-2 py-4">
              <span className="text-xs text-muted uppercase tracking-wider">Libera em</span>
              <span className="text-3xl font-extrabold text-accent tabular-nums tracking-tight">
                {formatCountdownLong(shippingLinkMsRemaining)}
              </span>
              <span className="text-sm text-dark-text font-medium mt-1">
                {formatPremiumDate(order.shipping_link_eta)}
              </span>
            </div>
          ) : (
            <p className="relative text-sm text-dark-text font-medium">
              Já está no prazo — assim que você recarregar esta página o link deve aparecer.
            </p>
          )}
        </div>
      )}

      {/* Link de pagamento do frete — aparece assim que o sistema libera */}
      {effectiveStatus === "shipping_link_pending" && order.shipping_payment_link && (
        <div className="bg-dark-surface rounded-2xl border border-accent/30 p-6 space-y-4">
          <h2 className="text-sm font-bold text-dark-text flex items-center gap-2">
            <Truck size={15} className="text-accent" />
            Pagamento do frete
          </h2>
          <p className="text-sm text-muted">
            Pague o frete no link abaixo e depois confirme aqui embaixo com seu nome e o ID do
            pedido da Shopee, pra seguirmos com o envio.
          </p>
          <a href={order.shipping_payment_link} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="accent" fullWidth leftIcon={<ExternalLink size={14} />}>
              Pagar o frete
            </Button>
          </a>

          <div className="pt-4 border-t border-dark-border space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/40">
              <CheckCircle2 size={14} className="text-accent" />
              <p className="text-sm font-bold text-accent uppercase tracking-wide">Já pagou? Confirme aqui</p>
            </div>
            <Input
              label="Nome completo (da conta Shopee)"
              value={shopeeName}
              onChange={(e) => setShopeeName(capitalizeWords(e.target.value))}
              placeholder="Nome e sobrenome"
              error={shopeeNameInvalid ? "Coloque nome e sobrenome." : undefined}
            />
            <div className="w-full">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-sm font-medium text-dark-text">
                  ID do pedido (Shopee)
                </label>
                <button
                  type="button"
                  onClick={() => setIdHelpOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/40 text-xs font-bold text-accent hover:bg-accent/25 transition-colors flex-shrink-0"
                >
                  <HelpCircle size={12} />
                  Como pegar o ID?
                </button>
              </div>
              {/* Sem digitação manual — só colar, pra evitar erro de transcrição
                  (trocar 0 por O, esquecer um dígito, etc). Antes de colar, só o
                  botão chamativo aparece; depois de colar, mostra o valor + um
                  jeito de limpar e colar de novo se errou. */}
              {shopeeOrderId ? (
                <div className="flex items-center gap-2">
                  <div
                    className={[
                      "flex-1 min-w-0 bg-dark-surface border rounded-xl px-4 py-2.5 text-sm text-dark-text font-mono truncate",
                      shopeeIdInvalid || shopeeIdTooLong ? "border-danger" : "border-dark-border-light",
                    ].join(" ")}
                  >
                    {shopeeOrderId}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShopeeOrderId("")}
                    title="Limpar"
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-dark-alt border border-dark-border text-muted hover:text-danger hover:border-danger/40 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePasteShopeeId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-danger text-white font-bold text-sm uppercase tracking-wide animate-pulse-accent hover:bg-danger/90 transition-colors"
                >
                  <Clipboard size={16} />
                  Colar aqui seu ID do pedido
                </button>
              )}
            </div>
            {pasteError && <p className="text-sm text-danger">{pasteError}</p>}
            {shopeeIdTooLong && (
              <p className="text-sm text-danger">
                Isso tem {shopeeIdTrimmed.length} caracteres — o ID do pedido da Shopee tem no máximo 14. Confira o que você copiou e cole de novo.
              </p>
            )}
            {!shopeeIdTooLong && shopeeIdInvalid && (
              <p className="text-sm text-danger">O ID do pedido da Shopee sempre começa com número.</p>
            )}
            {confirmError && <p className="text-sm text-danger">{confirmError}</p>}
            <Button
              variant="accent"
              fullWidth
              onClick={handleOpenShippingConfirmModal}
              disabled={!shippingFormValid}
            >
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Tutorial de onde achar o ID do pedido na Shopee */}
      {idHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-dark-surface rounded-2xl border border-accent/40 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-dark-text flex items-center gap-2">
                <HelpCircle size={16} className="text-accent" />
                Como pegar o ID do pedido
              </h3>
              <button
                onClick={() => setIdHelpOpen(false)}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-dark-alt border border-dark-border text-muted hover:text-dark-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <ol className="space-y-3.5">
              {[
                <>Abra a Shopee.</>,
                <>Toque em <span className="text-dark-text font-medium">&quot;Eu&quot;</span> (canto inferior direito).</>,
                <>Toque em <span className="text-dark-text font-medium">&quot;Preparando&quot;</span> dentro de Minhas Compras.</>,
                <>Toque no produto que você comprou.</>,
                <>Role até achar o <span className="text-dark-text font-medium">&quot;ID do pedido&quot;</span>.</>,
                <>Toque em <span className="text-dark-text font-medium">&quot;Copiar&quot;</span>.</>,
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-accent/15 border border-accent/40 text-accent text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-xl overflow-hidden border border-dark-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tutorial-id-pedido-shopee.jfif"
                alt="Onde encontrar o ID do pedido na Shopee"
                className="w-full h-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 flex-shrink-0 rounded-full bg-accent/15 border border-accent/40 text-accent text-xs font-bold flex items-center justify-center">
                7
              </span>
              <span className="text-sm text-muted leading-snug">
                Pronto! Clique em <span className="text-dark-text font-medium">&quot;Colar aqui seu ID do pedido&quot;</span>.
              </span>
            </div>
            <Button variant="secondary" fullWidth onClick={() => setIdHelpOpen(false)}>
              Entendi
            </Button>
          </div>
        </div>
      )}

      {/* Confirmação em duas etapas — mesmo motivo do modal da etiqueta:
          depois de enviado, os dados de frete não dá pra editar. */}
      {shippingConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-dark-surface rounded-2xl border border-accent/40 p-6 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-accent" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-dark-text">Confere os dados?</h3>
              <p className="text-sm text-muted">
                Depois de confirmar não é possível editar. Confira se está tudo certo:
              </p>
            </div>
            <div className="bg-dark-alt border border-dark-border rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted flex-shrink-0">Nome</span>
                <span className="text-dark-text text-right truncate">{shopeeName}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted flex-shrink-0">ID do pedido</span>
                <span className="text-dark-text font-mono text-right truncate">{shopeeOrderId}</span>
              </div>
            </div>
            {confirmError && <p className="text-sm text-danger text-center">{confirmError}</p>}
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="accent"
                fullWidth
                onClick={handleConfirmShipping}
                isLoading={confirmSubmitting}
              >
                Sim, está tudo certo
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setShippingConfirmModalOpen(false)}
                disabled={confirmSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {shippingPaidOverride && (
        <div className="bg-success/10 border border-success/25 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-success flex-shrink-0" />
          <p className="text-sm text-success font-medium">
            Frete confirmado! Estamos preparando a etiqueta de envio.
          </p>
        </div>
      )}

      {/* Etiqueta de envio — disponível assim que o admin emite. Abre num
          visualizador embutido (iframe) em vez de um link direto, pra não
          depender da configuração de cada navegador (alguns forçam download
          de PDF em vez de abrir) — visualizar fica sempre rápido e certo. */}
      {order.shipping_label_url && (
        <>
          {effectiveStatus === "label_issued" && (
            <p className="text-center text-base sm:text-lg font-extrabold uppercase tracking-wide text-accent animate-pulse-accent">
              Clique aqui pra conferir sua etiqueta de envio!!
            </p>
          )}
          <button
            onClick={() => setLabelOpen(true)}
            className={[
              "w-full flex items-center gap-3 bg-dark-surface rounded-2xl border p-5 transition-colors text-left",
              effectiveStatus === "label_issued"
                ? "border-accent animate-glow-pulse hover:border-accent"
                : "border-accent/30 hover:border-accent/50",
            ].join(" ")}
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-dark-text">Etiqueta de envio</p>
              <p className="text-xs text-muted">Toque para visualizar</p>
            </div>
          </button>

          {labelOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="flex items-center justify-between gap-3 p-4 bg-dark-surface border-b border-dark-border">
                <p className="text-sm font-semibold text-dark-text truncate">Etiqueta de envio</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={order.shipping_label_url}
                    download
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-alt border border-dark-border text-xs font-medium text-dark-text hover:border-accent/40 transition-colors"
                  >
                    <Download size={14} />
                    Baixar
                  </a>
                  <button
                    onClick={() => setLabelOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-dark-alt border border-dark-border text-muted hover:text-dark-text transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <iframe
                src={order.shipping_label_url}
                title="Etiqueta de envio"
                className="flex-1 w-full bg-white"
              />
            </div>
          )}
        </>
      )}

      {/* Confirmação da etiqueta — aparece assim que o admin emite. Se o
          cliente não confirmar, o pedido finaliza sozinho em 24h (ver
          maybeAutoCompleteOrder), então o contador aqui é só transparência,
          não uma ameaça: o pedido segue de qualquer jeito. */}
      {effectiveStatus === "label_issued" && (
        <div className="bg-dark-surface rounded-2xl border border-accent/30 p-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/40">
            <CheckCircle2 size={14} className="text-accent" />
            <p className="text-sm font-bold text-accent uppercase tracking-wide">Confira sua etiqueta</p>
          </div>
          <p className="text-sm text-muted">
            Abra a etiqueta acima e confira se os dados estão certos. Estando tudo certo, confirme
            abaixo pra seguirmos com a postagem.
          </p>
          {labelMsRemaining !== null && labelMsRemaining > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted bg-dark-alt border border-dark-border rounded-xl p-3">
              <Clock size={14} className="text-accent flex-shrink-0 mt-0.5" />
              <span>
                Se você não confirmar, finalizamos o pedido automaticamente em{" "}
                <span className="font-semibold text-dark-text">{formatRemaining(labelMsRemaining)}</span>.
              </span>
            </div>
          )}
          {labelConfirmError && <p className="text-sm text-danger">{labelConfirmError}</p>}
          <Button
            variant="accent"
            fullWidth
            leftIcon={<CheckCircle2 size={14} />}
            onClick={() => setLabelConfirmModalOpen(true)}
          >
            Está tudo certo, confirmar
          </Button>
        </div>
      )}

      {/* Confirmação em duas etapas — pedido explícito: como essa ação não
          pode ser desfeita (segue direto pra postagem), garante que o
          cliente não confirma sem querer com um toque errado. */}
      {labelConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-dark-surface rounded-2xl border border-accent/40 p-6 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-accent" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-dark-text">Tem certeza?</h3>
              <p className="text-sm text-muted">
                Confirme só se já conferiu a etiqueta e está tudo certo — nome, endereço e demais
                dados. Depois de confirmar não é possível corrigir.
              </p>
            </div>
            {labelConfirmError && <p className="text-sm text-danger text-center">{labelConfirmError}</p>}
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="accent"
                fullWidth
                onClick={handleConfirmLabel}
                isLoading={labelConfirmSubmitting}
              >
                Sim, está tudo certo
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setLabelConfirmModalOpen(false)}
                disabled={labelConfirmSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mostra sempre que o pedido está finalizado — seja porque acabou de
          confirmar (override local) ou porque já estava assim quando a
          página carregou (ex: auto-finalizado depois de 24h sem confirmar
          a etiqueta). Daqui pra frente o rastreio é só pelo app da Shopee. */}
      {effectiveStatus === "completed" && (
        <div className="relative bg-dark-surface rounded-2xl border border-success/30 shadow-[0_8px_35px_-10px_rgba(16,185,129,0.35)] p-6 sm:p-8 text-center overflow-hidden">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-success/20 blur-2xl" />
            <div className="relative w-16 h-16 bg-success/10 border border-success/30 rounded-full flex items-center justify-center">
              <CheckCircle2 size={30} className="text-success" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-dark-text mb-1">Obrigado pela compra!</h2>
          <p className="text-sm font-semibold text-success mb-4">Equipe Tio Snoop agradece.</p>
          <p className="text-sm text-dark-text font-medium">
            {labelConfirmedOverride ? "Confirmado! Seu pedido está finalizado." : "Seu pedido está finalizado."}
          </p>
          <p className="text-xs text-muted mt-1">
            Agora é só acompanhar a entrega/rastreio direto pelo app da Shopee.
          </p>

          <div className="mt-5 bg-danger/10 border border-danger/40 rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-danger flex-shrink-0" />
              <p className="text-sm font-bold text-danger uppercase tracking-wide">Atenção às regras</p>
            </div>
            <p className="text-sm text-dark-text leading-relaxed">
              É <span className="font-bold">extremamente proibido</span> chamar o vendedor pela Shopee perguntando
              sobre o produto, comentar ou avaliar o pedido por lá. Apenas receba a encomenda normalmente — não
              interaja com nada dentro do app da Shopee.
            </p>
            <p className="text-sm text-danger font-bold mt-2.5">
              Descumprir essa regra resulta em banimento permanente da nossa comunidade.
            </p>
          </div>
        </div>
      )}

      {/* Ações */}
      <a
        href={generateOrderWhatsAppLink({
          orderNumber: order.order_number,
          customerName: order.customer_name,
          items: order.items.map((i) => ({ name: i.product_name, quantity: i.quantity })),
          total: order.total,
        })}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Button variant="secondary" fullWidth leftIcon={<MessageCircle size={14} />}>
          Falar no WhatsApp
        </Button>
      </a>
    </div>
  );
}
