import { createServiceClient } from "@/lib/supabase/server";
import { transitionOrderStatus } from "./transition";
import {
  isBlockedReleaseDay,
  computeShippingLinkDelayReleaseAt,
} from "./shipping-link-timing";

export { isBlockedReleaseDay, CARD_RELEASE_MORNING_HOUR, snapToMorningSaoPaulo } from "./shipping-link-timing";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface ShippingPaymentLink {
  id: string;
  label: string;
  url: string;
  is_active: boolean;
}

interface OrderForRelease {
  id: string;
  status: string;
  payment_method: string;
  payment_confirmed_at: string | null;
}

export interface ShippingLinkRelease {
  status: "shipping_link_pending";
  shipping_payment_link: string;
}

// Sem cron: a liberação do link de frete é calculada sob demanda, chamada em
// toda leitura de pedido (tracking público em order-lookup.ts, admin em
// db/orders.ts). Se o prazo (Pix instantâneo, Cartão configurável em
// Configurações > Frete) já passou desde payment_confirmed_at, sorteia um
// link ativo, grava no pedido (fixo — não resorteia depois) e transiciona o
// status. Retorna o que mudou (para o chamador atualizar a linha já
// carregada em memória, sem precisar de uma segunda query) ou `null` se
// nada mudou.
export async function maybeReleaseShippingLink(
  service: ServiceClient,
  order: OrderForRelease,
  options: { force?: boolean } = {}
): Promise<ShippingLinkRelease | null> {
  if (order.status !== "payment_confirmed" || !order.payment_confirmed_at) return null;

  const { data: settings } = await service
    .from("store_settings_private")
    .select("shipping_payment_links, shipping_link_delay_pix_hours, shipping_link_delay_card_hours")
    .eq("lock", true)
    .single();

  if (!settings) return null;

  if (!options.force) {
    const releaseAt = computeShippingLinkDelayReleaseAt({
      paymentMethod: order.payment_method,
      paymentConfirmedAt: order.payment_confirmed_at,
      delayPixHours: Number(settings.shipping_link_delay_pix_hours),
      delayCardHours: Number(settings.shipping_link_delay_card_hours),
    });
    if (Date.now() < releaseAt.getTime()) return null;

    if (isBlockedReleaseDay(new Date())) return null;
  }

  const links = (settings.shipping_payment_links as ShippingPaymentLink[] | null) ?? [];
  const activeLinks = links.filter((l) => l.is_active && l.url);
  // Nenhum link ativo cadastrado — não bloqueia o pedido, só ainda não libera.
  if (activeLinks.length === 0) return null;

  const chosen = activeLinks[Math.floor(Math.random() * activeLinks.length)];

  const { error: updateError } = await service
    .from("orders")
    .update({ shipping_payment_link: chosen.url })
    .eq("id", order.id);
  if (updateError) return null;

  const { error: transitionError } = await transitionOrderStatus(
    service,
    order.id,
    "shipping_link_pending",
    "system",
    "Link de frete liberado automaticamente"
  );
  if (transitionError) return null;

  return { status: "shipping_link_pending", shipping_payment_link: chosen.url };
}

const LABEL_CONFIRMATION_WINDOW_HOURS = 24;

interface OrderForAutoComplete {
  id: string;
  status: string;
  label_issued_at: string | null;
}

export interface AutoCompleteResult {
  status: "completed";
}

// Mesmo padrão sem cron do release do link acima: se o admin emitiu a
// etiqueta e o cliente não confirmou em 24h, o pedido avança sozinho pra
// "Pedido Finalizado" na próxima vez que alguém ler esse pedido (tracking
// público ou admin) — não trava o fluxo esperando uma ação do cliente.
export async function maybeAutoCompleteOrder(
  service: ServiceClient,
  order: OrderForAutoComplete
): Promise<AutoCompleteResult | null> {
  if (order.status !== "label_issued" || !order.label_issued_at) return null;

  const deadline = new Date(order.label_issued_at).getTime() + LABEL_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000;
  if (Date.now() < deadline) return null;

  const { error: transitionError } = await transitionOrderStatus(
    service,
    order.id,
    "completed",
    "system",
    "Cliente não confirmou a etiqueta em 24h — pedido finalizado automaticamente"
  );
  if (transitionError) return null;

  return { status: "completed" };
}
