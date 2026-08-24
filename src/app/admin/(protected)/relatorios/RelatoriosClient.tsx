"use client";

import React, { useState } from "react";
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, Filter } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { ReportCard } from "@/components/admin/ReportCard";
import { Tabs, TabContent } from "@/components/common/Tabs";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getSalesReportForRange } from "@/lib/actions/reports";
import { COUPON_TYPE_LABELS } from "@/types";
import type { SalesReport, ProductSalesData, CategorySalesData, CustomerReportData, CouponReportData } from "@/types";
import type { OperationalReportAdmin } from "@/lib/db/reports";

const TABS = [
  { value: "vendas", label: "Vendas" },
  { value: "produtos", label: "Produtos" },
  { value: "categorias", label: "Categorias" },
  { value: "clientes", label: "Clientes" },
  { value: "cupons", label: "Cupons" },
  { value: "operacional", label: "Operacional" },
];

interface Props {
  salesReport: SalesReport;
  productSales: ProductSalesData[];
  categorySales: CategorySalesData[];
  customerReport: CustomerReportData[];
  couponReport: CouponReportData[];
  operationalReport: OperationalReportAdmin;
}

export function RelatoriosClient({
  salesReport: initialSalesReport, productSales, categorySales, customerReport, couponReport, operationalReport,
}: Props) {
  const [activeTab, setActiveTab] = useState("vendas");

  // Vendas — período customizável. Começa com o período que a página já
  // carregou do servidor (últimos 14 dias); o usuário pode escolher outro
  // intervalo e buscar de novo sem recarregar a página inteira.
  const [salesReport, setSalesReport] = useState(initialSalesReport);
  const [fromDate, setFromDate] = useState(initialSalesReport.period_start);
  const [toDate, setToDate] = useState(initialSalesReport.period_end);
  const [filtering, setFiltering] = useState(false);
  const [filterError, setFilterError] = useState("");

  const handleFilter = async () => {
    setFiltering(true);
    setFilterError("");
    const result = await getSalesReportForRange(fromDate, toDate);
    setFiltering(false);
    if ("error" in result) {
      setFilterError(result.error);
      return;
    }
    setSalesReport(result.report);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Relatórios</h1>
        <p className="text-sm text-muted mt-1">
          {formatDate(salesReport.period_start)} — {formatDate(salesReport.period_end)}
        </p>
      </div>

      {/* Filtro de período — afeta os KPIs de vendas acima e a aba "Vendas" */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1.5">De</label>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-dark-alt border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1.5">Até</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-dark-alt border border-dark-border-light rounded-xl px-3 py-2 text-sm text-dark-text focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
          />
        </div>
        <Button
          variant="accent"
          size="sm"
          leftIcon={<Filter size={14} />}
          onClick={handleFilter}
          isLoading={filtering}
        >
          Filtrar
        </Button>
        {filterError && <p className="text-sm text-danger">{filterError}</p>}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita total" value={formatCurrency(salesReport.total_revenue)} icon={DollarSign} accent />
        <StatCard title="Total pedidos" value={salesReport.total_orders} icon={ShoppingCart} />
        <StatCard title="Ticket médio" value={formatCurrency(salesReport.average_ticket)} icon={TrendingUp} />
        <StatCard title="Pedidos pagos" value={salesReport.paid_orders} icon={BarChart3} />
      </div>

      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab}>
        <TabContent value="vendas" active={activeTab}>
          <div className="space-y-4 mt-6">
            <h2 className="text-sm font-bold text-dark-text">Receita por dia</h2>
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-5 overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left pb-2 text-xs font-semibold text-muted">Data</th>
                    <th className="text-right pb-2 text-xs font-semibold text-muted">Pedidos</th>
                    <th className="text-right pb-2 text-xs font-semibold text-muted">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReport.revenue_by_day.map((d) => (
                    <tr key={d.date} className="border-b border-dark-border last:border-0">
                      <td className="py-2.5 text-dark-text">{formatDate(d.date)}</td>
                      <td className="py-2.5 text-right text-muted">{d.orders}</td>
                      <td className="py-2.5 text-right font-bold text-dark-text">{formatCurrency(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabContent>

        <TabContent value="produtos" active={activeTab}>
          <div className="mt-6 bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-alt">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Produto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Vendidos</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Receita</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted hidden md:table-cell">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {productSales.map((p, i) => (
                  <tr key={p.product_id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover">
                    <td className="px-4 py-3 text-xs font-bold text-muted">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-dark-text truncate max-w-[200px]">{p.product_name}</div>
                      <div className="text-xs text-muted">{p.category_name}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-dark-text">{p.quantity_sold}</td>
                    <td className="px-4 py-3 text-right font-bold text-dark-text">{formatCurrency(p.revenue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted hidden md:table-cell">{formatCurrency(p.average_ticket)}</td>
                  </tr>
                ))}
                {productSales.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted text-sm">Nenhuma venda no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabContent>

        <TabContent value="categorias" active={activeTab}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {categorySales.map((cat) => (
              <ReportCard key={cat.category_id} title={cat.category_name} value={formatCurrency(cat.revenue)} description={`${cat.total_orders} pedidos · ${cat.total_items} itens vendidos`} />
            ))}
            {categorySales.length === 0 && (
              <p className="text-sm text-muted py-4 col-span-full text-center">Nenhuma venda no período.</p>
            )}
          </div>
        </TabContent>

        <TabContent value="clientes" active={activeTab}>
          <div className="mt-6 bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-alt">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Cliente</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Pedidos</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Total gasto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted hidden sm:table-cell">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {customerReport.map((c) => (
                  <tr key={c.customer_id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-dark-text">{c.customer_name}</span>
                        {c.is_vip && <Badge variant="gold" label="VIP" size="sm" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-dark-text">{c.total_orders}</td>
                    <td className="px-4 py-3 text-right font-bold text-dark-text">{formatCurrency(c.total_spent)}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted hidden sm:table-cell">{formatCurrency(c.average_ticket)}</td>
                  </tr>
                ))}
                {customerReport.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-muted text-sm">Nenhum cliente com pedidos ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabContent>

        <TabContent value="cupons" active={activeTab}>
          <div className="mt-6 bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border bg-dark-alt">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Usos</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted">Total descontado</th>
                </tr>
              </thead>
              <tbody>
                {couponReport.map((c) => (
                  <tr key={c.coupon_id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover">
                    <td className="px-4 py-3 font-mono font-bold text-dark-text">{c.code}</td>
                    <td className="px-4 py-3 text-xs text-muted">{COUPON_TYPE_LABELS[c.type]}</td>
                    <td className="px-4 py-3 text-right text-sm text-dark-text">{c.uses_count}</td>
                    <td className="px-4 py-3 text-right font-bold text-danger">{formatCurrency(c.total_discounted)}</td>
                  </tr>
                ))}
                {couponReport.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-muted text-sm">Nenhum cupom utilizado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabContent>

        <TabContent value="operacional" active={activeTab}>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReportCard title="Pedidos pagos" value={operationalReport.paid_orders.length} description="Prontos para separação" icon={ShoppingCart} />
              <ReportCard title="Itens para separar" value={operationalReport.items_to_separate.length} description="SKUs diferentes" icon={BarChart3} />
            </div>
            <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-dark-border bg-dark-alt"><th className="text-left px-4 py-3 text-xs font-semibold text-muted">Pedido</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted">Cliente</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted">Total</th></tr></thead>
                <tbody>
                  {operationalReport.paid_orders.map((o) => (
                    <tr key={o.id} className="border-b border-dark-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-dark-text">{o.order_number}</td>
                      <td className="px-4 py-3 text-sm text-muted">{o.customer_name}</td>
                      <td className="px-4 py-3 text-right font-bold text-dark-text">{formatCurrency(o.total)}</td>
                    </tr>
                  ))}
                  {operationalReport.paid_orders.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-muted text-sm">Nenhum pedido aguardando separação.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabContent>
      </Tabs>
    </div>
  );
}
