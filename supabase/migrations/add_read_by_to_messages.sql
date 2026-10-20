-- ========================================================
-- EDUCHAT: RECIBOS DE LEITURA (READ RECEIPTS) NA TABELA MESSAGES
-- Adiciona as colunas read_by e is_read para rastrear leitura de
-- mensagens em canais/grupos e conversas 1-a-1.
-- ========================================================

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS read_by text[] DEFAULT '{}'::text[];

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Índices para consultas eficientes com arrays e boolean
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON public.messages USING GIN (read_by);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages (is_read);

-- Garantir que atualizações na tabela messages estejam 100% liberadas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    DROP POLICY IF EXISTS "Permitir update em messages para todos" ON public.messages;
    CREATE POLICY "Permitir update em messages para todos" ON public.messages
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
