export const STORE_WHATSAPP = "5511999999999"; // TODO: conectar às configurações

interface WhatsAppOrderData {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number; unitPrice?: number }[];
  total: number;
  storePhone?: string;
}

interface WhatsAppSupportData {
  customerName?: string;
  productName?: string;
  storePhone?: string;
}

export const generateOrderWhatsAppLink = ({
  orderNumber,
  customerName,
  items,
  total,
  storePhone = STORE_WHATSAPP,
}: WhatsAppOrderData): string => {
  const itemsList = items
    .map((i) =>
      i.unitPrice !== undefined
        ? `• ${i.name} × ${i.quantity} (R$ ${i.unitPrice.toFixed(2).replace(".", ",")} cada)`
        : `• ${i.name} × ${i.quantity}`
    )
    .join("\n");
  const text = `Olá! Sou ${customerName} e fiz o pedido *${orderNumber}*.

${itemsList}

*Total: R$ ${total.toFixed(2).replace(".", ",")}*

Gostaria de mais informações sobre meu pedido.`;
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};

export const generateSupportWhatsAppLink = ({
  customerName,
  productName,
  storePhone = STORE_WHATSAPP,
}: WhatsAppSupportData): string => {
  const text = productName
    ? `Olá! ${customerName ? `Sou ${customerName} e t` : "T"}enho uma dúvida sobre o produto *${productName}*.`
    : `Olá! ${customerName ? `Sou ${customerName} e p` : "P"}reciso de ajuda.`;
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};

export const generateStatusWhatsAppLink = ({
  orderNumber,
  customerName,
  newStatus,
  storePhone = STORE_WHATSAPP,
}: {
  orderNumber: string;
  customerName: string;
  newStatus: string;
  storePhone?: string;
}): string => {
  const statusMessages: Record<string, string> = {
    payment_confirmed: `Olá ${customerName}! Confirmamos o pagamento do seu pedido *${orderNumber}*. Em breve liberamos o link de pagamento do frete! 📦`,
    shipping_link_pending: `Olá ${customerName}! O link de pagamento do frete do seu pedido *${orderNumber}* já está disponível em Acompanhar Pedido. 🚚`,
    shipping_paid: `Olá ${customerName}! Confirmamos o pagamento do frete do seu pedido *${orderNumber}*. Estamos preparando a etiqueta! 🔄`,
    label_issued: `Olá ${customerName}! A etiqueta do seu pedido *${orderNumber}* foi emitida e o envio está pronto para postagem. 🏷️`,
    completed: `Olá ${customerName}! Seu pedido *${orderNumber}* foi finalizado. Esperamos que goste! ✅`,
  };
  const text =
    statusMessages[newStatus] ||
    `Olá ${customerName}! Atualização sobre seu pedido *${orderNumber}*.`;
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};

export const generateStoreWhatsAppLink = (storePhone = STORE_WHATSAPP, message?: string): string =>
  message
    ? `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${storePhone}`;

interface WhatsAppProductPurchaseData {
  productName: string;
  colorName?: string;
  size?: string;
  quantity: number;
  total: number;
  storePhone?: string;
}

// Mensagem de intenção de compra de UM produto (PDP) — diferente de
// generateSupportWhatsAppLink (dúvida genérica): já inclui cor/tamanho
// escolhidos, quantidade e valor, pra o atendimento já saber exatamente o
// que o cliente quer comprar.
export const generateProductPurchaseWhatsAppLink = ({
  productName,
  colorName,
  size,
  quantity,
  total,
  storePhone = STORE_WHATSAPP,
}: WhatsAppProductPurchaseData): string => {
  const lines = ["Olá, tenho interesse neste produto:", "", `Produto: ${productName}`];
  if (colorName) lines.push(`Cor: ${colorName}`);
  if (size) lines.push(`Tamanho: ${size}`);
  lines.push(`Quantidade: ${quantity}`);
  lines.push(`Valor: R$ ${total.toFixed(2).replace(".", ",")}`);
  const text = lines.join("\n");
  return `https://wa.me/${storePhone}?text=${encodeURIComponent(text)}`;
};
