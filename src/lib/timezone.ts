// Fuso horário oficial da loja. Brasília não observa horário de verão desde
// 2019, então um offset fixo de -03:00 é seguro pra qualquer pedido real do
// catálogo — evita depender de uma lib de fuso horário só pra isso.
export const STORE_TIMEZONE = "America/Sao_Paulo";
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

function brasiliaYMD(reference: Date): { y: number; m: number; d: number } {
  const shifted = new Date(reference.getTime() - BR_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

// Início do dia (00:00) em horário de Brasília de uma referência qualquer,
// devolvido como o instante UTC real correspondente — pronto pra usar em
// filtros .gte("created_at", ...) do Postgres. Sem isso, "hoje" calculado com
// new Date().setHours(0,0,0,0) usa meia-noite UTC (servidor roda em UTC na
// Vercel), que corresponde a 21h de Brasília do dia ANTERIOR.
export function brasiliaDayStartUTC(reference: Date = new Date()): Date {
  const { y, m, d } = brasiliaYMD(reference);
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) + BR_OFFSET_MS);
}

// Início do dia de Brasília, deslocado N dias (negativo = passado) — pra
// montar períodos de relatório ("últimos X dias") sem cair na virada UTC errada.
export function brasiliaDayStartUTCOffset(daysOffset: number, reference: Date = new Date()): Date {
  const { y, m, d } = brasiliaYMD(reference);
  return new Date(Date.UTC(y, m, d + daysOffset, 0, 0, 0, 0) + BR_OFFSET_MS);
}

// Chave "YYYY-MM-DD" do dia de Brasília em que um instante (ISO/timestamp) cai
// — usada pra agrupar pedidos por dia sem cair na virada UTC errada.
export function brasiliaDateKey(isoString: string): string {
  const { y, m, d } = brasiliaYMD(new Date(isoString));
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Meia-noite de Brasília do dia "YYYY-MM-DD" informado (mais `dayOffset` dias,
// padrão 0) — transforma uma data escolhida num <input type="date"> num
// instante UTC real, pronto pra usar em consultas.
export function brasiliaDateStringToUTC(dateStr: string, dayOffset = 0): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0, 0) + BR_OFFSET_MS);
}
