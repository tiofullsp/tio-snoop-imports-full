import type { PaymentProvider } from "./types";
import { stubPaymentProvider } from "./stub-provider";
import { picpayProvider } from "./picpay-provider";
import { zendryProvider } from "./zendry-provider";
import { suprapayProvider } from "./suprapay-provider";
import { manualPaymentProvider } from "./manual-provider";
import { getPaymentMode } from "@/lib/db/settings";

// Fábrica do provider de pagamento ativo. payment_mode vem do banco
// (store_settings_private, chave de emergência ligada em Configurações >
// Pagamentos) — enquanto for "manual", o manualPaymentProvider tem
// prioridade sobre tudo, sem precisar de deploy.
//
// Pix é via SupraPay — único gateway ativo. PYX Gate foi descontinuada de
// vez (instabilidade recorrente, decisão do negócio) e NUNCA é escolhida
// aqui, mesmo que PYXGATE_SECRET_KEY ainda esteja configurada na Vercel.
// Cartão de crédito também foi descontinuado (a tela de pagamento não
// mostra mais formulário de cartão — CARD_PAYMENT_ENABLED = false em
// PagamentoClient.tsx). Zendry/PicPay ficam como fallback do Pix caso a
// SupraPay saia do ar.
export async function getPaymentProvider(): Promise<PaymentProvider> {
  if ((await getPaymentMode()) === "manual") return manualPaymentProvider;
  if (process.env.SUPRAPAY_API_KEY && process.env.SUPRAPAY_API_SECRET) return suprapayProvider;
  if (process.env.ZENDRY_CLIENT_ID && process.env.ZENDRY_CLIENT_SECRET) return zendryProvider;
  if (process.env.PICPAY_TOKEN) return picpayProvider;
  return stubPaymentProvider;
}

export async function isStubPaymentProvider(): Promise<boolean> {
  return (await getPaymentProvider()).name === "stub";
}

export type { PaymentProvider } from "./types";
