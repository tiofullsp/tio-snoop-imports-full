"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { processPaymentResult } from "@/lib/payments/process";

export type PixPollStatus = "pending" | "confirmed" | "failed";

// Chamada pelo polling da tela de pagamento (PagamentoClient) a cada poucos
// segundos enquanto o Pix ainda não foi confirmado — consulta a PYX Gate
// DIRETO (GET /v1/payments/{id}, com a secret key do servidor) em vez de só
// esperar o webhook deles chegar, porque na prática o webhook já demorou até
// mais de 1h pra avisar em alguns casos (ver relato mandado pro suporte da
// PYX Gate). A consulta ativa costuma refletir o pagamento mais rápido.
//
// IMPORTANTE: isso roda no servidor de propósito — a secret key
// (PYXGATE_SECRET_KEY) nunca pode ir pro navegador. Se um dia essa checagem
// precisar ser mais frequente que o refresh da página, criar uma rota
// dedicada; por enquanto reaproveita o mesmo Server Action.
export async function checkPixPaymentStatus(orderId: string): Promise<{ status: PixPollStatus }> {
  const service = createServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();
  if (!order) return { status: "pending" };
  if (order.payment_status === "confirmed") return { status: "confirmed" };

  const { data: payment } = await service
    .from("payments")
    .select("external_id, status")
    .eq("order_id", orderId)
    .single();
  if (!payment?.external_id) return { status: "pending" };
  if (payment.status === "failed") return { status: "failed" };

  const provider = await getPaymentProvider();
  const verification = await provider.verifyPayment(payment.external_id);

  if (verification.status === "approved") {
    await processPaymentResult({
      service,
      orderId,
      status: "approved",
      paidAt: verification.paidAt ?? new Date().toISOString(),
    });
    return { status: "confirmed" };
  }

  if (verification.status === "rejected" || verification.status === "cancelled") {
    await processPaymentResult({ service, orderId, status: verification.status });
    return { status: "failed" };
  }

  return { status: "pending" };
}
