
CREATE TABLE public.whatsapp_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  evolution_url text NOT NULL,
  evolution_api_key text NOT NULL,
  instance_name text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp_instances"
  ON public.whatsapp_instances
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.facebook_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name text NOT NULL DEFAULT '',
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage facebook_webhooks"
  ON public.facebook_webhooks
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
