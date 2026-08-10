import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Plus, ShoppingCart, DollarSign, Star, Clock } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { StatCard } from "@/components/admin/StatCard";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerByIdAdmin, getOrdersByCustomerAdmin, getClientCouponsAdmin,
  type CustomerOrderSummary, type CustomerCouponSummary,
} from "@/lib/db/customers";
import { getCustomerById as getMockCustomerById } from "@/data/mock-customers";
import { getOrdersByCustomer as getMockOrdersByCustomer } from "@/data/mock-orders";
import { getClientCoupons as getMockClientCoupons } from "@/data/mock-coupons";
import { routes } from "@/lib/routes";
import type { Customer } from "@/types";

interface Props { params: Promise<{ id: string }> }

async function loadCustomerData(id: string): Promise<{
  customer: Customer | null;
  orders: CustomerOrderSummary[];
  coupons: CustomerCouponSummary[];
}> {
  try {
    const customer = await getCustomerByIdAdmin(id);
    if (!customer) return { customer: null, orders: [], coupons: [] };
    const [orders, coupons] = await Promise.all([
      getOrdersByCustomerAdmin(id),
      getClientCouponsAdmin(id),
    ]);
    return { customer, orders, coupons };
  } catch {
    const customer = getMockCustomerById(id) ?? null;
    if (!customer) return { customer: null, orders: [], coupons: [] };
    return { customer, orders: getMockOrdersByCustomer(id), coupons: getMockClientCoupons(id) };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { customer } = await loadCustomerData(id);
  return { title: customer?.name ?? "Cliente" };
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const { customer, orders, coupons } = await loadCustomerData(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={routes.admin.clientes}>
          <button className="w-8 h-8 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center hover:bg-dark-hover transition-colors">
            <ArrowLeft size={15} className="text-muted" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-dark-text">{customer.name}</h1>
            {customer.is_vip && <Badge variant="gold" label="VIP" />}
            {!customer.is_vip && customer.total_orders >= 3 && <Badge variant="info" label="Recorrente" />}
            {!customer.is_vip && customer.total_orders < 3 && <Badge variant="neutral" label="Novo cliente" />}
          </div>
          <p className="text-sm text-muted">{customer.email} · {customer.phone}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${customer.phone.replace(/\D/g, "")}?text=Olá ${encodeURIComponent(customer.name)}!`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-whatsapp/30 text-whatsapp hover:bg-whatsapp/10 transition-all text-xs font-medium">
              <MessageCircle size={14} />
              WhatsApp
            </button>
          </a>
          <Link href={routes.admin.cupons}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all text-xs font-medium">
              <Plus size={14} />
              Criar cupom
            </button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total pedidos" value={customer.total_orders} icon={ShoppingCart} />
        <StatCard title="Total gasto" value={formatCurrency(customer.total_spent)} icon={DollarSign} accent />
        <StatCard title="Ticket médio" value={formatCurrency(customer.average_ticket)} icon={Star} />
        <StatCard
          title="Última compra"
          value={customer.last_order_at ? formatDate(customer.last_order_at) : "—"}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-dark-text">Histórico de pedidos</h2>
          {orders.length === 0 ? (
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-8 text-center text-sm text-muted">
              Nenhum pedido encontrado para este cliente.
            </div>
          ) : (
            <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-alt">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Pedido</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-dark-border last:border-0 hover:bg-dark-hover transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-dark-text">
                        <Link href={routes.admin.pedido(order.id)} className="hover:text-accent transition-colors">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3 font-bold text-dark-text">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusSelect currentStatus={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Address */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Endereço</h3>
            <p className="text-sm text-dark-text">
              {customer.street}, {customer.number}
              {customer.complement && `, ${customer.complement}`}
            </p>
            <p className="text-sm text-muted">{customer.neighborhood}</p>
            <p className="text-sm text-muted">{customer.city}/{customer.state} · {customer.zip_code}</p>
          </div>

          {/* Coupons */}
          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Cupons personalizados ({coupons.length})
            </h3>
            {coupons.length === 0 ? (
              <p className="text-xs text-muted">Nenhum cupom personalizado.</p>
            ) : (
              <div className="space-y-2">
                {coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-dark-border last:border-0">
                    <span className="text-sm font-mono font-bold text-accent">{c.code}</span>
                    <Badge
                      variant={c.is_active ? "success" : "neutral"}
                      label={c.is_active ? "Ativo" : "Inativo"}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {customer.notes && customer.notes.length > 0 && (
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Notas internas</h3>
              <div className="space-y-2">
                {customer.notes.map((note) => (
                  <div key={note.id} className="text-xs text-muted bg-dark-alt rounded-lg p-2.5">
                    <p>{note.note}</p>
                    <p className="mt-1 text-muted/60">{formatDate(note.created_at)} · {note.created_by}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
