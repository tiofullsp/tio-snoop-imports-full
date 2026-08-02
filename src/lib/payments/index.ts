import type { PaymentProvider } from "./types";
import { stubPaymentProvider } from "./stub-provider";
import { picpayProvider } from "./picpay-provider";
import { zendryProvider } from "./zendry-provider";
import { suprapayProvider } from "./suprapay-provider";
import { manualPaymentProvider } from "./manual-provider";
import { PAYMENT_MODE } from "./mode";

// Fábrica do provider de pagamento ativo. Enquanto PAYMENT_MODE === "manual"
// (ver ./mode.ts), o manualPaymentProvider tem prioridade sobre tudo.
//
// Pix é sempre via SupraPay agora (SUPRAPAY_API_KEY/SUPRAPAY_API_SECRET) —
// Zendry continua ativo só pro pagamento por CARTÃO (src/lib/actions/
// card-payment.ts chama a API do Zendry direto, sem passar por
// getPaymentProvider(), então não é afetado por essa troca). Zendry/PicPay
// ficam como caminho de rollback do Pix caso a SupraPay seja desativada.
export function getPaymentProvider(): PaymentProvider {
  if (PAYMENT_MODE === "manual") return manualPaymentProvider;
  if (process.env.SUPRAPAY_API_KEY && process.env.SUPRAPAY_API_SECRET) return suprapayProvider;
  if (process.env.ZENDRY_CLIENT_ID && process.env.ZENDRY_CLIENT_SECRET) return zendryProvider;
  if (process.env.PICPAY_TOKEN) return picpayProvider;
  return stubPaymentProvider;
}

export function isStubPaymentProvider(): boolean {
  return getPaymentProvider().name === "stub";
}

export type { PaymentProvider } from "./types";
