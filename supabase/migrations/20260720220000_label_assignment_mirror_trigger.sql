-- Sincroniza automaticamente etiquetas entre conversa e lead da mesma pessoa
-- (mesmo telefone), direto no banco — mais confiável do que fazer isso no
-- código do site, que podia falhar silenciosamente sem avisar ninguém.

CREATE OR REPLACE FUNCTION public.mirror_label_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_clean_phone TEXT;
  rec RECORD;
BEGIN
  IF NEW.chat_id IS NOT NULL THEN
    SELECT contact_phone INTO v_phone FROM whatsapp_chats WHERE id = NEW.chat_id;
    IF v_phone IS NOT NULL THEN
      v_clean_phone := regexp_replace(v_phone, '\D', '', 'g');
      FOR rec IN
        SELECT id FROM leads WHERE phone ILIKE '%' || right(v_clean_phone, 8)
      LOOP
        INSERT INTO label_assignments (label_id, lead_id, user_id, tenant_id)
        VALUES (NEW.label_id, rec.id, NEW.user_id, NEW.tenant_id)
        ON CONFLICT (label_id, lead_id) DO NOTHING;
      END LOOP;
    END IF;
  ELSIF NEW.lead_id IS NOT NULL THEN
    SELECT phone INTO v_phone FROM leads WHERE id = NEW.lead_id;
    IF v_phone IS NOT NULL THEN
      v_clean_phone := regexp_replace(v_phone, '\D', '', 'g');
      FOR rec IN
        SELECT id FROM whatsapp_chats WHERE contact_phone ILIKE '%' || right(v_clean_phone, 8)
      LOOP
        INSERT INTO label_assignments (label_id, chat_id, user_id, tenant_id)
        VALUES (NEW.label_id, rec.id, NEW.user_id, NEW.tenant_id)
        ON CONFLICT (label_id, chat_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_label_assignment ON public.label_assignments;
CREATE TRIGGER trg_mirror_label_assignment
  AFTER INSERT ON public.label_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_label_assignment();

-- Mesma lógica para quando uma etiqueta é REMOVIDA — remove do lado espelhado também.
CREATE OR REPLACE FUNCTION public.mirror_label_unassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_clean_phone TEXT;
BEGIN
  IF OLD.chat_id IS NOT NULL THEN
    SELECT contact_phone INTO v_phone FROM whatsapp_chats WHERE id = OLD.chat_id;
    IF v_phone IS NOT NULL THEN
      v_clean_phone := regexp_replace(v_phone, '\D', '', 'g');
      DELETE FROM label_assignments
      WHERE label_id = OLD.label_id
        AND lead_id IN (SELECT id FROM leads WHERE phone ILIKE '%' || right(v_clean_phone, 8));
    END IF;
  ELSIF OLD.lead_id IS NOT NULL THEN
    SELECT phone INTO v_phone FROM leads WHERE id = OLD.lead_id;
    IF v_phone IS NOT NULL THEN
      v_clean_phone := regexp_replace(v_phone, '\D', '', 'g');
      DELETE FROM label_assignments
      WHERE label_id = OLD.label_id
        AND chat_id IN (SELECT id FROM whatsapp_chats WHERE contact_phone ILIKE '%' || right(v_clean_phone, 8));
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_label_unassignment ON public.label_assignments;
CREATE TRIGGER trg_mirror_label_unassignment
  AFTER DELETE ON public.label_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_label_unassignment();
