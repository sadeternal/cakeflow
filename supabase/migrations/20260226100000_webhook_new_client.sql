-- Habilitar extensões necessárias
create extension if not exists "http" with schema "extensions";

-- Criar a função primeiro para evitar erro de referência inexistente na trigger
CREATE OR REPLACE FUNCTION public.notify_new_client_webhook()
RETURNS TRIGGER AS $$
BEGIN
  -- Nota: O Supabase costuma gerenciar webhooks nativamente via Dashboard.
  -- Esta trigger serve como base para que o evento de INSERT seja capturado.
  -- Se o pg_net estiver disponível, o disparo poderia ser feito aqui via SQL.
  -- Por padrão, deixamos a função pronta para integração.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agora criamos a trigger com segurança
DROP TRIGGER IF EXISTS tr_notify_new_client ON public.clientes;
DROP TRIGGER IF EXISTS on_client_created ON public.clientes;

CREATE TRIGGER on_client_created
  AFTER INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_client_webhook();
