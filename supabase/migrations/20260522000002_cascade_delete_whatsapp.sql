-- 2026-05-22: Add whatsapp_instance_id to leads for cascade cleanup
--
-- When a WhatsApp instance is deleted, leads auto-created from that
-- instance should also be cleaned up. We track the source instance on
-- the lead row so the delete edge function can target them precisely.
--
-- The cascade chain for chats/messages already exists:
--   whatsapp_instances ──CASCADE──► whatsapp_chats ──CASCADE──► whatsapp_messages
-- (defined in migration 20260408100532)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID
    REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

-- Index for efficient cleanup query in the delete edge function
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_instance
  ON public.leads(whatsapp_instance_id)
  WHERE whatsapp_instance_id IS NOT NULL;

-- Backfill: mark existing WhatsApp-sourced leads with a NULL instance_id
-- (we can't know which instance created them retrospectively, but SET NULL
-- means they won't be cascade-deleted when any instance is removed — safe)
-- No backfill SQL needed; new leads will have the column set by the webhook.
