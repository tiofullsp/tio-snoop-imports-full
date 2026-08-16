import { createServiceClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "./index";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface CreatePaymentPreferenceResult {
  checkoutUrl: string;
  pixCode?: string;
  pixQrUrl?: string;
  externalCheckoutUrl?: string;
}

// Busca o pedido + itens reais no banco, pede ao provider ativo (stub hoje,
// gateway real depois) uma preferência de pagamento, e persiste o
// external_id/pix_code retornado em `payments`. Usado tanto pelo checkout
// (logo após criar o pedido) quanto pelo Route Handler /api/payments/create-preference
// (retry manual de pagamento).
export async function createPaymentPreferenceForOrder(
  service: ServiceClient,
  orderId: string
): Promise<CreatePaymentPreferenceResult | { error: string }> {
  const { data: order, error: orderError } = await service
    .from("orders")
    .select(
      "id, order_number, total, customer_name, customer_email, customer_phone, customer_id, customers(cpf_cnpj), order_items(product_name, quantity, unit_price_pix)"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) return { error: "Pedido não encontrado." };

  const customerDocument = (
    order.customers as unknown as { cpf_cnpj: string | null } | null
  )?.cpf_cnpj;

  const provider = getPaymentProvider();
  let result;
  try {
    result = await provider.createPreference({
      orderId: order.id,
      orderNumber: order.order_number,
      total: Number(order.total),
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone ?? undefined,
      customerDocument: customerDocument ?? undefined,
      items: (order.order_items ?? []).map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price_pix),
      })),
    });
  } catch (err) {
    // O provider lança um erro com mensagem já amigável pro cliente (ver
    // pyxgate-provider.ts) — sem esse catch, a exceção sobe crua até o Route
    // Handler e vira um 500 sem corpo JSON, e o cliente nunca vê o motivo
    // real (só o fallback genérico "Tente novamente").
    return { error: err instanceof Error ? err.message : "Não foi possível gerar o pagamento agora." };
  }

  const pixQrUrl = result.pixQrBase64 ? `data:image/png;base64,${result.pixQrBase64}` : null;

  const { error: updateError } = await service
    .from("payments")
    .update({
      external_id: result.externalId,
      pix_code: result.pixCode ?? null,
      pix_qr_url: pixQrUrl,
      metadata: result.externalCheckoutUrl ? { checkout_url: result.externalCheckoutUrl } : null,
    })
    .eq("order_id", orderId);

  if (updateError) return { error: updateError.message };

  return {
    checkoutUrl: result.checkoutUrl,
    pixCode: result.pixCode,
    pixQrUrl: pixQrUrl ?? undefined,
    externalCheckoutUrl: result.externalCheckoutUrl,
  };
}
