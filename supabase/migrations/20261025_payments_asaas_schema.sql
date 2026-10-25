-- =========================================================================
-- MIGRAÇÃO: MÓDULO FINANCEIRO & INTEGRAÇÃO ASAAS (SPRINT 3.1)
-- Projeto: EduChat / EduControl
-- Tabela: public.payments & View public.pagamentos
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY DEFAULT ('pay_' || replace(gen_random_uuid()::text, '-', '')),
    academic_process_id TEXT REFERENCES public.academic_processes(id) ON DELETE SET NULL,
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    hub_id TEXT REFERENCES public.hubs(id) ON DELETE SET NULL,
    
    -- Identificadores Oficiais do Asaas
    asaas_payment_id TEXT UNIQUE,
    asaas_customer_id TEXT,
    asaas_invoice_url TEXT,
    asaas_bank_slip_url TEXT,
    asaas_pix_qrcode_url TEXT,
    asaas_pix_payload TEXT,
    
    -- Modalidade e Status
    billing_type TEXT NOT NULL DEFAULT 'PIX', -- PIX, BOLETO, CREDIT_CARD, UNDEFINED
    status TEXT NOT NULL DEFAULT 'PENDING',    -- PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, CANCELLED
    
    -- Valores e Regra de Split
    valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    valor_liquido NUMERIC(10, 2),
    percentual_split_polo NUMERIC(5, 2) DEFAULT 0.00,
    valor_split_polo NUMERIC(10, 2) DEFAULT 0.00,
    asaas_wallet_id_polo TEXT,
    
    -- Prazos e Liquidação
    data_vencimento DATE,
    data_pagamento TIMESTAMPTZ,
    descricao TEXT,
    
    -- Auditoria
    created_by_id TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_payments_academic_process ON public.payments(academic_process_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_hub ON public.payments(hub_id);
CREATE INDEX IF NOT EXISTS idx_payments_asaas_id ON public.payments(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Desativa RLS para livre leitura operacional autenticada
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Permissões Totais para os papéis de serviço e aplicação
GRANT ALL ON public.payments TO anon, authenticated, service_role;

-- Vista Semântica em Português para paridade com o Cérebro Único e Tools da IA
CREATE OR REPLACE VIEW public.pagamentos AS
SELECT 
    id,
    academic_process_id AS processo_id,
    student_id AS aluno_id,
    hub_id AS polo_id,
    asaas_payment_id,
    asaas_customer_id,
    asaas_invoice_url AS url_fatura,
    asaas_bank_slip_url AS url_boleto,
    asaas_pix_qrcode_url AS url_qrcode_pix,
    asaas_pix_payload AS codigo_pix_copia_cola,
    billing_type AS forma_cobranca,
    status,
    valor_total,
    valor_liquido,
    percentual_split_polo,
    valor_split_polo,
    asaas_wallet_id_polo AS carteira_polo_id,
    data_vencimento,
    data_pagamento,
    descricao,
    created_by_id,
    created_date,
    updated_date
FROM public.payments;

GRANT ALL ON public.pagamentos TO anon, authenticated, service_role;
