-- Corrige dois bugs do claim_lead (pescar lead):
-- 1) A conversa de WhatsApp só era vinculada ao pescador SE já estivesse sem
--    dono. Se por qualquer motivo já tivesse algum valor ali (mesmo errado/
--    desatualizado), a função "silenciosamente" não linkava nada — o lead
--    virava seu, mas a conversa "não subia" pra Conversas, sem erro nenhum.
-- 2) Faltava restringir por tenant_id: telefones iguais em empresas
--    diferentes podiam ser cruzados incorretamente.
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_clean_phone TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.leads
  SET assigned_to = auth.uid(), status = 'contactado', pipeline_stage = 'contactado'
  WHERE id = p_lead_id AND assigned_to IS NULL
  RETURNING * INTO v_lead;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'already_claimed');
  END IF;

  -- Vincula a conversa de WhatsApp correspondente ao mesmo vendedor.
  -- Uma vez que o lead foi pescado (passo atômico acima já garantiu isso),
  -- a conversa sempre acompanha — não fica mais condicionado a "já estar
  -- sem dono", e agora é restrito ao tenant certo.
  IF v_lead.phone IS NOT NULL THEN
    v_clean_phone := regexp_replace(v_lead.phone, '\D', '', 'g');
    UPDATE public.whatsapp_chats
    SET assigned_to = auth.uid()
    WHERE contact_phone ILIKE '%' || right(v_clean_phone, 8) || '%'
      AND tenant_id = v_lead.tenant_id;
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'lead_id', v_lead.id,
    'lead_name', v_lead.name,
    'lead_phone', v_lead.phone
  );
END;
$$;
