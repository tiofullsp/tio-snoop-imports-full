import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessageCircle, ArrowRight, LinkIcon, Tag } from "lucide-react";
import { CheckoutSteps } from "@/components/public/CheckoutSteps";
import { Container } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { formatCurrency } from "@/lib/formatters";
import { routes } from "@/lib/routes";
import { getOrderByIdAdmin } from "@/lib/db/orders";
import { getPublicStoreSettings } from "@/lib/db/settings";
import { generateOrderWhatsAppLink, generateStoreWhatsAppLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pedido confirmado" };

export default async function PedidoConfirmadoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const settings = await getPublicStoreSettings();

  const order = await getOrderByIdAdmin(orderId).catch(() => null);

  const orderNumber = order?.order_number ?? orderId;
  const whatsappLink = order
    ? generateOrderWhatsAppLink({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        items: (order.items ?? []).map((i) => ({
          name: i.product_name,
          quantity: i.quantity,
          unitPrice: i.unit_price_pix,
        })),
        total: order.total,
        storePhone: settings.whatsapp_number,
      })
    : generateStoreWhatsAppLink(settings.whatsapp_number, settings.whatsapp_default_message);

  return (
    <div className="py-12">
      <Container size="sm">
        <div className="mb-10">
          <CheckoutSteps currentStep={4} />
        </div>

        {/* Success */}
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-success/15 blur-2xl" />
            <div className="relative w-24 h-24 bg-success/10 border border-success/30 rounded-full flex items-center justify-center">
              <CheckCircle2 size={44} className="text-success" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-dark-text mb-2">
            Pedido confirmado!
          </h1>
          <p className="text-muted">
            Pagamento recebido — seu pedido já está com a gente.
          </p>
        </div>

        {/* Resumo do pedido */}
        <div className="bg-dark-surface rounded-2xl border border-accent/25 shadow-[0_8px_30px_-8px_rgba(242,183,5,0.2)] p-6 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-muted mb-1">Número do pedido</p>
            <p className="text-xl font-bold font-mono text-dark-text">#{orderNumber}</p>
          </div>
          {order && (
            <div className="text-right">
              <p className="text-xs text-muted mb-1">Total pago</p>
              <p className="text-xl font-bold text-dark-text">{formatCurrency(order.total)}</p>
            </div>
          )}
        </div>

        {/* Next steps */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-dark-text">Próximos passos:</h2>
          {[
            { icon: CheckCircle2, text: "Pagamento confirmado — já processamos a baixa do seu pedido.", color: "text-success" },
            { icon: LinkIcon, text: "Link de pagamento do frete — liberado direto na página \"Acompanhar Pedido\".", color: "text-accent" },
            { icon: Tag, text: "Após pagar o frete e confirmar, emitimos a etiqueta e seu pedido segue para postagem.", color: "text-info" },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <step.icon size={18} className={`${step.color} flex-shrink-0 mt-0.5`} />
              <p className="text-sm text-muted">{step.text}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link href={routes.acompanharPedido}>
            <Button variant="accent" fullWidth rightIcon={<ArrowRight size={16} />}>
              Acompanhar meu pedido
            </Button>
          </Link>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" fullWidth leftIcon={<MessageCircle size={16} />}>
              Falar no WhatsApp
            </Button>
          </a>
          <Link href={routes.home}>
            <Button variant="ghost" fullWidth size="sm">
              Voltar à loja
            </Button>
          </Link>
        </div>

      </Container>
    </div>
  );
}
