-- ========================================================
-- EDUCHAT: TABELA DEDICADA DE RECIBOS DE LEITURA EM CANAIS
-- E PERMISSÕES GLOBAIS PARA TODOS OS USUÁRIOS (SEM TRAVAS ADMIN)
-- ========================================================

-- 1. TABELA DE RECIBOS DE LEITURA EM CANAIS
CREATE TABLE IF NOT EXISTS public.channel_read_receipts (
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, channel_id)
);

-- Habilita RLS
DO $$
BEGIN
    ALTER TABLE public.channel_read_receipts ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Políticas de RLS para channel_read_receipts (Acesso aberto para leitura, escrita e atualização por qualquer usuário autenticado ou anônimo)
DROP POLICY IF EXISTS "Permitir leitura de recibos de canal para todos" ON public.channel_read_receipts;
CREATE POLICY "Permitir leitura de recibos de canal para todos"
ON public.channel_read_receipts FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de recibos de canal para todos" ON public.channel_read_receipts;
CREATE POLICY "Permitir insercao de recibos de canal para todos"
ON public.channel_read_receipts FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de recibos de canal para todos" ON public.channel_read_receipts;
CREATE POLICY "Permitir atualizacao de recibos de canal para todos"
ON public.channel_read_receipts FOR UPDATE
USING (true);

-- 2. GARANTIA DE ATUALIZAÇÃO DE DISPONIBILIDADE (is_available) PARA TODOS OS USUÁRIOS
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

ALTER TABLE IF EXISTS public.collaborators 
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    DROP POLICY IF EXISTS "Permitir update em profiles para todos" ON public.profiles;
    CREATE POLICY "Permitir update em profiles para todos" ON public.profiles
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'collaborators') THEN
    DROP POLICY IF EXISTS "Permitir update em collaborators para todos" ON public.collaborators;
    CREATE POLICY "Permitir update em collaborators para todos" ON public.collaborators
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
