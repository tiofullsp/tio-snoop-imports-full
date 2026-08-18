-- =============================================================================
-- 034_payment_mode.sql
-- Chave de emergência: quando o gateway (PYX Gate) cai, o admin vira esse
-- modo pra "manual" em Configurações > Pagamentos sem precisar de deploy.
-- Nenhuma tela de Pix/Cartão é mostrada nesse modo -- o cliente completa o
-- checkout normalmente e a tela de pagamento mostra só um botão pro
-- WhatsApp, pra combinar o pagamento por fora. Confirmação também vira
-- manual, feita pelo admin no painel do pedido.
-- =============================================================================

ALTER TABLE store_settings_private
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'gateway'
    CHECK (payment_mode IN ('gateway', 'manual'));

COMMENT ON COLUMN store_settings_private.payment_mode IS '"gateway": Pix/Cartão embutidos via PYX Gate. "manual": checkout normal, mas a tela de pagamento só mostra um botão pro WhatsApp -- pra quando o gateway está fora do ar.';
