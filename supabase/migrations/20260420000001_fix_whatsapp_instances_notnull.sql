-- ============================================================
-- Fix NOT NULL constraints on whatsapp_instances that have no
-- DEFAULT value, causing INSERT failures when api_url / api_key
-- are not explicitly provided.
--
-- Strategy: keep the data-level constraint by setting DEFAULT ''
-- instead of dropping NOT NULL — this preserves intent while
-- letting inserts succeed when the value is passed as empty.
-- ============================================================

-- api_url: was NOT NULL without DEFAULT → add DEFAULT '' so old
-- code paths that don't supply it don't crash.
ALTER TABLE public.whatsapp_instances
  ALTER COLUMN api_url SET DEFAULT '';

-- If the column somehow lacks NOT NULL, also ensure blank rows
-- from the past are filled:
UPDATE public.whatsapp_instances
  SET api_url = COALESCE(evolution_url, evolution_api_url, '')
  WHERE api_url IS NULL OR api_url = '';

-- api_key: same treatment
ALTER TABLE public.whatsapp_instances
  ALTER COLUMN api_key SET DEFAULT '';

UPDATE public.whatsapp_instances
  SET api_key = COALESCE(evolution_api_key, '')
  WHERE api_key IS NULL OR api_key = '';

-- evolution_api_url: add DEFAULT '' if column exists but is nullable
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS evolution_api_url TEXT NOT NULL DEFAULT '';

UPDATE public.whatsapp_instances
  SET evolution_api_url = COALESCE(evolution_url, '')
  WHERE evolution_api_url IS NULL OR evolution_api_url = '';

-- Ensure updated_at is kept current (idempotent)
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
