-- ========================================================
-- EDUCHAT: RECIBOS DE LEITURA (READ RECEIPTS) NA TABELA MESSAGES
-- Adiciona a coluna read_by para rastrear quais usuários visualizaram
-- cada mensagem no grupo #geral.
-- Usamos text[] DEFAULT '{}'::text[] para comportar tanto UUIDs quanto
-- IDs em formato string (ex: 'u1', 'u2', 'u_1792429986084').
-- ========================================================

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS read_by text[] DEFAULT '{}'::text[];

-- Índice GIN para consultas eficientes com arrays
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON public.messages USING GIN (read_by);

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
