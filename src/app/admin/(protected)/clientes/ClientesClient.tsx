"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Users, DollarSign, ShoppingCart, Crown, Eye } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { computeCustomerMetrics } from "@/lib/customer-metrics";
import { routes } from "@/lib/routes";
import type { Customer } from "@/types";

interface Props {
  initialCustomers: Customer[];
}

export function ClientesClient({ initialCustomers }: Props) {
  const [search, setSearch] = useState("");
  const metrics = useMemo(() => computeCustomerMetrics(initialCustomers), [initialCustomers]);

  const getCustomerBadge = (c: Customer) => {
    if (c.is_vip) return <Badge variant="gold" label="VIP" size="sm" />;
    if (c.total_orders >= 3) return <Badge variant="info" label="Recorrente" size="sm" />;
    return <Badge variant="neutral" label="Novo" size="sm" />;
  };

  const filtered = initialCustomers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Clientes</h1>
        <p className="text-sm text-muted mt-1">{metrics.total_customers} clientes cadastrados</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total clientes" value={metrics.total_customers} icon={Users} />
        <StatCard title="Total pedidos" value={metrics.total_orders} icon={ShoppingCart} />
        <StatCard title="Receita total" value={formatCurrency(metrics.total_revenue)} icon={DollarSign} accent />
        <StatCard title="Clientes VIP" value={metrics.vip_count} icon={Crown} />
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome, e-mail ou telefone..."
      />

      {/* Table */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-dark-alt">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">Pedidos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Total gasto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Desde</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Última compra</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-accent">{c.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-dark-text">{c.name}</div>
                        <div className="text-xs text-muted">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-dark-text hidden sm:table-cell">{c.total_orders}</td>
                  <td className="px-4 py-3 font-bold text-dark-text">{formatCurrency(c.total_spent)}</td>
                  <td className="px-4 py-3 text-xs text-muted hidden md:table-cell">
                    {c.first_order_at ? formatDate(c.first_order_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted hidden lg:table-cell">
                    {c.last_order_at ? formatDate(c.last_order_at) : "—"}
                  </td>
                  <td className="px-4 py-3">{getCustomerBadge(c)}</td>
                  <td className="px-4 py-3">
                    <Link href={routes.admin.cliente(c.id)}>
                      <button className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors">
                        <Eye size={13} />
                        Ver
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
