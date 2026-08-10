import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getOrderByIdAdmin, getOrderPayment } from "@/lib/db/orders";
import { getPublicStoreSettings } from "@/lib/db/settings";
import { isStubPaymentProvider } from "@/lib/payments";
import { routes } from "@/lib/routes";
import { PagamentoClient } from "@/components/public/PagamentoClient";

export default async function PagamentoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const order = await getOrderByIdAdmin(orderId);
  if (!order) notFound();

  if (order.payment_status === "confirmed") {
    redirect(routes.pedidoConfirmado(orderId));
  }

  const payment = await getOrderPayment(orderId);
  const settings = await getPublicStoreSettings();

  // IP do cliente pro threeds_data do 3DS (ip_address) — capturado no server,
  // não dá pra confiar em nada que o próprio navegador reporte sobre si mesmo.
  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "";

  return (
    <PagamentoClient
      orderId={orderId}
      orderNumber={order.order_number}
      total={order.total}
      initialPaymentMethod={order.payment_method}
      pixCode={payment?.pix_code ?? null}
      pixQrUrl={payment?.pix_qr_url ?? null}
      checkoutUrl={payment?.checkout_url ?? null}
      expiresAt={payment?.pix_expiration ?? null}
      isStub={isStubPaymentProvider()}
      whatsappNumber={settings.whatsapp_number}
      clientIp={clientIp}
    />
  );
}
