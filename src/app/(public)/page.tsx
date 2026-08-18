import { ProductCard } from "@/components/public/ProductCard";
import { HeroBannerCarousel } from "@/components/public/HeroBannerCarousel";
import { EmptyState } from "@/components/common/EmptyState";
import { Container } from "@/components/common/SectionHeader";
import { getTopLevelCategories as dbGetTopLevelCategories } from "@/lib/db/categories";
import { getProductsByCategoryIds as dbGetProductsByCategoryIds } from "@/lib/db/products";
import { getActiveBanners } from "@/lib/db/banners";
import { mockCategories } from "@/data/mock-categories";
import { getProductsByCategoryIds as mockGetProductsByCategoryIds } from "@/data/mock-products";
import type { Category, Product, HomeBanner } from "@/types";

// Vive dentro do grupo (public) de propósito -- assim herda o
// (public)/layout.tsx, que é quem checa isMaintenanceModeActive() e troca o
// site inteiro pela tela de manutenção. Antes esta página ficava solta em
// src/app/page.tsx (fora do grupo, sob o layout raiz puro), então a home
// nunca entrava em manutenção mesmo com o admin ativando o modo -- só as
// outras rotas públicas (que já viviam dentro de (public)/) respeitavam.
export default async function HomePage() {
  let categories: Category[];
  try {
    categories = await dbGetTopLevelCategories();
  } catch {
    categories = mockCategories.filter((c) => c.is_active && !c.parent_id);
  }

  let products: Product[];
  try {
    products = await dbGetProductsByCategoryIds(categories.map((c) => c.id));
  } catch {
    products = mockGetProductsByCategoryIds(categories.map((c) => c.id));
  }

  let banners: HomeBanner[] = [];
  try {
    banners = await getActiveBanners();
  } catch {
    banners = [];
  }

  const sections = categories
    .map((cat) => ({ category: cat, products: products.filter((p) => p.category_id === cat.id) }))
    .filter((s) => s.products.length > 0);

  return (
    <div className="pt-8 pb-16">
      <Container>
        {banners.length > 0 && (
          <div className="mb-10 sm:mb-14">
            <HeroBannerCarousel banners={banners} />
          </div>
        )}

        <div className="mb-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold uppercase text-dark-text mb-2 tracking-wide">Todos os produtos</h1>
          <p className="text-sm text-muted/70">
            {products.length} produto{products.length !== 1 ? "s" : ""} disponíve{products.length !== 1 ? "is" : "l"}
          </p>
        </div>

        <div className="divider-gold my-6" />

        {sections.length === 0 ? (
          <EmptyState
            title="Sem produtos disponíveis"
            description="Novos produtos serão adicionados em breve."
          />
        ) : (
          <div className="space-y-14">
            {sections.map(({ category, products: catProducts }) => (
              <section key={category.id}>
                <h2 className="text-xl md:text-2xl font-bold text-dark-text tracking-tight mb-6">
                  {category.name}
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  {catProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
