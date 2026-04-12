-- Add unique constraint on instance_name so upsert on conflict works
-- First, remove any duplicate rows keeping the most recent one
DELETE FROM public.whatsapp_instances a
  USING public.whatsapp_instances b
  WHERE a.id < b.id
    AND a.instance_name = b.instance_name;

-- Now add the unique constraint
ALTER TABLE public.whatsapp_instances
  ADD CONSTRAINT whatsapp_instances_instance_name_key UNIQUE (instance_name);
