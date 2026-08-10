import { NextResponse } from "next/server";

// Devolve o token de autenticação 3DS pro SDK que roda no navegador do
// cliente (ZendrySDKThreeds.init_threeds — a PYX Gate confirmou que o
// desafio 3DS de cartão continua rodando por trás pela Zendry, mesmo com o
// pagamento em si indo pra API da PYX Gate). Token de curta duração
// específico pra esse fluxo, gerado sob demanda — não é o mesmo Bearer
// secreto usado nas chamadas server-to-server (diferente do que acontecia
// antes, direto com a Zendry).
export async function GET() {
  const secretKey = process.env.PYXGATE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Gateway de pagamento não configurado." }, { status: 500 });
  }

  const apiBase = process.env.PYXGATE_API_BASE ?? "https://pyxgate-api.onrender.com/v1";

  try {
    const res = await fetch(`${apiBase}/card_authentications/token`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Erro ao gerar token de autenticação." }, { status: 502 });
    }

    const json = (await res.json()) as { token?: string; access_token?: string };
    const token = json.token ?? json.access_token;
    if (!token) {
      return NextResponse.json({ error: "Erro ao gerar token de autenticação." }, { status: 502 });
    }

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar token de autenticação." }, { status: 500 });
  }
}
