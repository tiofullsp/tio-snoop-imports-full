-- =============================================================================
-- 032_shipping_state_full_name.sql
-- shipping_state guardava só a sigla (CHAR(2)) e nem era coletado no
-- checkout. Agora o cliente escolhe o estado por extenso (ex: "São Paulo"),
-- então o campo precisa comportar o nome completo — não cabe em CHAR(2).
-- =============================================================================

ALTER TABLE orders ALTER COLUMN shipping_state TYPE TEXT;

COMMENT ON COLUMN orders.shipping_state IS 'Nome completo do estado (ex: "São Paulo"), escolhido pelo cliente no checkout — não é mais a sigla de 2 letras.';
