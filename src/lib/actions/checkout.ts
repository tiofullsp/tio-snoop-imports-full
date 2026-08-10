"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { resolveBasePrice, calculateQuantityDiscountPrice } from "@/lib/pricing";
import { getPublicStoreSettings } from "@/lib/db/settings";
import { digitsOnly, isValidCpf } from "@/lib/cpf";
import { isValidEmail } from "@/lib/email";
import { hasFullName } from "@/lib/name";
import { BRAZILIAN_STATES } from "@/lib/brazilian-states";

// ---------------------------------------------------------------------------
// O front-end nunca é fonte de verdade para preço/estoque/desconto. O
// checkout manda só o "carrinho de intenção" (produto + quantidade) e os
// dados do cliente; tudo que tem valor em dinheiro é buscado e recalculado
// aqui, a partir do banco.
// ---------------------------------------------------------------------------

export interface CheckoutItemInput {
  product_id: string;
  variant_size_id?: string;
  quantity: number;
}

export interface CheckoutFormData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  state: string;
  // Escolhido pelo cliente já no checkout (não mais só na tela de pagamento)
  // — assim só a cobrança do método escolhido é criada na PyxGate, evitando
  // gerar um Pix à toa quando o cliente já vai pagar no cartão.
  paymentMethod: "pix" | "card";
  items: CheckoutItemInput[];
  coupon_code?: string;
  insurance_enabled?: boolean;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
}

interface ComputedItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  quantity: number;
  unit_price_pix: number;
  unit_price_card: number;
  subtotal: number;
  category_id: string;
  variant_size_id: string | null;
  variant_color_name: string | null;
  variant_color_hex: string | null;
  variant_size: string | null;
  variant_sku: string | null;
}

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  price_pix: number;
  price_card: number;
  is_active: boolean;
  track_stock: boolean;
  stock: number | null;
  stock_item_id: string | null;
  quantity_pricing_enabled: boolean;
  price_tiers: unknown;
  product_media: { url: string; is_main: boolean; display_order: number }[] | null;
};

type VariantSizeRow = {
  id: string;
  size: string;
  stock: number;
  sku: string | null;
  is_active: boolean;
  variant_id: string;
  product_variants: {
    product_id: string | null;
    stock_item_id: string | null;
    color_name: string;
    color_hex: string;
    is_active: boolean;
  } | null;
};

