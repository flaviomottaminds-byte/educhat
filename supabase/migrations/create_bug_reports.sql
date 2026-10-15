-- ========================================================
-- AI BUG TRACKER: Tabela de Reporte Automático de Bugs
-- Sistema: EduChat (Supabase PostgreSQL)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    titulo TEXT NOT NULL,
    problema TEXT NOT NULL,
    solucao_esperada TEXT NOT NULL,
    prioridade VARCHAR(20) DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
    status VARCHAR(30) DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'em_desenvolvimento', 'resolvido', 'descartado')),
    reporter_name TEXT,
    reporter_id TEXT,
    raw_payload JSONB
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Idempotentes (RLS)
DROP POLICY IF EXISTS "Permitir leitura de bug_reports" ON public.bug_reports;
CREATE POLICY "Permitir leitura de bug_reports"
ON public.bug_reports FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de bug_reports" ON public.bug_reports;
CREATE POLICY "Permitir insercao de bug_reports"
ON public.bug_reports FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de bug_reports" ON public.bug_reports;
CREATE POLICY "Permitir atualizacao de bug_reports"
ON public.bug_reports FOR UPDATE
USING (true);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_prioridade ON public.bug_reports (prioridade);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports (status);
