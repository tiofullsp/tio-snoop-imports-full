"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { checkAndRecordLookupAttempt } from "@/lib/order-lookup-rate-limit";
import { digitsOnly, isValidCpf } from "@/lib/cpf";
import { maskPhoneDisplay, maskEmailDisplay } from "@/lib/mask";
import { maybeReleaseShippingLink, maybeAutoCompleteOrder, isBlockedReleaseDay, snapToMorningSaoPaulo, CARD_RELEASE_MORNING_HOUR } from "@/lib/orders/shipping-link";
import type { OrderStatus, PaymentStatus, PaymentMethod, OrderStatusHistory } from "@/types";

// ---------------------------------------------------------------------------
// Busca pública de pedidos (sem login) — só por CPF, sem 2º fator de
// confirmação (decisão consciente: simplicidade para o cliente em troca de
// não confirmar que quem busca é o dono do CPF). Nunca expõe dado bruto: o
// mascaramento acontece aqui, antes de montar a resposta.
// ---------------------------------------------------------------------------

const NOT_FOUND_MESSAGE =
  "Não encontramos pedidos com esse CPF. Confira o número ou fale com nosso atendimento.";
const RATE_LIMIT_MESSAGE = "Muitas tentativas de busca. Aguarde alguns minutos e tente novamente.";

export interface PublicOrderItem {
  id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price_pix: number;
  subtotal: number;
  variant_color_name?: string;
  variant_color_hex?: string;
  variant_size?: string;
}

export interface PublicOrderDetail {
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_confirmed_at: string | null;
  // Preenchido quando o pedido ainda está esperando o link de frete liberar
  // E a espera é "visível" pro cliente: sempre no cartão (7 dias), ou no Pix
  // só quando a confirmação caiu numa sexta/sábado/domingo (sem expedição,
  // ver shipping-link.ts) — Pix em dia útil libera na hora, sem aviso.
  shipping_link_eta: string | null;
  created_at: string;
  subtotal: number;
  coupon_discount: number;
  shipping_value: number;
  total: number;
  customer_name: string;
  customer_phone_masked: string | null;
  customer_email_masked: string;
  shipping_city: string;
  shipping_neighborhood: string;
  shipping_state: string;
  shipping_service: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shipping_payment_link: string | null;
  shipping_customer_name: string | null;
  shipping_order_id: string | null;
  shipping_label_url: string | null;
  label_issued_at: string | null;
  items: PublicOrderItem[];
  status_history: OrderStatusHistory[];
}

export type OrderListLookupResult = { error: string } | { orders: PublicOrderDetail[] };

const ORDER_PUBLIC_FIELDS = `
  id, order_number, customer_id, customer_name, customer_phone, customer_email,
  status, payment_status, payment_method, payment_confirmed_at,
  shipping_city, shipping_neighborhood, shipping_state, shipping_service,
  tracking_code, tracking_url,
  shipping_payment_link, shipping_customer_name, shipping_order_id, shipping_label_storage_path,
  label_issued_at,
  subtotal, coupon_discount, shipping_value, total,
  created_at,
  order_items ( id, product_name, product_image, quantity, unit_price_pix, subtotal, variant_color_name, variant_color_hex, variant_size ),
  order_status_history ( id, order_id, previous_status, new_status, changed_by, notes, created_at )
` as const;

interface OrderPublicRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_confirmed_at: string | null;
  shipping_city: string;
  shipping_neighborhood: string;
  shipping_state: string;
  shipping_service: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shipping_payment_link: string | null;
  shipping_customer_name: string | null;
  shipping_order_id: string | null;
  shipping_label_storage_path: string | null;
  shipping_label_url?: string | null;
  label_issued_at: string | null;
  subtotal: number;
  coupon_discount: number;
  shipping_value: number;
  total: number;
  created_at: string;
  order_items?: {
    id: string;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price_pix: number;
    subtotal: number;
    variant_color_name: string | null;
    variant_color_hex: string | null;
    variant_size: string | null;
  }[];
  order_status_history?: {
    id: string;
    order_id: string;
    previous_status: string | null;
    new_status: string;
    changed_by: string;
    notes: string | null;
    created_at: string;
  }[];
}

