-- Suporte à API oficial da Meta (WhatsApp Cloud API) como um segundo "provedor"
-- de instância WhatsApp, ao lado da Evolution API (não-oficial) já existente.
-- Os campos evolution_url/evolution_api_key não fazem sentido pra Cloud API,
-- então viram opcionais; os novos campos guardam os identificadores da Meta
-- (o token de acesso fica como secret no Supabase, não numa coluna).
ALTER TABLE public.whatsapp_instances
  ALTER COLUMN evolution_url DROP NOT NULL,
  ALTER COLUMN evolution_api_key DROP NOT NULL;

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS cloud_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS cloud_waba_id TEXT;

-- Instância piloto: número de teste da Meta, isolado no tenant "Luiz Importados"
-- pra validar toda a integração antes de migrar um número real em produção.
INSERT INTO public.whatsapp_instances (
  name, instance_name, status, tenant_id, provider, cloud_phone_number_id, cloud_waba_id,
  evolution_url, evolution_api_key
)
VALUES (
  'WhatsApp Oficial (piloto/teste)',
  'cloud-piloto-luiz',
  'connected',
  '30c69880-b3dd-400e-99b7-76fe2675a889',
  'cloud_api',
  '1163233846882489',
  '1015464974451472',
  NULL,
  NULL
)
ON CONFLICT DO NOTHING;
