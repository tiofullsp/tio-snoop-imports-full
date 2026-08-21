import type { PaymentProvider } from "./types";
import { stubPaymentProvider } from "./stub-provider";
import { picpayProvider } from "./picpay-provider";
import { zendryProvider } from "./zendry-provider";
import { suprapayProvider } from "./suprapay-provider";
import { pyxgateProvider } from "./pyxgate-provider";
import { manualPaymentProvider } from "./manual-provider";
import { getPaymentMode } from "@/lib/db/settings";

// Fábrica do provider de pagamento ativo. payment_mode vem do banco
// (store_settings_private, chave de emergência ligada em Configurações >
// Pagamentos) — enquanto for "manual", o manualPaymentProvider tem
// prioridade sobre tudo, sem precisar de deploy.
//
// Pix é via SupraPay (prioridade sobre PYX Gate desde que a PYX Gate teve
// instabilidade recorrente — ver histórico). Cartão foi descontinuado como
// forma de pagamento (decisão do negócio): card-payment.ts chamava a PYX
// Gate direto, sem passar por getPaymentProvider(), mas a tela de
// pagamento não mostra mais formulário de cartão (CARD_PAYMENT_ENABLED =
// false em PagamentoClient.tsx), então esse caminho não é mais acionado.
// PYX Gate/Zendry/PicPay ficam como fallback do Pix caso a SupraPay saia
// do ar.
export async function getPaymentProvider(): Promise<PaymentProvider> {
  if ((await getPaymentMode()) === "manual") return manualPaymentProvider;
  if (process.env.SUPRAPAY_API_KEY && process.env.SUPRAPAY_API_SECRET) return suprapayProvider;
  if (process.env.PYXGATE_SECRET_KEY) return pyxgateProvider;
  if (process.env.ZENDRY_CLIENT_ID && process.env.ZENDRY_CLIENT_SECRET) return zendryProvider;
  if (process.env.PICPAY_TOKEN) return picpayProvider;
  return stubPaymentProvider;
}

export async function isStubPaymentProvider(): Promise<boolean> {
  return (await getPaymentProvider()).name === "stub";
}

export type { PaymentProvider } from "./types";
