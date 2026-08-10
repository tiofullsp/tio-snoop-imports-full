import type {
  PaymentProvider,
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentVerificationResult,
  PaymentVerificationStatus,
} from "./types";

// Provider real — Zendry (https://developers.zendry.com).
//
// IMPORTANTE — histórico: a primeira versão desse provider usava o checkout
// hospedado (POST /v1/charges → link em pay.zendry.com). Trocamos pra Pix
// embutido na própria página (POST /v1/pix/qrcodes) a pedido do dono da loja,
// que não queria o cliente saindo do site pra pagar. Cartão (POST
// /v1/card_payments) usava a Zendry também, mas src/lib/actions/
// card-payment.ts foi migrado pra PYX Gate — este arquivo só fica ativo
// como rollback de Pix agora.
//
// Só entra em uso quando ZENDRY_CLIENT_ID e ZENDRY_CLIENT_SECRET estão
// preenchidos (ver getPaymentProvider em ./index.ts).
export const ZENDRY_API_BASE = "https://api.zendry.com.br";

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ZENDRY_CLIENT_ID;
  const clientSecret = process.env.ZENDRY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ZENDRY_CLIENT_ID / ZENDRY_CLIENT_SECRET não configurados.");
  }
  return { clientId, clientSecret };
}

// Cache do token em memória — válido por 30min (expires_in: 1800), renovado
// com 60s de folga.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getZendryAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${ZENDRY_API_BASE}/auth/generate_token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Zendry recusou a geração do token (${res.status}): ${errorBody}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

// A doc do Zendry não documenta os valores exatos de `status` pros webhooks
// de checkout/pix_qrcode/card_payment — mapeamento por substring,
// case-insensitive, tolerante a variações que a API possa usar.
export function mapZendryStatus(rawStatus: string | undefined | null): PaymentVerificationStatus {
  const s = (rawStatus ?? "").toLowerCase();
  if (/paid|complet|confirm|approv|success|accepted/.test(s)) return "approved";
  if (/cancel|expir|refund|chargeback/.test(s)) return "cancelled";
  if (/reject|fail|denied|declin|refus/.test(s)) return "rejected";
  return "pending";
}

interface ZendryPixQrCodeResponse {
  qrcode: {
    reference_code: string;
    content: string;
    image_base64: string;
  };
}

const PIX_EXPIRATION_SECONDS = 30 * 60;

export const zendryProvider: PaymentProvider = {
  name: "zendry",

  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    const token = await getZendryAccessToken();

    const res = await fetch(`${ZENDRY_API_BASE}/v1/pix/qrcodes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value_cents: Math.round(input.total * 100),
        generator_name: input.customerName,
        ...(input.customerDocument ? { generator_document: input.customerDocument } : {}),
        expiration_time: String(PIX_EXPIRATION_SECONDS),
        external_reference: input.orderNumber,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Zendry recusou a criação do QR Code Pix (${res.status}): ${errorBody}`);
    }

    const { qrcode } = (await res.json()) as ZendryPixQrCodeResponse;

    return {
      checkoutUrl: `/pagamento/${input.orderId}`,
      externalId: qrcode.reference_code,
      pixCode: qrcode.content,
      pixQrBase64: qrcode.image_base64,
    };
  },

  // Não há endpoint de consulta de status confirmado (testei GET
  // /v1/charges/{reference_code} e variações contra a API real — nenhuma
  // respondeu de forma utilizável). A confirmação depende do webhook
  // dedicado (src/app/api/payments/webhook/zendry/route.ts), que confia no
  // payload protegido por um segredo próprio na URL de callback.
  async verifyPayment(): Promise<PaymentVerificationResult> {
    throw new Error(
      "Zendry: não há verificação de status independente disponível — a confirmação chega só pelo webhook dedicado."
    );
  },
};
