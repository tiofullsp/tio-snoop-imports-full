"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminWrite } from "@/lib/auth/admin-guard";
import type { ShippingPaymentLinkSetting } from "@/lib/db/settings";
import type { Json } from "@/types/database.types";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Configurações da loja (Loja, Manutenção, WhatsApp, Logo)
// ---------------------------------------------------------------------------

export interface StoreSettingsFormData {
  store_name: string;
  email: string;
  address: string;
  cnpj_cpf: string;
  whatsapp_number: string;
  whatsapp_default_message: string;
  logo_url: string;
  insurance_percentage: number;
  maintenance_mode: boolean;
}

export async function updateStoreSettings(
  data: StoreSettingsFormData
): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;

  if (
    !Number.isFinite(data.insurance_percentage) ||
    data.insurance_percentage < 0 ||
    data.insurance_percentage > 100
  ) {
    return { error: "A porcentagem do seguro precisa ser um número entre 0 e 100." };
  }

  const service = createServiceClient();

  const { error: pubError } = await service
    .from("store_settings_public")
    .update({
      store_name: data.store_name,
      email: data.email || null,
      address: data.address || null,
      cnpj_cpf: data.cnpj_cpf || null,
      whatsapp_number: data.whatsapp_number,
      whatsapp_default_message: data.whatsapp_default_message,
      logo_url: data.logo_url || null,
      insurance_percentage: data.insurance_percentage,
      updated_at: new Date().toISOString(),
    })
    .eq("lock", true);

  if (pubError) {
    return { error: extractErrorMessage(pubError, "Erro ao salvar configurações da loja.") };
  }

  const { error: privError } = await service
    .from("store_settings_private")
    .update({
      maintenance_mode: data.maintenance_mode,
      updated_at: new Date().toISOString(),
    })
    .eq("lock", true);

  if (privError) {
    return { error: extractErrorMessage(privError, "Erro ao salvar modo de manutenção.") };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Frete — links de pagamento do envio + prazos de liberação (Pix/Cartão)
// ---------------------------------------------------------------------------

const MAX_SHIPPING_LINKS = 5;

export interface ShippingSettingsFormData {
  shipping_payment_links: ShippingPaymentLinkSetting[];
  shipping_link_delay_pix_hours: number;
  shipping_link_delay_card_hours: number;
}

export async function updateShippingSettings(
  data: ShippingSettingsFormData
): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;

  if (data.shipping_payment_links.length > MAX_SHIPPING_LINKS) {
    return { error: `No máximo ${MAX_SHIPPING_LINKS} links de pagamento de frete.` };
  }

  for (const link of data.shipping_payment_links) {
    if (!link.label.trim() || !link.url.trim()) {
      return { error: "Todo link precisa de um nome e uma URL." };
    }
    try {
      new URL(link.url);
    } catch {
      return { error: `URL inválida: ${link.url}` };
    }
  }

  if (
    !Number.isFinite(data.shipping_link_delay_pix_hours) ||
    data.shipping_link_delay_pix_hours < 0 ||
    !Number.isFinite(data.shipping_link_delay_card_hours) ||
    data.shipping_link_delay_card_hours < 0
  ) {
    return { error: "As horas de liberação precisam ser números maiores ou iguais a 0." };
  }

  const service = createServiceClient();

  const { error } = await service
    .from("store_settings_private")
    .update({
      shipping_payment_links: data.shipping_payment_links as unknown as Json,
      shipping_link_delay_pix_hours: data.shipping_link_delay_pix_hours,
      shipping_link_delay_card_hours: data.shipping_link_delay_card_hours,
      updated_at: new Date().toISOString(),
    })
    .eq("lock", true);

  if (error) {
    return { error: extractErrorMessage(error, "Erro ao salvar configurações de frete.") };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Usuários administrativos
// ---------------------------------------------------------------------------

export async function inviteAdminUser(
  email: string,
  password: string,
  name: string,
  role: "owner" | "manager" | "viewer"
): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;

  if (password.length < 6) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }

  const service = createServiceClient();

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return { error: extractErrorMessage(createError, "Erro ao criar usuário.") };
  }

  const { error: profileError } = await service.from("admin_profiles").insert({
    id: created.user.id,
    email,
    name,
    role,
  });

  if (profileError) {
    // Reverte a criação no Auth para não deixar um usuário órfão sem perfil
    await service.auth.admin.deleteUser(created.user.id);
    return { error: extractErrorMessage(profileError, "Erro ao criar perfil de admin.") };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

export async function removeAdminUser(id: string): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdminWrite();
  if ("error" in guard) return guard;

  if (id === guard.id) {
    return { error: "Você não pode remover o próprio usuário." };
  }

  const service = createServiceClient();

  const { error: profileError } = await service.from("admin_profiles").delete().eq("id", id);
  if (profileError) {
    return { error: extractErrorMessage(profileError, "Erro ao remover perfil de admin.") };
  }

  const { error: authError } = await service.auth.admin.deleteUser(id);
  if (authError) {
    return { error: extractErrorMessage(authError, "Perfil removido, mas falhou ao remover o acesso.") };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}
