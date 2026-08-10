import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/public/ProductCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Container } from "@/components/common/SectionHeader";
import { getAllActiveProducts as dbGetAllActiveProducts } from "@/lib/db/products";
import { getAllActiveProducts as mockGetAllActiveProducts } from "@/data/mock-products";
import { productMatchesQuery } from "@/lib/search";
import { routes } from "@/lib/routes";
import type { Product } from "@/types";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Busca: ${q}` : "Buscar produtos" };
}

export default async function BuscaPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let allProducts: Product[] = [];
  try {
    allProducts = await dbGetAllActiveProducts();
  } catch {
    allProducts = mockGetAllActiveProducts();
  }

  const results = query
    ? allProducts.filter((p) => productMatchesQuery(p, query))
    : [];

  return (
    <div className="py-16">
      <Container>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted mb-10 flex-wrap">
          <Link href={routes.home} className="hover:text-accent transition-colors">Início</Link>
          <ChevronRight size={12} className="text-muted/50" />
          <span className="text-dark-text/80 font-medium">Busca</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold text-dark-text mb-3 tracking-tight">
              {query ? `Resultados para "${query}"` : "Buscar produtos"}
            </h1>
            {query && (
              <p className="text-sm text-muted/70 mt-3">
                {results.length} produto{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link href={routes.home} className="flex-shrink-0">
            <span className="flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors mt-1">
              <ArrowLeft size={15} />
              Voltar
            </span>
          </Link>
        </div>

        <div className="divider-gold my-10" />

        {!query ? (
          <EmptyState
            title="Digite algo pra buscar"
            description="Use a barra de busca no topo da página pra encontrar um produto pelo nome."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="Nenhum produto encontrado"
            description={`Não achamos nada pra "${query}". Confira a grafia ou dá uma olhada nas categorias.`}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
