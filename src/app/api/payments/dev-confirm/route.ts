import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isStubPaymentProvider } from "@/lib/payments";
import { processPaymentResult } from "@/lib/payments/process";

// POST /api/payments/dev-confirm — { orderId }
// Simula, em ambiente de desenvolvimento/stub, o que um webhook real do
// gateway enviaria quando o pagamento é aprovado. Só funciona enquanto nenhum
// gateway real estiver configurado (getPaymentProvider() === stub) — assim
// que um provider real for plugado, esse endpoint deixa de fazer efeito,
// porque só o webhook real (com verificação no gateway) pode confirmar pagamento.
export async function POST(request: NextRequest) {
  if (!(await isStubPaymentProvider())) {
    return NextResponse.json(
      { error: "Confirmação manual desabilitada — gateway de pagamento real está configurado." },
      { status: 403 }
    );
  }

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ error: "orderId é obrigatório" }, { status: 400 });
  }

  const service = createServiceClient();
  const result = await processPaymentResult({
    service,
    orderId: body.orderId,
    status: "approved",
    paidAt: new Date().toISOString(),
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
