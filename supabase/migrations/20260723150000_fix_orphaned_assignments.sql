-- Libera qualquer lead ou conversa que ficou "presa" a um usuário cujo perfil
-- não existe mais (efeito colateral de um bug no delete-user já corrigido).
-- Sem isso, essas conversas ficavam invisíveis pra todo mundo — nem RLS, nem
-- o painel do gerente encontram o dono.
UPDATE public.leads
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM public.profiles);

UPDATE public.whatsapp_chats
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM public.profiles);
