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
// prioridade sobre tudo, sem precisar de deploy pra desativar a PYX Gate
// quando ela cai.
//
// Pix é sempre via PYX Gate (PYXGATE_SECRET_KEY) — cartão também é PYX
// Gate, mas src/lib/actions/card-payment.ts chama a API direto, sem passar
// por getPaymentProvider(), então não é afetado por essa troca (mas nem
// chega a ser chamado em modo manual: a tela de pagamento não mostra
// formulário de cartão nesse modo). SupraPay/Zendry/PicPay ficam como
// caminho de rollback do Pix caso a PYX Gate seja desativada de vez.
export async function getPaymentProvider(): Promise<PaymentProvider> {
  if ((await getPaymentMode()) === "manual") return manualPaymentProvider;
  if (process.env.PYXGATE_SECRET_KEY) return pyxgateProvider;
  if (process.env.SUPRAPAY_API_KEY && process.env.SUPRAPAY_API_SECRET) return suprapayProvider;
  if (process.env.ZENDRY_CLIENT_ID && process.env.ZENDRY_CLIENT_SECRET) return zendryProvider;
  if (process.env.PICPAY_TOKEN) return picpayProvider;
  return stubPaymentProvider;
}

export async function isStubPaymentProvider(): Promise<boolean> {
  return (await getPaymentProvider()).name === "stub";
}

export type { PaymentProvider } from "./types";
