ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS valor_itens numeric(10,2) DEFAULT 0;

NOTIFY pgrst, 'reload schema';
