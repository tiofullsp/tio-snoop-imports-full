"use server";

import { getAllActiveProducts as dbGetAllActiveProducts } from "@/lib/db/products";
import { getAllActiveProducts as mockGetAllActiveProducts } from "@/data/mock-products";
import { productMatchesQuery } from "@/lib/search";
import { resolveBasePrice } from "@/lib/pricing";
import type { Product } from "@/types";

export interface SearchSuggestion {
  id: string;
  name: string;
  slug: string;
  price_pix: number;
  image: string | null;
}

const MAX_SUGGESTIONS = 6;

// Usada pelo dropdown de sugestões da barra de busca (aparece enquanto o
// cliente digita, sem precisar clicar em "Buscar") — mesma lógica de match
// da página /busca, só que devolve um resumo enxuto e limitado.
export async function searchProductsLive(query: string): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  let allProducts: Product[] = [];
  try {
    allProducts = await dbGetAllActiveProducts();
  } catch {
    allProducts = mockGetAllActiveProducts();
  }

  return allProducts
    .filter((p) => productMatchesQuery(p, q))
    .slice(0, MAX_SUGGESTIONS)
    .map((p) => {
      const mainImage = p.media?.find((m) => m.is_main && m.type === "image") ?? p.media?.[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price_pix: resolveBasePrice(p),
        image: mainImage?.url ?? null,
      };
    });
}
