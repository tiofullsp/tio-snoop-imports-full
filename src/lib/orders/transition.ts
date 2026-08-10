import { createServiceClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS } from "@/types";
import type { OrderStatus } from "@/types";
import { VALID_TRANSITIONS } from "./status-transitions";

// Única fonte de verdade para mudança de status de pedido — usada pela action
// de admin (updateOrderStatus) e pelo processamento de pagamento (webhook /
// dev-confirm), garantindo que toda transição sempre grava histórico e
// notificação, não importa quem a disparou.

export { VALID_TRANSITIONS };

type ServiceClient = ReturnType<typeof createServiceClient>;

export async function transitionOrderStatus(
  service: ServiceClient,
  orderId: string,
  newStatus: OrderStatus,
  changedBy: string,
  notes?: string,
  extraFields?: Record<string, unknown>
): Promise<{ error?: string }> {
  const { data: order, error: fetchError } = await service
    .from("orders")
    .select("id, order_number, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return { error: "Pedido não encontrado." };
  }

  const currentStatus = order.status as OrderStatus;
  if (currentStatus === newStatus) return {};

  const validNext = VALID_TRANSITIONS[currentStatus];
  if (!validNext.includes(newStatus)) {
    return { error: `Transição inválida: ${ORDER_STATUS_LABELS[currentStatus]} → ${ORDER_STATUS_LABELS[newStatus]}` };
  }

  // extraFields entra no MESMO update do status — ex: a etiqueta (URL +
  // label_issued_at) junto com a virada pra "label_issued". Um único UPDATE
  // é atômico por linha: quem ler o pedido nunca pega um instante em que só
  // um dos dois já mudou (etiqueta visível com status ainda no passo
  // anterior, timeline incompleta, etc).
  const { error: updateError } = await service
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString(), ...extraFields })
    .eq("id", orderId);

  if (updateError) return { error: updateError.message };

  await service.from("order_status_history").insert({
    order_id:        orderId,
    previous_status: currentStatus,
    new_status:      newStatus,
    changed_by:      changedBy,
    notes:           notes ?? null,
  });

  await service.from("notifications").insert({
    type:  "order_status_change",
    title: "Status do pedido atualizado",
    body:  `Pedido ${order.order_number}: ${ORDER_STATUS_LABELS[currentStatus]} → ${ORDER_STATUS_LABELS[newStatus]}`,
    data:  {
      order_id:        orderId,
      order_number:    order.order_number,
      previous_status: currentStatus,
      new_status:      newStatus,
    },
  });

  return {};
}
