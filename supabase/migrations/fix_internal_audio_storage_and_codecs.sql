-- ========================================================
-- EDUCHAT: CORREÇÃO DE POLÍTICAS DE STORAGE PARA ÁUDIO INTERNO
-- Garante leitura e upload com suporte irrestrito a codecs
-- (WebM Opus, MP4, AAC, OGG, WAV) para usuários autenticados e anônimos
-- ========================================================

-- 1. Garante que o bucket 'chat-audios' é público e aceita qualquer codec de áudio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat-audios', 'chat-audios', true, 52428800, NULL),
  ('chat-attachments', 'chat-attachments', true, 104857600, NULL),
  ('attachments', 'attachments', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = NULL,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Limpeza de políticas prévias
DROP POLICY IF EXISTS "Permitir leitura publica de anexos e audios" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao de arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao de arquivos" ON storage.objects;

-- 3. POLÍTICA DE LEITURA (SELECT): Qualquer usuário autenticado (ou anônimo do frontend) pode ler os áudios
CREATE POLICY "Permitir leitura publica de anexos e audios"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- 4. POLÍTICA DE UPLOAD (INSERT): Permite gravação e envio de áudios e anexos
CREATE POLICY "Permitir upload para usuarios autenticados"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- 5. POLÍTICA DE ATUALIZAÇÃO (UPDATE)
CREATE POLICY "Permitir atualizacao de arquivos"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));

-- 6. POLÍTICA DE EXCLUSÃO (DELETE)
CREATE POLICY "Permitir exclusao de arquivos"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id IN ('chat-audios', 'chat-attachments', 'attachments'));
