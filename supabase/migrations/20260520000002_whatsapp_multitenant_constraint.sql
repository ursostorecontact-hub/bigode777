-- 2026-05-20: Isolamento multi-tenant em whatsapp_instances
-- Cada tenant tem seu próprio namespace de instance_name.
-- Antes havia um UNIQUE global em instance_name; agora é por tenant.

-- Remove constraint global (se existir)
ALTER TABLE whatsapp_instances
  DROP CONSTRAINT IF EXISTS whatsapp_instances_instance_name_key;

-- Adiciona constraint por tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_instances_tenant_instance_unique'
  ) THEN
    ALTER TABLE whatsapp_instances
      ADD CONSTRAINT whatsapp_instances_tenant_instance_unique
      UNIQUE (tenant_id, instance_name);
  END IF;
END $$;