// Busca os produtos reais e recalcula cada item — preço, tier e estoque
// nunca vêm do cliente. Quando o item tem variant_size_id, o estoque de
// verdade vive em product_variant_sizes, não em products.stock.
async function resolveItems(
  service: ReturnType<typeof createServiceClient>,
  requested: CheckoutItemInput[]
): Promise<{ items: ComputedItem[] } | { error: string }> {
  if (requested.length === 0) return { error: "Carrinho vazio." };

  const productIds = requested.map((i) => i.product_id);
  const { data, error } = await service
    .from("products")
    .select(
      "id, name, sku, category_id, price_pix, price_card, is_active, track_stock, stock, stock_item_id, quantity_pricing_enabled, price_tiers, product_media(url, is_main, display_order)"
    )
    .in("id", productIds);

  if (error) return { error: "Erro ao validar produtos do pedido." };

  const products = (data ?? []) as unknown as ProductRow[];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Query separada para os tamanhos de variação pedidos — preço/nome/sku
  // continuam vindo do produto (variação não tem preço próprio).
  const variantSizeIds = requested
    .map((i) => i.variant_size_id)
    .filter((id): id is string => !!id);

  let variantSizeMap = new Map<string, VariantSizeRow>();
  if (variantSizeIds.length > 0) {
    const { data: variantSizeData, error: variantSizeError } = await service
      .from("product_variant_sizes")
      .select("id, size, stock, sku, is_active, variant_id, product_variants(product_id, stock_item_id, color_name, color_hex, is_active)")
      .in("id", variantSizeIds);

    if (variantSizeError) return { error: "Erro ao validar variações do pedido." };

    variantSizeMap = new Map(
      ((variantSizeData ?? []) as unknown as VariantSizeRow[]).map((v) => [v.id, v])
    );
  }

  const items: ComputedItem[] = [];

  for (const req of requested) {
    if (!req.product_id || req.quantity <= 0) {
      return { error: "Item de carrinho inválido." };
    }

    const product = productMap.get(req.product_id);
    if (!product || !product.is_active) {
      return { error: `Produto não disponível: ${req.product_id}` };
    }

    let variantSnapshot = {
      variant_size_id: null as string | null,
      variant_color_name: null as string | null,
      variant_color_hex: null as string | null,
      variant_size: null as string | null,
      variant_sku: null as string | null,
    };

    if (req.variant_size_id) {
      const variantSize = variantSizeMap.get(req.variant_size_id);
      // Nunca confia que variant_size_id e product_id mandados pelo client
      // realmente combinam entre si — exige que a variação pertença ao mesmo
      // produto pedido, seja direto (product_id) ou via peça vinculada
      // (stock_item_id do produto == stock_item_id da variante).
      const belongsDirectly = variantSize?.product_variants?.product_id === req.product_id;
      const belongsViaStockItem =
        !!product.stock_item_id &&
        variantSize?.product_variants?.stock_item_id === product.stock_item_id;

      if (!variantSize || !variantSize.product_variants || (!belongsDirectly && !belongsViaStockItem)) {
        return { error: `Variação inválida para "${product.name}".` };
      }

      if (!variantSize.is_active || !variantSize.product_variants.is_active) {
        return { error: `"${product.name}" (${variantSize.product_variants.color_name} / ${variantSize.size}) não está mais disponível.` };
      }
      if (variantSize.stock <= 0) {
        return { error: `"${product.name}" (${variantSize.product_variants.color_name} / ${variantSize.size}) está sem estoque.` };
      }
      if (req.quantity > variantSize.stock) {
        return {
          error: `Estoque insuficiente para "${product.name}" (${variantSize.product_variants.color_name} / ${variantSize.size}) — disponível: ${variantSize.stock}, solicitado: ${req.quantity}.`,
        };
      }

      variantSnapshot = {
        variant_size_id: variantSize.id,
        variant_color_name: variantSize.product_variants.color_name,
        variant_color_hex: variantSize.product_variants.color_hex,
        variant_size: variantSize.size,
        variant_sku: variantSize.sku,
      };
    } else if (product.track_stock) {
      const stock = product.stock ?? 0;
      if (stock <= 0) {
        return { error: `"${product.name}" está sem estoque.` };
      }
      if (req.quantity > stock) {
        return {
          error: `Estoque insuficiente para "${product.name}" (disponível: ${stock}, solicitado: ${req.quantity}).`,
        };
      }
    }

    const basePix = resolveBasePrice({ price_pix: Number(product.price_pix) });

    const hasTiers = product.quantity_pricing_enabled && Array.isArray(product.price_tiers)
      && (product.price_tiers as unknown[]).length > 0;

    const unitPricePix = hasTiers
      ? calculateQuantityDiscountPrice({ basePrice: basePix, quantity: req.quantity }).unitPrice
      : basePix;
    const unitPriceCard = Number(product.price_card);

    const media = [...(product.product_media ?? [])].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return a.display_order - b.display_order;
    });

    items.push({
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      product_image: media[0]?.url ?? null,
      quantity: req.quantity,
      unit_price_pix: unitPricePix,
      unit_price_card: unitPriceCard,
      subtotal: Number((unitPricePix * req.quantity).toFixed(2)),
      category_id: product.category_id,
      ...variantSnapshot,
    });
  }

  return { items };
}

interface ResolvedCoupon {
  id: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  discount: number;
  usesCount: number;
}

