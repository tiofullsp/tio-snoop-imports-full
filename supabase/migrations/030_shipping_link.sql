-- =============================================================================
-- 030_shipping_link.sql
-- Automação do pagamento de frete (Shopee): depois que o pedido é pago, o
-- sistema libera pro cliente — na área "Acompanhar Pedido" — um link de
-- pagamento de frete sorteado entre os cadastrados no admin, com atraso
-- diferente por método de pagamento (instantâneo no Pix, configurável no
-- Cartão). O cliente paga e confirma nome + ID do pedido da Shopee; o admin
-- depois sobe a etiqueta em PDF. Substitui o fluxo manual "combinado por
-- WhatsApp" descrito hoje na aba Frete de Configurações.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- orders — rastreamento do ciclo de frete
-- -----------------------------------------------------------------------------

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_confirmed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_payment_link        TEXT,
  ADD COLUMN IF NOT EXISTS shipping_customer_name       TEXT,
  ADD COLUMN IF NOT EXISTS shipping_order_id            TEXT,
  ADD COLUMN IF NOT EXISTS shipping_label_url           TEXT,
  ADD COLUMN IF NOT EXISTS shipping_label_storage_path  TEXT;

COMMENT ON COLUMN orders.payment_confirmed_at IS 'Momento em que payment_status virou confirmed — base para o atraso (Pix/Cartão) de liberação do link de frete.';
COMMENT ON COLUMN orders.shipping_payment_link IS 'Link de pagamento de frete sorteado para este pedido — fixo uma vez atribuído, não resorteia a cada visita.';
COMMENT ON COLUMN orders.shipping_customer_name IS 'Nome completo informado pelo cliente (da conta Shopee) ao confirmar o pagamento do frete.';
COMMENT ON COLUMN orders.shipping_order_id IS 'ID do pedido na Shopee, informado pelo cliente ao confirmar o pagamento do frete.';
COMMENT ON COLUMN orders.shipping_label_storage_path IS 'Path no bucket privado private-documents — usado para gerar signed URL e para exclusão; nunca exposto ao público.';

-- Backfill defensivo: pedidos já confirmados antes desta migration não têm
-- payment_confirmed_at — sem isso, maybeReleaseShippingLink() nunca liberaria
-- o link pra eles. Usa o histórico de status como aproximação.
UPDATE orders o
SET payment_confirmed_at = h.created_at
FROM order_status_history h
WHERE h.order_id = o.id
  AND h.new_status = 'payment_confirmed'
  AND o.payment_confirmed_at IS NULL
  AND o.payment_status = 'confirmed';

-- -----------------------------------------------------------------------------
-- store_settings_private — links de frete + atrasos configuráveis
-- -----------------------------------------------------------------------------

ALTER TABLE store_settings_private
  ADD COLUMN IF NOT EXISTS shipping_payment_links        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS shipping_link_delay_pix_hours  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_link_delay_card_hours NUMERIC NOT NULL DEFAULT 48;

COMMENT ON COLUMN store_settings_private.shipping_payment_links IS 'Array de até 5 links de pagamento de frete: [{id, label, url, is_active}]. Sorteio entre os is_active=true na liberação automática.';
COMMENT ON COLUMN store_settings_private.shipping_link_delay_pix_hours IS 'Horas após payment_confirmed_at para liberar o link de frete quando o pedido foi pago no Pix.';
COMMENT ON COLUMN store_settings_private.shipping_link_delay_card_hours IS 'Horas após payment_confirmed_at para liberar o link de frete quando o pedido foi pago no Cartão.';

-- -----------------------------------------------------------------------------
-- order_status — novos valores do fluxo de frete
-- Valores antigos (awaiting_validation, awaiting_separation, shipped,
-- delivered) permanecem no enum sem uso — Postgres não suporta DROP VALUE de
-- forma segura, e mantê-los órfãos não tem custo nem risco.
-- -----------------------------------------------------------------------------

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'shipping_link_pending';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'shipping_paid';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'label_issued';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
