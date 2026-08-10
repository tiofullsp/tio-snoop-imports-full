"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Package, StickyNote, Save, ShieldCheck, Copy, CheckCircle2, Truck, Zap } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { OrderStatusTimeline } from "@/components/public/OrderStatusTimeline";
import { LabelUploader } from "@/components/admin/LabelUploader";
import { useBreadcrumbLabel } from "@/components/admin/BreadcrumbContext";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { formatCurrency, formatDateTime, formatDateTimeSeconds } from "@/lib/formatters";
import { maskCpf } from "@/lib/utils";
import {
  updateOrderStatus,
  updateOrderInternalNotes,
  confirmManualPayment,
  forceReleaseShippingLink,
  saveShippingLabel,
} from "@/lib/actions/orders";
import { routes } from "@/lib/routes";
import { ORDER_STATUS_COLORS } from "@/types";
import type { OrderStatus } from "@/types";
import type { AdminOrder } from "@/lib/db/orders";

interface Props {
  order: AdminOrder;
}

export function PedidoClient({ order }: Props) {
  const router = useRouter();
  useBreadcrumbLabel(`/admin/pedidos/${order.id}`, order.order_number);
  const [isPending, startTransition] = useTransition();
  const [internalNotes, setInternalNotes] = useState(order.internal_notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [manualName, setManualName] = useState("");
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [releasingLink, setReleasingLink] = useState(false);
  const [releaseError, setReleaseError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Sem cron: o cliente pode confirmar frete/etiqueta a qualquer momento pelo
  // lado dele, e o admin não devia precisar dar F5 pra ver isso aqui. Repete
  // em segundo plano (router.refresh() só troca os dados do Server Component,
  // sem resetar formulário/estado local desta tela) + atualiza na hora quando
  // a aba volta a ficar em foco.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5_000);
    const handleVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [router]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(order.id, newStatus);
      router.refresh();
    });
  };

  const handleSaveNotes = () => {
    startTransition(async () => {
      await updateOrderInternalNotes(order.id, internalNotes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    });
  };

  const productsSummary = (order.items ?? [])
    .map((item) => `${item.product_name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
    .join(", ");
  const manualSummaryText = `Nome: ${manualName.trim() || "___"}\nProduto(s): ${productsSummary || "___"}\nID DO PEDIDO: ${order.order_number}`;

  const handleCopySummary = () => {
    navigator.clipboard.writeText(manualSummaryText).catch(() => {});
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2000);
  };

  const handleConfirmPayment = () => {
    setConfirmingPayment(true);
    startTransition(async () => {
      await confirmManualPayment(order.id);
      setConfirmingPayment(false);
      router.refresh();
    });
  };

  const handleForceRelease = () => {
    setReleasingLink(true);
    setReleaseError("");
    startTransition(async () => {
      const result = await forceReleaseShippingLink(order.id);
      setReleasingLink(false);
      if (result.error) setReleaseError(result.error);
      else router.refresh();
    });
  };

  const handleCopyShippingLink = () => {
    if (!order.shipping_payment_link) return;
    navigator.clipboard.writeText(order.shipping_payment_link).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleLabelUploaded = (url: string, storagePath: string) => {
    startTransition(async () => {
      await saveShippingLabel(order.id, url, storagePath);
      router.refresh();
    });
  };

  const statusVariant = ORDER_STATUS_COLORS[order.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={routes.admin.pedidos}>
            <button className="w-8 h-8 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center hover:bg-dark-hover transition-colors">
              <ArrowLeft size={15} className="text-muted" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-dark-text font-mono">{order.order_number}</h1>
              <Badge variant={statusVariant} label="" size="sm">
                {/* rendered via OrderStatusSelect below */}
              </Badge>
            </div>
            <p className="text-xs text-muted">{formatDateTime(order.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=Ol%C3%A1%20${encodeURIComponent(order.customer_name)}%2C%20sobre%20seu%20pedido%20${order.order_number}...`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-whatsapp/30 text-whatsapp hover:bg-whatsapp/10 text-xs font-medium transition-all">
              <MessageCircle size={14} />
              WhatsApp cliente
            </button>
          </a>
          <OrderStatusSelect
            currentStatus={order.status}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda */}
        <div className="lg:col-span-2 space-y-5">

          {/* Itens */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h2 className="text-sm font-bold text-dark-text mb-4">Itens do pedido</h2>
            {order.items && order.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left pb-2 text-xs font-semibold text-muted">Produto</th>
                    <th className="text-right pb-2 text-xs font-semibold text-muted">Qtd</th>
                    <th className="text-right pb-2 text-xs font-semibold text-muted">Preço Pix</th>
                    <th className="text-right pb-2 text-xs font-semibold text-muted">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-dark-border last:border-0">
                      <td className="py-3">
                        <div className="text-sm text-dark-text">{item.product_name}</div>
                        {item.variant_color_name && item.variant_size ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                            {item.variant_color_hex && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-dark-border-light flex-shrink-0"
                                style={{ backgroundColor: item.variant_color_hex }}
                              />
                            )}
                            <span>Cor: {item.variant_color_name} · Tamanho: {item.variant_size}</span>
                          </div>
                        ) : null}
                        <div className="text-xs text-muted font-mono">
                          SKU: {item.variant_sku ?? item.product_sku}
                        </div>
                      </td>
                      <td className="py-3 text-right text-muted">{item.quantity}</td>
                      <td className="py-3 text-right text-muted">{formatCurrency(item.unit_price_pix)}</td>
                      <td className="py-3 text-right font-bold text-dark-text">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">Sem itens registrados.</p>
            )}

            {/* Financeiro */}
            <div className="border-t border-dark-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-dark-text">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.coupon_discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Cupom {order.coupon_code && `(${order.coupon_code})`}</span>
                  <span className="text-success">-{formatCurrency(order.coupon_discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">Frete {order.shipping_service && `(${order.shipping_service})`}</span>
                <span className="text-dark-text">
                  {order.shipping_value > 0 ? formatCurrency(order.shipping_value) : "Pago à parte"}
                </span>
              </div>
              {order.insurance_enabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Seguro da mercadoria</span>
                  <span className="text-dark-text">{formatCurrency(order.insurance_value)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span className="text-dark-text">Total</span>
                <span className="text-dark-text text-lg">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h2 className="text-sm font-bold text-dark-text mb-4">Histórico do pedido</h2>
            <OrderStatusTimeline
              currentStatus={order.status}
              history={order.status_history ?? []}
            />
          </div>

          {/* Anotações internas */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote size={14} className="text-muted" />
              <h2 className="text-sm font-bold text-dark-text">Anotações internas</h2>
              <span className="text-xs text-muted">(visível apenas para admins)</span>
            </div>
            <textarea
              value={internalNotes}
              onChange={(e) => { setInternalNotes(e.target.value); setNotesSaved(false); }}
              rows={3}
              placeholder="Adicione observações internas sobre este pedido..."
              className="w-full bg-dark-alt border border-dark-border-light rounded-xl px-3 py-2.5 text-sm text-dark-text placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 resize-none transition-all mb-2"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Save size={13} />}
                onClick={handleSaveNotes}
                isLoading={isPending}
              >
                {notesSaved ? "Salvo!" : "Salvar"}
              </Button>
            </div>
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Cliente */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Cliente</h3>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-dark-text">{order.customer_name}</p>
              <p className="text-xs text-muted">{order.customer_email}</p>
              <p className="text-xs text-muted">{order.customer_phone}</p>
              <p className="text-xs text-muted">
                CPF: {order.customer_cpf ? maskCpf(order.customer_cpf) : "não informado"}
              </p>
            </div>
          </div>

          {/* Entrega */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Entrega</h3>
            <div className="space-y-1 text-sm text-muted">
              {order.shipping_street && (
                <p>{order.shipping_street}, {order.shipping_number}</p>
              )}
              {order.shipping_complement && <p>{order.shipping_complement}</p>}
              {order.shipping_neighborhood && <p>{order.shipping_neighborhood}</p>}
              <p className="text-dark-text">
                {order.shipping_city ? `${order.shipping_city}/` : ""}{order.shipping_state || "Estado não informado"}
                {order.shipping_zip_code && ` · ${order.shipping_zip_code}`}
              </p>
              <p className="text-xs text-muted/70">
                Endereço completo não é coletado — envio combinado à parte via Shopee.
              </p>
              {order.shipping_service && (
                <div className="mt-2 flex items-center gap-2">
                  <Package size={13} className="text-accent" />
                  <span className="text-xs">{order.shipping_service}</span>
                </div>
              )}
              {order.insurance_enabled && (
                <div className="mt-2 flex items-center gap-2 text-success">
                  <ShieldCheck size={13} />
                  <span className="text-xs font-medium">Seguro contratado — reenviar em caso de extravio/avaria</span>
                </div>
              )}
            </div>
          </div>

          {/* Envio — link de pagamento de frete, dados do cliente, etiqueta */}
          {(order.status === "payment_confirmed" ||
            order.status === "shipping_link_pending" ||
            order.status === "shipping_paid" ||
            order.status === "label_issued" ||
            order.status === "completed") && (
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Truck size={13} />
                Envio
              </h3>

              {order.status === "payment_confirmed" && (
                <div className="space-y-2.5">
                  <p className="text-xs text-muted">
                    O link de pagamento do frete é liberado automaticamente pro cliente
                    ({order.payment_method === "pix" ? "Pix" : "Cartão"}, conforme o prazo em
                    Configurações &gt; Frete). Pode liberar antes do prazo se precisar.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    leftIcon={<Zap size={13} />}
                    onClick={handleForceRelease}
                    isLoading={releasingLink}
                  >
                    Liberar agora
                  </Button>
                  {releaseError && <p className="text-xs text-danger">{releaseError}</p>}
                </div>
              )}

              {order.shipping_payment_link && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Link de frete enviado</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-dark-alt rounded-xl px-3 py-2 text-xs text-muted font-mono truncate border border-dark-border">
                      {order.shipping_payment_link}
                    </code>
                    <button
                      onClick={handleCopyShippingLink}
                      className="w-8 h-8 flex-shrink-0 rounded-xl bg-dark-alt border border-dark-border flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 transition-all"
                      title="Copiar link"
                    >
                      {linkCopied ? <CheckCircle2 size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              {order.shipping_customer_name && (
                <div className="mt-3 pt-3 border-t border-dark-border space-y-1">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Dados enviados pelo cliente</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Nome (Shopee)</span>
                    <span className="text-dark-text">{order.shipping_customer_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">ID do pedido</span>
                    <span className="text-dark-text font-mono">{order.shipping_order_id}</span>
                  </div>
                </div>
              )}

              {(order.status === "shipping_paid" || order.shipping_label_url) && (
                <div className="mt-3 pt-3 border-t border-dark-border space-y-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Etiqueta de envio (PDF)</p>
                  <LabelUploader
                    orderId={order.id}
                    initialUrl={order.shipping_label_url}
                    onUploaded={handleLabelUploaded}
                  />
                </div>
              )}

              {order.status === "label_issued" && (
                <div className="mt-3 pt-3 border-t border-dark-border">
                  <p className="text-xs text-muted">
                    Aguardando o cliente confirmar a etiqueta. Se ele não confirmar, o pedido
                    finaliza automaticamente 24h após o envio
                    {order.label_issued_at && (
                      <> (enviada em {new Date(order.label_issued_at).toLocaleString("pt-BR")})</>
                    )}
                    .
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pagamento */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Pagamento</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Método</span>
                <span className="text-dark-text capitalize">
                  {order.payment_method === "pix" ? "Pix" : "Cartão"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Status</span>
                <Badge
                  variant={
                    order.payment_status === "confirmed" ? "success"
                    : order.payment_status === "failed"    ? "danger"
                    : order.payment_status === "refunded"  ? "warning"
                    : "neutral"
                  }
                  label={
                    order.payment_status === "confirmed" ? "Confirmado"
                    : order.payment_status === "failed"    ? "Falhou"
                    : order.payment_status === "refunded"  ? "Estornado"
                    : "Pendente"
                  }
                  size="sm"
                />
              </div>
              {order.payment_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">ID externo</span>
                  <span className="text-xs font-mono text-dark-text truncate max-w-24 text-right" title={order.payment_id}>
                    {order.payment_id}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Confirmação manual — pagamento feito por fora (link enviado pelo WhatsApp).
              Some do pedido assim que confirmado: já cumpriu a função, e deixar visível
              só polui a tela do admin com um pedido que já está resolvido. */}
          {order.payment_status !== "confirmed" && (
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Confirmação manual</h3>
              <p className="text-xs text-muted mb-3">
                Cole o nome que o cliente mandou pra gerar o resumo do pedido.
              </p>
              <Input
                label="Nome enviado pelo cliente"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nome completo"
              />
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Resumo</p>
                <pre className="whitespace-pre-wrap break-words text-xs bg-dark-alt border border-dark-border rounded-xl px-3 py-2.5 text-dark-text font-mono">
{manualSummaryText}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  leftIcon={summaryCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  onClick={handleCopySummary}
                >
                  {summaryCopied ? "Copiado!" : "Copiar resumo"}
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-dark-border">
                <Button
                  variant="accent"
                  size="sm"
                  fullWidth
                  onClick={handleConfirmPayment}
                  isLoading={confirmingPayment}
                >
                  Confirmar pagamento recebido
                </Button>
              </div>
            </div>
          )}

          {/* Data */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Datas</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted">Pedido criado</span>
                <span className="text-dark-text text-xs font-mono text-right">{formatDateTimeSeconds(order.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted">Pagamento confirmado</span>
                <span className="text-dark-text text-xs font-mono text-right">
                  {order.payment_confirmed_at ? formatDateTimeSeconds(order.payment_confirmed_at) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-muted">Atualizado</span>
                <span className="text-dark-text text-xs font-mono text-right">{formatDateTimeSeconds(order.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
