-- ========================================================
-- EDUCHAT: CORREÇÃO DO TRIGGER DE NOTIFICAÇÕES EM CANAIS
-- Sistema: EduChat (Supabase Realtime & Triggers)
-- ========================================================

-- 1. Tabela de Membros de Canais (channel_members)
CREATE TABLE IF NOT EXISTS public.channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(channel_id, user_id)
);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de channel_members para todos" ON public.channel_members;
CREATE POLICY "Permitir leitura de channel_members para todos"
ON public.channel_members FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de channel_members" ON public.channel_members;
CREATE POLICY "Permitir gerenciamento de channel_members"
ON public.channel_members FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 2. Tabela de Notificações Unificada (notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,          -- Destinatário da notificação
    recipient_id TEXT,             -- Compatibilidade com legado
    sender_id TEXT,
    sender_name TEXT,
    chat_id TEXT NOT NULL,         -- Canal ('c-geral') ou DM ('dm-u1-u2')
    title TEXT NOT NULL,
    content TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de notificacoes pelo destinatario" ON public.notifications;
CREATE POLICY "Permitir leitura de notificacoes pelo destinatario"
ON public.notifications FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de notificacoes" ON public.notifications;
CREATE POLICY "Permitir insercao de notificacoes"
ON public.notifications FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de notificacoes" ON public.notifications;
CREATE POLICY "Permitir atualizacao de notificacoes"
ON public.notifications FOR UPDATE
TO authenticated, anon
USING (true);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_channel_members_lookup ON public.channel_members (channel_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read, created_at DESC);

-- 3. Carga Inicial de Membros dos Canais Institucionais (Garante que todos os membros recebam alertas)
-- c-geral: Toda a equipe
INSERT INTO public.channel_members (channel_id, user_id)
VALUES 
  ('c-geral', 'u1'), ('c-geral', 'u2'), ('c-geral', 'u3'), ('c-geral', 'u4'),
  ('c-geral', 'u5'), ('c-geral', 'u6'), ('c-geral', 'u7'), ('c-geral', 'u8'),
  ('c-geral', 'u9'), ('c-geral', 'u10'), ('c-geral', 'u11'), ('c-geral', 'u12'),
  ('geral', 'u1'), ('geral', 'u2'), ('geral', 'u3'), ('geral', 'u4'),
  ('geral', 'u5'), ('geral', 'u6'), ('geral', 'u7'), ('geral', 'u8'),
  ('geral', 'u9'), ('geral', 'u10'), ('geral', 'u11'), ('geral', 'u12'),
  -- c-comercial
  ('c-comercial', 'u1'), ('c-comercial', 'u2'), ('c-comercial', 'u3'), ('c-comercial', 'u4'), ('c-comercial', 'u5'),
  ('comercial', 'u1'), ('comercial', 'u2'), ('comercial', 'u3'), ('comercial', 'u4'), ('comercial', 'u5'),
  -- c-tutoria
  ('c-tutoria', 'u1'), ('c-tutoria', 'u6'),
  ('tutoria', 'u1'), ('tutoria', 'u6'),
  -- c-secretaria
  ('c-secretaria', 'u1'), ('c-secretaria', 'u7'), ('c-secretaria', 'u8'), ('c-secretaria', 'u9'),
  ('secretaria', 'u1'), ('secretaria', 'u7'), ('secretaria', 'u8'), ('secretaria', 'u9'),
  -- c-marketing
  ('c-marketing', 'u1'), ('c-marketing', 'u10'),
  ('marketing', 'u1'), ('marketing', 'u10'),
  -- c-pedagogico
  ('c-pedagogico', 'u1'), ('c-pedagogico', 'u11'),
  ('pedagogico', 'u1'), ('pedagogico', 'u11'),
  -- c-expansao
  ('c-expansao', 'u1'), ('c-expansao', 'u12'),
  ('expansao', 'u1'), ('expansao', 'u12'),
  -- c-diretoria
  ('c-diretoria', 'u1'),
  ('diretoria', 'u1')
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- 4. FUNÇÃO TRIGGER INTELIGENTE: Cruza mensagens de canais com channel_members
CREATE OR REPLACE FUNCTION public.fn_notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
    v_clean_text TEXT;
    v_title TEXT;
    v_channel_name TEXT;
    v_recipient TEXT;
    parts TEXT[];
BEGIN
    -- Limpa metadados e tags do texto da mensagem
    v_clean_text := regexp_replace(NEW.text, '<!-\-[\s\S]*?-\->', '', 'g');
    v_clean_text := regexp_replace(v_clean_text, '\[ARQUIVO_ANEXO:[\s\S]*?\]', '📎 [Arquivo Anexo]', 'g');
    v_clean_text := trim(v_clean_text);
    IF length(v_clean_text) > 90 THEN
        v_clean_text := substring(v_clean_text from 1 for 87) || '...';
    END IF;

    -- =========================================================================
    -- CASO 1: MENSAGEM DIRETA (DM / 1 a 1)
    -- =========================================================================
    IF NEW.chat_id LIKE 'dm-%' OR NEW.recipient_id IS NOT NULL THEN
        v_recipient := NEW.recipient_id;

        -- Extrai o destinatário a partir da chave dm-id1-id2 caso não venha na coluna
        IF v_recipient IS NULL AND NEW.chat_id LIKE 'dm-%' THEN
            parts := string_to_array(replace(NEW.chat_id, 'dm-', ''), '-');
            IF array_length(parts, 1) >= 2 THEN
                IF parts[1] = NEW.sender_id THEN
                    v_recipient := parts[2];
                ELSE
                    v_recipient := parts[1];
                END IF;
            END IF;
        END IF;

        IF v_recipient IS NOT NULL AND v_recipient <> NEW.sender_id THEN
            INSERT INTO public.notifications (
                user_id,
                recipient_id,
                sender_id,
                sender_name,
                chat_id,
                title,
                content,
                is_read,
                created_at
            ) VALUES (
                v_recipient,
                v_recipient,
                NEW.sender_id,
                NEW.sender_name,
                NEW.chat_id,
                'Nova mensagem de ' || COALESCE(NEW.sender_name, 'Colaborador'),
                COALESCE(v_clean_text, 'Nova mensagem recebida'),
                false,
                now()
            );
        END IF;

    -- =========================================================================
    -- CASO 2: MENSAGEM EM CANAL DE COMUNICAÇÃO (CORREÇÃO CRÍTICA DO BUG 3)
    -- Cruza a mensagem com channel_members e notifica TODOS os membros exceto o remetente
    -- =========================================================================
    ELSE
        v_channel_name := replace(replace(NEW.chat_id, 'c-', ''), '#', '');
        v_title := '#' || v_channel_name || ' • ' || COALESCE(NEW.sender_name, 'Colaborador');

        INSERT INTO public.notifications (
            user_id,
            recipient_id,
            sender_id,
            sender_name,
            chat_id,
            title,
            content,
            is_read,
            created_at
        )
        SELECT 
            cm.user_id,
            cm.user_id,
            NEW.sender_id,
            NEW.sender_name,
            NEW.chat_id,
            v_title,
            COALESCE(v_clean_text, 'Nova mensagem no canal #' || v_channel_name),
            false,
            now()
        FROM public.channel_members cm
        WHERE (cm.channel_id = NEW.chat_id OR cm.channel_id = v_channel_name OR cm.channel_id = 'c-' || v_channel_name)
          AND cm.user_id <> NEW.sender_id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Vinculação do Trigger na tabela de mensagens
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.messages;
CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_on_new_message();

-- 6. Habilitação de Realtime no Supabase para Notificações Instantâneas (Websockets)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignora se a publicação não estiver configurada no ambiente
END $$;
