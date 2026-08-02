"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X, ChevronRight } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { routes } from "@/lib/routes";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import { AnnouncementBell } from "@/components/layout/AnnouncementBell";
import type { Category, Announcement } from "@/types";

interface NavLink {
  label: string;
  href: string;
  external: boolean;
}

interface Props {
  categories: Category[];
  announcements?: Announcement[];
  whatsappNumber?: string;
  whatsappMessage?: string;
}

export const PublicNavbar = ({ categories, announcements = [], whatsappNumber, whatsappMessage }: Props) => {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const itemCount = useCartStore((s) => s.getItemCount());
  const pathname  = usePathname();

  const navLinks: NavLink[] = [
    { label: "Todos", href: routes.home, external: false },
    ...categories.map((cat) => ({
      label: cat.name,
      href: routes.categoria(cat.slug),
      external: false,
    })),
    { label: "Acompanhar Pedido", href: routes.acompanharPedido, external: false },
    { label: "Atendimento", href: generateStoreWhatsAppLink(whatsappNumber, whatsappMessage), external: true },
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href: string, external: boolean): boolean => {
    if (external) return false;
    if (href === routes.home) return pathname === routes.home;
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={[
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300 border-b",
          scrolled
            ? "bg-dark-bg/98 backdrop-blur-md border-accent/10 shadow-[0_4px_32px_rgba(0,0,0,0.8)]"
            : "bg-dark-bg/90 backdrop-blur-sm border-accent/[0.06]",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-24">

            {/* ── Logo ─────────────────────────────── */}
            <Link href={routes.home} className="flex items-center flex-shrink-0">
              <Image
                src="/logo-tio-snoop.png"
                alt="Tio Snoop Imports Full"
                width={860}
                height={418}
                priority
                unoptimized
                className="h-12 sm:h-16 w-auto object-contain transition-transform duration-300 hover:scale-105"
              />
            </Link>

            {/* ── Nav Desktop ──────────────────────── */}
            <nav className="hidden md:flex items-center gap-8 lg:gap-10">
              {navLinks.map((link) => {
                const active = isActive(link.href, link.external);
                const baseClass =
                  "relative text-sm font-medium transition-colors duration-200 group pb-0.5 tracking-wide";

                if (link.external) {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${baseClass} text-dark-text/80 hover:text-accent`}
                    >
                      {link.label}
                      <span className="absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-accent transition-all duration-300 group-hover:w-full" />
                    </a>
                  );
                }

                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`${baseClass} ${active ? "text-accent" : "text-dark-text/80 hover:text-accent"}`}
                  >
                    {link.label}
                    <span
                      className={[
                        "absolute bottom-0 left-0 h-0.5 rounded-full bg-accent transition-all duration-300",
                        active ? "w-full" : "w-0 group-hover:w-full",
                      ].join(" ")}
                    />
                  </Link>
                );
              })}
            </nav>

            {/* ── Actions ──────────────────────────── */}
            <div className="flex items-center gap-3">

              {/* Avisos e promoções */}
              <AnnouncementBell announcements={announcements} />

              {/* Carrinho */}
              <Link
                href={routes.carrinho}
                aria-label="Carrinho de compras"
                className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-dark-surface border border-dark-border text-dark-text/70 hover:text-accent hover:border-accent/50 hover:shadow-[0_0_16px_rgba(242,183,5,0.25)] transition-all duration-200"
              >
                <ShoppingCart size={21} />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 bg-accent text-dark-bg text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </Link>

              {/* Hambúrguer mobile */}
              <button
                className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-dark-surface border border-dark-border text-dark-text/70 hover:text-accent hover:border-accent/40 transition-all"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Menu Mobile ──────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 pt-24">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="relative bg-dark-bg border-b border-accent/10 shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href, link.external);

                if (link.external) {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-dark-text/80 hover:bg-dark-alt hover:text-accent transition-colors"
                    >
                      {link.label}
                      <ChevronRight size={16} className="text-muted" />
                    </a>
                  );
                }

                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-colors",
                      active
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-dark-text/80 hover:bg-dark-alt hover:text-accent",
                    ].join(" ")}
                  >
                    {link.label}
                    <ChevronRight
                      size={16}
                      className={active ? "text-accent" : "text-muted"}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
