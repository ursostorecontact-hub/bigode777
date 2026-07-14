-- Corrige a estrutura de user_roles: um usuário deve ter EXATAMENTE um cargo.
-- A constraint original UNIQUE(user_id, role) permitia (por engano) que um mesmo
-- usuário acumulasse mais de uma linha de cargo (ex: 'salesperson' E 'admin' ao
-- mesmo tempo), o que fazia consultas simples (`.find()`) devolverem o cargo errado.

-- 1) Limpa duplicidade existente: para cada usuário com mais de uma linha de cargo,
--    mantém apenas a de MENOR privilégio (salesperson < manager < admin).
--    Isso corrige o problema de usuários aparecendo como admin por engano.
--    Se algum usuário realmente deveria ser admin, é só reatribuir depois pela tela.
WITH ranked AS (
  SELECT
    id,
    user_id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role
        WHEN 'salesperson' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'admin' THEN 3
        ELSE 4
      END ASC
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Remove a constraint antiga (permitia duplicidade) e cria uma nova
--    garantindo no máximo um cargo por usuário.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 3) Corrige a função que cria o cargo padrão para novos usuários,
--    usando a constraint nova (ON CONFLICT (user_id) em vez de (user_id, role)).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insere o cargo padrão "salesperson" apenas se o usuário ainda não tiver nenhum cargo
  -- (a edge function create-user substitui essa linha pelo cargo escolhido, se houver).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'salesperson')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
