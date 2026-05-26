-- Adicionar colunas de IA, destaque, preço promocional e atributos à tabela products
-- Todas as colunas usam IF NOT EXISTS para ser idempotente

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_keywords TEXT,
  ADD COLUMN IF NOT EXISTS ai_sales_pitch TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Índice para busca de produtos em destaque por tenant
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(tenant_id, is_featured)
  WHERE is_featured = true;
