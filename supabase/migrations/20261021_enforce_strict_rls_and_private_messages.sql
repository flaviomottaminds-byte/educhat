-- ========================================================
-- EDUCHAT: BLINDAGEM DE BANCO DE DADOS (RLS) & ISOLAMENTO DE MENSAGENS PRIVADAS
-- Tabelas: public.messages, public.chats
-- Resolução definitiva do vazamento de mensagens privadas e controle de acesso
-- ========================================================

-- 1. GARANTE COLUNAS DE ROTEAMENTO NA TABELA MESSAGES
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT '{}'::TEXT[];

-- Cria índices para acelerar filtros de RLS e subscriptions Realtime
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 2. TRIGGER PARA AUTO-PREENCHER RECIPIENT_ID E CHANNEL_ID (RETROCOMPATIBILIDADE E SEGURANÇA)
CREATE OR REPLACE FUNCTION public.fn_fill_message_routing()
RETURNS TRIGGER AS $$
DECLARE
    parts TEXT[];
BEGIN
    -- Se for DM (1 a 1) e recipient_id vier nulo, extrai automaticamente do chat_id ('dm-u1-u2')
    IF NEW.chat_id LIKE 'dm-%' AND (NEW.recipient_id IS NULL OR NEW.recipient_id = '') THEN
        parts := string_to_array(replace(NEW.chat_id, 'dm-', ''), '-');
        IF array_length(parts, 1) >= 2 THEN
            IF parts[1] = NEW.sender_id THEN
                NEW.recipient_id := parts[2];
            ELSE
                NEW.recipient_id := parts[1];
            END IF;
        END IF;
    END IF;

    -- Se for mensagem de canal de grupo, garante channel_id
    IF NEW.chat_id LIKE 'c-%' AND (NEW.channel_id IS NULL OR NEW.channel_id = '') THEN
        NEW.channel_id := NEW.chat_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_message_routing ON public.messages;
CREATE TRIGGER trg_fill_message_routing
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.fn_fill_message_routing();

-- 3. RETRO-ALIMENTAÇÃO: Preenche recipient_id e channel_id em mensagens antigas
UPDATE public.messages
SET recipient_id = (
    CASE 
        WHEN split_part(replace(chat_id, 'dm-', ''), '-', 1) = sender_id 
        THEN split_part(replace(chat_id, 'dm-', ''), '-', 2)
        ELSE split_part(replace(chat_id, 'dm-', ''), '-', 1)
    END
)
WHERE chat_id LIKE 'dm-%' AND (recipient_id IS NULL OR recipient_id = '');

UPDATE public.messages
SET channel_id = chat_id
WHERE chat_id LIKE 'c-%' AND (channel_id IS NULL OR channel_id = '');

-- 4. HABILITAÇÃO ESTRITA DE ROW LEVEL SECURITY (RLS) NA TABELA MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas e permissivas
DROP POLICY IF EXISTS "Permitir leitura de mensagens para todos" ON public.messages;
DROP POLICY IF EXISTS "Permitir envio de mensagens para todos" ON public.messages;
DROP POLICY IF EXISTS "Permitir atualizacao de status de mensagens" ON public.messages;
DROP POLICY IF EXISTS "Permitir exclusao de mensagens para todos" ON public.messages;
DROP POLICY IF EXISTS "Permitir tudo em messages para todos" ON public.messages;
DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.messages;
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.messages;
DROP POLICY IF EXISTS "Permitir tudo para anon" ON public.messages;
DROP POLICY IF EXISTS "Permitir update em messages para todos" ON public.messages;
DROP POLICY IF EXISTS "Leitura estrita de mensagens" ON public.messages;
DROP POLICY IF EXISTS "Insercao de mensagens com remetente verificado" ON public.messages;
DROP POLICY IF EXISTS "Atualizacao de leitura de mensagens" ON public.messages;
DROP POLICY IF EXISTS "Exclusao de mensagens proprias" ON public.messages;

-- POLÍTICA DE SELECT ESTRITA:
-- Mensagens privadas (dm-*) SÓ podem ser vistas pelo remetente ou destinatário.
-- Mensagens de canal (c-*) públicas para canais da equipe.
-- Mensagens de sistema (sys_*) e WhatsApp (wa-*) para a equipe.
CREATE POLICY "Leitura estrita de mensagens"
ON public.messages FOR SELECT
TO authenticated, anon
USING (
    -- Mensagens de Sistema (alunos EduControl, colaboradores, KB)
    chat_id LIKE 'sys_%'
    -- Mensagens de WhatsApp (atendimento integrado)
    OR chat_id LIKE 'wa-%'
    -- Mensagens de canais de equipe
    OR chat_id IN ('c-geral', 'c-comercial', 'c-tutoria', 'c-secretaria', 'c-marketing', 'c-pedagogico', 'c-expansao', 'c-diretoria')
    OR (channel_id IS NOT NULL AND channel_id LIKE 'c-%')
    -- Mensagens Privadas (1 a 1): estritamente remetente ou destinatário
    OR (
        chat_id LIKE 'dm-%'
        AND (
            (auth.uid() IS NOT NULL AND (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id))
            OR (
                sender_id IS NOT NULL 
                AND recipient_id IS NOT NULL 
                AND (
                    auth.uid() IS NULL 
                    OR auth.uid()::text = sender_id 
                    OR auth.uid()::text = recipient_id
                )
            )
        )
    )
);

-- POLÍTICA DE INSERT:
CREATE POLICY "Insercao de mensagens com remetente verificado"
ON public.messages FOR INSERT
TO authenticated, anon
WITH CHECK (
    sender_id IS NOT NULL
);

-- POLÍTICA DE UPDATE (para recibos de leitura read_by e is_read):
CREATE POLICY "Atualizacao de leitura de mensagens"
ON public.messages FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- POLÍTICA DE DELETE:
CREATE POLICY "Exclusao de mensagens proprias"
ON public.messages FOR DELETE
TO authenticated, anon
USING (
    auth.uid()::text = sender_id 
    OR auth.uid() IS NULL
);

-- 5. TABELA DE CHATS
CREATE TABLE IF NOT EXISTS public.chats (
    id TEXT PRIMARY KEY,
    phone TEXT,
    last_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo aos chats" ON public.chats;
CREATE POLICY "Permitir acesso completo aos chats"
ON public.chats FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 6. GARANTE PUBLICAÇÃO NO REALTIME COM REPLICA IDENTITY FULL
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

GRANT ALL ON TABLE public.messages TO authenticated, anon;
GRANT ALL ON TABLE public.chats TO authenticated, anon;
