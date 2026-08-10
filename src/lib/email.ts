// Compartilhado entre client (bloquear o botão de finalizar) e server
// (validação real antes de criar o pedido) — mesma regra nos dois lados pra
// nunca divergir.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}
