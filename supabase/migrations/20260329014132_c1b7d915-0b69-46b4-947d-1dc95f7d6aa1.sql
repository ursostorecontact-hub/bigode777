
CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('lead_created', 'pipeline_changed', 'lead_inactive', 'lead_converted')),
  action_type TEXT NOT NULL CHECK (action_type IN ('webhook', 'whatsapp', 'sms')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_template TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  inactive_days INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage automations" ON public.automations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read automations" ON public.automations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