function toPublicOrderDetail(row: OrderPublicRow, shippingLinkEta: string | null): PublicOrderDetail {
  return {
    order_number: row.order_number,
    status: row.status as OrderStatus,
    payment_status: row.payment_status as PaymentStatus,
    payment_method: row.payment_method as PaymentMethod,
    payment_confirmed_at: row.payment_confirmed_at,
    shipping_link_eta: shippingLinkEta,
    created_at: row.created_at,
    subtotal: Number(row.subtotal),
    coupon_discount: Number(row.coupon_discount),
    shipping_value: Number(row.shipping_value),
    total: Number(row.total),
    customer_name: row.customer_name,
    customer_phone_masked: maskPhoneDisplay(row.customer_phone),
    customer_email_masked: maskEmailDisplay(row.customer_email),
    shipping_city: row.shipping_city,
    shipping_neighborhood: row.shipping_neighborhood,
    shipping_state: row.shipping_state,
    shipping_service: row.shipping_service,
    tracking_code: row.tracking_code,
    tracking_url: row.tracking_url,
    shipping_payment_link: row.shipping_payment_link,
    shipping_customer_name: row.shipping_customer_name,
    shipping_order_id: row.shipping_order_id,
    shipping_label_url: row.shipping_label_url ?? null,
    label_issued_at: row.label_issued_at,
    items: (row.order_items ?? []).map((i) => ({
      id: i.id,
      product_name: i.product_name,
      product_image: i.product_image ?? undefined,
      quantity: i.quantity,
      unit_price_pix: Number(i.unit_price_pix),
      subtotal: Number(i.subtotal),
      variant_color_name: i.variant_color_name ?? undefined,
      variant_color_hex: i.variant_color_hex ?? undefined,
      variant_size: i.variant_size ?? undefined,
    })),
    status_history: (row.order_status_history ?? [])
      .map((h) => ({
        id: h.id,
        order_id: h.order_id,
        previous_status: (h.previous_status ?? undefined) as OrderStatus | undefined,
        new_status: h.new_status as OrderStatus,
        changed_by: h.changed_by,
        notes: h.notes ?? undefined,
        created_at: h.created_at,
      }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  };
}

export async function lookupOrdersByCpf(cpfRaw: string): Promise<OrderListLookupResult> {
  const { allowed } = await checkAndRecordLookupAttempt();
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  return performOrderLookup(cpfRaw);
}

// Sem rate limit — usada só pra atualização automática em segundo plano
// (ver AcompanharPedidoClient.tsx) de um CPF que o cliente já validou nesta
// mesma sessão. O limite de tentativas existe pra impedir adivinhar CPFs
// aleatórios (enumeração), não pra atrapalhar quem já está vendo o próprio
// pedido e só quer a tela atualizando sozinha.
export async function refreshOrdersByCpf(cpfRaw: string): Promise<OrderListLookupResult> {
  return performOrderLookup(cpfRaw);
}

async function performOrderLookup(cpfRaw: string): Promise<OrderListLookupResult> {
  if (!isValidCpf(cpfRaw)) return { error: "Informe um CPF válido." };

  const service = createServiceClient();
  const cpfDigits = digitsOnly(cpfRaw);

  const { data: customers } = await service
    .from("customers")
    .select("id")
    .eq("cpf_cnpj", cpfDigits);

  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length === 0) return { error: NOT_FOUND_MESSAGE };

  const { data: rows } = await service
    .from("orders")
    .select(ORDER_PUBLIC_FIELDS)
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return { error: NOT_FOUND_MESSAGE };

  const typedRows = rows as unknown as OrderPublicRow[];

  const { data: shippingSettings } = await service
    .from("store_settings_private")
    .select("shipping_link_delay_card_hours, shipping_link_delay_pix_hours")
    .eq("lock", true)
    .single();
  const cardDelayHours = Number(shippingSettings?.shipping_link_delay_card_hours ?? 0);
  const pixDelayHours = Number(shippingSettings?.shipping_link_delay_pix_hours ?? 0);

  const shippingLinkEtas = new Map<string, string | null>();

  // Sem cron: cada busca é a oportunidade de checar se algum pedido já passou
  // do prazo (Pix/Cartão) pra liberar o link de frete — ver shipping-link.ts.
  for (const row of typedRows) {
    // Data estimada de liberação do link de frete — mostrada pro cliente
    // enquanto o pedido ainda está em "Pagamento Confirmado". Cartão sempre
    // mostra (a espera de dias é normal); Pix só mostra quando a confirmação
    // caiu numa sexta/sáb/dom (senão libera na hora, sem aviso nenhum).
    // Empurra pro próximo dia útil de manhã, espelhando a regra real de
    // liberação (maybeReleaseShippingLink).
    if (row.status === "payment_confirmed" && row.payment_confirmed_at) {
      const delayHours = row.payment_method === "card" ? cardDelayHours : pixDelayHours;
      const rawEta = new Date(new Date(row.payment_confirmed_at).getTime() + delayHours * 60 * 60 * 1000);
      const blockedFromStart = isBlockedReleaseDay(rawEta);

      if (row.payment_method === "card" || blockedFromStart) {
        let eta = snapToMorningSaoPaulo(rawEta, CARD_RELEASE_MORNING_HOUR);
        while (isBlockedReleaseDay(eta)) {
          eta = new Date(eta.getTime() + 24 * 60 * 60 * 1000);
        }
        shippingLinkEtas.set(row.id, eta.toISOString());
      }
    }

    const release = await maybeReleaseShippingLink(service, {
      id: row.id,
      status: row.status,
      payment_method: row.payment_method,
      payment_confirmed_at: row.payment_confirmed_at,
    });
    if (release) {
      row.status = release.status;
      row.shipping_payment_link = release.shipping_payment_link;
    }

    // Sem cron: idem acima, mas pra checar se passaram 24h desde a etiqueta
    // emitida sem o cliente confirmar — ver shipping-link.ts.
    const autoComplete = await maybeAutoCompleteOrder(service, {
      id: row.id,
      status: row.status,
      label_issued_at: row.label_issued_at,
    });
    if (autoComplete) row.status = autoComplete.status;

    // Bucket privado (private-documents) — a URL salva expira (ver
    // /api/admin/upload-label). Regenera a cada busca em vez de confiar na
    // URL persistida, pra nunca entregar um link quebrado pro cliente.
    if (row.shipping_label_storage_path) {
      const { data: signed } = await service.storage
        .from("private-documents")
        .createSignedUrl(row.shipping_label_storage_path, 60 * 60 * 24 * 7);
      if (signed) row.shipping_label_url = signed.signedUrl;
    }
  }

  return { orders: typedRows.map((row) => toPublicOrderDetail(row, shippingLinkEtas.get(row.id) ?? null)) };
}
