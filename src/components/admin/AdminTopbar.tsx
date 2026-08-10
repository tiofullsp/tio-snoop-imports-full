"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { routes } from "@/lib/routes";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AdminProfileMenu } from "@/components/admin/AdminProfileMenu";
import { useBreadcrumbLabels } from "@/components/admin/BreadcrumbContext";

interface Props {
  adminName: string;
  adminEmail: string;
  adminRole: string;
}

const BREADCRUMB_MAP: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/pedidos": "Pedidos",
  "/admin/produtos": "Produtos",
  "/admin/produtos/novo": "Novo Produto",
  "/admin/categorias": "Categorias",
  "/admin/cupons": "Cupons",
  "/admin/clientes": "Clientes",
  "/admin/relatorios": "Relatórios",
  "/admin/configuracoes": "Configurações",
  "/admin/banners": "Banners",
  "/admin/feedbacks": "Feedbacks",
};

const buildBreadcrumbs = (pathname: string, dynamicLabels: Record<string, string>) => {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [
    { label: "Admin", href: "/admin" },
  ];

  let current = "";
  for (const part of parts.slice(1)) {
    current += "/" + part;
    const fullPath = "/admin" + current;
    // Rota dinâmica (ex: /admin/pedidos/<uuid>) — usa o rótulo publicado pela
    // própria página (ver BreadcrumbContext) em vez do UUID cru da URL.
    const label = BREADCRUMB_MAP[fullPath] ?? dynamicLabels[fullPath] ?? capitalize(part);
    crumbs.push({ label, href: fullPath });
  }

  return crumbs;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const AdminTopbar = ({ adminName, adminEmail, adminRole }: Props) => {
  const pathname = usePathname();
  const dynamicLabels = useBreadcrumbLabels();
  const crumbs = buildBreadcrumbs(pathname, dynamicLabels);

  return (
    <header className="h-16 bg-dark-surface border-b border-dark-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb.href}>
            {i > 0 && <ChevronRight size={14} className="text-muted flex-shrink-0" />}
            {i < crumbs.length - 1 ? (
              <Link
                href={crumb.href}
                className="text-muted hover:text-dark-text transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-dark-text font-medium">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Link
          href={routes.home}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-dark-text transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-hover border border-transparent hover:border-dark-border"
        >
          <ExternalLink size={13} />
          Ver loja
        </Link>

        <NotificationBell />
        <AdminProfileMenu name={adminName} email={adminEmail} role={adminRole} />
      </div>
    </header>
  );
};
