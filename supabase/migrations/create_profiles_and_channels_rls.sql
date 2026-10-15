-- ========================================================
-- EDUCHAT: ESTRUTURA DE PERFIS, COLABORADORES E CANAIS COM RLS
-- Permite leitura de canais e colegas para todos os usuários
-- (inclusive consultores sem privilégio de admin, como Gabriel Carvalho)
-- ========================================================

-- 1. TABELA DE PERFIS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    role_type VARCHAR(20) DEFAULT 'colaborador' CHECK (role_type IN ('diretor', 'colaborador', 'bot')),
    avatar TEXT DEFAULT '👤',
    online BOOLEAN DEFAULT true,
    department VARCHAR(50) DEFAULT 'Geral',
    is_bot BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE COLABORADORES (COLLABORATORS)
CREATE TABLE IF NOT EXISTS public.collaborators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    role_type VARCHAR(20) DEFAULT 'colaborador' CHECK (role_type IN ('diretor', 'colaborador', 'bot')),
    avatar TEXT DEFAULT '👤',
    online BOOLEAN DEFAULT true,
    department VARCHAR(50) DEFAULT 'Geral',
    is_bot BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE CANAIS (CHANNELS)
CREATE TABLE IF NOT EXISTS public.channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    department VARCHAR(50) DEFAULT 'Todos',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================
-- HABILITAÇÃO SEGURA DE RLS (SEM FALHAR POR PRIVILÉGIOS)
-- ========================================================
DO $$
BEGIN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ========================================================
-- POLÍTICAS DE ACESSO (RLS) PARA LEITURA TOTAL (SELECT)
-- Garante que Gabriel Carvalho e qualquer membro possam
-- listar canais e colegas na Equipe Interna sem bloqueios
-- ========================================================

-- Políticas para profiles
DROP POLICY IF EXISTS "Permitir leitura de perfis para todos" ON public.profiles;
CREATE POLICY "Permitir leitura de perfis para todos"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de perfis" ON public.profiles;
CREATE POLICY "Permitir insercao de perfis"
ON public.profiles FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de perfis" ON public.profiles;
CREATE POLICY "Permitir atualizacao de perfis"
ON public.profiles FOR UPDATE
USING (true);

-- Políticas para collaborators
DROP POLICY IF EXISTS "Permitir leitura de colaboradores para todos" ON public.collaborators;
CREATE POLICY "Permitir leitura de colaboradores para todos"
ON public.collaborators FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de colaboradores" ON public.collaborators;
CREATE POLICY "Permitir insercao de colaboradores"
ON public.collaborators FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de colaboradores" ON public.collaborators;
CREATE POLICY "Permitir atualizacao de colaboradores"
ON public.collaborators FOR UPDATE
USING (true);

-- Políticas para channels
DROP POLICY IF EXISTS "Permitir leitura de canais para todos" ON public.channels;
CREATE POLICY "Permitir leitura de canais para todos"
ON public.channels FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de canais" ON public.channels;
CREATE POLICY "Permitir insercao de canais"
ON public.channels FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de canais" ON public.channels;
CREATE POLICY "Permitir atualizacao de canais"
ON public.channels FOR UPDATE
USING (true);

