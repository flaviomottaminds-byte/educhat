// =========================================================================
// SUPABASE EDGE FUNCTION: BASE44 SYNC (Espelhamento em Tempo Real)
// Endpoint: /functions/v1/base44-sync
// Recebe Webhooks da Base44 (Create/Update) e faz upsert instantâneo
// nas tabelas public.students, public.hubs, public.academic_processes e public.consultants
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-base44-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

// Whitelists das colunas no PostgreSQL
const TABLE_COLUMNS: Record<string, string[]> = {
  consultants: [
    "id", "nome", "email", "telefone", "gestor_id", "wallet_id_asaas",
    "percentual_comissao", "created_by_id", "created_date", "updated_date"
  ],
  hubs: [
    "id", "consultant_id", "razao_social", "nome_exibicao", "tipo_pessoa",
    "cnpj", "cpf", "nome_contato", "telefone", "email_login", "saldo_disponivel",
    "saldo_seguranca", "drive_polo_folder_id", "acesso_bloqueado", "data_bloqueio",
    "motivo_bloqueio", "suspenso", "motivo_suspensao", "data_suspensao",
    "permite_credito_parcelado", "limite_credito_personalizado",
    "parcela_minima_personalizada", "parcelas_pagas_sequenciais", "logo_url",
    "cor_primaria", "cor_secundaria", "atendimento_telefone", "atendimento_email",
    "atendimento_endereco", "perfil_comportamental", "perfil_ultima_atualizacao",
    "polo_codigo_emec", "polo_logradouro", "polo_numero", "polo_bairro",
    "polo_cep", "polo_codigo_municipio", "polo_nome_municipio", "polo_uf",
    "modo_demo", "reposicao_ativa", "limite_reposicao", "dia_fechamento_1",
    "dia_fechamento_2", "asaas_wallet_id", "piloto_vitrine_ativo",
    "is_clone_master", "clone_instance_id", "bloqueio_inadimplencia",
    "plano_fixo_ativo", "valor_plano_fixo_mensal", "categorias_ilimitadas",
    "cotas_mensais_por_categoria", "regime_cobranca", "percentual_comissao_polo",
    "created_by_id", "created_date", "updated_date"
  ],
  students: [
    "id", "hub_id", "nome_completo", "nome_social", "cpf", "rg",
    "rg_orgao_expedidor", "rg_uf", "data_nascimento", "sexo", "naturalidade",
    "naturalidade_codigo_municipio", "naturalidade_nome_municipio",
    "naturalidade_uf", "nacionalidade", "filiacao_pai_nome", "filiacao_mae_nome",
    "email", "telefone", "forma_ingresso", "ensino_medio_instituicao",
    "ensino_medio_cidade", "ensino_medio_ano", "plataforma_url",
    "ava_sync_status", "ava_ultimo_erro", "created_by_id", "created_date",
    "updated_date"
  ],
  academic_processes: [
    "id", "student_id", "hub_id", "tipo_processo", "category_id",
    "categoria_curso", "nome_curso", "periodo_ingresso", "data_inicio",
    "data_fim", "data_colacao_grau", "data_expedicao_diploma",
    "data_expedicao_historico", "enade_situacao", "numero_registro",
    "numero_livro", "numero_folha", "codigo_verificacao", "url_dossie_pdf",
    "url_certificado_final", "url_ata_assinada", "url_relatorio_estagio",
    "url_certificado_assinado", "url_historico_assinado",
    "url_termo_responsabilidade", "documentacao_xml_url", "rvdd_pdf_url",
    "historico_pdf_url", "drive_file_id", "status", "motivo_recusa",
    "aprovado_por_id", "data_aprovacao", "valor_debitado", "apressamento",
    "tentativas_reenvio", "cancelado", "simpleacademy_enviado",
    "simpleacademy_erro", "simpleacademy_data_envio", "simpleacademy_response",
    "integralizacao_ch_ok", "integralizacao_tcc_ok",
    "integralizacao_atividades_ok", "integralizacao_estagio_ok",
    "integralizacao_enade_ok", "integralizacao_ata_ok", "sollys_ultimo_status",
    "sollys_ultimo_protocolo", "sollys_ultima_data_envio",
    "sollys_ambiente_usado", "origem", "afiliado_nome", "combo_process_ids",
    "combo_id", "created_by_id", "created_date", "updated_date"
  ]
};

