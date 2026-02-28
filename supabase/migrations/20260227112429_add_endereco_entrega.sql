ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS endereco_entrega text;

NOTIFY pgrst, 'reload schema';
