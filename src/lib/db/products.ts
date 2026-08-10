// Repositório de produtos — leituras via anon key (RLS + column-level security aplicadas)
// internal_notes e cost_price são bloqueados pelo banco — nunca solicitá-los aqui
// Usar apenas em Server Components, Route Handlers e Server Actions

import { createClient } from "@/lib/supabase/server";
import type {
  Product,
  ProductMedia,
  ProductSpecification,
  ProductFAQ,
  ProductAvailability,
  ProductFulfillmentType,
  PriceTier,
} from "@/types";
import type {
  DbProduct,
  DbProductMedia,
  DbCategory,
} from "@/types/database.types";
import { VARIANT_FIELDS, toVariant, attachStockItemVariants, type VariantRowWithRelations } from "@/lib/db/variant-mappers";

// Campos seguros: exclui internal_notes e cost_price (bloqueados pela column-level security)
const PRODUCT_FIELDS = `
  id, name, slug, sku, category_id,
  price_pix, price_card, price_promotional, promotional_active,
  is_active, is_featured,
  short_description, description, benefits, specifications, faq, warnings,
  stock, stock_minimum, availability, track_stock,
  quantity_pricing_enabled, price_tiers,
  weight_kg, height_cm, width_cm, length_cm, extra_handling_days,
  allow_whatsapp,
  meta_title, meta_description,
  badge_image_url, badge_position_x, badge_position_y, badge_width_pct,
  show_illustrative_badge, fulfillment_type,
  display_order, stock_item_id,
  created_at, updated_at,
  product_media (
    id, product_id, type, url, thumbnail_url, alt_text,
    display_order, is_main, created_at
  ),
  product_variants ( ${VARIANT_FIELDS} )
` as const;

function toMedia(row: DbProductMedia): ProductMedia {
  return {
    id:            row.id,
    product_id:    row.product_id,
    type:          row.type as "image" | "video",
    url:           row.url,
    thumbnail_url: row.thumbnail_url ?? undefined,
    alt_text:      row.alt_text      ?? undefined,
    display_order: row.display_order,
    is_main:       row.is_main,
    created_at:    row.created_at,
  };
}

type ProductRowWithRelations = DbProduct & {
  product_media?: DbProductMedia[];
  product_variants?: VariantRowWithRelations[];
};

function toProduct(row: ProductRowWithRelations): Product {
  return {
    id:                  row.id,
    name:                row.name,
    slug:                row.slug,
    sku:                 row.sku,
    category_id:         row.category_id,
    price_pix:           Number(row.price_pix),
    price_card:          Number(row.price_card),
    price_promotional:   row.price_promotional != null ? Number(row.price_promotional) : undefined,
    promotional_active:  row.promotional_active,
    is_active:           row.is_active,
    is_featured:         row.is_featured,
    short_description:   row.short_description,
    description:         row.description,
    benefits:            row.benefits   ?? undefined,
    warnings:            row.warnings   ?? undefined,
    specifications:      Array.isArray(row.specifications)
                           ? (row.specifications as unknown as ProductSpecification[])
                           : undefined,
    faq:                 Array.isArray(row.faq)
                           ? (row.faq as unknown as ProductFAQ[])
                           : undefined,
    stock:               row.stock,
    stock_minimum:       row.stock_minimum,
    availability:        row.availability    as ProductAvailability,
    track_stock:         row.track_stock,
    quantity_pricing_enabled: row.quantity_pricing_enabled,
    price_tiers:         Array.isArray(row.price_tiers)
                           ? (row.price_tiers as unknown as PriceTier[])
                           : undefined,
    weight_kg:           Number(row.weight_kg),
    height_cm:           Number(row.height_cm),
    width_cm:            Number(row.width_cm),
    length_cm:           Number(row.length_cm),
    extra_handling_days: row.extra_handling_days,
    allow_whatsapp:      row.allow_whatsapp,
    meta_title:          row.meta_title       ?? undefined,
    meta_description:    row.meta_description ?? undefined,
    badge_image_url:     row.badge_image_url   ?? undefined,
    badge_position_x:    row.badge_position_x,
    badge_position_y:    row.badge_position_y,
    badge_width_pct:     row.badge_width_pct,
    show_illustrative_badge: row.show_illustrative_badge,
    fulfillment_type:    row.fulfillment_type as ProductFulfillmentType | null,
    display_order:       row.display_order,
    stock_item_id:       row.stock_item_id ?? undefined,
    created_at:          row.created_at,
    updated_at:          row.updated_at,
    media:               row.product_media
                           ?.slice()
                           .sort((a, b) => a.display_order - b.display_order)
                           .map(toMedia),
    variants:            row.product_variants
                           ?.slice()
                           .sort((a, b) => a.display_order - b.display_order)
                           .map(toVariant),
  };
}

