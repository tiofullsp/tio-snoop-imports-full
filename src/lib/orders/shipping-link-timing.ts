// Cálculo puro de horários da liberação do link de frete — sem imports de
// servidor (Supabase etc.), pra poder ser usado tanto por shipping-link.ts
// (decide quando liberar de verdade) quanto pelo client do admin (mostra
// cronômetro/aviso de bloqueio sem precisar duplicar a regra).

// Sexta, sábado e domingo ficam de fora da liberação automática — a
// logística (Shopee/Correios) não roda no fim de semana, então liberar o
// link nesses dias só faz o cliente pagar o frete e ficar sem novidade até
// segunda.
export function isBlockedReleaseDay(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(date);
  return weekday === "Fri" || weekday === "Sat" || weekday === "Sun";
}

// Horário em que o link do cartão libera — cedo de manhã, não na hora exata
// em que o prazo de dias completou. Só se aplica ao cartão (Pix continua
// instantâneo, 0h de espera). América/Sao_Paulo não observa horário de
// verão desde 2019, então -03:00 é um offset fixo seguro aqui.
export const CARD_RELEASE_MORNING_HOUR = 8;

export function snapToMorningSaoPaulo(date: Date, hour: number): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T${String(hour).padStart(2, "0")}:00:00-03:00`);
}

export interface ShippingLinkDelayInput {
  paymentMethod: string;
  paymentConfirmedAt: string; // ISO
  delayPixHours: number;
  delayCardHours: number;
}

// Momento em que o prazo configurado (Pix/Cartão, ver Configurações > Frete)
// termina — ainda sem considerar o bloqueio de fim de semana abaixo.
export function computeShippingLinkDelayReleaseAt(input: ShippingLinkDelayInput): Date {
  let releaseAt =
    new Date(input.paymentConfirmedAt).getTime() +
    (input.paymentMethod === "card" ? input.delayCardHours : input.delayPixHours) * 60 * 60 * 1000;
  if (input.paymentMethod === "card") {
    releaseAt = snapToMorningSaoPaulo(new Date(releaseAt), CARD_RELEASE_MORNING_HOUR).getTime();
  }
  return new Date(releaseAt);
}

// A partir do prazo calculado acima, empurra pro início do próximo dia útil
// se cair numa sexta/sábado/domingo — mesma regra usada na liberação de
// verdade. É uma estimativa pro cronômetro do admin: como não há cron, a
// liberação de fato só acontece quando alguém abre o pedido (tracking
// público ou admin) num dia não bloqueado, então pode ser um pouco depois
// do valor mostrado aqui.
export function computeEffectiveShippingLinkReleaseAt(delayReleaseAt: Date): Date {
  let candidate = delayReleaseAt;
  for (let i = 0; i < 8 && isBlockedReleaseDay(candidate); i++) {
    candidate = snapToMorningSaoPaulo(new Date(candidate.getTime() + 24 * 60 * 60 * 1000), 0);
  }
  return candidate;
}
