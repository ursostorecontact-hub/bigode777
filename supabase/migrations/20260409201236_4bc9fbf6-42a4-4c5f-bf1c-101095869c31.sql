
-- Table for user-created labels
CREATE TABLE public.user_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID DEFAULT current_tenant_id(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;

-- Users manage their own labels
CREATE POLICY "Users manage own labels"
  ON public.user_labels FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins/managers can view all labels in tenant
CREATE POLICY "Admins view all labels"
  ON public.user_labels FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

-- Junction table: assign labels to chats and/or leads
CREATE TABLE public.label_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID NOT NULL REFERENCES public.user_labels(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID DEFAULT current_tenant_id(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_target CHECK (chat_id IS NOT NULL OR lead_id IS NOT NULL),
  UNIQUE(label_id, chat_id),
  UNIQUE(label_id, lead_id)
);

ALTER TABLE public.label_assignments ENABLE ROW LEVEL SECURITY;

-- Users manage their own assignments
CREATE POLICY "Users manage own assignments"
  ON public.label_assignments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins/managers can view all assignments in tenant
CREATE POLICY "Admins view all assignments"
  ON public.label_assignments FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

-- Indexes for performance
CREATE INDEX idx_label_assignments_label ON public.label_assignments(label_id);
CREATE INDEX idx_label_assignments_chat ON public.label_assignments(chat_id);
CREATE INDEX idx_label_assignments_lead ON public.label_assignments(lead_id);
CREATE INDEX idx_label_assignments_user ON public.label_assignments(user_id);
CREATE INDEX idx_user_labels_user ON public.user_labels(user_id);
CREATE INDEX idx_user_labels_tenant ON public.user_labels(tenant_id);
