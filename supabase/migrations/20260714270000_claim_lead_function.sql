-- Função que faz a "pesca" de um lead de forma atômica e confiável, sem depender
-- da combinação de várias políticas RLS conflitantes em whatsapp_chats/leads.
-- SECURITY DEFINER faz ela rodar com privilégio elevado por dentro, mas ainda assim
-- só afeta o que o próprio usuário logado (auth.uid()) está autorizado a fazer,
-- já que usamos auth.uid() explicitamente pra saber quem está chamando.
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

  -- Só reivindica se o lead ainda estiver sem dono (trava atômica: dois cliques
  -- simultâneos nunca pescam o mesmo lead, porque o UPDATE é uma operação só).
  UPDATE public.leads
  SET assigned_to = auth.uid(), status = 'contactado', pipeline_stage = 'contactado'
  WHERE id = p_lead_id AND assigned_to IS NULL
  RETURNING * INTO v_lead;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'already_claimed');
  END IF;

  -- Vincula a conversa de WhatsApp correspondente ao mesmo vendedor
  IF v_lead.phone IS NOT NULL THEN
    v_clean_phone := regexp_replace(v_lead.phone, '\D', '', 'g');
    UPDATE public.whatsapp_chats
    SET assigned_to = auth.uid()
    WHERE contact_phone ILIKE '%' || right(v_clean_phone, 8) || '%'
      AND assigned_to IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'lead_id', v_lead.id,
    'lead_name', v_lead.name,
    'lead_phone', v_lead.phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_lead(UUID) TO authenticated;
