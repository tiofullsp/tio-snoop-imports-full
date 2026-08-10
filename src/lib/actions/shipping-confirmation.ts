"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { checkAndRecordLookupAttempt } from "@/lib/order-lookup-rate-limit";
import { digitsOnly, isValidCpf } from "@/lib/cpf";
import { hasFullName } from "@/lib/name";
import { transitionOrderStatus } from "@/lib/orders/transition";

// Primeira Server Action pública de ESCRITA do projeto (todas as outras
// exigem admin logado ou são só leitura). Segurança em duas camadas: rate
// limit por IP (mesmo mecanismo de order-lookup.ts) + exige o CPF do
// cliente batendo com o pedido — o mesmo "segredo" já usado pra encontrar o
// pedido em Acompanhar Pedido, não só o número do pedido (adivinhável).

const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
const NOT_FOUND_MESSAGE = "Não encontramos esse pedido com o CPF informado.";
const INVALID_STATUS_MESSAGE = "Esse pedido não está aguardando confirmação do frete no momento.";

export async function confirmShippingPayment(
  orderNumber: string,
  cpfRaw: string,
  fullName: string,
  shopeeOrderId: string
): Promise<{ error: string } | { ok: true }> {
  const { allowed } = await checkAndRecordLookupAttempt();
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  if (!isValidCpf(cpfRaw)) return { error: "Informe um CPF válido." };

  const name = fullName.trim();
  const shopeeId = shopeeOrderId.trim();
  if (name.length < 3) return { error: "Informe o nome completo." };
  if (!hasFullName(name)) return { error: "Coloque nome e sobrenome." };
  if (!shopeeId) return { error: "Informe o ID do pedido na Shopee." };
  if (shopeeId.length > 14) return { error: "O ID do pedido tem no máximo 14 caracteres." };

  const service = createServiceClient();
  const cpfDigits = digitsOnly(cpfRaw);

  const { data: customers } = await service
    .from("customers")
    .select("id")
    .eq("cpf_cnpj", cpfDigits);

  const customerIds = new Set((customers ?? []).map((c) => c.id));
  if (customerIds.size === 0) return { error: NOT_FOUND_MESSAGE };

  const { data: order } = await service
    .from("orders")
    .select("id, status, customer_id")
    .eq("order_number", orderNumber.trim())
    .maybeSingle();

  if (!order || !order.customer_id || !customerIds.has(order.customer_id)) {
    return { error: NOT_FOUND_MESSAGE };
  }

  if (order.status !== "shipping_link_pending") {
    return { error: INVALID_STATUS_MESSAGE };
  }

  const { error: updateError } = await service
    .from("orders")
    .update({ shipping_customer_name: name, shipping_order_id: shopeeId })
    .eq("id", order.id);
  if (updateError) return { error: "Erro ao salvar os dados. Tente novamente." };

  const { error: transitionError } = await transitionOrderStatus(
    service,
    order.id,
    "shipping_paid",
    "cliente",
    "Cliente confirmou pagamento do frete"
  );
  if (transitionError) return { error: transitionError };

  return { ok: true };
}

const INVALID_LABEL_STATUS_MESSAGE = "Esse pedido não está aguardando confirmação da etiqueta no momento.";

// Segunda Server Action pública de escrita — mesmo padrão de segurança da
// anterior (rate limit + CPF batendo com o pedido). O cliente confirma que
// viu a etiqueta e está tudo certo; se ele nunca confirmar, o pedido avança
// sozinho pra "completed" depois de 24h (ver maybeAutoCompleteOrder).
export async function confirmLabelReceived(
  orderNumber: string,
  cpfRaw: string
): Promise<{ error: string } | { ok: true }> {
  const { allowed } = await checkAndRecordLookupAttempt();
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  if (!isValidCpf(cpfRaw)) return { error: "Informe um CPF válido." };

  const service = createServiceClient();
  const cpfDigits = digitsOnly(cpfRaw);

  const { data: customers } = await service
    .from("customers")
    .select("id")
    .eq("cpf_cnpj", cpfDigits);

  const customerIds = new Set((customers ?? []).map((c) => c.id));
  if (customerIds.size === 0) return { error: NOT_FOUND_MESSAGE };

  const { data: order } = await service
    .from("orders")
    .select("id, status, customer_id")
    .eq("order_number", orderNumber.trim())
    .maybeSingle();

  if (!order || !order.customer_id || !customerIds.has(order.customer_id)) {
    return { error: NOT_FOUND_MESSAGE };
  }

  if (order.status !== "label_issued") {
    return { error: INVALID_LABEL_STATUS_MESSAGE };
  }

  const { error: transitionError } = await transitionOrderStatus(
    service,
    order.id,
    "completed",
    "cliente",
    "Cliente confirmou que a etiqueta está correta"
  );
  if (transitionError) return { error: transitionError };

  return { ok: true };
}
