-- Tabela oficial para a Base de Conhecimento da IA (Documentos, Regras, Catálogos)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Geral',
    content TEXT NOT NULL,
    summary TEXT,
    file_type TEXT,
    size TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Permissões de leitura e escrita
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_knowledge_base' AND policyname = 'Allow public read access on ai_knowledge_base'
    ) THEN
        CREATE POLICY "Allow public read access on ai_knowledge_base"
        ON public.ai_knowledge_base FOR SELECT
        TO public
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_knowledge_base' AND policyname = 'Allow public write access on ai_knowledge_base'
    ) THEN
        CREATE POLICY "Allow public write access on ai_knowledge_base"
        ON public.ai_knowledge_base FOR ALL
        TO public
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
