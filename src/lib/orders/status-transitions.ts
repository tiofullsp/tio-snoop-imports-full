import type { OrderStatus } from "@/types";

// Módulo puro (sem imports de servidor) — pode ser usado tanto no client
// (OrderStatusSelect, pra saber quais opções mostrar no dropdown) quanto no
// server (transitionOrderStatus, pra validar a transição antes de gravar).
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment:        ["payment_confirmed", "cancelled"],
  payment_confirmed:      ["shipping_link_pending", "cancelled"],
  shipping_link_pending:  ["shipping_paid", "cancelled"],
  shipping_paid:          ["label_issued", "cancelled"],
  label_issued:           ["completed", "cancelled"],
  completed:              [],
  // Cancelado → Pagamento Confirmado é a "ressurreição": o gateway às vezes
  // marca a cobrança como expirada/cancelada e só confirma o pagamento de
  // verdade depois (atraso do processamento deles) — sem essa transição, um
  // pedido pago de verdade ficaria preso em "Cancelado" pra sempre, e o
  // cliente perderia o dinheiro sem o admin nem ficar sabendo. Ver
  // processPaymentResult em src/lib/payments/process.ts.
  cancelled:              ["payment_confirmed"],
};
