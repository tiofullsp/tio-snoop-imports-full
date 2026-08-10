"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tag,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Image,
  Smartphone,
  MessageSquareQuote,
  Megaphone,
} from "lucide-react";
import { routes } from "@/lib/routes";
import { logoutAdmin } from "@/lib/actions/auth";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", href: routes.admin.dashboard, icon: LayoutDashboard },
      { label: "Pedidos", href: routes.admin.pedidos, icon: ShoppingCart },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Produtos", href: routes.admin.produtos, icon: Package },
      { label: "Categorias", href: routes.admin.categorias, icon: Grid3x3 },
      { label: "Cupons", href: routes.admin.cupons, icon: Tag },
      { label: "Banners", href: routes.admin.banners, icon: Image },
      { label: "Avisos", href: routes.admin.anuncios, icon: Megaphone },
      { label: "Feedbacks", href: routes.admin.feedbacks, icon: MessageSquareQuote },
      { label: "Preview Mobile", href: routes.admin.previewMobile, icon: Smartphone },
    ],
  },
  {
    label: "Clientes",
    items: [{ label: "Clientes", href: routes.admin.clientes, icon: Users }],
  },
  {
    label: "Análise",
    items: [{ label: "Relatórios", href: routes.admin.relatorios, icon: BarChart3 }],
  },
  {
    label: "Sistema",
    items: [{ label: "Configurações", href: routes.admin.configuracoes, icon: Settings }],
  },
];

export const AdminSidebar = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={[
        "flex flex-col h-full bg-dark-surface border-r border-dark-border transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      ].join(" ")}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-dark-border flex-shrink-0">
        {!collapsed && (
          <span className="font-bold text-sm text-dark-text truncate">Premium Admin</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-lg bg-dark-alt hover:bg-dark-hover border border-dark-border flex items-center justify-center transition-colors flex-shrink-0"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronRight size={14} className="text-muted" />
          ) : (
            <ChevronLeft size={14} className="text-muted" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-xs font-semibold text-muted uppercase tracking-wider px-2 mb-1">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={[
                        "flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        active
                          ? "bg-accent/10 text-dark-text"
                          : "text-muted hover:text-dark-text hover:bg-dark-hover",
                        collapsed ? "justify-center" : "",
                      ].join(" ")}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {active && !collapsed && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Logout — Server Action via form */}
      <div className="border-t border-dark-border p-2 flex-shrink-0">
        <form action={logoutAdmin}>
          <button
            type="submit"
            title={collapsed ? "Sair" : undefined}
            className={[
              "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-muted hover:text-danger hover:bg-danger/5 transition-all",
              collapsed ? "justify-center" : "",
            ].join(" ")}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </form>
      </div>
    </aside>
  );
};
