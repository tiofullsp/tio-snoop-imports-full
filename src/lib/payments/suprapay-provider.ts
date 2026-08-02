import crypto from "crypto";
import type {
  PaymentProvider,
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentVerificationResult,
  PaymentVerificationStatus,
} from "./types";

// Provider real — SupraPay (Pix API v1.1.0, https://app.suprapay.com.py).
// Só cuida de Pix — pagamento por cartão continua via Zendry
// (src/lib/actions/card-payment.ts), que não passa por getPaymentProvider().
//
// Só entra em uso quando SUPRAPAY_API_KEY e SUPRAPAY_API_SECRET estão
// preenchidos (ver getPaymentProvider em ./index.ts).
const SUPRAPAY_ORIGIN = "https://app.suprapay.com.py";

function getCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.SUPRAPAY_API_KEY;
  const apiSecret = process.env.SUPRAPAY_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("SUPRAPAY_API_KEY / SUPRAPAY_API_SECRET não configurados.");
  }
  return { apiKey, apiSecret };
}

// Assinatura HMAC v2 (seção 05 do guia da SupraPay): concatena exatamente 5
// linhas separadas por \n (LF) — timestamp, nonce, method, path (com prefixo
// /api/v1/integrations), sha256 hex do body — e assina com HMAC-SHA256
// usando o API Secret. O `path` NUNCA inclui a origin, só o path.
function signRequest(
  apiSecret: string,
  timestamp: string,
  nonce: string,
  method: string,
  path: string,
  body: string
): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  const payload = [timestamp, nonce, method, path, bodyHash].join("\n");
  return crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
}

async function supraPayRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const { apiKey, apiSecret } = getCredentials();

  const bodyStr = body != null ? JSON.stringify(body) : "";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const signature = signRequest(apiSecret, timestamp, nonce, method, path, bodyStr);

  const headers: Record<string, string> = {
    "X-Supra-Key": apiKey,
    "X-Supra-Timestamp": timestamp,
    "X-Supra-Nonce": nonce,
    "X-Supra-Signature": signature,
  };
  if (body != null) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`${SUPRAPAY_ORIGIN}${path}`, {
    method,
    headers,
    body: body != null ? bodyStr : undefined,
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // resposta sem corpo (ex: alguns 4xx/5xx)
  }

  return { ok: response.ok, status: response.status, json };
}

// Mapeia o status cru da SupraPay ("pending" | "processing" | "paid" |
// "expired" | "cancelled" | "refunded" | "failed") pro contrato genérico do
// app (PaymentVerificationStatus).
export function mapSupraPayStatus(rawStatus: string | undefined | null): PaymentVerificationStatus {
  const s = (rawStatus ?? "").toLowerCase();
  if (s === "paid") return "approved";
  if (s === "expired" || s === "cancelled" || s === "refunded") return "cancelled";
  if (s === "failed") return "rejected";
  return "pending"; // "pending" | "processing" | qualquer valor desconhecido
}

// Validação de assinatura do webhook (seção 13 do guia): HMAC-SHA256 hex de
// "{timestamp}\n{body_json}" usando o Webhook Secret (segredo separado do
// API Secret, entregue no registro do webhook no painel da SupraPay).
export function verifySupraPayWebhookSignature(
  timestampHeader: string | null,
  signatureHeader: string | null,
  rawBody: string,
  webhookSecret: string
): boolean {
  if (!timestampHeader || !signatureHeader) return false;

  const payload = `${timestampHeader}\n${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export const suprapayProvider: PaymentProvider = {
  name: "suprapay",

  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    const path = "/api/v1/integrations/pix/charges";
    const { ok, status, json } = await supraPayRequest(
      "POST",
      path,
      { amount: input.total, external_reference: input.orderId },
      // UUID único por pedido — evita cobrança duplicada em caso de retentativa.
      input.orderId
    );

    if (!ok) {
      throw new Error(`SupraPay recusou a criação da cobrança Pix (${status}): ${JSON.stringify(json)}`);
    }

    const charge = (json as { data?: { charge?: Record<string, unknown> } })?.data?.charge;
    const qrCode = (charge?.qr_code as string | undefined) ?? (charge?.qr_code_text as string | undefined);
    const txid = charge?.txid as string | undefined;

    if (!txid || !qrCode) {
      throw new Error(`SupraPay: resposta sem txid/qr_code: ${JSON.stringify(json)}`);
    }

    return {
      checkoutUrl: `/pagamento/${input.orderId}`,
      externalId: txid,
      pixCode: qrCode,
    };
  },

  // Nunca confia só no payload do webhook — confere o status direto na API
  // da SupraPay antes de liberar o pedido (recomendação de segurança da
  // própria documentação da SupraPay).
  async verifyPayment(externalId: string): Promise<PaymentVerificationResult> {
    const path = `/api/v1/integrations/pix/charges/${externalId}/status`;
    const { ok, json } = await supraPayRequest("GET", path);
    if (!ok) return { status: "pending" };

    const data = (json as { data?: Record<string, unknown> })?.data;
    if (!data?.txid) return { status: "pending" };

    return { status: mapSupraPayStatus(data.status as string | undefined) };
  },
};
