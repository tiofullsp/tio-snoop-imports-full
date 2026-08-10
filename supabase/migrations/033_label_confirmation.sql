-- Confirmação da etiqueta pelo cliente + auto-finalização em 24h sem resposta.
-- label_issued_at marca quando o admin subiu a etiqueta (mesmo padrão de
-- payment_confirmed_at) — usado pela checagem "sob demanda" (sem cron) que
-- avança o pedido pra "completed" automaticamente se o cliente não confirmar.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_issued_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
