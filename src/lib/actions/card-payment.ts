"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { processPaymentResult } from "@/lib/payments/process";
import { centsFromReais } from "@/lib/payments/pyxgate-provider";
import { computeCardTotalForInstallments } from "@/lib/pricing";
import { digitsOnly } from "@/lib/cpf";

// Pagamento por cartão via PYX Gate (POST /v1/payments, payment_method:
// "card") — diferente do Pix (gerado automaticamente na criação do pedido),
// o cartão só acontece quando o cliente escolhe essa aba e preenche o
// formulário na tela de pagamento. Chamado direto do nosso servidor com o
// Bearer secreto — os dados do cartão NUNCA devem ser logados, impressos em
// erro, nem salvos em nenhuma coluna/metadata (só os campos seguros da
// resposta).
//
// IMPORTANTE: a PYX Gate confirmou (suporte, 2026-08) que não existe
// tokenização client-side — número/validade/CVV trafegam direto no corpo
// desta requisição, o que coloca a loja no escopo de responsabilidade
// PCI-DSS. Decisão consciente do dono da loja, ciente do risco.
//
// 3DS é obrigatório — o desafio roda no navegador via
// ZendrySDKThreeds.init_threeds() (a PYX Gate roteia o desafio 3DS de cartão
// pela Zendry por trás, ver src/app/api/payments/pyxgate-3ds-token) e o
// resultado (three_ds_data) chega pronto aqui, só repassado como
// threeds_data pra API da PYX Gate.

export interface CardPaymentThreedsData {
  operation_session_id: string;
  cavv: string;
  xid: string;
  eci: string;
  secure_version: string;
  directory_server_transaction_id: string;
  three_ds_server_transaction_id: string;
  ip_address: string;
  user_agent_browser_value: string;
  http_browser_language: string;
  http_browser_screen_height: string;
  http_browser_screen_width: string;
  zip_code: string;
}

export interface CardBillingAddress {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface CardPaymentInput {
  orderId: string;
  cardNumber: string;
  cardExpirationDate: string; // "MMyyyy"
  cardSecurityCode: string;
  cardHolderName: string;
  cardHolderDocument: string;
  installments: number;
  billingAddress: CardBillingAddress;
  threedsData: CardPaymentThreedsData;
}

interface PyxGateCardPaymentResponse {
  id: string;
  status: "paid" | "pending" | "failed" | string;
}

function validate(input: CardPaymentInput): string | null {
  const cardNumber = digitsOnly(input.cardNumber);
  if (cardNumber.length < 13 || cardNumber.length > 19) return "Número do cartão inválido.";
  if (!/^\d{6}$/.test(input.cardExpirationDate)) return "Validade do cartão inválida.";
  if (!/^\d{3,4}$/.test(input.cardSecurityCode)) return "Código de segurança (CVV) inválido.";
  if (!input.cardHolderName.trim()) return "Nome impresso no cartão é obrigatório.";
  if (!digitsOnly(input.cardHolderDocument)) return "CPF do titular do cartão é obrigatório.";
  if (input.installments < 1 || input.installments > 12) return "Número de parcelas inválido.";
  const addr = input.billingAddress;
  if (!addr || digitsOnly(addr.zipCode).length !== 8 || !addr.street.trim() || !addr.number.trim() || !addr.neighborhood.trim() || !addr.city.trim() || !addr.state.trim()) {
    return "Endereço de cobrança incompleto.";
  }
  if (!input.threedsData?.operation_session_id) return "Autenticação de segurança do cartão (3DS) não foi concluída.";
  return null;
}

export async function payWithCard(
  input: CardPaymentInput
): Promise<{ error: string } | { ok: true }> {
  const validationError = validate(input);
  if (validationError) return { error: validationError };

  const service = createServiceClient();

  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, order_number, total, payment_status, customer_name, customer_email")
    .eq("id", input.orderId)
    .single();

  if (orderError || !order) return { error: "Pedido não encontrado." };
  if (order.payment_status === "confirmed") return { ok: true }; // já pago — idempotente

  // Valor real cobrado no cartão — Pix + taxa da bandeira pro número de
  // parcelas escolhido (tabela em src/lib/pricing.ts). Nunca confia num total
  // vindo do cliente; sempre recalcula aqui a partir do pedido.
  const cardTotal = computeCardTotalForInstallments(Number(order.total), input.installments);
  const secretKey = process.env.PYXGATE_SECRET_KEY;
  if (!secretKey) return { error: "Pagamento por cartão indisponível no momento. Tente pelo Pix." };

  const apiBase = process.env.PYXGATE_API_BASE ?? "https://pyxgate-api.onrender.com/v1";

  let res: Response;
  try {
    res = await fetch(`${apiBase}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${input.orderId}-card`,
      },
      body: JSON.stringify({
        amount: centsFromReais(cardTotal),
        payment_method: "card",
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          document: digitsOnly(input.cardHolderDocument),
        },
        metadata: { order_id: input.orderId, order_number: order.order_number },
        billing_address: {
          zip_code: digitsOnly(input.billingAddress.zipCode),
          street: input.billingAddress.street.trim(),
          number: input.billingAddress.number.trim(),
          complement: input.billingAddress.complement.trim(),
          neighborhood: input.billingAddress.neighborhood.trim(),
          city: input.billingAddress.city.trim(),
          state: input.billingAddress.state.trim(),
        },
        card: {
          number: digitsOnly(input.cardNumber),
          holder_name: input.cardHolderName.trim(),
          expiration_date: input.cardExpirationDate,
          security_code: input.cardSecurityCode,
          installments: input.installments,
        },
        threeds_data: input.threedsData,
      }),
    });
  } catch {
    // Nunca inclui o corpo da requisição (tem dados do cartão) em erro nenhum.
    return { error: "Erro de conexão com o gateway de pagamento. Tente novamente." };
  }

  if (!res.ok) {
    let message = "Pagamento recusado pela operadora do cartão.";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // corpo não veio como JSON — mantém a mensagem genérica
    }
    return { error: message };
  }

  const payment = (await res.json()) as PyxGateCardPaymentResponse;

  await service
    .from("payments")
    .update({ method: "card", external_id: payment.id })
    .eq("order_id", input.orderId);

  if (payment.status !== "paid") {
    return { error: "Pagamento recusado pela operadora do cartão." };
  }

  const result = await processPaymentResult({
    service,
    orderId: input.orderId,
    status: "approved",
    paidAt: new Date().toISOString(),
  });

  if (result.error) return { error: result.error };
  return { ok: true };
}
