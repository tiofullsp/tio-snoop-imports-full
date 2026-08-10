// =============================================================================
// Tipos gerados do schema Supabase — ecommerce-premium
// Manter sincronizado com supabase/migrations/001_initial_schema.sql
// Para regenerar: npx supabase gen types typescript --project-id <id> > src/types/database.types.ts
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Enums do banco (espelham os CREATE TYPE do schema)
// ---------------------------------------------------------------------------

export type DbProductAvailability = "in_stock" | "low_stock" | "out_of_stock" | "on_consultation";
export type DbOrderStatus         = "pending_payment" | "payment_confirmed" | "shipping_link_pending" | "shipping_paid" | "label_issued" | "completed" | "cancelled";
export type DbPaymentStatus       = "pending" | "confirmed" | "failed" | "refunded";
export type DbPaymentMethod       = "pix" | "card";
export type DbCouponType          = "percentage" | "fixed" | "free_shipping";
export type DbAdminRole           = "owner" | "manager" | "viewer";
export type DbMediaType           = "image" | "video";
export type DbAuditAction         = "create" | "update" | "delete" | "status_change" | "login" | "logout";
export type DbInventoryMovement   = "sale" | "restock" | "adjustment" | "cancelled_return";

// ---------------------------------------------------------------------------
// Tipo principal Database — usado para parametrizar o cliente Supabase
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {

      // -----------------------------------------------------------------------
      admin_profiles: {
        Row: {
          id:         string;
          email:      string;
          name:       string;
          role:       DbAdminRole;
          avatar_url: string | null;
          last_login: string | null;
          created_at: string;
        };
        Insert: {
          id:         string;         // obrigatório: deve ser o auth.users.id
          email:      string;
          name:       string;
          role?:      DbAdminRole;
          avatar_url?: string | null;
          last_login?: string | null;
          created_at?: string;
        };
        Update: {
          id?:        string;
          email?:     string;
          name?:      string;
          role?:      DbAdminRole;
          avatar_url?: string | null;
          last_login?: string | null;
        };
        Relationships: [
          { foreignKeyName: "admin_profiles_id_fkey"; columns: ["id"]; referencedRelation: "users"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      categories: {
        Row: {
          id:                          string;
          parent_id:                   string | null;
          name:                        string;
          slug:                        string;
          short_description:           string;
          full_description:            string | null;
          icon:                        string | null;
          image_url:                   string | null;
          image_storage_path:          string | null;
          image_object_position_x:     number;
          image_object_position_y:     number;
          image_scale:                 number;
          mobile_image_url:            string | null;
          mobile_image_storage_path:   string | null;
          mobile_image_object_position_x: number;
          mobile_image_object_position_y: number;
          mobile_image_scale:              number;
          gradient:                    string | null;
          color_accent:                string | null;
          display_order:               number;
          is_active:                   boolean;
          is_featured_home:            boolean;
          meta_title:                  string | null;
          meta_description:            string | null;
          created_at:                  string;
          updated_at:                  string;
        };
        Insert: {
          id?:                          string;
          parent_id?:                   string | null;
          name:                         string;
          slug:                         string;
          short_description?:           string;
          full_description?:            string | null;
          icon?:                        string | null;
          image_url?:                   string | null;
          image_storage_path?:          string | null;
          image_object_position_x?:     number;
          image_object_position_y?:     number;
          image_scale?:                 number;
          mobile_image_url?:            string | null;
          mobile_image_storage_path?:   string | null;
          mobile_image_object_position_x?: number;
          mobile_image_object_position_y?: number;
          mobile_image_scale?:              number;
          gradient?:                    string | null;
          color_accent?:                string | null;
          display_order?:               number;
          is_active?:                   boolean;
          is_featured_home?:            boolean;
          meta_title?:                  string | null;
          meta_description?:            string | null;
          created_at?:                  string;
          updated_at?:                  string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "categories_parent_id_fkey"; columns: ["parent_id"]; referencedRelation: "categories"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      products: {
        Row: {
          id:                  string;
          name:                string;
          slug:                string;
          sku:                 string;
          category_id:         string;
          price_pix:           number;
          price_card:          number;
          price_promotional:   number | null;
          promotional_active:  boolean;
          cost_price:          number | null;
          is_active:           boolean;
          is_featured:         boolean;
          short_description:   string;
          description:         string;
          benefits:            string | null;
          specifications:      Json | null;  // [{label: string, value: string}]
          faq:                 Json | null;  // [{question: string, answer: string}]
          warnings:            string | null;
          stock:               number | null;
          stock_minimum:       number;
          availability:        DbProductAvailability;
          weight_kg:           number;
          height_cm:           number;
          width_cm:            number;
          length_cm:           number;
          extra_handling_days: number;
          allow_whatsapp:      boolean;
          meta_title:          string | null;
          meta_description:    string | null;
          internal_notes:      string | null;
          track_stock:                boolean;
          quantity_pricing_enabled:   boolean;
          price_tiers:                Json | null; // [{quantity:number, unit_price:number}]
          badge_image_url:     string | null;
          badge_storage_path:  string | null;
          badge_position_x:    number;
          badge_position_y:    number;
          badge_width_pct:     number;
          show_illustrative_badge: boolean;
          fulfillment_type:    string | null;
          display_order:       number;
          stock_item_id:       string | null;
          created_at:          string;
          updated_at:          string;
        };
        Insert: {
          id?:                  string;
          name:                 string;
          slug:                 string;
          sku:                  string;
          category_id:          string;
          price_pix:            number;
          price_card:           number;
          price_promotional?:   number | null;
          promotional_active?:  boolean;
          cost_price?:          number | null;
          is_active?:           boolean;
          is_featured?:         boolean;
          short_description?:   string;
          description?:         string;
          benefits?:            string | null;
          specifications?:      Json | null;
          faq?:                 Json | null;
          warnings?:            string | null;
          stock?:               number | null;
          stock_minimum?:       number;
          availability?:        DbProductAvailability;
          weight_kg?:           number;
          height_cm?:           number;
          width_cm?:            number;
          length_cm?:           number;
          extra_handling_days?: number;
          allow_whatsapp?:      boolean;
          meta_title?:          string | null;
          meta_description?:    string | null;
          internal_notes?:      string | null;
          track_stock?:                boolean;
          quantity_pricing_enabled?:   boolean;
          price_tiers?:                Json | null;
          badge_image_url?:    string | null;
          badge_storage_path?: string | null;
          badge_position_x?:   number;
          badge_position_y?:   number;
          badge_width_pct?:    number;
          show_illustrative_badge?: boolean;
          fulfillment_type?:   string | null;
          display_order?:      number;
          stock_item_id?:      string | null;
          created_at?:          string;
          updated_at?:          string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] },
          { foreignKeyName: "products_stock_item_id_fkey"; columns: ["stock_item_id"]; referencedRelation: "stock_items"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      product_media: {
        Row: {
          id:            string;
          product_id:    string;
          type:          DbMediaType;
          url:           string;
          thumbnail_url: string | null;
          alt_text:      string | null;
          display_order: number;
          is_main:       boolean;
          created_at:    string;
        };
        Insert: {
          id?:            string;
          product_id:     string;
          type?:          DbMediaType;
          url:            string;
          thumbnail_url?: string | null;
          alt_text?:      string | null;
          display_order?: number;
          is_main?:       boolean;
          created_at?:    string;
        };
        Update: Partial<Database["public"]["Tables"]["product_media"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "product_media_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      stock_items: {
        Row: {
          id:          string;
          name:        string;
          base_sku:    string;
          category_id: string | null;
          is_active:   boolean;
          created_at:  string;
          updated_at:  string;
        };
        Insert: {
          id?:          string;
          name:         string;
          base_sku:     string;
          category_id?: string | null;
          is_active?:   boolean;
          created_at?:  string;
          updated_at?:  string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_items"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "stock_items_category_id_fkey"; columns: ["category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      product_variants: {
        Row: {
          id:            string;
          product_id:    string | null;
          stock_item_id: string | null;
          color_name:    string;
          color_hex:     string;
          display_order: number;
          is_active:     boolean;
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:            string;
          product_id?:    string | null;
          stock_item_id?: string | null;
          color_name:     string;
          color_hex:      string;
          display_order?: number;
          is_active?:     boolean;
          created_at?:    string;
          updated_at?:    string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variants"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "product_variants_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "product_variants_stock_item_id_fkey"; columns: ["stock_item_id"]; referencedRelation: "stock_items"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      product_variant_media: {
        Row: {
          id:            string;
          variant_id:    string;
          url:           string;
          storage_path:  string | null;
          is_main:       boolean;
          is_hover:      boolean;
          display_order: number;
          created_at:    string;
        };
        Insert: {
          id?:            string;
          variant_id:     string;
          url:            string;
          storage_path?:  string | null;
          is_main?:       boolean;
          is_hover?:      boolean;
          display_order?: number;
          created_at?:    string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variant_media"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "product_variant_media_variant_id_fkey"; columns: ["variant_id"]; referencedRelation: "product_variants"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      product_variant_sizes: {
        Row: {
          id:              string;
          variant_id:      string;
          size:            string;
          stock:           number;
          sku:             string | null;
          low_stock_alert: number;
          is_active:       boolean;
          created_at:      string;
          updated_at:      string;
        };
        Insert: {
          id?:              string;
          variant_id:       string;
          size:             string;
          stock?:           number;
          sku?:             string | null;
          low_stock_alert?: number;
          is_active?:       boolean;
          created_at?:      string;
          updated_at?:      string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variant_sizes"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "product_variant_sizes_variant_id_fkey"; columns: ["variant_id"]; referencedRelation: "product_variants"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      product_colors: {
        Row: {
          id:            string;
          product_id:    string;
          variant_id:    string;
          display_order: number;
          is_main:       boolean;
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:            string;
          product_id:     string;
          variant_id:     string;
          display_order?: number;
          is_main?:       boolean;
          created_at?:    string;
          updated_at?:    string;
        };
        Update: Partial<Database["public"]["Tables"]["product_colors"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "product_colors_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "product_colors_variant_id_fkey"; columns: ["variant_id"]; referencedRelation: "product_variants"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      product_color_images: {
        Row: {
          id:                string;
          product_color_id:  string;
          url:                string;
          storage_path:      string | null;
          source:            string;
          stock_media_id:    string | null;
          is_primary:        boolean;
          is_hover:          boolean;
          display_order:     number;
          created_at:        string;
        };
        Insert: {
          id?:                string;
          product_color_id:  string;
          url:                string;
          storage_path?:      string | null;
          source:            string;
          stock_media_id?:    string | null;
          is_primary?:        boolean;
          is_hover?:          boolean;
          display_order?:     number;
          created_at?:        string;
        };
        Update: Partial<Database["public"]["Tables"]["product_color_images"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "product_color_images_product_color_id_fkey"; columns: ["product_color_id"]; referencedRelation: "product_colors"; referencedColumns: ["id"] },
          { foreignKeyName: "product_color_images_stock_media_id_fkey"; columns: ["stock_media_id"]; referencedRelation: "product_variant_media"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      customers: {
        Row: {
          id:             string;
          auth_user_id:   string | null;
          name:           string;
          email:          string;
          phone:          string;
          cpf_cnpj:       string | null;
          street:         string;
          number:         string;
          complement:     string | null;
          neighborhood:   string;
          city:           string;
          state:          string;
          zip_code:       string;
          is_vip:         boolean;
          vip_marked_at:  string | null;
          total_orders:   number;
          total_spent:    number;
          average_ticket: number;
          first_order_at: string | null;
          last_order_at:  string | null;
          created_at:     string;
          updated_at:     string;
        };
        Insert: {
          id?:             string;
          auth_user_id?:   string | null;
          name:            string;
          email:           string;
          phone:           string;
          cpf_cnpj?:       string | null;
          street?:         string;
          number?:         string;
          complement?:     string | null;
          neighborhood?:   string;
          city?:           string;
          state?:          string;
          zip_code?:       string;
          is_vip?:         boolean;
          vip_marked_at?:  string | null;
          total_orders?:   number;
          total_spent?:    number;
          average_ticket?: number;
          first_order_at?: string | null;
          last_order_at?:  string | null;
          created_at?:     string;
          updated_at?:     string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      customer_notes: {
        Row: {
          id:          string;
          customer_id: string;
          note:        string;
          created_by:  string;
          created_at:  string;
        };
        Insert: {
          id?:         string;
          customer_id: string;
          note:        string;
          created_by:  string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_notes"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "customer_notes_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "customers"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      customer_segments: {
        Row: {
          id:          string;
          name:        string;
          description: string | null;
          color:       string | null;
          created_at:  string;
        };
        Insert: {
          id?:          string;
          name:         string;
          description?: string | null;
          color?:       string | null;
          created_at?:  string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_segments"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      customer_segment_memberships: {
        Row: {
          customer_id: string;
          segment_id:  string;
          added_at:    string;
        };
        Insert: {
          customer_id: string;
          segment_id:  string;
          added_at?:   string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_segment_memberships"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "csm_customer_fkey"; columns: ["customer_id"]; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "csm_segment_fkey";  columns: ["segment_id"];  referencedRelation: "customer_segments"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      orders: {
        Row: {
          id:                    string;
          order_number:          string;
          customer_id:           string | null;
          customer_name:         string;
          customer_phone:        string;
          customer_email:        string;
          status:                DbOrderStatus;
          payment_status:        DbPaymentStatus;
          payment_method:        DbPaymentMethod;
          payment_id:            string | null;
          shipping_street:       string;
          shipping_number:       string;
          shipping_complement:   string | null;
          shipping_neighborhood: string;
          shipping_city:         string;
          shipping_state:        string;
          shipping_zip_code:     string;
          subtotal:              number;
          coupon_code:           string | null;
          coupon_discount:       number;
          shipping_value:        number;
          shipping_service:      string | null;
          insurance_enabled:     boolean;
          insurance_value:       number;
          tracking_code:         string | null;
          tracking_url:          string | null;
          total:                 number;
          payment_confirmed_at:       string | null;
          shipping_payment_link:      string | null;
          shipping_customer_name:     string | null;
          shipping_order_id:          string | null;
          shipping_label_url:         string | null;
          shipping_label_storage_path: string | null;
          label_issued_at:            string | null;
          notes:                 string | null;
          internal_notes:        string | null;
          created_at:            string;
          updated_at:            string;
        };
        Insert: {
          id?:                    string;
          order_number?:          string;  // gerado automaticamente por DEFAULT
          customer_id?:           string | null;
          customer_name:          string;
          customer_phone:         string;
          customer_email:         string;
          status?:                DbOrderStatus;
          payment_status?:        DbPaymentStatus;
          payment_method:         DbPaymentMethod;
          payment_id?:            string | null;
          shipping_street:        string;
          shipping_number:        string;
          shipping_complement?:   string | null;
          shipping_neighborhood:  string;
          shipping_city:          string;
          shipping_state:         string;
          shipping_zip_code:      string;
          subtotal:               number;
          coupon_code?:           string | null;
          coupon_discount?:       number;
          shipping_value?:        number;
          shipping_service?:      string | null;
          insurance_enabled?:     boolean;
          insurance_value?:       number;
          tracking_code?:         string | null;
          tracking_url?:          string | null;
          total:                  number;
          payment_confirmed_at?:       string | null;
          shipping_payment_link?:      string | null;
          shipping_customer_name?:     string | null;
          shipping_order_id?:          string | null;
          shipping_label_url?:         string | null;
          shipping_label_storage_path?: string | null;
          label_issued_at?:            string | null;
          notes?:                 string | null;
          internal_notes?:        string | null;
          created_at?:            string;
          updated_at?:            string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "orders_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "customers"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      order_lookup_attempts: {
        Row: {
          id:         string;
          ip_hash:    string;
          created_at: string;
        };
        Insert: {
          id?:         string;
          ip_hash:     string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_lookup_attempts"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      order_items: {
        Row: {
          id:             string;
          order_id:       string;
          product_id:     string | null;
          product_name:   string;
          product_sku:    string;
          product_image:  string | null;
          quantity:       number;
          unit_price_pix: number;
          unit_price_card:number;
          subtotal:       number;
          variant_size_id:    string | null;
          variant_color_name: string | null;
          variant_color_hex:  string | null;
          variant_size:       string | null;
          variant_sku:        string | null;
        };
        Insert: {
          id?:             string;
          order_id:        string;
          product_id?:     string | null;
          product_name:    string;
          product_sku:     string;
          product_image?:  string | null;
          quantity:        number;
          unit_price_pix:  number;
          unit_price_card: number;
          subtotal:        number;
          variant_size_id?:    string | null;
          variant_color_name?: string | null;
          variant_color_hex?:  string | null;
          variant_size?:       string | null;
          variant_sku?:        string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_variant_size_id_fkey"; columns: ["variant_size_id"]; referencedRelation: "product_variant_sizes"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      payments: {
        Row: {
          id:             string;
          order_id:       string;
          method:         DbPaymentMethod;
          status:         DbPaymentStatus;
          amount:         number;
          pix_code:       string | null;
          pix_qr_url:     string | null;
          pix_expiration: string | null;
          external_id:    string | null;
          installments:   number | null;
          paid_at:        string | null;
          metadata:       Json | null;
          created_at:     string;
          updated_at:     string;
        };
        Insert: {
          id?:             string;
          order_id:        string;
          method:          DbPaymentMethod;
          status?:         DbPaymentStatus;
          amount:          number;
          pix_code?:       string | null;
          pix_qr_url?:     string | null;
          pix_expiration?: string | null;
          external_id?:    string | null;
          installments?:   number | null;
          paid_at?:        string | null;
          metadata?:       Json | null;
          created_at?:     string;
          updated_at?:     string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "payments_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      payment_webhooks: {
        Row: {
          id:           string;
          external_id:  string;
          type:         string;
          action:       string;
          raw_payload:  Json;
          processed:    boolean;
          processed_at: string | null;
          error:        string | null;
          created_at:   string;
        };
        Insert: {
          id?:           string;
          external_id:   string;
          type:          string;
          action:        string;
          raw_payload:   Json;
          processed?:    boolean;
          processed_at?: string | null;
          error?:        string | null;
          created_at?:   string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_webhooks"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      order_status_history: {
        Row: {
          id:              string;
          order_id:        string;
          previous_status: DbOrderStatus | null;
          new_status:      DbOrderStatus;
          changed_by:      string;
          notes:           string | null;
          created_at:      string;
        };
        Insert: {
          id?:              string;
          order_id:         string;
          previous_status?: DbOrderStatus | null;
          new_status:       DbOrderStatus;
          changed_by:       string;
          notes?:           string | null;
          created_at?:      string;
        };
        Update: Partial<Database["public"]["Tables"]["order_status_history"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "osh_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      coupons: {
        Row: {
          id:                    string;
          code:                  string;
          description_internal:  string | null;
          type:                  DbCouponType;
          value:                 number;
          is_active:             boolean;
          start_date:            string | null;  // date (YYYY-MM-DD)
          expiration_date:       string | null;
          max_uses_total:        number | null;
          max_uses_per_customer: number | null;
          min_order_value:       number | null;
          customer_specific_id:  string | null;
          customer_specific_name:string | null;
          restricted_categories: string[] | null;
          restricted_products:   string[] | null;
          uses_count:            number;
          created_at:            string;
          updated_at:            string;
        };
        Insert: {
          id?:                    string;
          code:                   string;
          description_internal?:  string | null;
          type:                   DbCouponType;
          value?:                 number;
          is_active?:             boolean;
          start_date?:            string | null;
          expiration_date?:       string | null;
          max_uses_total?:        number | null;
          max_uses_per_customer?: number | null;
          min_order_value?:       number | null;
          customer_specific_id?:  string | null;
          customer_specific_name?: string | null;
          restricted_categories?: string[] | null;
          restricted_products?:   string[] | null;
          uses_count?:            number;
          created_at?:            string;
          updated_at?:            string;
        };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "coupons_customer_specific_id_fkey"; columns: ["customer_specific_id"]; referencedRelation: "customers"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      coupon_usages: {
        Row: {
          id:               string;
          coupon_id:        string;
          order_id:         string;
          customer_email:   string;
          discount_applied: number;
          created_at:       string;
        };
        Insert: {
          id?:               string;
          coupon_id:         string;
          order_id:          string;
          customer_email:    string;
          discount_applied:  number;
          created_at?:       string;
        };
        Update: Partial<Database["public"]["Tables"]["coupon_usages"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "coupon_usages_coupon_id_fkey"; columns: ["coupon_id"]; referencedRelation: "coupons"; referencedColumns: ["id"] },
          { foreignKeyName: "coupon_usages_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      shipping_quotes: {
        Row: {
          id:              string;
          cep_origin:      string;
          cep_destination: string;
          weight_kg:       number;
          height_cm:       number;
          width_cm:        number;
          length_cm:       number;
          options:         Json;  // ShippingOption[]
          quoted_at:       string;
          expires_at:      string;
        };
        Insert: {
          id?:              string;
          cep_origin:       string;
          cep_destination:  string;
          weight_kg:        number;
          height_cm:        number;
          width_cm:         number;
          length_cm:        number;
          options:          Json;
          quoted_at?:       string;
          expires_at:       string;
        };
        Update: Partial<Database["public"]["Tables"]["shipping_quotes"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      shipping_methods: {
        Row: {
          id:            string;
          code:          string;
          name:          string;
          carrier:       string;
          is_active:     boolean;
          max_weight_kg: number | null;
          sort_order:    number;
          created_at:    string;
        };
        Insert: {
          id?:            string;
          code:           string;
          name:           string;
          carrier:        string;
          is_active?:     boolean;
          max_weight_kg?: number | null;
          sort_order?:    number;
          created_at?:    string;
        };
        Update: Partial<Database["public"]["Tables"]["shipping_methods"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      store_settings_public: {
        Row: {
          lock:             boolean;
          store_name:       string;
          logo_url:         string | null;
          slogan:           string | null;
          primary_color:    string;
          whatsapp_number:  string;
          whatsapp_default_message: string;
          email:            string | null;
          address:          string | null;
          cnpj_cpf:         string | null;
          insurance_percentage: number;
          meta_title:       string | null;
          meta_description: string | null;
          updated_at:       string;
        };
        Insert: {
          lock?:             boolean;
          store_name?:       string;
          logo_url?:         string | null;
          slogan?:           string | null;
          primary_color?:    string;
          whatsapp_number?:  string;
          whatsapp_default_message?: string;
          email?:            string | null;
          address?:          string | null;
          cnpj_cpf?:         string | null;
          insurance_percentage?: number;
          meta_title?:       string | null;
          meta_description?: string | null;
          updated_at?:       string;
        };
        Update: Partial<Database["public"]["Tables"]["store_settings_public"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // store_settings_private: NUNCA expor ao cliente — service role apenas
      store_settings_private: {
        Row: {
          lock:                    boolean;
          pix_key:                 string | null;
          pix_beneficiary_name:    string | null;
          cep_origin:              string | null;
          melhor_envio_token:      string | null;
          mercado_pago_public_key: string | null;
          mercado_pago_secret_key: string | null;  // SEGREDO — nunca enviar ao cliente
          maintenance_mode:        boolean;
          shipping_payment_links:        Json; // [{id, label, url, is_active}], até 5
          shipping_link_delay_pix_hours:  number;
          shipping_link_delay_card_hours: number;
          updated_at:              string;
        };
        Insert: {
          lock?:                    boolean;
          pix_key?:                 string | null;
          pix_beneficiary_name?:    string | null;
          cep_origin?:              string | null;
          melhor_envio_token?:      string | null;
          mercado_pago_public_key?: string | null;
          mercado_pago_secret_key?: string | null;
          maintenance_mode?:        boolean;
          shipping_payment_links?:        Json;
          shipping_link_delay_pix_hours?:  number;
          shipping_link_delay_card_hours?: number;
          updated_at?:              string;
        };
        Update: Partial<Database["public"]["Tables"]["store_settings_private"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      audit_logs: {
        Row: {
          id:         string;
          admin_id:   string | null;
          action:     DbAuditAction;
          table_name: string;
          record_id:  string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?:         string;
          admin_id?:   string | null;
          action:      DbAuditAction;
          table_name:  string;
          record_id?:  string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "audit_logs_admin_id_fkey"; columns: ["admin_id"]; referencedRelation: "admin_profiles"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      inventory_movements: {
        Row: {
          id:              string;
          product_id:      string;
          type:            DbInventoryMovement;
          quantity_change: number;
          quantity_before: number;
          quantity_after:  number;
          order_id:        string | null;
          notes:           string | null;
          created_by:      string;
          created_at:      string;
          variant_size_id: string | null;
        };
        Insert: {
          id?:              string;
          product_id:       string;
          type:             DbInventoryMovement;
          quantity_change:  number;
          quantity_before:  number;
          quantity_after:   number;
          order_id?:        string | null;
          notes?:           string | null;
          created_by?:      string;
          created_at?:      string;
          variant_size_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_movements"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "inventory_product_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_order_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_variant_size_fkey"; columns: ["variant_size_id"]; referencedRelation: "product_variant_sizes"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      notifications: {
        Row: {
          id:         string;
          type:       string;
          title:      string;
          body:       string;
          data:       Json | null;
          is_read:    boolean;
          read_at:    string | null;
          created_at: string;
        };
        Insert: {
          id?:         string;
          type:        string;
          title:       string;
          body:        string;
          data?:       Json | null;
          is_read?:    boolean;
          read_at?:    string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      home_banners: {
        Row: {
          id:                          string;
          title:                       string | null;
          subtitle:                    string | null;
          image_url:                   string;
          storage_path:                string | null;
          image_mobile_url:            string | null;
          mobile_storage_path:         string | null;
          link_url:                    string | null;
          link_label:                  string;
          is_active:                   boolean;
          display_order:               number;
          link_type:                   "product" | "category" | "url";
          link_product_id:             string | null;
          link_category_id:            string | null;
          desktop_object_position_x:   number;
          desktop_object_position_y:   number;
          desktop_scale:               number;
          mobile_object_position_x:    number;
          mobile_object_position_y:    number;
          mobile_scale:                number;
          created_at:                  string;
          updated_at:                  string;
        };
        Insert: {
          id?:                         string;
          title?:                      string | null;
          subtitle?:                   string | null;
          image_url:                   string;
          storage_path?:               string | null;
          image_mobile_url?:           string | null;
          mobile_storage_path?:        string | null;
          link_url?:                   string | null;
          link_label?:                 string;
          is_active?:                  boolean;
          display_order?:              number;
          link_type?:                  "product" | "category" | "url";
          link_product_id?:            string | null;
          link_category_id?:           string | null;
          desktop_object_position_x?:  number;
          desktop_object_position_y?:  number;
          desktop_scale?:              number;
          mobile_object_position_x?:   number;
          mobile_object_position_y?:   number;
          mobile_scale?:               number;
          created_at?:                 string;
          updated_at?:                 string;
        };
        Update: Partial<Database["public"]["Tables"]["home_banners"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "home_banners_link_product_id_fkey"; columns: ["link_product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "home_banners_link_category_id_fkey"; columns: ["link_category_id"]; referencedRelation: "categories"; referencedColumns: ["id"] }
        ];
      };

      // -----------------------------------------------------------------------
      announcements: {
        Row: {
          id:            string;
          type:          string;
          title:         string;
          message:       string;
          coupon_code:   string | null;
          is_active:     boolean;
          display_order: number;
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:            string;
          type?:          string;
          title:          string;
          message:        string;
          coupon_code?:   string | null;
          is_active?:     boolean;
          display_order?: number;
          created_at?:    string;
          updated_at?:    string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      reviews: {
        Row: {
          id:                  string;
          customer_name:       string;
          rating:              number;
          state:               string;
          delivery_days_label: string;
          comment:             string;
          image_url:           string | null;
          image_storage_path:  string | null;
          image_object_position_x: number;
          image_object_position_y: number;
          image_scale:              number;
          video_url:           string | null;
          product_ids:         string[];
          is_active:           boolean;
          display_order:       number;
          created_at:          string;
          updated_at:          string;
        };
        Insert: {
          id?:                  string;
          customer_name:        string;
          rating:               number;
          state:                string;
          delivery_days_label:  string;
          comment:              string;
          image_url?:           string | null;
          image_storage_path?:  string | null;
          image_object_position_x?: number;
          image_object_position_y?: number;
          image_scale?:              number;
          video_url?:           string | null;
          product_ids?:         string[];
          is_active?:           boolean;
          display_order?:       number;
          created_at?:          string;
          updated_at?:          string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };

    }; // fim Tables

    Views: Record<string, never>;
    Functions: Record<string, never>;

    Enums: {
      product_availability:    DbProductAvailability;
      order_status:            DbOrderStatus;
      payment_status:          DbPaymentStatus;
      payment_method:          DbPaymentMethod;
      coupon_type:             DbCouponType;
      admin_role:              DbAdminRole;
      media_type:              DbMediaType;
      audit_action:            DbAuditAction;
      inventory_movement_type: DbInventoryMovement;
    };

    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Helpers de conveniência para extrair tipos de linhas individuais
// ---------------------------------------------------------------------------

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type DbAdminProfile         = Tables<"admin_profiles">;
export type DbCategory             = Tables<"categories">;
export type DbProduct              = Tables<"products">;
export type DbProductMedia         = Tables<"product_media">;
export type DbProductVariant       = Tables<"product_variants">;
export type DbProductVariantMedia  = Tables<"product_variant_media">;
export type DbProductVariantSize   = Tables<"product_variant_sizes">;
export type DbProductColor         = Tables<"product_colors">;
export type DbProductColorImage    = Tables<"product_color_images">;
export type DbStockItem            = Tables<"stock_items">;
export type DbCustomer             = Tables<"customers">;
export type DbCustomerNote         = Tables<"customer_notes">;
export type DbCustomerSegment      = Tables<"customer_segments">;
export type DbOrder                = Tables<"orders">;
export type DbOrderItem            = Tables<"order_items">;
export type DbPayment              = Tables<"payments">;
export type DbPaymentWebhook       = Tables<"payment_webhooks">;
export type DbOrderStatusHistory   = Tables<"order_status_history">;
export type DbCoupon               = Tables<"coupons">;
export type DbCouponUsage          = Tables<"coupon_usages">;
export type DbShippingQuote        = Tables<"shipping_quotes">;
export type DbShippingMethod       = Tables<"shipping_methods">;
export type DbStoreSettingsPublic  = Tables<"store_settings_public">;
export type DbStoreSettingsPrivate = Tables<"store_settings_private">;
export type DbAuditLog             = Tables<"audit_logs">;
export type DbInventoryMovement2   = Tables<"inventory_movements">;
export type DbNotification         = Tables<"notifications">;
export type DbHomeBanner           = Tables<"home_banners">;
export type DbReview               = Tables<"reviews">;
