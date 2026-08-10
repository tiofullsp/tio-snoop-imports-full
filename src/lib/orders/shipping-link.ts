import { createServiceClient } from "@/lib/supabase/server";
import { transitionOrderStatus } from "./transition";

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

// Sexta, sábado e domingo ficam de fora da liberação automática — a
// logística (Shopee/Correios) não roda no fim de semana, então liberar o
// link nesses dias só faz o cliente pagar o frete e ficar sem novidade até
// segunda. Sem cron: o pedido simplesmente não libera enquanto isso, e
// libera sozinho assim que alguém ler o pedido num dia útil (mesmo padrão
// "sob demanda" do resto deste arquivo). Não afeta a liberação manual
// (force:true) — essa continua funcionando em qualquer dia, é exceção do admin.
export function isBlockedReleaseDay(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(date);
  return weekday === "Fri" || weekday === "Sat" || weekday === "Sun";
}

// Horário em que o link do cartão libera — cedo de manhã, não na hora exata
// (ex: 22h) em que o prazo de dias completou. Só se aplica ao cartão (Pix
// continua instantâneo, 0h de espera). América/Sao_Paulo não observa horário
// de verão desde 2019, então -03:00 é um offset fixo seguro aqui.
export const CARD_RELEASE_MORNING_HOUR = 8;

export function snapToMorningSaoPaulo(date: Date, hour: number): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T${String(hour).padStart(2, "0")}:00:00-03:00`);
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
    const delayHours =
      order.payment_method === "card"
        ? Number(settings.shipping_link_delay_card_hours)
        : Number(settings.shipping_link_delay_pix_hours);

    let releaseAt = new Date(order.payment_confirmed_at).getTime() + delayHours * 60 * 60 * 1000;
    if (order.payment_method === "card") {
      releaseAt = snapToMorningSaoPaulo(new Date(releaseAt), CARD_RELEASE_MORNING_HOUR).getTime();
    }
    if (Date.now() < releaseAt) return null;

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
