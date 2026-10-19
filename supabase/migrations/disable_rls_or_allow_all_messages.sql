-- ========================================================
-- EDUCHAT: CORREÇÃO DEFINITIVA E DESATIVAÇÃO DE TRAVAS DE RLS
-- Tabela: public.messages
-- ========================================================

-- OPÇÃO 1 (RECOMENDADA): Desativa o RLS na tabela messages.
-- Isso elimina completamente qualquer bloqueio silencioso nos INSERTS e SELECTS.
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Garante todas as permissões de acesso para as roles do Supabase
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO service_role;
GRANT ALL ON TABLE public.messages TO postgres;

-- OPÇÃO 2: Caso sua infraestrutura exija RLS estritamente ATIVADO,
-- descomente as linhas abaixo para liberar 100% de acesso sem checagens restritivas:
/*
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.messages;
DROP POLICY IF EXISTS "Permitir tudo para anon" ON public.messages;
DROP POLICY IF EXISTS "Permitir tudo em messages para todos" ON public.messages;
DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.messages;

CREATE POLICY "Permitir tudo para autenticados"
ON public.messages
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
*/
