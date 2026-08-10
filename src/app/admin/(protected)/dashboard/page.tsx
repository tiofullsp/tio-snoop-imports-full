import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingCart, DollarSign, Package, Users, AlertTriangle, ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/common/Badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getDashboardKPIs } from "@/lib/db/orders";
import { getProductAndCategorySalesAdmin } from "@/lib/db/reports";
import { mockTodayReport, mockProductSales } from "@/data/mock-reports";
import { getTodayOrders, mockOrders } from "@/data/mock-orders";
import { getCustomerMetrics, mockCustomers } from "@/data/mock-customers";
import { mockProducts } from "@/data/mock-products";
import { routes } from "@/lib/routes";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/types";
import type { DashboardKPIs } from "@/lib/db/orders";

export const metadata: Metadata = { title: "Dashboard" };

// ---------------------------------------------------------------------------
// Fallback: KPIs calculados dos mocks quando o banco não está disponível
// ---------------------------------------------------------------------------

function getMockKPIs(): DashboardKPIs {
  const todayOrders = getTodayOrders();
  const metrics = getCustomerMetrics();
  const activeProducts = mockProducts.filter((p) => p.is_active);
  const lowStock = activeProducts.filter((p) => p.track_stock && (p.stock ?? 0) <= p.stock_minimum);

  return {
    orders_today:         mockTodayReport.orders,
    orders_today_paid:    mockTodayReport.paid,
    orders_today_pending: mockTodayReport.pending,
    revenue_today:        mockTodayReport.revenue,
    active_products:      activeProducts.length,
    total_customers:      metrics.total_customers,
    vip_count:            metrics.vip_count,
    low_stock:            lowStock.map((p) => ({ id: p.id, name: p.name, slug: p.slug, stock: p.stock ?? 0, stock_minimum: p.stock_minimum })),
    recent_orders:        mockOrders.slice(0, 5).map((o) => ({ ...o, customer_id: o.customer_id ?? "", item_count: o.items?.length ?? 0 })),
    top_customers:        [...mockCustomers].sort((a, b) => b.total_spent - a.total_spent).slice(0, 4).map((c) => ({
      id: c.id, name: c.name, total_orders: c.total_orders, total_spent: c.total_spent, is_vip: c.is_vip,
    })),
  };
}

export default async function DashboardPage() {
  let kpis: DashboardKPIs;

  try {
    kpis = await getDashboardKPIs();
  } catch {
    kpis = getMockKPIs();
  }

  let topProducts;
  try {
    topProducts = (await getProductAndCategorySalesAdmin(30)).products.slice(0, 5);
  } catch {
    topProducts = mockProductSales.slice(0, 5);
  }

  return (
    <div className="space-y-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Visão geral das operações de hoje</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pedidos hoje"
          value={kpis.orders_today}
          subtitle={`${kpis.orders_today_paid} pago${kpis.orders_today_paid !== 1 ? "s" : ""} · ${kpis.orders_today_pending} pendente${kpis.orders_today_pending !== 1 ? "s" : ""}`}
          icon={ShoppingCart}
          trend={0}
        />
        <StatCard
          title="Faturamento hoje"
          value={formatCurrency(kpis.revenue_today)}
          subtitle="Pagamentos confirmados"
          icon={DollarSign}
          trend={0}
          accent
        />
        <StatCard
          title="Produtos ativos"
          value={kpis.active_products}
          subtitle={`${kpis.low_stock.length} com estoque baixo`}
          icon={Package}
          trend={0}
        />
        <StatCard
          title="Clientes"
          value={kpis.total_customers}
          subtitle={`${kpis.vip_count} VIP`}
          icon={Users}
          trend={0}
        />
      </div>

      {/* Alerta estoque baixo */}
      {kpis.low_stock.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning mb-1">Estoque baixo</p>
              <div className="flex flex-wrap gap-2">
                {kpis.low_stock.map((p) => (
                  <Link key={p.id} href={routes.admin.editarProduto(p.id)}>
                    <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-lg hover:bg-warning/20 transition-colors">
                      {p.name} ({p.stock} un.)
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pedidos recentes + Mais vendidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pedidos recentes */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-dark-text">Pedidos recentes</h2>
            <Link href={routes.admin.pedidos} className="text-xs text-dark-text hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {kpis.recent_orders.map((order) => (
              <Link key={order.id} href={routes.admin.pedido(order.id)}>
                <div className="flex items-center justify-between py-2 border-b border-dark-border last:border-0 hover:bg-dark-hover -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <div className="text-sm font-medium text-dark-text font-mono">{order.order_number}</div>
                    <div className="text-xs text-muted">{order.customer_name} · {formatDate(order.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={ORDER_STATUS_COLORS[order.status]}
                      label={ORDER_STATUS_LABELS[order.status]}
                      size="sm"
                    />
                    <span className="text-sm font-bold text-dark-text">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </Link>
            ))}
            {kpis.recent_orders.length === 0 && (
              <p className="text-sm text-muted py-4 text-center">Nenhum pedido ainda.</p>
            )}
          </div>
        </div>

        {/* Mais vendidos (últimos 30 dias) */}
        <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-dark-text">Mais vendidos</h2>
            <Link href={routes.admin.relatorios} className="text-xs text-dark-text hover:underline flex items-center gap-1">
              Ver relatório <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.product_id} className="flex items-center gap-3 py-2 border-b border-dark-border last:border-0">
                <span className="text-xs font-bold text-muted w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-dark-text truncate">{p.product_name}</div>
                  <div className="text-xs text-muted">{p.quantity_sold} vendidos</div>
                </div>
                <span className="text-sm font-bold text-dark-text flex-shrink-0">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Melhores clientes */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-dark-text">Melhores clientes</h2>
          <Link href={routes.admin.clientes} className="text-xs text-dark-text hover:underline flex items-center gap-1">
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>
        {kpis.top_customers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.top_customers.map((c) => (
              <Link key={c.id} href={routes.admin.cliente(c.id)}>
                <div className="p-4 bg-dark-alt rounded-xl border border-dark-border hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-accent">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    {c.is_vip && <Badge variant="gold" label="VIP" size="sm" />}
                  </div>
                  <div className="text-sm font-semibold text-dark-text truncate">{c.name}</div>
                  <div className="text-xs text-muted">{c.total_orders} pedido{c.total_orders !== 1 ? "s" : ""}</div>
                  <div className="text-sm font-bold text-dark-text mt-1">{formatCurrency(c.total_spent)}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted py-4 text-center">Nenhum cliente ainda.</p>
        )}
      </div>

    </div>
  );
}
