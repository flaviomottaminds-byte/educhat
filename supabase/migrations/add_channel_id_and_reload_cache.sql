-- ========================================================
-- EDUCHAT: ADICIONAR COLUNA channel_id E REFRESH NO SCHEMA CACHE
-- Tabela: public.messages
-- ========================================================

-- 1. CRIAÇÃO DA COLUNA channel_id (Aceita NULL para DMs)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel_id TEXT NULL;

-- 2. CRIAÇÃO DE ÍNDICE DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages (channel_id);

-- 3. POPULAÇÃO RETROATIVA PARA CANAIS EXISTENTES
UPDATE public.messages
SET channel_id = chat_id
WHERE (chat_id LIKE 'c-%' OR chat_id IN ('c-geral', 'c-comercial', 'c-tutoria', 'c-secretaria', 'c-marketing', 'c-pedagogico', 'c-expansao', 'c-diretoria'))
  AND (channel_id IS NULL OR channel_id = '');

-- 4. RECARREGAMENTO IMEDIATO DO SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
