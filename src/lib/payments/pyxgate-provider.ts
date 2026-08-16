import crypto from "crypto";
import type {
  PaymentProvider,
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentVerificationResult,
  PaymentVerificationStatus,
} from "./types";

// Provider real — PYX Gate (https://www.pyxgate.com/developers/), gateway
// ativo tanto pro Pix quanto pro cartão (ver src/lib/actions/card-payment.ts
// pro cartão, que não passa por getPaymentProvider() — só Pix passa).
//
// Valores trafegam em CENTAVOS inteiros (ex: 1990 = R$19,90) — diferente da
// SupraPay (que usava reais decimais). Sempre converter com centsFromReais.
//
// A URL "https://api.pyxgate.com/v1" da documentação original não existe
// (confirmado com o suporte da PYX Gate) — a URL real de produção é a de
// baixo. Corrigido em 2026-08 após o domínio documentado dar NXDOMAIN.
const PYXGATE_API_BASE =
  process.env.PYXGATE_API_BASE ?? "https://pyxgate-api.onrender.com/v1";

function getSecretKey(): string {
  const key = process.env.PYXGATE_SECRET_KEY;
  if (!key) throw new Error("PYXGATE_SECRET_KEY não configurada.");
  return key;
}

export function centsFromReais(reais: number): number {
  return Math.round(Number(reais) * 100);
}

// A PYX Gate devolve JSON técnico (ex: {"error":{"code":"invalid_payload",
// "param":"customer.email","message":"customer.email inválido."}}) — nunca
// deve chegar assim na tela do cliente. Traduz pro que o cliente realmente
// precisa saber; o JSON cru continua logado no servidor (console.error) pra
// quem for investigar depois.
function friendlyPixCreationError(json: unknown): string {
  const err = (json as { error?: { param?: string; message?: string } } | null)?.error;
  const param = err?.param ?? "";
  const message = err?.message ?? "";
  if (param.includes("email") || message.toLowerCase().includes("email")) {
    return "O e-mail informado não é válido. Verifique e tente novamente.";
  }
  return "Não foi possível gerar o pagamento Pix agora. Tente novamente em instantes ou fale com nosso atendimento.";
}

async function pyxGateRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const secretKey = getSecretKey();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (body != null) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`${PYXGATE_API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // resposta sem corpo (ex: alguns 4xx/5xx)
  }

  return { ok: response.ok, status: response.status, json };
}

// Mapeia o status cru da PYX Gate ("pending" | "paid" | "failed" | "expired")
// pro contrato genérico do app (PaymentVerificationStatus).
export function mapPyxGateStatus(rawStatus: string | undefined | null): PaymentVerificationStatus {
  const s = (rawStatus ?? "").toLowerCase();
  if (s === "paid") return "approved";
  if (s === "expired") return "cancelled";
  if (s === "failed") return "rejected";
  return "pending"; // "pending" ou qualquer valor desconhecido
}

// Verificação de assinatura do webhook — header "PYX-Signature: t=<timestamp>,v1=<hmac>",
// hmac = HMAC-SHA256(webhook_secret, "{t}.{raw_body}") em hex.
export function verifyPyxGateWebhookSignature(
  signatureHeader: string | null,
  rawBody: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const timestamp = parts.t;
  const receivedHmac = parts.v1;
  if (!timestamp || !receivedHmac) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(receivedHmac);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export const pyxgateProvider: PaymentProvider = {
  name: "pyxgate",

  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    const { ok, status, json } = await pyxGateRequest(
      "POST",
      "/payments",
      {
        amount: centsFromReais(input.total),
        payment_method: "pix",
        customer: {
          name: input.customerName,
          email: input.customerEmail,
          document: input.customerDocument ?? "",
        },
        metadata: { order_id: input.orderId, order_number: input.orderNumber },
      },
      // Inclui um sufixo variável (nao so o orderId) -- a PYX Gate cacheia a
      // RESPOSTA por Idempotency-Key, inclusive quando ela mesma falha (ver
      // relato ao suporte: pedido TF00065 ficou preso pra sempre em
      // "payment_creation_failed" porque toda retentativa reenviava a mesma
      // chave e recebia de volta o mesmo erro cacheado). O botão "Tentar
      // novamente" só reexecuta isso quando ainda não existe pix_code salvo
      // (ver needsGeneration em PagamentoClient.tsx), entao nao ha risco real
      // de cobranca duplicada em gerar uma chave nova a cada tentativa.
      `${input.orderId}:${Date.now()}`
    );

    if (!ok) {
      console.error(`PYX Gate recusou a criação do pagamento Pix (${status}):`, JSON.stringify(json));
      throw new Error(friendlyPixCreationError(json));
    }

    const payment = json as {
      id?: string;
      qr_code?: string;
      qr_code_base64?: string;
    };

    if (!payment.id || !payment.qr_code) {
      throw new Error(`PYX Gate: resposta sem id/qr_code: ${JSON.stringify(json)}`);
    }

    return {
      checkoutUrl: `/pagamento/${input.orderId}`,
      externalId: payment.id,
      pixCode: payment.qr_code,
      pixQrBase64: payment.qr_code_base64,
    };
  },

  // Nunca confia só no payload do webhook — confere o status direto na API
  // da PYX Gate antes de liberar o pedido (mesmo padrão de segurança já usado
  // com a SupraPay).
  async verifyPayment(externalId: string): Promise<PaymentVerificationResult> {
    const { ok, json } = await pyxGateRequest("GET", `/payments/${externalId}`);
    if (!ok) return { status: "pending" };

    const payment = json as { id?: string; status?: string };
    if (!payment.id) return { status: "pending" };

    return { status: mapPyxGateStatus(payment.status) };
  },
};
