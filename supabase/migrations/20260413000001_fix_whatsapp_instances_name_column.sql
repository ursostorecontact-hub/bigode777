-- ============================================================
-- Add missing 'name' column to whatsapp_instances
-- The original migration defined name TEXT NOT NULL but the
-- actual DB is missing this column, causing all INSERTs to fail
-- with "column 'name' does not exist".
-- ============================================================

-- Add the column with a safe default so existing rows are not broken
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

-- Backfill: copy instance_name into name for all existing rows
UPDATE public.whatsapp_instances
  SET name = instance_name
  WHERE name = '';

-- Also add updated_at if missing (exists in real DB but not in migrations)
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Trigger to keep updated_at current on every update
DROP TRIGGER IF EXISTS update_whatsapp_instances_updated_at ON public.whatsapp_instances;
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
