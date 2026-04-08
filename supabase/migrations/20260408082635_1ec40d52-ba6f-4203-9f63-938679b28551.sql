
-- Create whatsapp_assignments table
CREATE TABLE public.whatsapp_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percentage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(whatsapp_instance_id, user_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_assignments ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins manage whatsapp_assignments"
  ON public.whatsapp_assignments
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read their own assignments
CREATE POLICY "Users read own whatsapp_assignments"
  ON public.whatsapp_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
