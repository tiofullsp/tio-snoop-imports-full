// =============================================
// CATEGORIAS
// =============================================

export interface Category {
  id: string;
  parent_id?: string;
  name: string;
  slug: string;
  short_description: string;
  full_description?: string;
  icon?: string;
  image_url?: string;
  image_storage_path?: string;
  image_object_position_x?: number;
  image_object_position_y?: number;
  image_scale?: number;
  mobile_image_url?: string;
  mobile_image_storage_path?: string;
  mobile_image_object_position_x?: number;
  mobile_image_object_position_y?: number;
  mobile_image_scale?: number;
  first_product_image_url?: string;
  gradient?: string;
  color_accent?: string;
  display_order: number;
  is_active: boolean;
  is_featured_home: boolean;
  product_count?: number;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// MÍDIA DO PRODUTO
// =============================================

export interface ProductMedia {
  id: string;
  product_id: string;
  type: "image" | "video";
  url: string;
  thumbnail_url?: string;
  alt_text?: string;
  display_order: number;
  is_main: boolean;
  created_at: string;
}

// =============================================
// VARIAÇÕES DE PRODUTO (cor → fotos + tamanhos com estoque próprio)
// =============================================

export interface ProductVariantMedia {
  id: string;
  variant_id: string;
  url: string;
  storage_path?: string;
  is_main: boolean;
  is_hover: boolean;
  display_order: number;
  created_at: string;
}

export interface ProductVariantSize {
  id: string;
  variant_id: string;
  size: string;
  stock: number;
  sku?: string;
  low_stock_alert: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  // Dono da variante — OU um produto direto (modo legado/manual) OU uma
  // peça de estoque reutilizável (stock_item_id). Nunca os dois.
  product_id?: string;
  stock_item_id?: string;
  color_name: string;
  color_hex: string;
  display_order: number;
  is_active: boolean;
  media: ProductVariantMedia[];
  sizes: ProductVariantSize[];
  created_at: string;
  updated_at: string;
}

// =============================================
// CURADORIA DE CORES — quais cores de uma peça do estoque aparecem em um
// produto vinculado, em que ordem, qual é a principal, e imagens próprias
// do produto por cor (cópia da imagem do estoque + ajustes, nunca duplica
// tamanho/SKU/quantidade). Usado só pelo Admin — não substitui
// ProductVariant/ProductVariantMedia, que continuam sendo o formato lido
// pela loja pública (ver attachStockItemVariants).
// =============================================

export interface ProductColorImage {
  id: string;
  product_color_id: string;
  url: string;
  storage_path?: string;
  source: "stock" | "upload";
  stock_media_id?: string;
  is_primary: boolean;
  is_hover: boolean;
  display_order: number;
  created_at: string;
}

export interface ProductColor {
  id: string;
  product_id: string;
  variant_id: string;
  display_order: number;
  is_main: boolean;
  images: ProductColorImage[];
  created_at: string;
  updated_at: string;
}

// =============================================
// ESTOQUE — peça reutilizável (cor → tamanho/SKU/quantidade)
// =============================================

export interface StockItem {
  id: string;
  name: string;
  base_sku: string;
  category_id?: string;
  is_active: boolean;
  variants: ProductVariant[];
  // Produto comercial vinculado a esta peça, se houver (1 peça = 1 produto)
  linked_product?: { id: string; name: string; slug: string };
  created_at: string;
  updated_at: string;
}

export type InventoryMovementType = "sale" | "restock" | "adjustment" | "cancelled_return";

export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_size_id?: string;
  type: InventoryMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  order_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  // Contexto legível — montado na camada de leitura, não vem direto do banco
  color_name?: string;
  size?: string;
}

// =============================================
// PRODUTO
// =============================================

export type ProductAvailability =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

// Selo de disponibilidade exibido no card — mutuamente exclusivo
export type ProductFulfillmentType =
  | "pronta_entrega"
  | "sob_encomenda";

export const FULFILLMENT_TYPE_LABELS: Record<ProductFulfillmentType, string> = {
  pronta_entrega: "Pronta entrega",
  sob_encomenda:  "Sob encomenda",
};

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductFAQ {
  question: string;
  answer: string;
}

export interface PriceTier {
  quantity: number;
  unit_price: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category_id: string;
  category?: Category;

  // Preços
  price_pix: number;
  price_card: number;
  price_promotional?: number;
  promotional_active: boolean;
  cost_price?: number;

  // Visibilidade
  is_active: boolean;
  is_featured: boolean;

  // Textos
  short_description: string;
  description: string;
  benefits?: string;
  specifications?: ProductSpecification[];
  faq?: ProductFAQ[];
  warnings?: string;

  // Mídia
  media?: ProductMedia[];

  // Variações de cor/tamanho — quando presente e não-vazio, o produto usa
  // estoque por variação em vez do estoque flat abaixo (stock/track_stock).
  variants?: ProductVariant[];

