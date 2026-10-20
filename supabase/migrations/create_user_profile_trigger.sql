-- ========================================================
-- EDUCHAT: TRIGGER DE CRIAÇÃO AUTOMÁTICA DE PERFIS
-- Garante atribuição estrita e única do ID do Auth (auth.users.id)
-- para a tabela public.profiles (e public.collaborators)
-- Impedindo clonagem de IDs ou contaminação de remetentes
-- ========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_dept TEXT;
  v_role TEXT;
  v_avatar TEXT;
BEGIN
  -- Extrai metadados do usuário ou gera valores padrão seguros
  v_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'user_name'), ''),
    NULLIF(TRIM(split_part(new.email, '@', 1)), ''),
    'Colaborador'
  );

  v_dept := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'department'), ''),
    'Comercial'
  );

  v_role := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'role'), ''),
    'Colaborador'
  );

  v_avatar := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'avatar'), ''),
    '👤'
  );

  -- 1. Inserção estrita na tabela 'profiles' usando NEW.id (UUID único do Supabase Auth)
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    role_type,
    avatar,
    online,
    department,
    is_bot,
    created_at,
    updated_at
  )
  VALUES (
    new.id::text,
    v_name,
    COALESCE(new.email, ''),
    v_role,
    'colaborador',
    v_avatar,
    true,
    v_dept,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    role = EXCLUDED.role,
    updated_at = now();

  -- 2. Inserção correspondente na tabela 'collaborators' se existir
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'collaborators') THEN
    INSERT INTO public.collaborators (
      id,
      name,
      email,
      role,
      role_type,
      avatar,
      online,
      department,
      is_bot,
      created_at,
      updated_at
    )
    VALUES (
      new.id::text,
      v_name,
      COALESCE(new.email, ''),
      v_role,
      'colaborador',
      v_avatar,
      true,
      v_dept,
      false,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      department = EXCLUDED.department,
      role = EXCLUDED.role,
      updated_at = now();
  END IF;

  RETURN new;
END;
$$;

-- Remove qualquer trigger anterior para recriação limpa
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Garante permissões irrestritas para profiles
GRANT ALL ON TABLE public.profiles TO authenticated, anon;