// Revalida o cupom contra a tabela real `coupons` — o desconto enviado pelo
// cliente nunca é usado, só o código.
async function resolveCoupon(
  service: ReturnType<typeof createServiceClient>,
  code: string | undefined,
  subtotalPix: number,
  shippingValue: number,
  items: ComputedItem[]
): Promise<{ coupon: ResolvedCoupon | null } | { error: string }> {
  if (!code || !code.trim()) return { coupon: null };

  const { data: coupon, error } = await service
    .from("coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .single();

  if (error || !coupon) return { error: "Cupom inválido." };
  if (!coupon.is_active) return { error: "Este cupom está inativo." };

  // Comparação por string YYYY-MM-DD: independente de timezone do servidor.
  // Validade: válido até o FIM do dia selecionado (expiration_date >= today).
  const todayStr = new Date().toISOString().split("T")[0];
  if (coupon.start_date && coupon.start_date > todayStr) {
    return { error: "Este cupom ainda não está válido." };
  }
  if (coupon.expiration_date && coupon.expiration_date < todayStr) {
    return { error: "Este cupom expirou." };
  }
  const minOrderValue = Number(coupon.min_order_value ?? 0);
  if (minOrderValue > 0 && subtotalPix < minOrderValue) {
    return {
      error: `Este cupom exige pedido mínimo de R$ ${minOrderValue.toFixed(2)}. Seu subtotal é R$ ${subtotalPix.toFixed(2)}.`,
    };
  }
  if (coupon.max_uses_total !== null && coupon.uses_count >= coupon.max_uses_total) {
    return { error: "Este cupom atingiu o limite de usos." };
  }
  if (
    Array.isArray(coupon.restricted_products) &&
    coupon.restricted_products.length > 0 &&
    !items.some((i) => coupon.restricted_products!.includes(i.product_id))
  ) {
    return { error: "Este cupom não é válido para os produtos do carrinho." };
  }
  if (
    Array.isArray(coupon.restricted_categories) &&
    coupon.restricted_categories.length > 0 &&
    !items.some((i) => coupon.restricted_categories!.includes(i.category_id))
  ) {
    return { error: "Este cupom não é válido para os produtos do carrinho." };
  }

  let discount = 0;
  if (coupon.type === "percentage") {
    discount = (subtotalPix * Number(coupon.value)) / 100;
  } else if (coupon.type === "fixed") {
    discount = Math.min(Number(coupon.value), subtotalPix);
  } else if (coupon.type === "free_shipping") {
    discount = shippingValue;
  }

  return {
    coupon: {
      id:        coupon.id,
      code:      coupon.code,
      type:      coupon.type,
      discount:  Number(discount.toFixed(2)),
      usesCount: coupon.uses_count,
    },
  };
}

export async function createOrder(
  data: CheckoutFormData
): Promise<CreateOrderResult | { error: string }> {
  // Validação server-side (defesa em profundidade)
  if (!data.name.trim())         return { error: "Nome é obrigatório." };
  if (!hasFullName(data.name))   return { error: "Coloque nome e sobrenome." };
  if (!data.email.trim())        return { error: "E-mail é obrigatório." };
  // Formato inválido só seria pego pelo gateway de pagamento lá no passo 9,
  // depois de já ter criado pedido/cliente/itens/pagamento no banco — validar
  // aqui evita pedidos-fantasma sem forma nenhuma de pagar.
  if (!isValidEmail(data.email)) return { error: "E-mail inválido." };
  if (!data.phone.trim())        return { error: "Telefone é obrigatório." };
  if (!data.items || data.items.length === 0) return { error: "Carrinho vazio." };
  // CPF agora é obrigatório: é a chave usada depois pra achar o pedido em
  // "Acompanhar Pedido" e pra confirmar o pagamento do frete — sem ele o
  // cliente fica sem acesso a essas telas.
  if (!data.cpf?.trim()) return { error: "CPF é obrigatório." };
  if (!isValidCpf(data.cpf)) return { error: "CPF inválido." };
  if (!data.state?.trim() || !(BRAZILIAN_STATES as readonly string[]).includes(data.state.trim())) {
    return { error: "Selecione um estado válido." };
  }
  if (data.paymentMethod !== "pix" && data.paymentMethod !== "card") {
    return { error: "Selecione a forma de pagamento." };
  }

  const service = createServiceClient();

  try {
    // 1. Recalcula itens (preço, tiers, estoque) a partir do banco
    const itemsResult = await resolveItems(service, data.items);
    if ("error" in itemsResult) return { error: itemsResult.error };
    const items = itemsResult.items;

    const subtotalPix = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

    // 1b. Frete é combinado fora do site (Shopee) — não entra na soma do pedido.
    const shippingValue = 0;

    // 1c. Seguro da mercadoria — nunca usa o valor enviado pelo cliente, recalcula
    // como % (configurada pelo admin) do subtotal resolvido acima.
    const insuranceEnabled = !!data.insurance_enabled;
    const { insurance_percentage } = await getPublicStoreSettings();
    const insuranceValue = insuranceEnabled
      ? Number((subtotalPix * insurance_percentage).toFixed(2))
      : 0;

    // 2. Revalida o cupom contra o banco (nunca usa o desconto enviado pelo cliente)
    const couponResult = await resolveCoupon(service, data.coupon_code, subtotalPix, shippingValue, items);
    if ("error" in couponResult) return { error: couponResult.error };
    const coupon = couponResult.coupon;

    const couponDiscount = coupon?.discount ?? 0;
    const total = Math.max(0, Number((subtotalPix + shippingValue + insuranceValue - couponDiscount).toFixed(2)));

    // 3. Upsert cliente por e-mail (cria se novo, atualiza dados se existente)
    // cpf_cnpj só entra no payload se foi informado nesta compra — senão o
    // upsert sobrescreveria com null um CPF já salvo numa compra anterior.
    // Endereço não é mais coletado no checkout — o admin combina o envio
    // (Shopee) e preenche isso depois, se precisar.
    const { data: customer, error: customerError } = await service
      .from("customers")
      .upsert(
        {
          name:  data.name.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
          ...(data.cpf?.trim() ? { cpf_cnpj: digitsOnly(data.cpf) } : {}),
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();

    if (customerError) throw customerError;

    // 4. Criar pedido (order_number gerado automaticamente pela função generate_order_number)
    const { data: order, error: orderError } = await service
      .from("orders")
      .insert({
        customer_id:           customer.id,
        customer_name:         data.name.trim(),
        customer_email:        data.email.trim().toLowerCase(),
        customer_phone:        data.phone.trim(),
        payment_method:        data.paymentMethod,
        // Endereço completo não é mais coletado no checkout — o admin combina
        // o envio (Shopee) e preenche isso depois, se precisar. O estado é a
        // exceção: coletado no checkout (obrigatório) por extenso.
        shipping_street:       "",
        shipping_number:       "",
        shipping_complement:   null,
        shipping_neighborhood: "",
        shipping_city:         "",
        shipping_state:        data.state.trim(),
        shipping_zip_code:     "",
        subtotal:              subtotalPix,
        coupon_code:           coupon?.code ?? null,
        coupon_discount:       couponDiscount,
        shipping_value:        shippingValue,
        shipping_service:      null,
        insurance_enabled:     insuranceEnabled,
        insurance_value:       insuranceValue,
        total,
      })
      .select("id, order_number")
      .single();

    if (orderError) throw orderError;

    const orderId      = order.id;
    const orderNumber  = order.order_number;

    // 5. Inserir itens (snapshot do catálogo no momento da compra, com preço já recalculado)
    const { error: itemsError } = await service.from("order_items").insert(
      items.map((item) => ({
        order_id:        orderId,
        product_id:      item.product_id,
        product_name:    item.product_name,
        product_sku:     item.product_sku,
        product_image:   item.product_image,
        quantity:        item.quantity,
        unit_price_pix:  item.unit_price_pix,
        unit_price_card: item.unit_price_card,
        subtotal:        item.subtotal,
        variant_size_id:    item.variant_size_id,
        variant_color_name: item.variant_color_name,
        variant_color_hex:  item.variant_color_hex,
        variant_size:       item.variant_size,
        variant_sku:        item.variant_sku,
      }))
    );

    if (itemsError) throw itemsError;

    // 6. Criar registro de pagamento (pix_code/external_id preenchidos no passo 9,
    // pelo provider de pagamento ativo — stub hoje, gateway real depois)
    const { error: paymentError } = await service.from("payments").insert({
      order_id:       orderId,
      method:         "pix" as const,
      status:         "pending" as const,
      amount:         total,
      pix_expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    if (paymentError) throw paymentError;

    // 7. Histórico inicial de status
    const { error: historyError } = await service.from("order_status_history").insert({
      order_id:   orderId,
      new_status: "pending_payment" as const,
      changed_by: "system",
      notes:      "Pedido criado via checkout",
    });

    if (historyError) throw historyError;

    // 8. Registrar uso do cupom e incrementar uses_count (erro não-fatal — não cancela o pedido)
    if (coupon) {
      await service.from("coupon_usages").insert({
        coupon_id:        coupon.id,
        order_id:         orderId,
        customer_email:   data.email.trim().toLowerCase(),
        discount_applied: coupon.discount,
      });
      await service
        .from("coupons")
        .update({ uses_count: coupon.usesCount + 1 })
        .eq("id", coupon.id);
    }

    // 9. A preferência de pagamento (chamada à gateway — PyxGate leva uns 5s só
    // pra criar a cobrança Pix) NÃO é criada aqui: geraria uma espera de 10s+
    // com o botão "Finalizar pedido" travado, sem nenhum feedback pro
    // cliente. Em vez disso, a página /pagamento/[orderId] chama
    // /api/payments/create-preference assim que carrega, e mostra "Gerando
    // seu Pix..." nesse meio tempo — mesma chamada, só que numa tela que já
    // avisa o que está acontecendo.
    return { orderId, orderNumber, total };
  } catch (err: unknown) {
    // Erros do Supabase (PostgrestError) são objetos simples, não instâncias
    // de Error — "instanceof Error" sozinho escondia a mensagem real e sempre
    // caía no fallback genérico. console.error aqui é o único jeito de ver a
    // causa de verdade durante o desenvolvimento.
    console.error("createOrder falhou:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Erro ao criar pedido. Tente novamente.";
    return { error: message };
  }
}