  // Quando preenchido, as variações acima vêm de uma peça do estoque
  // reutilizável (stock_items), não de product_variants.product_id direto.
  stock_item_id?: string;

  // Selo/badge customizado — imagem livre sobre o card (posição/tamanho em %)
  badge_image_url?: string;
  badge_position_x?: number;
  badge_position_y?: number;
  badge_width_pct?: number;

  // Aviso "Imagem meramente ilustrativa" sobre a foto do card — ligado por padrão
  show_illustrative_badge: boolean;

  // Selo de disponibilidade — mutuamente exclusivo (ou um, ou outro, ou nenhum)
  fulfillment_type?: ProductFulfillmentType | null;

  // Ordem de exibição dentro da categoria — definida por drag-and-drop no admin
  display_order: number;

  // Estoque
  stock: number | null;
  stock_minimum: number;
  availability: ProductAvailability;
  track_stock: boolean;

  // Promoção por quantidade
  quantity_pricing_enabled: boolean;
  price_tiers?: PriceTier[];

  // Logística
  weight_kg: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  extra_handling_days: number;

  // Comportamento
  allow_whatsapp: boolean;

  // SEO
  meta_title?: string;
  meta_description?: string;

  // Interno
  internal_notes?: string;

  created_at: string;
  updated_at: string;
}

// =============================================
// BANNERS DA HOME
// =============================================

export interface HomeBanner {
  id: string;
  title?: string | null;
  subtitle?: string | null;

  // Imagem Desktop (obrigatória)
  image_url: string;
  storage_path?: string | null;

  // Imagem Mobile (opcional — usa desktop como fallback)
  image_mobile_url?: string | null;
  mobile_storage_path?: string | null;

  link_url?: string | null;
  link_label: string;
  is_active: boolean;
  display_order: number;

  // Destino estruturado — quando preenchido, link_url é gerado automaticamente
  link_type: "product" | "category" | "url";
  link_product_id?: string | null;
  link_category_id?: string | null;

  // Enquadramento — opcionais para compatibilidade com banners antigos (default: 50/50/1)
  desktop_object_position_x?: number;
  desktop_object_position_y?: number;
  desktop_scale?: number;
  mobile_object_position_x?: number;
  mobile_object_position_y?: number;
  mobile_scale?: number;

  // Promoção por quantidade do produto vinculado (somente leitura, calculada)
  linked_product?: {
    price_pix: number;
    quantity_pricing_enabled: boolean;
    price_tiers?: PriceTier[];
  };

  created_at: string;
  updated_at: string;
}

// =============================================
// AVISOS (sino do navbar) — promoções, cupons, avisos gerais
// =============================================

export type AnnouncementType = "promocao" | "cupom" | "aviso";

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  promocao: "Promoção",
  cupom:    "Cupom",
  aviso:    "Aviso",
};

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  message: string;
  coupon_code?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// =============================================
// FEEDBACKS / AVALIAÇÕES
// =============================================

export interface Review {
  id: string;
  customer_name: string;
  rating: number; // 0-5
  state: string; // UF
  delivery_days_label: string;
  comment: string;
  image_url?: string;
  image_storage_path?: string;
  image_object_position_x: number;
  image_object_position_y: number;
  image_scale: number;
  video_url?: string;
  product_ids: string[]; // pode estar relacionado a vários produtos (mesmo pedido)
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// =============================================
// CLIENTE
// =============================================

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf_cnpj?: string;

  // Endereço
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;

  // Segmentação
  is_vip: boolean;
  vip_marked_at?: string;

  // Métricas calculadas
  total_orders: number;
  total_spent: number;
  average_ticket: number;
  first_order_at?: string;
  last_order_at?: string;

  notes?: CustomerNote[];

  created_at: string;
  updated_at: string;
}

// =============================================
// PEDIDO
// =============================================

export type OrderStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "shipping_link_pending"
  | "shipping_paid"
  | "label_issued"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded";

export type PaymentMethod = "pix" | "card";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image?: string;
  quantity: number;
  unit_price_pix: number;
  unit_price_card: number;
  subtotal: number;
  variant_size_id?: string;
  variant_color_name?: string;
  variant_color_hex?: string;
  variant_size?: string;
  variant_sku?: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status?: OrderStatus;
  new_status: OrderStatus;
  changed_by: string;
  notes?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_cpf?: string;

  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_id?: string;

  // Endereço de entrega
  shipping_street: string;
  shipping_number: string;
  shipping_complement?: string;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_code: string;

  // Financeiro
  subtotal: number;
  coupon_code?: string;
  coupon_discount: number;
  shipping_value: number;
  shipping_service?: string;
  insurance_enabled: boolean;
  insurance_value: number;
  tracking_code?: string;
  tracking_url?: string;
  total: number;

  // Frete (Shopee)
  payment_confirmed_at?: string;
  shipping_payment_link?: string;
  shipping_customer_name?: string;
  shipping_order_id?: string;
  shipping_label_url?: string;
  shipping_label_storage_path?: string;
  label_issued_at?: string;

  // Itens
  items?: OrderItem[];

  // Histórico
  status_history?: OrderStatusHistory[];

  notes?: string;
  internal_notes?: string;

  created_at: string;
  updated_at: string;
}

