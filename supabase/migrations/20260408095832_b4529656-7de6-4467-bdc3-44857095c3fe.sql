
-- Allow salespeople to read whatsapp_instances they are assigned to
CREATE POLICY "Users read assigned whatsapp_instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_assignments
    WHERE whatsapp_assignments.whatsapp_instance_id = whatsapp_instances.id
    AND whatsapp_assignments.user_id = auth.uid()
  )
);
