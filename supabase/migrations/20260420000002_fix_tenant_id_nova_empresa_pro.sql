-- ============================================================
-- Fix: whatsapp_instances "nova-empresa-pro" tinha tenant_id=NULL,
-- fazendo com que todos os chats/mensagens inseridos pelo webhook
-- ficassem com tenant_id=NULL e invisíveis pelo RLS.
--
-- 1. Corrige o tenant_id na instância
-- 2. Faz backfill de whatsapp_chats sem tenant_id vinculados à instância
-- 3. Faz backfill de whatsapp_messages sem tenant_id vinculados a esses chats
-- ============================================================

-- Step 1: Corrige a instância
UPDATE public.whatsapp_instances
SET tenant_id = '0c1ee0e7-205d-44ac-b19e-c1a66ae14df4'
WHERE instance_name = 'nova-empresa-pro'
  AND (tenant_id IS NULL OR tenant_id != '0c1ee0e7-205d-44ac-b19e-c1a66ae14df4');

-- Step 2: Backfill chats vinculados à instância que estão sem tenant_id
UPDATE public.whatsapp_chats
SET tenant_id = '0c1ee0e7-205d-44ac-b19e-c1a66ae14df4'
WHERE whatsapp_instance_id = (
  SELECT id FROM public.whatsapp_instances WHERE instance_name = 'nova-empresa-pro'
)
AND (tenant_id IS NULL);

-- Step 3: Backfill mensagens vinculadas a esses chats que estão sem tenant_id
UPDATE public.whatsapp_messages
SET tenant_id = '0c1ee0e7-205d-44ac-b19e-c1a66ae14df4'
WHERE tenant_id IS NULL
  AND chat_id IN (
    SELECT wc.id
    FROM public.whatsapp_chats wc
    JOIN public.whatsapp_instances wi ON wi.id = wc.whatsapp_instance_id
    WHERE wi.instance_name = 'nova-empresa-pro'
  );
