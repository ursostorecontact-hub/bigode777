-- Migration: health_check_cron
-- Agenda pg_cron para chamar whatsapp-health-check a cada 5 minutos

-- Requer extensão pg_net (disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove schedule anterior se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-health-check') THEN
    PERFORM cron.unschedule('whatsapp-health-check');
  END IF;
END $$;

SELECT cron.schedule(
  'whatsapp-health-check',
  '*/5 * * * *',
  $$
  SELECT extensions.http_post(
    url    := 'https://wdgmmmbctqrubrxnmtsf.supabase.co/functions/v1/whatsapp-health-check',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body   := '{}'::jsonb
  );
  $$
);
