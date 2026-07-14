-- Distribuição automática de leads por porcentagem: assim que um lead é criado
-- sem vendedor definido, ele já é atribuído automaticamente ao vendedor certo,
-- respeitando a porcentagem configurada para cada um em profiles.distribution_percentage.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS distribution_percentage NUMERIC;

CREATE OR REPLACE FUNCTION public.auto_distribute_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_id UUID;
BEGIN
  -- Só distribui automaticamente se o lead ainda não tiver vendedor
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Escolhe o vendedor com a menor proporção (leads ativos ÷ porcentagem configurada),
  -- o que mantém a distribuição real seguindo a porcentagem ao longo do tempo.
  SELECT p.id INTO chosen_id
  FROM public.profiles p
  WHERE p.tenant_id IS NOT DISTINCT FROM NEW.tenant_id
    AND p.active = true
    AND p.distribution_percentage IS NOT NULL
    AND p.distribution_percentage > 0
  ORDER BY
    (
      SELECT COUNT(*) FROM public.leads l
      WHERE l.assigned_to = p.id AND l.status NOT IN ('ganho', 'perdido')
    )::numeric / p.distribution_percentage
  ASC
  LIMIT 1;

  IF chosen_id IS NOT NULL THEN
    NEW.assigned_to := chosen_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_distribute_new_lead ON public.leads;
CREATE TRIGGER trg_auto_distribute_new_lead
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_distribute_new_lead();
