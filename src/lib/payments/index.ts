import type { PaymentProvider } from "./types";
import { stubPaymentProvider } from "./stub-provider";
import { suprapayProvider } from "./suprapay-provider";
import { manualPaymentProvider } from "./manual-provider";
import { getPaymentMode } from "@/lib/db/settings";

// Fábrica do provider de pagamento ativo. payment_mode vem do banco
// (store_settings_private, chave de emergência ligada em Configurações >
// Pagamentos) — enquanto for "manual", o manualPaymentProvider tem
// prioridade sobre tudo, sem precisar de deploy.
//
// SupraPay é o ÚNICO gateway ativo — de propósito, sem fallback automático
// pra nenhum outro (PYX Gate, Zendry, PicPay). Se a SupraPay cair, NÃO cai
// pra outro gateway sozinho: a saída é ligar o modo manual (Configurações >
// Pagamentos), igual foi feito quando a PYX Gate caiu. Cartão de crédito
// também foi descontinuado (a tela de pagamento não mostra mais formulário
// de cartão — CARD_PAYMENT_ENABLED = false em PagamentoClient.tsx).
export async function getPaymentProvider(): Promise<PaymentProvider> {
  if ((await getPaymentMode()) === "manual") return manualPaymentProvider;
  if (process.env.SUPRAPAY_API_KEY && process.env.SUPRAPAY_API_SECRET) return suprapayProvider;
  return stubPaymentProvider;
}

export async function isStubPaymentProvider(): Promise<boolean> {
  return (await getPaymentProvider()).name === "stub";
}

export type { PaymentProvider } from "./types";
