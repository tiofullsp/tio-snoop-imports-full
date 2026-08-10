import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processPaymentResult } from "@/lib/payments/process";
import { pyxgateProvider, verifyPyxGateWebhookSignature } from "@/lib/payments/pyxgate-provider";
import type { Json } from "@/types/database.types";

// POST /api/payments/webhook/pyxgate — chamado pela PYX Gate em
// payment.created / payment.paid / payment.failed / payment.expired.
// Cadastrar esta URL no painel da PYX Gate (Developers > Webhook Endpoints):
//   https://SEUDOMINIO.com/api/payments/webhook/pyxgate
//
// Verifica a assinatura HMAC (header PYX-Signature: t=<ts>,v1=<hmac>) e,
// mesmo assim, nunca confia só no payload pra liberar o pedido — sempre
// confirma direto na API via pyxgateProvider.verifyPayment antes de chamar
// processPaymentResult (mesmo padrão de segurança já usado com a SupraPay).
// Idempotente via UNIQUE(external_id, action) em payment_webhooks.

export async function POST(request: NextRequest) {
  // Precisa do corpo BRUTO (string exata recebida) pra recalcular o HMAC —
  // um JSON.parse()/stringify() poderia mudar a formatação e invalidar o hash.
  const rawBody = await request.text();

  let payload: {
    id?: string;
    type?: string;
    data?: { object?: { id?: string; status?: string } };
  } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[webhook pyxgate] corpo não é JSON válido:", rawBody.slice(0, 500));
    return NextResponse.json({ ok: true });
  }

  const paymentId = payload.data?.object?.id;
  if (!paymentId) {
    console.error("[webhook pyxgate] payload sem data.object.id — payload recebido:", JSON.stringify(payload).slice(0, 1000));
    return NextResponse.json({ ok: true });
  }

  const webhookSecret = process.env.PYXGATE_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" && !webhookSecret) {
    console.error("[webhook pyxgate] PYXGATE_WEBHOOK_SECRET não configurado em produção — webhook recusado.");
    return NextResponse.json({ error: "Webhook secret não configurado" }, { status: 500 });
  }

  if (webhookSecret) {
    const isValid = verifyPyxGateWebhookSignature(
      request.headers.get("pyx-signature"),
      rawBody,
      webhookSecret
    );
    if (!isValid) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  } else {
    console.warn("[webhook pyxgate] PYXGATE_WEBHOOK_SECRET não configurado — assinatura não verificada.");
  }

  const action = payload.type ?? "unknown";
  const service = createServiceClient();

  // Registra o evento antes de processar — se já existir (mesmo external_id +
  // action), a constraint única bloqueia o insert e sabemos que é repetido.
  const { error: insertError } = await service.from("payment_webhooks").insert({
    external_id: paymentId,
    type: "pyxgate_payment",
    action,
    raw_payload: payload as Json,
  });

  if (insertError) {
    // 23505 = unique_violation — evento já processado antes, ignora.
    return NextResponse.json({ ok: true });
  }

  try {
    const verification = await pyxgateProvider.verifyPayment(paymentId);

    const { data: payment } = await service
      .from("payments")
      .select("order_id")
      .eq("external_id", paymentId)
      .single();

    if (payment) {
      const result = await processPaymentResult({
        service,
        orderId: payment.order_id,
        status: verification.status,
        paidAt: verification.paidAt,
      });

      if (result.error) {
        await service.from("payment_webhooks").update({ error: result.error }).eq("external_id", paymentId).eq("action", action);
      }
    }

    await service
      .from("payment_webhooks")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("external_id", paymentId)
      .eq("action", action);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar webhook.";
    await service.from("payment_webhooks").update({ error: message }).eq("external_id", paymentId).eq("action", action);
  }

  return NextResponse.json({ ok: true });
}
