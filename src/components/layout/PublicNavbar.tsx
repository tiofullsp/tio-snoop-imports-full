"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingCart, Menu, X, ChevronRight, Search, Package } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { routes } from "@/lib/routes";
import { formatCurrency } from "@/lib/formatters";
import { searchProductsLive, type SearchSuggestion } from "@/lib/actions/search";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const itemCount = useCartStore((s) => s.getItemCount());
  const pathname  = usePathname();
  const router = useRouter();

  const runSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    router.push(routes.busca(q));
    setSearchOpen(false);
    setMenuOpen(false);
  };

  // Clicar numa sugestão leva pra lista de resultados (mesma tela de sempre,
  // com grid/breadcrumb/contagem), não direto pra página do produto — usa o
  // nome exato da sugestão como busca, então normalmente aparece só ele (ou
  // ele + variações do mesmo nome) na lista.
  const goToSuggestion = (name: string) => {
    router.push(routes.busca(name));
    setSearchOpen(false);
    setMenuOpen(false);
    setSearchQuery("");
  };

  // Sugestões ao vivo enquanto digita — sem precisar clicar em "Buscar".
  // Debounce de 250ms pra não disparar uma busca a cada tecla.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchProductsLive(q);
      setSuggestions(results);
      setSuggestionsLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const suggestionsList = (
    <>
      {suggestionsLoading && (
        <p className="text-xs text-muted text-center py-2">Buscando...</p>
      )}
      {!suggestionsLoading && searchQuery.trim() && suggestions.length === 0 && (
        <p className="text-xs text-muted text-center py-2">Nenhum produto encontrado.</p>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => goToSuggestion(s.name)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-dark-alt transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-dark-alt border border-dark-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                {s.image ? (
                  <Image src={s.image} alt="" width={40} height={40} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <Package size={16} className="text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-dark-text truncate">{s.name}</p>
                <p className="text-xs text-accent font-semibold">{formatCurrency(s.price_pix)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Fecha o dropdown de busca ao clicar fora — mesmo padrão do AnnouncementBell.
  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  // Fecha o dropdown de busca (e o menu mobile) sempre que a rota muda — sem
  // isso, ele ficava "grudado" aberto por cima do conteúdo ao navegar por um
  // link do menu em vez de pela busca.
  useEffect(() => {
    setSearchOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const navLinks: NavLink[] = [
    { label: "Todos", href: routes.home, external: false },
    ...categories.map((cat) => ({
      label: cat.name,
      href: routes.categoria(cat.slug),
      external: false,
    })),
    { label: "Acompanhar Pedido", href: routes.acompanharPedido, external: false },
    { label: "Preço de Atacado", href: "https://www.tiosnoopdog.com/", external: true },
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
                src="/logo-nova.png"
                alt="Tio Snoop Imports Full"
                width={1536}
                height={1024}
                priority
                unoptimized
                className="h-14 sm:h-20 w-auto object-contain transition-transform duration-300 hover:scale-105"
              />
            </Link>

            {/* ── Nav Desktop ──────────────────────── */}
            <nav className="hidden md:flex items-center gap-8 lg:gap-10">
              {navLinks.map((link) => {
                const active = isActive(link.href, link.external);
                const baseClass =
                  "relative text-sm font-medium transition-colors duration-200 group pb-0.5 tracking-wide";

                if (link.external) {
                  const isWholesale = link.label === "Preço de Atacado";
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={[
                        baseClass,
                        isWholesale ? "text-accent font-bold animate-pulse-accent" : "text-dark-text/80 hover:text-accent",
                      ].join(" ")}
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

              {/* Busca */}
              <div ref={searchWrapRef} className="relative hidden sm:block">
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  aria-label="Buscar produtos"
                  className={[
                    "flex items-center justify-center w-11 h-11 rounded-xl border transition-all duration-200",
                    searchOpen
                      ? "bg-accent/10 border-accent/50 text-accent"
                      : "bg-dark-surface border-dark-border text-dark-text/70 hover:text-accent hover:border-accent/50 hover:shadow-[0_0_16px_rgba(242,183,5,0.25)]",
                  ].join(" ")}
                >
                  <Search size={19} />
                </button>

                {searchOpen && (
                  <div className="absolute right-0 top-full mt-3 w-80 z-50 animate-fade-in">
                    <div className="relative rounded-2xl overflow-hidden bg-dark-surface border border-accent/25 shadow-[0_0_0_1px_rgba(242,183,5,0.1),0_24px_64px_rgba(0,0,0,0.55)]">
                      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

                      <div className="px-4 py-3.5 border-b border-dark-border flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-dark-text">
                          <Search size={14} className="text-accent" />
                          Buscar produtos
                        </span>
                        <button
                          onClick={() => setSearchOpen(false)}
                          aria-label="Fechar busca"
                          className="text-muted hover:text-dark-text transition-colors"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && runSearch()}
                          placeholder="Ex: Tirzepatida, GHK-CU..."
                          className="w-full bg-dark-alt border border-dark-border-light rounded-xl px-3.5 py-2.5 text-sm text-dark-text placeholder-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                        />
                        {suggestionsList}
                        <button
                          onClick={runSearch}
                          className="w-full px-4 py-2.5 rounded-xl bg-accent text-dark-bg text-sm font-semibold hover:bg-accent/90 transition-colors"
                        >
                          Ver todos os resultados
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
              {/* Busca (mobile) */}
              <div className="flex items-center gap-2 pb-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="Buscar produto..."
                    className="w-full bg-dark-surface border border-dark-border-light rounded-xl pl-10 pr-4 py-2.5 text-sm text-dark-text placeholder-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                </div>
                <button
                  onClick={runSearch}
                  className="px-4 py-2.5 rounded-xl bg-accent text-dark-bg text-sm font-semibold hover:bg-accent/90 transition-colors flex-shrink-0"
                >
                  Buscar
                </button>
              </div>
              {searchQuery.trim() && <div className="pb-2">{suggestionsList}</div>}

              {navLinks.map((link) => {
                const active = isActive(link.href, link.external);

                if (link.external) {
                  const isWholesale = link.label === "Preço de Atacado";
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className={[
                        "flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-colors",
                        isWholesale
                          ? "text-accent animate-pulse-accent bg-accent/10 border border-accent/20"
                          : "text-dark-text/80 hover:bg-dark-alt hover:text-accent",
                      ].join(" ")}
                    >
                      {link.label}
                      <ChevronRight size={16} className={isWholesale ? "text-accent" : "text-muted"} />
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
