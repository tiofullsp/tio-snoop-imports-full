-- =============================================================================
-- 031_order_number_tf_prefix.sql
-- Troca o prefixo do número do pedido de RF (herdado da migration 018) para
-- TF (Tio Full). Formato continua TF00001, TF00002, ...
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
  SELECT 'TF' || LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
$$ LANGUAGE sql;

-- Reinicia a sequência para o próximo pedido sair como TF00001 — só se ainda
-- não houver pedidos (evita colidir com order_number já existente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders) THEN
    ALTER SEQUENCE order_number_seq RESTART WITH 1;
  END IF;
END $$;
