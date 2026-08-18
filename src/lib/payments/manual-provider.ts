import type {
  PaymentProvider,
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentVerificationResult,
} from "./types";

// Provider usado quando payment_mode === "manual" (ver getPaymentMode() em
// @/lib/db/settings, Configurações > Pagamentos no admin) — não fala
// com nenhum gateway. O pedido só é registrado; o pagamento acontece por
// fora (link enviado pelo WhatsApp) e a confirmação é manual, feita pelo
// admin no painel do pedido (processPaymentResult chamado direto por lá).
export const manualPaymentProvider: PaymentProvider = {
  name: "manual",

  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    return {
      checkoutUrl: `/pagamento/${input.orderId}`,
      externalId: `manual_${input.orderId}`,
    };
  },

  async verifyPayment(): Promise<PaymentVerificationResult> {
    return { status: "pending" };
  },
};
