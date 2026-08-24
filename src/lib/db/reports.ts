import { createServiceClient } from "@/lib/supabase/server";
import { getAllCustomersAdmin } from "./customers";
import { brasiliaDayStartUTCOffset, brasiliaDateKey, brasiliaDateStringToUTC } from "@/lib/timezone";
import type {
  SalesReport, SalesDataPoint, ProductSalesData, CategorySalesData,
  CustomerReportData, CouponReportData, CouponType,
} from "@/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

interface QualifyingOrder {
  id: string;
  total: number;
}

// Pedidos "pagos" (payment_status confirmado e não cancelados) dentro do
// período — base usada tanto pelo relatório de vendas quanto pelas
// agregações de produto/categoria. `periodEndExclusive` opcional pra
// períodos com data final fixa (não "até agora").
async function getPaidOrdersInPeriod(
  service: ServiceClient,
  periodStart: Date,
  periodEndExclusive?: Date
): Promise<{ all: { id: string; total: number; status: string; payment_status: string; created_at: string }[]; paid: QualifyingOrder[] }> {
  let query = service
    .from("orders")
    .select("id, total, status, payment_status, created_at")
    .gte("created_at", periodStart.toISOString());
  if (periodEndExclusive) {
    query = query.lt("created_at", periodEndExclusive.toISOString());
  }
  const { data, error } = await query;

  if (error) throw error;

  const all = data ?? [];
  const paid = all
    .filter((o) => o.payment_status === "confirmed" && o.status !== "cancelled")
    .map((o) => ({ id: o.id, total: Number(o.total) }));

  return { all, paid };
}

// Monta o SalesReport (KPIs + receita por dia) pra um intervalo de dias de
// Brasília já resolvido em instantes UTC — compartilhado entre o relatório
// "últimos N dias" e o filtro de período customizado.
async function buildSalesReport(
  service: ServiceClient,
  periodStart: Date,
  periodEndExclusive: Date,
  dayCount: number
): Promise<SalesReport> {
  const { all, paid } = await getPaidOrdersInPeriod(service, periodStart, periodEndExclusive);

  const pendingCount = all.filter((o) => o.payment_status === "pending").length;
  const cancelledCount = all.filter((o) => o.status === "cancelled").length;
  const totalRevenue = paid.reduce((sum, o) => sum + o.total, 0);

  const paidByOrderId = new Map(all.map((o) => [o.id, o]));
  const revenue_by_day: SalesDataPoint[] = [];
  for (let i = 0; i < dayCount; i++) {
    const dayStr = brasiliaDateKey(brasiliaDayStartUTCOffset(i, periodStart).toISOString());
    const dayOrders = paid.filter((o) => {
      const createdAt = paidByOrderId.get(o.id)?.created_at;
      return createdAt && brasiliaDateKey(createdAt) === dayStr;
    });
    revenue_by_day.push({
      date: dayStr,
      revenue: Number(dayOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)),
      orders: dayOrders.length,
    });
  }

  const periodEndInclusive = new Date(periodEndExclusive.getTime() - 1);

  return {
    period_start: brasiliaDateKey(periodStart.toISOString()),
    period_end: brasiliaDateKey(periodEndInclusive.toISOString()),
    total_revenue: Number(totalRevenue.toFixed(2)),
    total_orders: all.length,
    average_ticket: all.length > 0 ? Number((totalRevenue / all.length).toFixed(2)) : 0,
    paid_orders: paid.length,
    pending_orders: pendingCount,
    cancelled_orders: cancelledCount,
    revenue_by_day,
  };
}

export async function getSalesReportAdmin(days = 14): Promise<SalesReport> {
  const service = createServiceClient();
  const periodStart = brasiliaDayStartUTCOffset(-(days - 1));
  const periodEndExclusive = brasiliaDayStartUTCOffset(1); // início de amanhã (Brasília) — cobre o dia de hoje inteiro
  return buildSalesReport(service, periodStart, periodEndExclusive, days);
}

