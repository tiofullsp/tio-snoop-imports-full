import { createServiceClient } from "@/lib/supabase/server";
import { maybeReleaseShippingLink, maybeAutoCompleteOrder } from "@/lib/orders/shipping-link";
import type {
  Order, OrderItem, OrderStatus, OrderStatusHistory,
  PaymentStatus, PaymentMethod,
} from "@/types";
import type { DbOrder, DbOrderItem, DbOrderStatusHistory } from "@/types/database.types";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface AdminOrder extends Order {
  item_count: number;
}

export interface DashboardKPIs {
  orders_today:         number;
  orders_today_paid:    number;
  orders_today_pending: number;
  revenue_today:        number;
  active_products:      number;
  total_customers:      number;
  vip_count:            number;
  low_stock:            { id: string; name: string; slug: string; stock: number; stock_minimum: number }[];
  recent_orders:        AdminOrder[];
  top_customers:        { id: string; name: string; total_orders: number; total_spent: number; is_vip: boolean }[];
}

// ---------------------------------------------------------------------------
// Select strings
// ---------------------------------------------------------------------------

const ORDER_LIST_FIELDS = `
  id, order_number, customer_id, customer_name, customer_email, customer_phone,
  status, payment_status, payment_method, payment_id,
  total, subtotal, coupon_code, coupon_discount, shipping_value, shipping_service,
  insurance_enabled, insurance_value,
  tracking_code, tracking_url,
  shipping_street, shipping_number, shipping_complement, shipping_neighborhood,
  shipping_city, shipping_state, shipping_zip_code,
  notes, internal_notes, created_at, updated_at,
  order_items (id)
` as const;

const ORDER_DETAIL_FIELDS = `
  id, order_number, customer_id, customer_name, customer_email, customer_phone,
  status, payment_status, payment_method, payment_id,
  total, subtotal, coupon_code, coupon_discount, shipping_value, shipping_service,
  insurance_enabled, insurance_value,
  tracking_code, tracking_url,
  payment_confirmed_at, shipping_payment_link, shipping_customer_name, shipping_order_id,
  shipping_label_url, shipping_label_storage_path, label_issued_at,
  shipping_street, shipping_number, shipping_complement, shipping_neighborhood,
  shipping_city, shipping_state, shipping_zip_code,
  notes, internal_notes, created_at, updated_at,
  order_items (
    id, order_id, product_id, product_name, product_sku, product_image,
    quantity, unit_price_pix, unit_price_card, subtotal,
    variant_size_id, variant_color_name, variant_color_hex, variant_size, variant_sku
  ),
  order_status_history (
    id, order_id, previous_status, new_status, changed_by, notes, created_at
  ),
  customers ( cpf_cnpj )
` as const;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

type DbOrderRow = DbOrder & {
  order_items?: Array<DbOrderItem | { id: string }>;
  order_status_history?: DbOrderStatusHistory[];
  customers?: { cpf_cnpj: string | null } | null;
};

function toOrderItem(row: DbOrderItem): OrderItem {
  return {
    id:              row.id,
    order_id:        row.order_id,
    product_id:      row.product_id ?? "",
    product_name:    row.product_name,
    product_sku:     row.product_sku,
    product_image:   row.product_image ?? undefined,
    quantity:        row.quantity,
    unit_price_pix:  row.unit_price_pix,
    unit_price_card: row.unit_price_card,
    subtotal:        row.subtotal,
    variant_size_id:     row.variant_size_id     ?? undefined,
    variant_color_name:  row.variant_color_name  ?? undefined,
    variant_color_hex:   row.variant_color_hex   ?? undefined,
    variant_size:        row.variant_size        ?? undefined,
    variant_sku:         row.variant_sku         ?? undefined,
  };
}

function toStatusHistory(row: DbOrderStatusHistory): OrderStatusHistory {
  return {
    id:              row.id,
    order_id:        row.order_id,
    previous_status: (row.previous_status ?? undefined) as OrderStatus | undefined,
    new_status:      row.new_status as OrderStatus,
    changed_by:      row.changed_by,
    notes:           row.notes ?? undefined,
    created_at:      row.created_at,
  };
}

