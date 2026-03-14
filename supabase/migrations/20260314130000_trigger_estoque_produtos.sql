-- Trigger para gerenciar estoque de produtos automaticamente
-- Regras:
--   INSERT (status != 'cancelado'): diminui estoque
--   UPDATE para 'cancelado':        restaura estoque
--   UPDATE de 'cancelado' para outro: diminui estoque novamente

CREATE OR REPLACE FUNCTION public.handle_pedido_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item        jsonb;
  produto_id  uuid;
  qtd_pedida  int;
BEGIN
  -- INSERT: pedido criado (não cancelado) com produtos
  IF TG_OP = 'INSERT'
     AND NEW.tipo = 'produto_pronto'
     AND NEW.status IS DISTINCT FROM 'cancelado'
     AND NEW.produtos_catalogo IS NOT NULL
     AND jsonb_array_length(NEW.produtos_catalogo) > 0
  THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.produtos_catalogo)
    LOOP
      produto_id := (item->>'id')::uuid;
      qtd_pedida := COALESCE((item->>'quantidade')::int, 1);

      UPDATE public.produtos
        SET quantidade = GREATEST(0, quantidade - qtd_pedida)
        WHERE id = produto_id AND quantidade IS NOT NULL;
    END LOOP;
  END IF;

  -- UPDATE → cancelado: restaura estoque
  IF TG_OP = 'UPDATE'
     AND NEW.tipo = 'produto_pronto'
     AND OLD.status IS DISTINCT FROM 'cancelado'
     AND NEW.status = 'cancelado'
     AND NEW.produtos_catalogo IS NOT NULL
     AND jsonb_array_length(NEW.produtos_catalogo) > 0
  THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.produtos_catalogo)
    LOOP
      produto_id := (item->>'id')::uuid;
      qtd_pedida := COALESCE((item->>'quantidade')::int, 1);

      UPDATE public.produtos
        SET quantidade = quantidade + qtd_pedida
        WHERE id = produto_id AND quantidade IS NOT NULL;
    END LOOP;
  END IF;

  -- UPDATE → de cancelado para outro status: diminui estoque novamente
  IF TG_OP = 'UPDATE'
     AND NEW.tipo = 'produto_pronto'
     AND OLD.status = 'cancelado'
     AND NEW.status IS DISTINCT FROM 'cancelado'
     AND NEW.produtos_catalogo IS NOT NULL
     AND jsonb_array_length(NEW.produtos_catalogo) > 0
  THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.produtos_catalogo)
    LOOP
      produto_id := (item->>'id')::uuid;
      qtd_pedida := COALESCE((item->>'quantidade')::int, 1);

      UPDATE public.produtos
        SET quantidade = GREATEST(0, quantidade - qtd_pedida)
        WHERE id = produto_id AND quantidade IS NOT NULL;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS trigger_pedido_estoque ON public.pedidos;

-- Cria trigger
CREATE TRIGGER trigger_pedido_estoque
  AFTER INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pedido_estoque();