// Relatório de vendas pra um intervalo de datas escolhido pelo usuário
// (inputs "YYYY-MM-DD", inclusive nas duas pontas, interpretados em
// horário de Brasília).
export async function getSalesReportForRangeAdmin(fromDateStr: string, toDateStr: string): Promise<SalesReport> {
  const service = createServiceClient();
  const periodStart = brasiliaDateStringToUTC(fromDateStr);
  const periodEndExclusive = brasiliaDateStringToUTC(toDateStr, 1);
  const dayCount = Math.max(1, Math.round((periodEndExclusive.getTime() - periodStart.getTime()) / 86400000));
  return buildSalesReport(service, periodStart, periodEndExclusive, dayCount);
}

export async function getProductAndCategorySalesAdmin(
  days = 14
): Promise<{ products: ProductSalesData[]; categories: CategorySalesData[] }> {
  const service = createServiceClient();

  const periodStart = brasiliaDayStartUTCOffset(-(days - 1));

  const { paid } = await getPaidOrdersInPeriod(service, periodStart);
  if (paid.length === 0) return { products: [], categories: [] };

  const orderIds = paid.map((o) => o.id);

  const { data: itemRows, error: itemsError } = await service
    .from("order_items")
    .select("order_id, product_id, product_name, product_sku, quantity, subtotal")
    .in("order_id", orderIds);

  if (itemsError) throw itemsError;

  const items = itemRows ?? [];
  const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => !!id))];

  let categoryByProduct = new Map<string, string | null>();
  let categoryNames = new Map<string, string>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await service
      .from("products")
      .select("id, category_id")
      .in("id", productIds);
    if (productsError) throw productsError;

    categoryByProduct = new Map((products ?? []).map((p) => [p.id, p.category_id]));

    const categoryIds = [...new Set((products ?? []).map((p) => p.category_id).filter((id): id is string => !!id))];
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await service
        .from("categories")
        .select("id, name")
        .in("id", categoryIds);
      if (categoriesError) throw categoriesError;
      categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));
    }
  }

  const productAgg = new Map<string, ProductSalesData>();
  const categoryAgg = new Map<string, CategorySalesData & { orderIds: Set<string> }>();

  for (const item of items) {
    const key = item.product_id ?? `sku:${item.product_sku}`;
    const existing = productAgg.get(key);
    const quantity = item.quantity;
    const subtotal = Number(item.subtotal);

    if (existing) {
      existing.quantity_sold += quantity;
      existing.revenue = Number((existing.revenue + subtotal).toFixed(2));
    } else {
      const categoryId = item.product_id ? categoryByProduct.get(item.product_id) : null;
      productAgg.set(key, {
        product_id: item.product_id ?? key,
        product_name: item.product_name,
        product_sku: item.product_sku,
        category_name: (categoryId && categoryNames.get(categoryId)) || "—",
        quantity_sold: quantity,
        revenue: subtotal,
        average_ticket: 0,
      });
    }

    const categoryId = item.product_id ? categoryByProduct.get(item.product_id) : null;
    if (categoryId) {
      const catExisting = categoryAgg.get(categoryId);
      if (catExisting) {
        catExisting.total_items += quantity;
        catExisting.revenue = Number((catExisting.revenue + subtotal).toFixed(2));
        catExisting.orderIds.add(item.order_id);
      } else {
        categoryAgg.set(categoryId, {
          category_id: categoryId,
          category_name: categoryNames.get(categoryId) ?? "—",
          total_items: quantity,
          total_orders: 0,
          revenue: subtotal,
          orderIds: new Set([item.order_id]),
        });
      }
    }
  }

  const products = [...productAgg.values()]
    .map((p) => ({ ...p, average_ticket: p.quantity_sold > 0 ? Number((p.revenue / p.quantity_sold).toFixed(2)) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const categories = [...categoryAgg.values()]
    .map(({ orderIds, ...c }) => ({ ...c, total_orders: orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue);

  return { products, categories };
}

export async function getCustomerReportAdmin(): Promise<CustomerReportData[]> {
  const customers = await getAllCustomersAdmin();
  return customers
    .filter((c) => c.total_orders > 0)
    .map((c) => ({
      customer_id: c.id,
      customer_name: c.name,
      customer_email: c.email,
      customer_phone: c.phone,
      total_orders: c.total_orders,
      total_spent: c.total_spent,
      average_ticket: c.average_ticket,
      first_order_at: c.first_order_at ?? c.created_at,
      last_order_at: c.last_order_at ?? c.created_at,
      is_vip: c.is_vip,
    }));
}

export async function getCouponReportAdmin(): Promise<CouponReportData[]> {
  const service = createServiceClient();

  const { data: coupons, error } = await service
    .from("coupons")
    .select("id, code, type, value, uses_count, customer_specific_id")
    .order("uses_count", { ascending: false });

  if (error) throw error;
  if (!coupons || coupons.length === 0) return [];

  const { data: usages, error: usagesError } = await service
    .from("coupon_usages")
    .select("coupon_id, discount_applied");

  if (usagesError) throw usagesError;

  const discountByCoupon = new Map<string, number>();
  for (const u of usages ?? []) {
    discountByCoupon.set(u.coupon_id, (discountByCoupon.get(u.coupon_id) ?? 0) + Number(u.discount_applied));
  }

  return coupons
    .filter((c) => c.uses_count > 0)
    .map((c) => ({
      coupon_id: c.id,
      code: c.code,
      type: c.type as CouponType,
      value: Number(c.value),
      uses_count: c.uses_count,
      total_discounted: Number((discountByCoupon.get(c.id) ?? 0).toFixed(2)),
      customer_specific: !!c.customer_specific_id,
    }));
}

export interface OperationalOrderSummary {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
}

export interface OperationalItemToSeparate {
  product_id: string;
  product_name: string;
  product_image?: string;
  total_quantity: number;
  order_numbers: string[];
}

export interface OperationalReportAdmin {
  paid_orders: OperationalOrderSummary[];
  items_to_separate: OperationalItemToSeparate[];
}

// Pedidos pagos que ainda não foram enviados — o que falta separar/despachar agora.
export async function getOperationalReportAdmin(): Promise<OperationalReportAdmin> {
  const service = createServiceClient();

  const { data: orders, error } = await service
    .from("orders")
    .select("id, order_number, customer_name, total")
    .eq("payment_status", "confirmed")
    .in("status", ["payment_confirmed", "shipping_link_pending", "shipping_paid"]);

  if (error) throw error;

  const paid_orders = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    customer_name: o.customer_name,
    total: Number(o.total),
  }));

  if (paid_orders.length === 0) return { paid_orders: [], items_to_separate: [] };

  const orderIds = paid_orders.map((o) => o.id);
  const orderNumberById = new Map(paid_orders.map((o) => [o.id, o.order_number]));

  const { data: itemRows, error: itemsError } = await service
    .from("order_items")
    .select("order_id, product_id, product_name, product_image, quantity")
    .in("order_id", orderIds);

  if (itemsError) throw itemsError;

  const agg = new Map<string, OperationalItemToSeparate & { orderNumbers: Set<string> }>();
  for (const item of itemRows ?? []) {
    const key = item.product_id ?? item.product_name;
    const existing = agg.get(key);
    const orderNumber = orderNumberById.get(item.order_id) ?? "";
    if (existing) {
      existing.total_quantity += item.quantity;
      existing.orderNumbers.add(orderNumber);
    } else {
      agg.set(key, {
        product_id: item.product_id ?? key,
        product_name: item.product_name,
        product_image: item.product_image ?? undefined,
        total_quantity: item.quantity,
        order_numbers: [],
        orderNumbers: new Set([orderNumber]),
      });
    }
  }

  const items_to_separate = [...agg.values()].map(({ orderNumbers, ...rest }) => ({
    ...rest,
    order_numbers: [...orderNumbers],
  }));

  return { paid_orders, items_to_separate };
}