function toAdminOrder(row: DbOrderRow, withRelations = false): AdminOrder {
  const items = withRelations
    ? (row.order_items as DbOrderItem[] | undefined)?.map(toOrderItem)
    : undefined;

  const history = withRelations
    ? (row.order_status_history ?? [])
        .map(toStatusHistory)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : undefined;

  return {
    id:                    row.id,
    order_number:          row.order_number,
    customer_id:           row.customer_id ?? "",
    customer_name:         row.customer_name,
    customer_phone:        row.customer_phone,
    customer_email:        row.customer_email,
    customer_cpf:          row.customers?.cpf_cnpj ?? undefined,
    status:                row.status as OrderStatus,
    payment_status:        row.payment_status as PaymentStatus,
    payment_method:        row.payment_method as PaymentMethod,
    payment_id:            row.payment_id ?? undefined,
    shipping_street:       row.shipping_street,
    shipping_number:       row.shipping_number,
    shipping_complement:   row.shipping_complement ?? undefined,
    shipping_neighborhood: row.shipping_neighborhood,
    shipping_city:         row.shipping_city,
    shipping_state:        row.shipping_state,
    shipping_zip_code:     row.shipping_zip_code,
    subtotal:              Number(row.subtotal),
    coupon_code:           row.coupon_code ?? undefined,
    coupon_discount:       Number(row.coupon_discount),
    shipping_value:        Number(row.shipping_value),
    shipping_service:      row.shipping_service ?? undefined,
    insurance_enabled:     row.insurance_enabled,
    insurance_value:       Number(row.insurance_value),
    tracking_code:         row.tracking_code ?? undefined,
    tracking_url:          row.tracking_url ?? undefined,
    total:                 Number(row.total),
    payment_confirmed_at:        row.payment_confirmed_at ?? undefined,
    shipping_payment_link:       row.shipping_payment_link ?? undefined,
    shipping_customer_name:      row.shipping_customer_name ?? undefined,
    shipping_order_id:           row.shipping_order_id ?? undefined,
    shipping_label_url:          row.shipping_label_url ?? undefined,
    shipping_label_storage_path: row.shipping_label_storage_path ?? undefined,
    label_issued_at:             row.label_issued_at ?? undefined,
    notes:                 row.notes ?? undefined,
    internal_notes:        row.internal_notes ?? undefined,
    items,
    status_history:        history,
    created_at:            row.created_at,
    updated_at:            row.updated_at,
    item_count:            row.order_items?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAllOrdersAdmin(): Promise<AdminOrder[]> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("orders")
    .select(ORDER_LIST_FIELDS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((row) => toAdminOrder(row as DbOrderRow));
}

export async function getOrderByIdAdmin(id: string): Promise<AdminOrder | null> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("orders")
    .select(ORDER_DETAIL_FIELDS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  if (!data) return null;

  const row = data as DbOrderRow;

  // Sem cron: abrir o pedido no admin também dispara a checagem de liberação
  // do link de frete — ver shipping-link.ts.
  const release = await maybeReleaseShippingLink(service, {
    id: row.id,
    status: row.status,
    payment_method: row.payment_method,
    payment_confirmed_at: row.payment_confirmed_at,
  });
  if (release) {
    row.status = release.status;
    row.shipping_payment_link = release.shipping_payment_link;
  }

  // Sem cron: idem acima, mas pra checar se passaram 24h desde a etiqueta
  // emitida sem o cliente confirmar — ver shipping-link.ts.
  const autoComplete = await maybeAutoCompleteOrder(service, {
    id: row.id,
    status: row.status,
    label_issued_at: row.label_issued_at,
  });
  if (autoComplete) row.status = autoComplete.status;

  // Bucket privado (private-documents) — a URL salva é uma signed URL que
  // expira (ver /api/admin/upload-label). Regenera a cada carregamento da
  // página em vez de confiar na URL persistida, pra nunca quebrar o link.
  if (row.shipping_label_storage_path) {
    const { data: signed } = await service.storage
      .from("private-documents")
      .createSignedUrl(row.shipping_label_storage_path, 60 * 60 * 24 * 7);
    if (signed) row.shipping_label_url = signed.signedUrl;
  }

  return toAdminOrder(row, true);
}

export interface OrderPaymentInfo {
  status: PaymentStatus;
  pix_code: string | null;
  pix_qr_url: string | null;
  pix_expiration: string | null;
  checkout_url: string | null;
}

export async function getOrderPayment(orderId: string): Promise<OrderPaymentInfo | null> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("payments")
    .select("status, pix_code, pix_qr_url, pix_expiration, metadata")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const metadata = data.metadata as { checkout_url?: string } | null;

  return {
    status: data.status as PaymentStatus,
    pix_code: data.pix_code,
    pix_qr_url: data.pix_qr_url,
    pix_expiration: data.pix_expiration,
    checkout_url: metadata?.checkout_url ?? null,
  };
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const service = createServiceClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const [
    todayOrdersResult,
    recentOrdersResult,
    activeProductsResult,
    totalCustomersResult,
    vipCustomersResult,
    topCustomersResult,
  ] = await Promise.all([
    service
      .from("orders")
      .select("id, status, payment_status, total")
      .gte("created_at", todayStr),

    service
      .from("orders")
      .select(ORDER_LIST_FIELDS)
      .order("created_at", { ascending: false })
      .limit(5),

    service
      .from("products")
      .select("id, name, slug, stock, stock_minimum, track_stock")
      .eq("is_active", true),

    service
      .from("customers")
      .select("id", { count: "exact", head: true }),

    service
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("is_vip", true),

    service
      .from("customers")
      .select("id, name, total_orders, total_spent, is_vip")
      .order("total_spent", { ascending: false })
      .limit(4),
  ]);

  const todayOrders = todayOrdersResult.data ?? [];
  const orders_today         = todayOrders.length;
  const orders_today_paid    = todayOrders.filter((o) => o.payment_status === "confirmed" && o.status !== "cancelled").length;
  const orders_today_pending = todayOrders.filter((o) => o.payment_status === "pending").length;
  const revenue_today        = todayOrders
    .filter((o) => o.payment_status === "confirmed" && o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const allActiveProducts = activeProductsResult.data ?? [];
  const active_products   = allActiveProducts.length;
  const low_stock         = allActiveProducts
    .filter((p) => p.track_stock && (p.stock ?? 0) <= p.stock_minimum)
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug, stock: p.stock ?? 0, stock_minimum: p.stock_minimum }));

  const total_customers = totalCustomersResult.count ?? 0;
  const vip_count       = vipCustomersResult.count ?? 0;

  const recent_orders = (recentOrdersResult.data ?? []).map((row) =>
    toAdminOrder(row as DbOrderRow)
  );

  const top_customers = (topCustomersResult.data ?? []).map((c) => ({
    id:           c.id,
    name:         c.name,
    total_orders: c.total_orders,
    total_spent:  Number(c.total_spent),
    is_vip:       c.is_vip,
  }));

  return {
    orders_today,
    orders_today_paid,
    orders_today_pending,
    revenue_today,
    active_products,
    total_customers,
    vip_count,
    low_stock,
    recent_orders,
    top_customers,
  };
}