-- ========================================================
-- CARGA INICIAL DE COLABORADORES DA EQUIPE
-- ========================================================
INSERT INTO public.profiles (id, name, email, role, role_type, avatar, online, department, is_bot)
VALUES
  ('u1', 'Flávio Motta', 'flavio@educhat.com', 'Diretor Executivo / Gestor Geral', 'diretor', '👨‍💼', true, 'Diretoria', false),
  ('u2', 'Tatiane Salatinos', 'tati2009tati@gmail.com', 'Comercial & Matrículas', 'colaborador', '👩‍💼', true, 'Comercial', false),
  ('u3', 'Gabriel Carvalho', 'gahenriquecamargo@gmail.com', 'Comercial & Vendas', 'colaborador', '👨‍💼', true, 'Comercial', false),
  ('u4', 'Michele Cristina', 'migp1308@gmail.com', 'Comercial & Atendimento', 'colaborador', '👩‍💻', true, 'Comercial', false),
  ('u5', 'Clarice Oliveira', 'claricealvespj23@gmail.com', 'Comercial & Suporte', 'colaborador', '👩‍💼', true, 'Comercial', false),
  ('u6', 'Raquel Lopes', 'raquelcarmodo@gmail.com', 'Tutoria Acadêmica', 'colaborador', '👩‍🏫', true, 'Tutoria', false),
  ('u7', 'Ana Paula', 'paula.estudemais@gmail.com', 'Secretaria Acadêmica', 'colaborador', '👩‍💼', true, 'Secretaria', false),
  ('u8', 'Larissa Machado', 'larissa.machado30089@gmail.com', 'Secretaria & Documentos', 'colaborador', '👩‍💻', true, 'Secretaria', false),
  ('u9', 'Gislaine Santos', 'giih.5569@gmail.com', 'Secretaria & Diplomas', 'colaborador', '👩‍💼', true, 'Secretaria', false),
  ('u10', 'Ana Livia', 'analiviamarquesribeiro@gmail.com', 'Marketing & Comunicação', 'colaborador', '👩‍🎨', true, 'Marketing', false),
  ('u11', 'Paulo do Vale', 'paulos.dovale@gmail.com', 'Coordenação Pedagógica', 'colaborador', '👨‍🏫', true, 'Pedagógico', false),
  ('u12', 'Luiz Augusto', 'luizdomingues08844@gmail.com', 'Expansão & Parcerias de Polos', 'colaborador', '👨‍💼', true, 'Expansão', false),
  ('u_ia_copilot', 'Assistente IA (MEC & Processos)', 'ia@educhat.internal', 'Inteligência Artificial Institucional', 'bot', '🤖', true, 'Inteligência Artificial', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.collaborators (id, name, email, role, role_type, avatar, online, department, is_bot)
VALUES
  ('u1', 'Flávio Motta', 'flavio@educhat.com', 'Diretor Executivo / Gestor Geral', 'diretor', '👨‍💼', true, 'Diretoria', false),
  ('u2', 'Tatiane Salatinos', 'tati2009tati@gmail.com', 'Comercial & Matrículas', 'colaborador', '👩‍💼', true, 'Comercial', false),
  ('u3', 'Gabriel Carvalho', 'gahenriquecamargo@gmail.com', 'Comercial & Vendas', 'colaborador', '👨‍💼', true, 'Comercial', false),
  ('u4', 'Michele Cristina', 'migp1308@gmail.com', 'Comercial & Atendimento', 'colaborador', '👩‍💻', true, 'Comercial', false),
  ('u5', 'Clarice Oliveira', 'claricealvespj23@gmail.com', 'Comercial & Suporte', 'colaborador', '👩‍💼', true, 'Comercial', false),
  ('u6', 'Raquel Lopes', 'raquelcarmodo@gmail.com', 'Tutoria Acadêmica', 'colaborador', '👩‍🏫', true, 'Tutoria', false),
  ('u7', 'Ana Paula', 'paula.estudemais@gmail.com', 'Secretaria Acadêmica', 'colaborador', '👩‍💼', true, 'Secretaria', false),
  ('u8', 'Larissa Machado', 'larissa.machado30089@gmail.com', 'Secretaria & Documentos', 'colaborador', '👩‍💻', true, 'Secretaria', false),
  ('u9', 'Gislaine Santos', 'giih.5569@gmail.com', 'Secretaria & Diplomas', 'colaborador', '👩‍💼', true, 'Secretaria', false),
  ('u10', 'Ana Livia', 'analiviamarquesribeiro@gmail.com', 'Marketing & Comunicação', 'colaborador', '👩‍🎨', true, 'Marketing', false),
  ('u11', 'Paulo do Vale', 'paulos.dovale@gmail.com', 'Coordenação Pedagógica', 'colaborador', '👨‍🏫', true, 'Pedagógico', false),
  ('u12', 'Luiz Augusto', 'luizdomingues08844@gmail.com', 'Expansão & Parcerias de Polos', 'colaborador', '👨‍💼', true, 'Expansão', false),
  ('u_ia_copilot', 'Assistente IA (MEC & Processos)', 'ia@educhat.internal', 'Inteligência Artificial Institucional', 'bot', '🤖', true, 'Inteligência Artificial', true)
ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- CARGA INICIAL DE CANAIS OPERACIONAIS
-- ========================================================
INSERT INTO public.channels (id, name, description, department)
VALUES
  ('c-geral', 'geral', 'Comunicados oficiais e avisos gerais para toda a equipe', 'Todos'),
  ('c-comercial', 'comercial', 'Atendimentos, negociações e matrículas', 'Comercial'),
  ('c-tutoria', 'tutoria', 'Acompanhamento e suporte acadêmico aos alunos', 'Tutoria'),
  ('c-secretaria', 'secretaria', 'Processos, documentação, históricos e certidões', 'Secretaria'),
  ('c-marketing', 'marketing', 'Campanhas, captação de leads, mídias e comunicação', 'Marketing'),
  ('c-pedagogico', 'pedagogico', 'Conteúdos, matrizes curriculares e professores', 'Pedagógico'),
  ('c-expansao', 'expansao', 'Novos polos, parceiros e crescimento institucional', 'Expansão'),
  ('c-diretoria', 'diretoria', 'Alinhamentos executivos e decisões estratégicas', 'Diretoria')
ON CONFLICT (id) DO NOTHING;
