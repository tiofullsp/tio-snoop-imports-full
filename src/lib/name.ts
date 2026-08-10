// Nome só com um "termo" (sem sobrenome) costuma ser digitação apressada e
// atrapalha depois (conferência de identidade, etiqueta de envio) — exige
// pelo menos duas palavras. Usado no checkout e na confirmação de frete,
// tanto no client (bloquear botão) quanto no server (defesa em profundidade).
export function hasFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

// Aplicado no onChange do campo de nome — deixa "vinicius QUARTAROLO" virar
// "Vinicius Quartarolo" enquanto o cliente digita, sem mexer nos espaços (pra
// não atrapalhar quem ainda está digitando o sobrenome).
export function capitalizeWords(value: string): string {
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
