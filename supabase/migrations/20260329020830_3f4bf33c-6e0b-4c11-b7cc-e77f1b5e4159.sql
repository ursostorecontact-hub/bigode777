
DROP POLICY "Read interactions" ON public.interactions;

CREATE POLICY "Read interactions"
  ON public.interactions
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = interactions.lead_id
        AND leads.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = interactions.client_id
        AND EXISTS (
          SELECT 1 FROM public.leads
          WHERE leads.id = clients.lead_id
            AND leads.assigned_to = auth.uid()
        )
    )
  );
