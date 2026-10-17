-- ========================================================
-- EDUCHAT: CONTROLE DE DISPONIBILIDADE DE ATENDENTES
-- Adiciona o campo is_available para alternar entre "Disponível" e "Em Pausa"
-- ========================================================

ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

ALTER TABLE IF EXISTS public.collaborators 
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

ALTER TABLE IF EXISTS public.users 
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- Habilita atualização por qualquer usuário autenticado ou anônimo no frontend
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    DROP POLICY IF EXISTS "Permitir update de disponibilidade em profiles" ON public.profiles;
    CREATE POLICY "Permitir update de disponibilidade em profiles" ON public.profiles
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'collaborators') THEN
    DROP POLICY IF EXISTS "Permitir update de disponibilidade em collaborators" ON public.collaborators;
    CREATE POLICY "Permitir update de disponibilidade em collaborators" ON public.collaborators
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
