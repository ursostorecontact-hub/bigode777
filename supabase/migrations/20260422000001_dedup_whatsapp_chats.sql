-- ============================================================
-- Deduplica whatsapp_chats por (whatsapp_instance_id, contact_phone)
-- e adiciona índice único parcial para evitar futuros duplicados.
--
-- Causa raiz: Evolution API retorna o mesmo contato com JIDs diferentes
-- (@s.whatsapp.net e @lid), gerando múltiplas linhas por contact_phone.
--
-- Estratégia:
--   1. Identificar "vencedor" por grupo (mais recente last_message_at)
--   2. Reassociar whatsapp_messages dos perdedores ao vencedor
--   3. Reassociar label_assignments dos perdedores ao vencedor
--   4. Deletar os perdedores
--   5. Criar índice único parcial para prevenir recorrência
-- ============================================================

BEGIN;

-- Vencedores: um por (instance, contact_phone), o mais recente
CREATE TEMP TABLE _chat_winners AS
SELECT DISTINCT ON (whatsapp_instance_id, contact_phone)
  id                    AS winner_id,
  whatsapp_instance_id,
  contact_phone
FROM public.whatsapp_chats
WHERE contact_phone IS NOT NULL
  AND contact_phone <> ''
ORDER BY whatsapp_instance_id, contact_phone, last_message_at DESC NULLS LAST;

-- Perdedores: todos que não são o vencedor do grupo
CREATE TEMP TABLE _chat_losers AS
SELECT
  wc.id               AS loser_id,
  cw.winner_id
FROM public.whatsapp_chats wc
JOIN _chat_winners cw
  ON  cw.whatsapp_instance_id = wc.whatsapp_instance_id
  AND cw.contact_phone        = wc.contact_phone
WHERE wc.id <> cw.winner_id;

-- 1. Reassociar mensagens
UPDATE public.whatsapp_messages
SET chat_id = cl.winner_id
FROM _chat_losers cl
WHERE public.whatsapp_messages.chat_id = cl.loser_id;

-- 2. Reassociar label_assignments (se existir a tabela)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_label_assignments'
  ) THEN
    UPDATE public.chat_label_assignments cla
    SET chat_id = cl.winner_id
    FROM _chat_losers cl
    WHERE cla.chat_id = cl.loser_id
      AND NOT EXISTS (
        -- Evita duplicar assignment de mesma label no vencedor
        SELECT 1 FROM public.chat_label_assignments
        WHERE chat_id = cl.winner_id AND label_id = cla.label_id
      );

    DELETE FROM public.chat_label_assignments
    WHERE chat_id IN (SELECT loser_id FROM _chat_losers);
  END IF;
END $$;

-- 3. Deletar perdedores
DELETE FROM public.whatsapp_chats
WHERE id IN (SELECT loser_id FROM _chat_losers);

-- Relatório
DO $$
DECLARE
  v_loser_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_loser_count FROM _chat_losers;
  RAISE NOTICE 'Dedup: % chats duplicados removidos', v_loser_count;
END $$;

COMMIT;

-- 4. Índice único PARCIAL — permite contact_phone NULL/vazio (grupos, broadcasts)
--    mas proíbe duplicatas de contatos reais
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_chats_instance_phone
  ON public.whatsapp_chats (whatsapp_instance_id, contact_phone)
  WHERE contact_phone IS NOT NULL AND contact_phone <> '';
