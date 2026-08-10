import type { Product } from "@/types";

// Fallback usado apenas quando o Supabase está inacessível.
export const mockProducts: Product[] = [
  {
    id: "prod-1",
    name: "Camiseta Básica Masculina — Preta",
    slug: "camiseta-basica-masculina-preta",
    sku: "CAM-MASC-PRETA-001",
    category_id: "cat-camisa-masculina",
    display_order: 0,
    price_pix: 89.90,
    price_card: 94.90,
    promotional_active: false,
    is_active: true,
    is_featured: true,
    short_description: "Camiseta básica masculina 100% algodão, corte premium.",
    description: "Camiseta masculina confeccionada em algodão penteado de alta gramatura, com modelagem regular e acabamento premium. Conforto e durabilidade para o dia a dia.",
    benefits: "100% algodão penteado\nModelagem regular fit\nReforço nas costuras\nNão desbota",
    specifications: [
      { label: "Tecido", value: "100% algodão penteado" },
      { label: "Tamanhos disponíveis", value: "P, M, G, GG" },
      { label: "Modelagem", value: "Regular fit" },
      { label: "Cuidados de lavagem", value: "Lavar à máquina, água fria" },
    ],
    media: [
      {
        id: "media-1",
        product_id: "prod-1",
        type: "image",
        url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
        alt_text: "Camiseta básica masculina preta",
        display_order: 1,
        is_main: true,
        created_at: "2026-06-24T10:00:00Z",
      },
    ],
    stock: 40,
    stock_minimum: 5,
    availability: "in_stock",
    track_stock: true,
    quantity_pricing_enabled: false,
    weight_kg: 0.2,
    height_cm: 3,
    width_cm: 25,
    length_cm: 35,
    extra_handling_days: 0,
    allow_whatsapp: true,
    show_illustrative_badge: true,
    created_at: "2026-06-24T10:00:00Z",
    updated_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "prod-2",
    name: "Polo Masculina Piquet — Azul Marinho",
    slug: "polo-masculina-piquet-azul-marinho",
    sku: "POLO-MASC-AZUL-001",
    category_id: "cat-polo-masculina",
    display_order: 0,
    price_pix: 139.90,
    price_card: 146.90,
    promotional_active: true,
    price_promotional: 119.90,
    is_active: true,
    is_featured: true,
    short_description: "Polo masculina em piquet com gola e punho canelados.",
    description: "Polo masculina confeccionada em tecido piquet de alta qualidade, com gola e punhos canelados e botões em resina. Visual elegante para o dia a dia ou ocasiões casuais.",
    benefits: "Tecido piquet premium\nGola e punho canelados\nBotões em resina\nCaimento confortável",
    specifications: [
      { label: "Tecido", value: "Piquet 100% algodão" },
      { label: "Tamanhos disponíveis", value: "P, M, G, GG, XG" },
      { label: "Modelagem", value: "Slim fit" },
      { label: "Cuidados de lavagem", value: "Lavar à máquina, não usar alvejante" },
    ],
    media: [
      {
        id: "media-2",
        product_id: "prod-2",
        type: "image",
        url: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800",
        alt_text: "Polo masculina azul marinho",
        display_order: 1,
        is_main: true,
        created_at: "2026-06-24T10:00:00Z",
      },
    ],
    stock: 25,
    stock_minimum: 5,
    availability: "in_stock",
    track_stock: true,
    quantity_pricing_enabled: false,
    weight_kg: 0.25,
    height_cm: 3,
    width_cm: 25,
    length_cm: 35,
    extra_handling_days: 0,
    allow_whatsapp: true,
    show_illustrative_badge: true,
    created_at: "2026-06-24T10:00:00Z",
    updated_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "prod-3",
    name: "Camiseta Básica Feminina — Branca",
    slug: "camiseta-basica-feminina-branca",
    sku: "CAM-FEM-BRANCA-001",
    category_id: "cat-camisa-feminina",
    display_order: 0,
    price_pix: 84.90,
    price_card: 89.90,
    promotional_active: false,
    is_active: true,
    is_featured: true,
    short_description: "Camiseta básica feminina 100% algodão, caimento premium.",
    description: "Camiseta feminina em algodão penteado com caimento que valoriza o corpo, gola careca e acabamento reforçado. Peça versátil para compor diferentes looks.",
    benefits: "100% algodão penteado\nCaimento feminino\nGola careca reforçada\nTecido macio",
    specifications: [
      { label: "Tecido", value: "100% algodão penteado" },
      { label: "Tamanhos disponíveis", value: "PP, P, M, G, GG" },
      { label: "Modelagem", value: "Caimento justo" },
      { label: "Cuidados de lavagem", value: "Lavar à máquina, água fria" },
    ],
    media: [
      {
        id: "media-3",
        product_id: "prod-3",
        type: "image",
        url: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=800",
        alt_text: "Camiseta básica feminina branca",
        display_order: 1,
        is_main: true,
        created_at: "2026-06-24T10:00:00Z",
      },
    ],
    stock: 35,
    stock_minimum: 5,
    availability: "in_stock",
    track_stock: true,
    quantity_pricing_enabled: false,
    weight_kg: 0.18,
    height_cm: 3,
    width_cm: 24,
    length_cm: 33,
    extra_handling_days: 0,
    allow_whatsapp: true,
    show_illustrative_badge: true,
    created_at: "2026-06-24T10:00:00Z",
    updated_at: "2026-06-24T10:00:00Z",
  },
  {
    id: "prod-4",
    name: "Moletom Feminino com Capuz — Cinza Mescla",
    slug: "moletom-feminino-capuz-cinza-mescla",
    sku: "MOL-FEM-CINZA-001",
    category_id: "cat-moletom-feminino",
    display_order: 0,
    price_pix: 189.90,
    price_card: 198.90,
    promotional_active: false,
    is_active: true,
    is_featured: false,
    short_description: "Moletom feminino com capuz, flanelado por dentro.",
    description: "Moletom feminino em moletom flanelado, com capuz forrado e bolso canguru. Quentinho e confortável, ideal para dias mais frios sem perder o estilo.",
    benefits: "Flanelado por dentro\nCapuz forrado\nBolso canguru\nPunhos e barra em ribana",
    specifications: [
      { label: "Tecido", value: "Moletom flanelado 100% algodão" },
      { label: "Tamanhos disponíveis", value: "P, M, G, GG" },
      { label: "Modelagem", value: "Caimento solto" },
      { label: "Cuidados de lavagem", value: "Lavar à máquina, não usar secadora" },
    ],
    media: [
      {
        id: "media-4",
        product_id: "prod-4",
        type: "image",
        url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800",
        alt_text: "Moletom feminino cinza mescla",
        display_order: 1,
        is_main: true,
        created_at: "2026-06-24T10:00:00Z",
      },
    ],
    stock: 4,
    stock_minimum: 5,
    availability: "low_stock",
    track_stock: true,
    quantity_pricing_enabled: false,
    weight_kg: 0.45,
    height_cm: 5,
    width_cm: 30,
    length_cm: 40,
    extra_handling_days: 1,
    allow_whatsapp: true,
    show_illustrative_badge: true,
    created_at: "2026-06-24T10:00:00Z",
    updated_at: "2026-06-24T10:00:00Z",
  },
];

export const getProductBySlug = (slug: string): Product | undefined =>
  mockProducts.find((p) => p.slug === slug);

export const getProductsByCategory = (categoryId: string): Product[] =>
  mockProducts.filter((p) => p.category_id === categoryId && p.is_active);

export const getProductsByCategoryIds = (categoryIds: string[]): Product[] =>
  mockProducts.filter((p) => categoryIds.includes(p.category_id) && p.is_active);

export const getFeaturedProducts = (): Product[] =>
  mockProducts.filter((p) => p.is_featured && p.is_active);

export const getAllActiveProducts = (): Product[] =>
  mockProducts.filter((p) => p.is_active);

export const getRelatedProducts = (
  productId: string,
  categoryId: string,
  limit = 4
): Product[] =>
  mockProducts
    .filter(
      (p) => p.category_id === categoryId && p.id !== productId && p.is_active
    )
    .slice(0, limit);