// =============================================
// CUPOM
// =============================================

export type CouponType = "percentage" | "fixed" | "free_shipping";

export interface Coupon {
  id: string;
  code: string;
  description_internal?: string;
  type: CouponType;
  value: number;
  is_active: boolean;
  start_date?: string;
  expiration_date?: string;
  max_uses_total?: number;
  max_uses_per_customer?: number;
  min_order_value?: number;
  customer_specific_id?: string;
  customer_specific_name?: string;
  categories?: string[];
  products?: string[];
  uses_count: number;
  created_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  order_id: string;
  customer_email: string;
  discount_applied: number;
  created_at: string;
}

// =============================================
// FRETE
// =============================================

export interface ShippingOption {
  code: string;
  name: string;
  carrier: string;
  price: number;
  delivery_days: number;
  description?: string;
}

export interface ShippingQuote {
  cep_origin: string;
  cep_destination: string;
  options: ShippingOption[];
  quoted_at: string;
}

// =============================================
// CARRINHO (Zustand local)
// =============================================

export interface CartItem {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_sku: string;
  product_image?: string;
  price_pix: number; // preço unitário efetivo para a quantidade atual (recalculado por tier)
  base_price_pix: number; // preço unitário para quantidade 1 (já resolvendo promoção)
  price_card: number;
  price_tiers?: PriceTier[];
  quantity: number;
  track_stock: boolean;
  stock: number | null;

  // Variação escolhida (cor+tamanho) — ausente para produtos sem variação
  variant_size_id?: string;
  variant_color_name?: string;
  variant_color_hex?: string;
  variant_size?: string;
  variant_sku?: string;
}

export interface CartState {
  items: CartItem[];
  shipping_option: ShippingOption | null;
  coupon_code: string | null;
  coupon_discount: number;
  coupon_type?: CouponType;
  insurance_enabled: boolean;
  // Fração (0.25 = 25%) — sincronizada a partir das configurações da loja
  // (ver CartSettingsSync). O valor inicial é só um fallback antes da
  // primeira sincronização.
  insurance_percentage: number;
}

// =============================================
// RELATÓRIOS
// =============================================

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface ProductSalesData {
  product_id: string;
  product_name: string;
  product_sku: string;
  category_name: string;
  quantity_sold: number;
  revenue: number;
  average_ticket: number;
}

export interface CategorySalesData {
  category_id: string;
  category_name: string;
  total_items: number;
  total_orders: number;
  revenue: number;
}

export interface CustomerReportData {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_orders: number;
  total_spent: number;
  average_ticket: number;
  first_order_at: string;
  last_order_at: string;
  is_vip: boolean;
}

export interface CouponReportData {
  coupon_id: string;
  code: string;
  type: CouponType;
  value: number;
  uses_count: number;
  total_discounted: number;
  customer_specific?: boolean;
}

export interface SalesReport {
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_orders: number;
  average_ticket: number;
  paid_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  revenue_by_day: SalesDataPoint[];
}

export interface OperationalReport {
  date: string;
  paid_orders: Order[];
  items_to_separate: {
    product_id: string;
    product_name: string;
    product_image?: string;
    total_quantity: number;
    order_numbers: string[];
  }[];
}

// =============================================
// CONFIGURAÇÕES
// =============================================

export interface StoreSettingsPublic {
  store_name: string;
  logo_url?: string;
  slogan?: string;
  primary_color: string;
  whatsapp_number: string;
  email?: string;
  address?: string;
}

// =============================================
// ADMIN
// =============================================

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "viewer";
  avatar_url?: string;
  created_at: string;
  last_login?: string;
}

// =============================================
// HELPERS DE LABEL
// =============================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  payment_confirmed: "Pagamento Confirmado",
  shipping_link_pending: "Link de pagamento do Envio",
  shipping_paid: "Envio pago",
  label_issued: "Etiqueta emitida",
  completed: "Pedido Finalizado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  "warning" | "success" | "info" | "danger" | "neutral"
> = {
  pending_payment: "warning",
  payment_confirmed: "success",
  shipping_link_pending: "info",
  shipping_paid: "success",
  label_issued: "info",
  completed: "success",
  cancelled: "danger",
};

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  percentage: "Percentual",
  fixed: "Valor fixo",
  free_shipping: "Frete grátis",
};

export const AVAILABILITY_LABELS: Record<ProductAvailability, string> = {
  in_stock: "Em estoque",
  low_stock: "Estoque baixo",
  out_of_stock: "Indisponível",
};