// Produtos em destaque para a Home (is_featured = true, ativos)
export async function getFeaturedProducts(): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const products = (data ?? []).map((row) => toProduct(row as ProductRowWithRelations));
  await attachStockItemVariants(supabase, products);
  return products;
}

// Produtos ativos de uma categoria (para página /categoria/[slug])
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .order("display_order", { ascending: true });

  if (error) throw error;

  const products = (data ?? []).map((row) => toProduct(row as ProductRowWithRelations));
  await attachStockItemVariants(supabase, products);
  return products;
}

// Produtos ativos de várias categorias ao mesmo tempo (para a vitrine de uma
// categoria-pai com subcategorias, ex: Masculino → Camisa + Polo)
export async function getProductsByCategoryIds(categoryIds: string[]): Promise<Product[]> {
  if (categoryIds.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("is_active", true)
    .in("category_id", categoryIds)
    .order("display_order", { ascending: true });

  if (error) throw error;

  const products = (data ?? []).map((row) => toProduct(row as ProductRowWithRelations));
  await attachStockItemVariants(supabase, products);
  return products;
}

// Todos os produtos ativos, de qualquer categoria — usado pela busca (/busca),
// que precisa procurar no catálogo inteiro, não só numa categoria por vez.
export async function getAllActiveProducts(): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;

  const products = (data ?? []).map((row) => toProduct(row as ProductRowWithRelations));
  await attachStockItemVariants(supabase, products);
  return products;
}

// Produto pelo slug (para página /produtos/[slug]) — inclui categoria para breadcrumb e badge
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  if (!data) return null;

  const product = toProduct(data as ProductRowWithRelations);
  await attachStockItemVariants(supabase, [product]);

  // Busca categoria separadamente para breadcrumb e badge de categoria
  const { data: catData } = await supabase
    .from("categories")
    .select(
      "id, name, slug, short_description, full_description, icon, image_url, gradient, color_accent, display_order, is_active, is_featured_home, meta_title, meta_description, created_at, updated_at"
    )
    .eq("id", data.category_id)
    .single();

  if (catData) {
    const cat = catData as DbCategory;
    product.category = {
      id:                cat.id,
      name:              cat.name,
      slug:              cat.slug,
      short_description: cat.short_description,
      full_description:  cat.full_description  ?? undefined,
      icon:              cat.icon              ?? undefined,
      image_url:         cat.image_url         ?? undefined,
      gradient:          cat.gradient          ?? undefined,
      color_accent:      cat.color_accent      ?? undefined,
      display_order:     cat.display_order,
      is_active:         cat.is_active,
      is_featured_home:  cat.is_featured_home,
      meta_title:        cat.meta_title        ?? undefined,
      meta_description:  cat.meta_description  ?? undefined,
      created_at:        cat.created_at,
      updated_at:        cat.updated_at,
    };
  }

  return product;
}

// Produtos relacionados (mesma categoria, excluindo o produto atual)
export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4
): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .neq("id", productId)
    .order("display_order", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const products = (data ?? []).map((row) => toProduct(row as ProductRowWithRelations));
  await attachStockItemVariants(supabase, products);
  return products;
}
