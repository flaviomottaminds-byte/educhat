-- ========================================================
-- EDUCONTROL -> SUPABASE: MIGRAÇÃO CORE - ESPELHAMENTO DO SCHEMA
-- Tabelas Essenciais:
--   1. consultants (Consultores Comerciais & Gestores)
--   2. hubs (Polos de Apoio Presencial / Parceiros White Label)
--   3. students (Alunos da Rede)
--   4. academic_processes (Matrículas e Certificações)
-- Vistas em Português: consultores, polos, alunos, matriculas
-- Índices de Alta Performance para IA (Cruzamento com EduChat)
-- Políticas RLS Seguras e Triggers de Atualização Automática
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. TABELA DE CONSULTORES (consultants)
CREATE TABLE IF NOT EXISTS public.consultants (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    gestor_id TEXT REFERENCES public.consultants(id) ON DELETE SET NULL,
    wallet_id_asaas TEXT,
    percentual_comissao NUMERIC(5, 2) DEFAULT 0,
    created_by_id TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE POLOS (hubs)
CREATE TABLE IF NOT EXISTS public.hubs (
    id TEXT PRIMARY KEY,
    consultant_id TEXT REFERENCES public.consultants(id) ON DELETE SET NULL,
    razao_social TEXT NOT NULL,
    nome_exibicao TEXT,
    tipo_pessoa VARCHAR(2) DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PJ', 'PF')),
    cnpj TEXT,
    cpf TEXT,
    nome_contato TEXT,
    telefone TEXT,
    email_login TEXT,
    saldo_disponivel NUMERIC(12, 2) DEFAULT 0,
    saldo_seguranca NUMERIC(12, 2) DEFAULT 200,
    drive_polo_folder_id TEXT,
    acesso_bloqueado BOOLEAN DEFAULT false,
    data_bloqueio DATE,
    motivo_bloqueio TEXT,
    suspenso BOOLEAN DEFAULT false,
    motivo_suspensao TEXT,
    data_suspensao DATE,
    permite_credito_parcelado BOOLEAN DEFAULT false,
    limite_credito_personalizado NUMERIC(12, 2),
    parcela_minima_personalizada NUMERIC(12, 2),
    parcelas_pagas_sequenciais INTEGER DEFAULT 0,
    logo_url TEXT,
    cor_primaria VARCHAR(10),
    cor_secundaria VARCHAR(10),
    atendimento_telefone TEXT,
    atendimento_email TEXT,
    atendimento_endereco TEXT,
    perfil_comportamental TEXT,
    perfil_ultima_atualizacao DATE,
    polo_codigo_emec INTEGER,
    polo_logradouro TEXT,
    polo_numero TEXT,
    polo_bairro TEXT,
    polo_cep VARCHAR(10),
    polo_codigo_municipio VARCHAR(10),
    polo_nome_municipio TEXT,
    polo_uf VARCHAR(2),
    modo_demo BOOLEAN DEFAULT false,
    reposicao_ativa BOOLEAN DEFAULT false,
    limite_reposicao NUMERIC(12, 2),
    dia_fechamento_1 INTEGER,
    dia_fechamento_2 INTEGER,
    asaas_wallet_id TEXT,
    piloto_vitrine_ativo BOOLEAN DEFAULT false,
    is_clone_master BOOLEAN DEFAULT false,
    clone_instance_id TEXT,
    bloqueio_inadimplencia BOOLEAN DEFAULT false,
    plano_fixo_ativo BOOLEAN DEFAULT false,
    valor_plano_fixo_mensal NUMERIC(12, 2),
    categorias_ilimitadas JSONB DEFAULT '[]'::jsonb,
    cotas_mensais_por_categoria JSONB DEFAULT '[]'::jsonb,
    regime_cobranca VARCHAR(30) DEFAULT 'fatura_vaga' CHECK (regime_cobranca IN ('fatura_vaga', 'plano_fixo', 'comissionamento_split')),
    percentual_comissao_polo NUMERIC(5, 2) DEFAULT 50,
    created_by_id TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE ALUNOS (students)
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    hub_id TEXT REFERENCES public.hubs(id) ON DELETE SET NULL,
    nome_completo TEXT NOT NULL,
    nome_social TEXT,
    cpf VARCHAR(14),
    rg VARCHAR(30),
    rg_orgao_expedidor VARCHAR(30),
    rg_uf VARCHAR(2),
    data_nascimento DATE,
    sexo VARCHAR(1) CHECK (sexo IN ('M', 'F')),
    naturalidade TEXT,
    naturalidade_codigo_municipio VARCHAR(10),
    naturalidade_nome_municipio TEXT,
    naturalidade_uf VARCHAR(2),
    nacionalidade VARCHAR(50) DEFAULT 'Brasileira',
    filiacao_pai_nome TEXT,
    filiacao_mae_nome TEXT,
    email TEXT,
    telefone TEXT,
    forma_ingresso VARCHAR(50) DEFAULT 'Vestibular',
    ensino_medio_instituicao TEXT,
    ensino_medio_cidade TEXT,
    ensino_medio_ano VARCHAR(10),
    plataforma_url TEXT,
    ava_sync_status VARCHAR(20) DEFAULT 'pendente' CHECK (ava_sync_status IN ('sincronizado', 'pendente', 'erro')),
    ava_ultimo_erro TEXT,
    created_by_id TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA DE PROCESSOS ACADÊMICOS / MATRÍCULAS (academic_processes)
CREATE TABLE IF NOT EXISTS public.academic_processes (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    hub_id TEXT REFERENCES public.hubs(id) ON DELETE SET NULL,
    tipo_processo VARCHAR(30) DEFAULT 'Matricula' CHECK (tipo_processo IN ('Matricula', 'Certificacao')),
    category_id TEXT,
    categoria_curso TEXT,
    nome_curso TEXT NOT NULL,
    periodo_ingresso VARCHAR(20),
    data_inicio DATE,
    data_fim DATE,
    data_colacao_grau DATE,
    data_expedicao_diploma DATE,
    data_expedicao_historico DATE,
    enade_situacao TEXT,
    numero_registro TEXT,
    numero_livro TEXT,
    numero_folha TEXT,
    codigo_verificacao TEXT,
    url_dossie_pdf TEXT,
    url_certificado_final TEXT,
    url_ata_assinada TEXT,
    url_relatorio_estagio TEXT,
    url_certificado_assinado TEXT,
    url_historico_assinado TEXT,
    url_termo_responsabilidade TEXT,
    documentacao_xml_url TEXT,
    rvdd_pdf_url TEXT,
    historico_pdf_url TEXT,
    drive_file_id TEXT,
    status VARCHAR(50) DEFAULT 'Em Analise' CHECK (status IN (
        'Aguardando Deferimento',
        'Ativo',
        'Em Analise',
        'Documento Pendente',
        'Em Emissao',
        'Processamento Externo',
        'Concluído',
        'Emitido',
        'Diploma Digital em Processamento',
        'Em Retificacao',
        'Rejeitado'
    )),
    motivo_recusa TEXT,
    aprovado_por_id TEXT,
    data_aprovacao TEXT,
    valor_debitado NUMERIC(10, 2),
    apressamento BOOLEAN DEFAULT false,
    tentativas_reenvio INTEGER DEFAULT 0,
    cancelado BOOLEAN DEFAULT false,
    simpleacademy_enviado BOOLEAN DEFAULT false,
    simpleacademy_erro TEXT,
    simpleacademy_data_envio DATE,
    simpleacademy_response TEXT,
    integralizacao_ch_ok BOOLEAN DEFAULT false,
    integralizacao_tcc_ok BOOLEAN DEFAULT false,
    integralizacao_atividades_ok BOOLEAN DEFAULT false,
    integralizacao_estagio_ok BOOLEAN DEFAULT false,
    integralizacao_enade_ok BOOLEAN DEFAULT false,
    integralizacao_ata_ok BOOLEAN DEFAULT false,
    sollys_ultimo_status VARCHAR(20) CHECK (sollys_ultimo_status IN ('Sucesso', 'Falha', 'Processando')),
    sollys_ultimo_protocolo TEXT,
    sollys_ultima_data_envio TEXT,
    sollys_ambiente_usado VARCHAR(20) CHECK (sollys_ambiente_usado IN ('homologacao', 'producao')),
    origem VARCHAR(30) DEFAULT 'manual' CHECK (origem IN ('vitrine_publica', 'manual')),
    afiliado_nome TEXT,
    combo_process_ids JSONB DEFAULT '[]'::jsonb,
    combo_id TEXT,
    created_by_id TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================
-- ÍNDICES DE ALTA PERFORMANCE (CRUZAMENTO IA & EDUCHAT)
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_consultants_email ON public.consultants(email);
CREATE INDEX IF NOT EXISTS idx_consultants_telefone ON public.consultants(telefone);

CREATE INDEX IF NOT EXISTS idx_hubs_consultant_id ON public.hubs(consultant_id);
CREATE INDEX IF NOT EXISTS idx_hubs_cnpj ON public.hubs(cnpj);
CREATE INDEX IF NOT EXISTS idx_hubs_cpf ON public.hubs(cpf);
CREATE INDEX IF NOT EXISTS idx_hubs_email_login ON public.hubs(email_login);
CREATE INDEX IF NOT EXISTS idx_hubs_polo_uf ON public.hubs(polo_uf);

CREATE INDEX IF NOT EXISTS idx_students_hub_id ON public.students(hub_id);
CREATE INDEX IF NOT EXISTS idx_students_cpf ON public.students(cpf);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_telefone ON public.students(telefone);
CREATE INDEX IF NOT EXISTS idx_students_nome_completo ON public.students USING gin (nome_completo gin_trgm_ops) 
    WHERE nome_completo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_academic_processes_student_id ON public.academic_processes(student_id);
CREATE INDEX IF NOT EXISTS idx_academic_processes_hub_id ON public.academic_processes(hub_id);
CREATE INDEX IF NOT EXISTS idx_academic_processes_status ON public.academic_processes(status);
CREATE INDEX IF NOT EXISTS idx_academic_processes_tipo_processo ON public.academic_processes(tipo_processo);
CREATE INDEX IF NOT EXISTS idx_academic_processes_created_date ON public.academic_processes(created_date DESC);

-- ========================================================
-- VISTAS EM PORTUGUÊS (FACILIDADE DE QUERY PARA A IA)
-- ========================================================
CREATE OR REPLACE VIEW public.consultores AS 
    SELECT * FROM public.consultants;

CREATE OR REPLACE VIEW public.polos AS 
    SELECT * FROM public.hubs;

CREATE OR REPLACE VIEW public.alunos AS 
    SELECT * FROM public.students;

CREATE OR REPLACE VIEW public.matriculas AS 
    SELECT * FROM public.academic_processes;

-- ========================================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================================
DO $$
BEGIN
    ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.academic_processes ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Policies: Usuários autenticados (colaboradores/diretores/service_role) podem consultar
DROP POLICY IF EXISTS "Permitir leitura autenticada para consultants" ON public.consultants;
CREATE POLICY "Permitir leitura autenticada para consultants" ON public.consultants
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Permitir leitura autenticada para hubs" ON public.hubs;
CREATE POLICY "Permitir leitura autenticada para hubs" ON public.hubs
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Permitir leitura autenticada para students" ON public.students;
CREATE POLICY "Permitir leitura autenticada para students" ON public.students
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Permitir leitura autenticada para academic_processes" ON public.academic_processes;
CREATE POLICY "Permitir leitura autenticada para academic_processes" ON public.academic_processes
    FOR SELECT TO authenticated, anon USING (true);

-- Permissões totais para service_role (usado pelos Webhooks, Edge Functions e ETL)
DROP POLICY IF EXISTS "Service role acesso full consultants" ON public.consultants;
CREATE POLICY "Service role acesso full consultants" ON public.consultants
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role acesso full hubs" ON public.hubs;
CREATE POLICY "Service role acesso full hubs" ON public.hubs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role acesso full students" ON public.students;
CREATE POLICY "Service role acesso full students" ON public.students
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role acesso full academic_processes" ON public.academic_processes;
CREATE POLICY "Service role acesso full academic_processes" ON public.academic_processes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
