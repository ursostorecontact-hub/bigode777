
-- Fix 1: Restrict clients SELECT to assigned leads' clients + admin/manager
DROP POLICY "Read clients" ON clients;

CREATE POLICY "Read clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = clients.lead_id
        AND leads.assigned_to = auth.uid()
    )
  );

-- Fix 2: Add DELETE policy on tasks
CREATE POLICY "Delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );
