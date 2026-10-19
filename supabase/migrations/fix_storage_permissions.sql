-- ========================================================
-- EDUCHAT: CORREÇÃO DE PERMISSÕES DE STORAGE (ÁUDIO E ANEXOS)
-- Sistema: EduChat (Supabase Storage RLS)
-- ========================================================

-- 1. Criação/Garantia dos Buckets de Armazenamento
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat-audios', 'chat-audios', true, 52428800, NULL),
  ('chat-attachments', 'chat-attachments', true, 104857600, NULL),
  ('attachments', 'attachments', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = NULL,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. RLS em storage.objects já vem habilitado por padrão no Supabase (não requer ALTER TABLE)
-- (Evita erro 42501: must be owner of table objects)

-- 3. Remoção de políticas restritivas antigas que limitavam a administradores
DROP POLICY IF EXISTS "Permitir upload para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura publica de anexos e audios" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Admin full access storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

-- 4. POLÍTICA DE LEITURA (SELECT): Todos os usuários autenticados e anônimos podem ler/baixar áudios e anexos
CREATE POLICY "Permitir leitura publica de anexos e audios"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- 5. POLÍTICA DE UPLOAD (INSERT): Todos os usuários autenticados e anônimos (EduChat) podem enviar áudios e arquivos
CREATE POLICY "Permitir upload para usuarios autenticados"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- 6. POLÍTICA DE ATUALIZAÇÃO (UPDATE): Permite sobrescrever/atualizar arquivos nos buckets de chat
CREATE POLICY "Permitir atualizacao de arquivos"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- 7. POLÍTICA DE EXCLUSÃO (DELETE): Permite deletar arquivos
CREATE POLICY "Permitir exclusao de arquivos"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- ========================================================
-- GARANTIR PERMISSÃO NA TABELA 'messages' PARA NÃO-ADMINS
-- ========================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de mensagens para todos" ON public.messages;
CREATE POLICY "Permitir leitura de mensagens para todos"
ON public.messages FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Permitir envio de mensagens para todos" ON public.messages;
CREATE POLICY "Permitir envio de mensagens para todos"
ON public.messages FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de status de mensagens" ON public.messages;
CREATE POLICY "Permitir atualizacao de status de mensagens"
ON public.messages FOR UPDATE
TO authenticated, anon
USING (true);
