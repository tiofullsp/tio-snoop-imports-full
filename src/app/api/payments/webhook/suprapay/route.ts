import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processPaymentResult } from "@/lib/payments/process";
import { suprapayProvider, verifySupraPayWebhookSignature } from "@/lib/payments/suprapay-provider";
import type { Json } from "@/types/database.types";

// POST /api/payments/webhook/suprapay — chamado pela SupraPay sempre que um
// evento de cobrança Pix ocorre (pix.charge.paid, pix.charge.expired etc).
// Cadastrar esta URL no painel da SupraPay:
//   https://SEUDOMINIO.com/api/payments/webhook/suprapay
//
// Diferente do webhook do Zendry (que confia direto no payload — a doc do
// Zendry não documenta assinatura), este verifica a assinatura HMAC
// (X-Supra-Webhook-*) E, mesmo assim, nunca confia só no payload pra liberar
// o pedido: sempre confirma direto na API via suprapayProvider.verifyPayment
// antes de chamar processPaymentResult — recomendação de segurança da
// própria documentação da SupraPay. Idempotente via UNIQUE(external_id,
// action) em payment_webhooks, mesmo padrão do resto da camada de pagamentos.
const MAX_WEBHOOK_SKEW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  // Precisa do corpo BRUTO (string exata recebida) pra recalcular a
  // assinatura — um JSON.parse()/stringify() poderia mudar a formatação e
  // invalidar o hash.
  const rawBody = await request.text();

  let payload: { event?: string; data?: { txid?: string; external_reference?: string } } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const txid = payload.data?.txid;
  if (!txid) return NextResponse.json({ ok: true });

  const webhookSecret = process.env.SUPRAPAY_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" && !webhookSecret) {
    console.error("[webhook suprapay] SUPRAPAY_WEBHOOK_SECRET não configurado em produção — webhook recusado.");
    return NextResponse.json({ error: "Webhook secret não configurado" }, { status: 500 });
  }

  if (webhookSecret) {
    const timestampHeader = request.headers.get("x-supra-webhook-timestamp");
    const timestampMs = Number(timestampHeader) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_WEBHOOK_SKEW_MS) {
      return NextResponse.json({ error: "Timestamp inválido ou expirado" }, { status: 401 });
    }

    const isValid = verifySupraPayWebhookSignature(
      timestampHeader,
      request.headers.get("x-supra-webhook-signature"),
      rawBody,
      webhookSecret
    );
    if (!isValid) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  } else {
    console.warn("[webhook suprapay] SUPRAPAY_WEBHOOK_SECRET não configurado — assinatura não verificada.");
  }

  const action = `pix_charge.${payload.event ?? "unknown"}`;
  const service = createServiceClient();

  // Registra o evento antes de processar — se já existir (mesmo external_id +
  // action), a constraint única bloqueia o insert e sabemos que é repetido.
  const { error: insertError } = await service.from("payment_webhooks").insert({
    external_id: txid,
    type: "suprapay_pix_charge",
    action,
    raw_payload: payload as Json,
  });

  if (insertError) {
    // 23505 = unique_violation — evento já processado antes, ignora.
    return NextResponse.json({ ok: true });
  }

  try {
    const verification = await suprapayProvider.verifyPayment(txid);

    const { data: payment } = await service
      .from("payments")
      .select("order_id")
      .eq("external_id", txid)
      .single();

    if (payment) {
      const result = await processPaymentResult({
        service,
        orderId: payment.order_id,
        status: verification.status,
        paidAt: verification.paidAt,
      });

      if (result.error) {
        await service.from("payment_webhooks").update({ error: result.error }).eq("external_id", txid).eq("action", action);
      }
    }

    await service
      .from("payment_webhooks")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("external_id", txid)
      .eq("action", action);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar webhook.";
    await service.from("payment_webhooks").update({ error: message }).eq("external_id", txid).eq("action", action);
  }

  return NextResponse.json({ ok: true });
}
