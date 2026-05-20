-- 2026-05-20: Suporte a grupos e limpeza de chats fantasmas

-- 1. Colunas para remetente em mensagens de grupo
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_jid  TEXT;

-- 2. Remover mensagens cujo chat tem JID inválido (IDs internos sem sufixo @*.*)
--    JIDs válidos: @s.whatsapp.net (contatos), @g.us (grupos)
--    Inválidos: IDs internos do Evolution como "cmo7tr8ex6nzdp34j44v4o16b"
DELETE FROM whatsapp_messages
WHERE chat_id IN (
  SELECT id FROM whatsapp_chats
  WHERE remote_jid NOT LIKE '%@s.whatsapp.net'
    AND remote_jid NOT LIKE '%@g.us'
    AND remote_jid NOT LIKE '%@lid'
);

-- 3. Remover os próprios chats fantasmas
DELETE FROM whatsapp_chats
WHERE remote_jid NOT LIKE '%@s.whatsapp.net'
  AND remote_jid NOT LIKE '%@g.us'
  AND remote_jid NOT LIKE '%@lid';
