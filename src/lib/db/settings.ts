import { cache } from "react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AdminProfile } from "@/types";
import type { DbStoreSettingsPublic, DbStoreSettingsPrivate, DbAdminProfile } from "@/types/database.types";

export interface PublicStoreSettings {
  store_name: string;
  logo_url?: string;
  whatsapp_number: string;
  whatsapp_default_message: string;
  email?: string;
  address?: string;
  // Fração (0.25 = 25%) — convertida a partir do inteiro salvo no banco,
  // que é o que o admin de fato digita (25, não 0.25).
  insurance_percentage: number;
}

function toPublicSettings(row: DbStoreSettingsPublic): PublicStoreSettings {
  return {
    store_name: row.store_name,
    logo_url: row.logo_url ?? undefined,
    whatsapp_number: row.whatsapp_number,
    whatsapp_default_message: row.whatsapp_default_message,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    insurance_percentage: Number(row.insurance_percentage) / 100,
  };
}

const FALLBACK_PUBLIC_SETTINGS: PublicStoreSettings = {
  store_name: "Tio Snoop Imports Full",
  whatsapp_number: "5511999999999",
  whatsapp_default_message: "Olá! Vim pela loja e tenho uma dúvida.",
  insurance_percentage: 0.25,
};

// Leitura pública (anon) — usada em Server Components do site público.
// cache() evita repetir a query quando várias partes do layout pedem as
// configurações na mesma requisição.
export const getPublicStoreSettings = cache(async (): Promise<PublicStoreSettings> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings_public")
      .select("store_name, logo_url, whatsapp_number, whatsapp_default_message, email, address, insurance_percentage")
      .eq("lock", true)
      .single();

    if (error || !data) return FALLBACK_PUBLIC_SETTINGS;
    return toPublicSettings(data as DbStoreSettingsPublic);
  } catch {
    return FALLBACK_PUBLIC_SETTINGS;
  }
});

export interface ShippingPaymentLinkSetting {
  id: string;
  label: string;
  url: string;
  is_active: boolean;
}

export interface AdminStoreSettings {
  store_name: string;
  logo_url?: string;
  whatsapp_number: string;
  whatsapp_default_message: string;
  email?: string;
  address?: string;
  cnpj_cpf?: string;
  // Pontos percentuais inteiros (25 = 25%) — o que o admin digita no formulário.
  insurance_percentage: number;
  maintenance_mode: boolean;
  payment_mode: "gateway" | "manual";
  shipping_payment_links: ShippingPaymentLinkSetting[];
  shipping_link_delay_pix_hours: number;
  shipping_link_delay_card_hours: number;
}

// Leitura completa (público + privado) para o painel admin — usa service client
export async function getAdminStoreSettings(): Promise<AdminStoreSettings> {
  const service = createServiceClient();

  const [{ data: pub, error: pubError }, { data: priv, error: privError }] = await Promise.all([
    service.from("store_settings_public").select("*").eq("lock", true).single(),
    service
      .from("store_settings_private")
      .select("maintenance_mode, payment_mode, shipping_payment_links, shipping_link_delay_pix_hours, shipping_link_delay_card_hours")
      .eq("lock", true)
      .single(),
  ]);

  if (pubError) throw pubError;
  if (privError) throw privError;

  const p = pub as DbStoreSettingsPublic;
  const s = priv as Pick<
    DbStoreSettingsPrivate,
    "maintenance_mode" | "payment_mode" | "shipping_payment_links" | "shipping_link_delay_pix_hours" | "shipping_link_delay_card_hours"
  >;

  return {
    store_name: p.store_name,
    logo_url: p.logo_url ?? undefined,
    whatsapp_number: p.whatsapp_number,
    whatsapp_default_message: p.whatsapp_default_message,
    email: p.email ?? undefined,
    address: p.address ?? undefined,
    cnpj_cpf: p.cnpj_cpf ?? undefined,
    insurance_percentage: Number(p.insurance_percentage),
    maintenance_mode: s.maintenance_mode,
    payment_mode: s.payment_mode === "manual" ? "manual" : "gateway",
    shipping_payment_links: (s.shipping_payment_links as unknown as ShippingPaymentLinkSetting[] | null) ?? [],
    shipping_link_delay_pix_hours: Number(s.shipping_link_delay_pix_hours),
    shipping_link_delay_card_hours: Number(s.shipping_link_delay_card_hours),
  };
}

function toAdminProfile(row: DbAdminProfile): AdminProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as "owner" | "manager" | "viewer",
    avatar_url: row.avatar_url ?? undefined,
    created_at: row.created_at,
    last_login: row.last_login ?? undefined,
  };
}

// Lido no PublicLayout (Server Component) para bloquear o site público
// quando o admin liga o modo de manutenção. Usa service client porque
// store_settings_private nunca é exposta ao anon.
export async function isMaintenanceModeActive(): Promise<boolean> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("store_settings_private")
      .select("maintenance_mode")
      .eq("lock", true)
      .single();

    if (error || !data) return false;
    return data.maintenance_mode;
  } catch {
    return false;
  }
}

// Lido em getPaymentProvider() (server) e na tela de pagamento (client, via
// prop) — chave de emergência pra tirar a PYX Gate da jogada sem deploy
// quando ela cai. Fail-safe pro lado errado importa aqui: se a leitura falhar
// por qualquer motivo, cai em "gateway" (comportamento atual), nunca trava o
// checkout inteiro em manual por causa de um erro transitório de leitura.
export async function getPaymentMode(): Promise<"gateway" | "manual"> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("store_settings_private")
      .select("payment_mode")
      .eq("lock", true)
      .single();

    if (error || !data) return "gateway";
    return data.payment_mode === "manual" ? "manual" : "gateway";
  } catch {
    return "gateway";
  }
}

export async function getAdminUsers(): Promise<AdminProfile[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("admin_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => toAdminProfile(row as DbAdminProfile));
}