// Mapeamento polimórfico de nomes de entidade da Base44 para a tabela Supabase
function resolveTargetTable(rawEntity: string): string | null {
  const norm = (rawEntity || "").toLowerCase().trim();
  if (norm === "student" || norm === "students" || norm === "aluno" || norm === "alunos") return "students";
  if (norm === "hub" || norm === "hubs" || norm === "polo" || norm === "polos") return "hubs";
  if (norm === "academicprocess" || norm === "academic_process" || norm === "processo" || norm === "matricula" || norm === "matriculas") return "academic_processes";
  if (norm === "consultant" || norm === "consultants" || norm === "consultor" || norm === "consultores") return "consultants";
  return null;
}

// Sanitização estrita do registro para conformidade PostgreSQL PostgREST
function cleanRecord(table: string, rawRecord: Record<string, any>): Record<string, any> {
  const allowed = TABLE_COLUMNS[table] || [];
  const cleaned: Record<string, any> = {};

  for (const col of allowed) {
    let value = rawRecord[col] !== undefined ? rawRecord[col] : null;

    // Normaliza strings vazias para null
    if (typeof value === "string" && value.trim() === "") {
      value = null;
    }

    cleaned[col] = value;
  }

  // Garante timestamps de auditoria para evitar violação de not-null em novos registros
  if (!cleaned.created_date) {
    cleaned.created_date = new Date().toISOString();
  }
  if (!cleaned.updated_date) {
    cleaned.updated_date = new Date().toISOString();
  }

  return cleaned;
}

serve(async (req: Request) => {
  // Trata preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Healthcheck GET
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "online",
        service: "base44-sync",
        description: "EduControl Base44 Webhook Sync Engine",
        target_database: "Supabase (yuhtzkhoxnabrsrhqdni)",
        supported_entities: ["Student", "Hub", "AcademicProcess", "Consultant"],
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const url = new URL(req.url);
    const queryEntity = url.searchParams.get("entity") || url.searchParams.get("entity_name") || "";

    const body = await req.json().catch(() => ({}));

    // Resolve entidade do payload ou query param
    const rawEntity =
      body.entity ||
      body.entity_name ||
      body.entityName ||
      body.event?.entity ||
      body.event_type?.split(".")[0] ||
      queryEntity;

    const targetTable = resolveTargetTable(rawEntity);

    if (!targetTable) {
      return new Response(
        JSON.stringify({
          error: "Entidade não reconhecida ou ausente no payload.",
          received_entity: rawEntity,
          hint: "Envie 'entity': 'Student' | 'Hub' | 'AcademicProcess' | 'Consultant' no body ou ?entity=Student na URL."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrai o registro de dados (suporta { data: {...} }, { record: {...} } ou body direto)
    const rawData = body.data || body.record || body.payload || body;
    const recordsToProcess: Record<string, any>[] = Array.isArray(rawData) ? rawData : [rawData];

    if (recordsToProcess.length === 0 || !recordsToProcess[0]?.id) {
      return new Response(
        JSON.stringify({
          error: "Nenhum registro com campo 'id' válido encontrado para sincronização.",
          hint: "O objeto de dados deve conter obrigatoriamente a chave primária 'id'."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanedBatch = recordsToProcess.map((rec) => cleanRecord(targetTable, rec));

    // Conexão com Supabase usando service_role para bypass de RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://yuhtzkhoxnabrsrhqdni.supabase.co";
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aHR6a2hveG5hYnJzcmhxZG5pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjAyMTI2MSwiZXhwIjoyMTA3NTk3MjYxfQ.-1Fp79lZTxLowQnKCyx9ZV3CgECBJTcWQ0aNhRlB31A";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabase
      .from(targetTable)
      .upsert(cleanedBatch, { onConflict: "id" })
      .select("id");

    if (error) {
      console.error(`[Base44 Sync Error] Erro ao sincronizar em ${targetTable}:`, error);
      return new Response(
        JSON.stringify({
          success: false,
          table: targetTable,
          error: error.message,
          code: error.code,
          details: error.details
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processedIds = (data || []).map((r) => r.id);
    console.log(`[Base44 Sync Success] ${processedIds.length} registro(s) sincronizado(s) em ${targetTable}:`, processedIds);

    return new Response(
      JSON.stringify({
        success: true,
        action: "upsert",
        table: targetTable,
        count: processedIds.length,
        ids: processedIds,
        synced_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Base44 Sync Exception]:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Erro interno no processamento do webhook"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
