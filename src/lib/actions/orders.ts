"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminWrite } from "@/lib/auth/admin-guard";
import { transitionOrderStatus } from "@/lib/orders/transition";
import { maybeReleaseShippingLink } from "@/lib/orders/shipping-link";
import { processPaymentResult } from "@/lib/payments/process";
import type { OrderStatus } from "@/types";

// ---------------------------------------------------------------------------
// updateOrderStatus
// Valida a transição, atualiza o pedido, registra o histórico e cria notificação.
// ---------------------------------------------------------------------------

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  notes?: string
): Promise<{ error?: string }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;
  const service = createServiceClient();

  // "Pagamento Confirmado" pelo seletor genérico também não pode ser um
  // simples troca de status — precisa gravar payment_status='confirmed' e
  // payment_confirmed_at (processPaymentResult, o mesmo caminho do webhook/
  // confirmação manual), senão o pedido mostrava "Pagamento Confirmado" mas
  // o link de frete nunca liberava sozinho (depende desse campo pra saber
  // quando começar a contar o prazo).
  if (newStatus === "payment_confirmed") {
    const result = await processPaymentResult({
      service,
      orderId,
      status: "approved",
      paidAt: new Date().toISOString(),
    });
    if (result.error) return result;

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/dashboard");
    return {};
  }

  // "Link de pagamento do Envio" nunca pode ser setado pelo seletor genérico
  // de status — esse status exige sortear e gravar um link (mesma lógica do
  // botão "Liberar agora"). Sem esse desvio, o pedido ficava com o status
  // certo mas shipping_payment_link nulo, e o cliente nunca via o link.
  if (newStatus === "shipping_link_pending") {
    const { data: order, error: fetchError } = await service
      .from("orders")
      .select("id, status, payment_method, payment_confirmed_at")
      .eq("id", orderId)
      .single();
    if (fetchError || !order) return { error: "Pedido não encontrado." };

    const release = await maybeReleaseShippingLink(service, order, { force: true });
    if (!release) {
      return { error: "Cadastre pelo menos um link de frete ativo em Configurações > Frete antes de liberar." };
    }

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/dashboard");
    return {};
  }

  const result = await transitionOrderStatus(service, orderId, newStatus, "admin", notes);
  if (result.error) return result;

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/dashboard");

  return {};
}

// ---------------------------------------------------------------------------
// confirmManualPayment
// Usada no fluxo de pagamento manual (Configurações > Pagamentos no admin):
// o admin confirma que recebeu o pagamento por fora (link enviado pelo
// WhatsApp) depois de conferir nome + ID do pedido mandados pelo cliente.
// Reaproveita processPaymentResult — a mesma função usada por webhook real e
// por dev-confirm — pra garantir que payments.status, orders.payment_status
// e a transição pra "payment_confirmed" (com baixa de estoque via trigger)
// aconteçam exatamente como aconteceriam com um gateway automático.
// ---------------------------------------------------------------------------

export async function confirmManualPayment(orderId: string): Promise<{ error?: string }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;
  const service = createServiceClient();

  const result = await processPaymentResult({
    service,
    orderId,
    status: "approved",
    paidAt: new Date().toISOString(),
  });
  if (result.error) return result;

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/dashboard");

  return {};
}

// ---------------------------------------------------------------------------
// updateOrderInternalNotes
// Salva anotações internas do pedido (visíveis apenas para admins).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// updateOrderTracking
// Salva código/link de rastreio — usado pela tela pública "Acompanhar Pedido"
// pra mostrar o botão "Acompanhar rastreio" e/ou o código da transportadora.
// ---------------------------------------------------------------------------

export async function updateOrderTracking(
  orderId: string,
  trackingCode: string,
  trackingUrl: string
): Promise<{ error?: string }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;
  const service = createServiceClient();

  const { error } = await service
    .from("orders")
    .update({
      tracking_code: trackingCode.trim() || null,
      tracking_url: trackingUrl.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/pedidos/${orderId}`);
  return {};
}

export async function updateOrderInternalNotes(
  orderId: string,
  notes: string
): Promise<{ error?: string }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;
  const service = createServiceClient();

  const { error } = await service
    .from("orders")
    .update({ internal_notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/pedidos/${orderId}`);
  return {};
}

// ---------------------------------------------------------------------------
// forceReleaseShippingLink
// Libera o link de pagamento de frete antes do prazo configurado (Pix/Cartão)
// — exceção manual do admin. Reaproveita maybeReleaseShippingLink com
// force:true, então o sorteio/gravação/transição é idêntico ao automático.
// ---------------------------------------------------------------------------

export async function forceReleaseShippingLink(orderId: string): Promise<{ error?: string }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;
  const service = createServiceClient();

  const { data: order, error: fetchError } = await service
    .from("orders")
    .select("id, status, payment_method, payment_confirmed_at")
    .eq("id", orderId)
    .single();
  if (fetchError || !order) return { error: "Pedido não encontrado." };

  if (order.status !== "payment_confirmed") {
    return { error: "Só é possível liberar o link enquanto o pedido está em 'Pagamento Confirmado'." };
  }

  const release = await maybeReleaseShippingLink(service, order, { force: true });
  if (!release) {
    return { error: "Cadastre pelo menos um link de frete ativo em Configurações > Frete antes de liberar." };
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  return {};
}

// ---------------------------------------------------------------------------
// saveShippingLabel
// Chamada depois do upload da etiqueta em PDF (ver /api/admin/upload-label) —
// grava a URL/path e transiciona o pedido para "label_issued".
// ---------------------------------------------------------------------------

export async function saveShippingLabel(
  orderId: string,
  labelUrl: string,
  storagePath: string
): Promise<{ error?: string }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;
  const service = createServiceClient();

  const { data: order } = await service.from("orders").select("status").eq("id", orderId).single();
  if (!order) return { error: "Pedido não encontrado." };

  if (order.status === "shipping_paid") {
    // Primeiro envio da etiqueta: grava a URL/path JUNTO com a virada de
    // status num único UPDATE (via extraFields) — nunca existe um instante
    // em que o cliente vê a etiqueta sem o resto da tela (mensagem, timeline,
    // confirmação) ter acompanhado.
    const result = await transitionOrderStatus(service, orderId, "label_issued", "admin", "Etiqueta enviada", {
      shipping_label_url: labelUrl,
      shipping_label_storage_path: storagePath,
      label_issued_at: new Date().toISOString(),
    });
    if (result.error) return result;
  } else {
    // Reenvio (status já é label_issued ou depois) — só troca o arquivo, sem
    // mexer no status.
    const { error: updateError } = await service
      .from("orders")
      .update({ shipping_label_url: labelUrl, shipping_label_storage_path: storagePath, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (updateError) return { error: updateError.message };
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  return {};
}
