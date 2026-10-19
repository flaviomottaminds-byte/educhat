-- ========================================================
-- EDUCHAT: CORREÇÃO DEFINITIVA DE PERSISTÊNCIA E RLS
-- Tabela: public.messages
-- Buckets: chat-audios, chat-attachments, attachments
-- Garante permissões irrestritas de INSERT, SELECT, UPDATE, DELETE
-- para as roles 'authenticated' e 'anon' (cliente web)
-- ========================================================

-- 1. GARANTE RLS HABILITADO E POLÍTICAS IRRESTRITAS NA TABELA 'messages'
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Remove quaisquer políticas antigas restritivas
DROP POLICY IF EXISTS "Permitir leitura de mensagens para todos" ON public.messages;
DROP POLICY IF EXISTS "Permitir envio de mensagens para todos" ON public.messages;
DROP POLICY IF EXISTS "Permitir atualizacao de status de mensagens" ON public.messages;
DROP POLICY IF EXISTS "Permitir exclusao de mensagens para todos" ON public.messages;
DROP POLICY IF EXISTS "Permitir tudo em messages para todos" ON public.messages;
DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.messages;

-- Cria políticas explícitas e permissivas para cada operação
CREATE POLICY "Permitir leitura de mensagens para todos"
ON public.messages FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Permitir envio de mensagens para todos"
ON public.messages FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Permitir atualizacao de status de mensagens"
ON public.messages FOR UPDATE
TO authenticated, anon
USING (true);

CREATE POLICY "Permitir exclusao de mensagens para todos"
ON public.messages FOR DELETE
TO authenticated, anon
USING (true);

-- Concede privilégios SQL nas tabelas para as roles do Supabase
GRANT ALL ON TABLE public.messages TO authenticated, anon;
GRANT ALL ON TABLE public.channels TO authenticated, anon;
GRANT ALL ON TABLE public.collaborators TO authenticated, anon;
GRANT ALL ON TABLE public.profiles TO authenticated, anon;

-- 2. GARANTE CONFIGURAÇÃO DOS BUCKETS DO STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat-audios', 'chat-audios', true, 52428800, NULL),
  ('chat-attachments', 'chat-attachments', true, 104857600, NULL),
  ('attachments', 'attachments', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = NULL,
  file_size_limit = EXCLUDED.file_size_limit;

-- 3. POLÍTICAS RLS NO STORAGE (storage.objects)
DROP POLICY IF EXISTS "Permitir leitura publica de anexos e audios" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Storage full access for chat buckets" ON storage.objects;

CREATE POLICY "Permitir leitura publica de anexos e audios"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

CREATE POLICY "Permitir upload para usuarios autenticados"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

CREATE POLICY "Permitir atualizacao de arquivos"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

CREATE POLICY "Permitir exclusao de arquivos"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

GRANT ALL ON TABLE storage.objects TO authenticated, anon;
GRANT ALL ON TABLE storage.buckets TO authenticated, anon;
