/**
 * ETL EduControl (Base44 -> Supabase)
 * Extrai dados da Base44 via REST API e injeta no Supabase em ordem topológica.
 * Utiliza fetch nativo (Node 20+) com zero dependências externas.
 * 
 * Uso:
 *   node scripts/etl-base44-to-supabase.js --base44-key="SUA_CHAVE" [--dry-run] [--batch-size=100]
 */

const BASE44_API_URL = process.env.BASE44_API_URL || 'https://facobgestao.base44.app/api';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yuhtzkhoxnabrsrhqdni.supabase.co';

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v === undefined ? true : v;
  return acc;
}, {});

const BASE44_API_KEY = process.env.BASE44_API_KEY || args['base44-key'];
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aHR6a2hveG5hYnJzcmhxZG5pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjAyMTI2MSwiZXhwIjoyMTA3NTk3MjYxfQ.-1Fp79lZTxLowQnKCyx9ZV3CgECBJTcWQ0aNhRlB31A';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || args['supabase-key'] || DEFAULT_SERVICE_ROLE_KEY;
const IS_DRY_RUN = Boolean(args['dry-run']);
const BATCH_SIZE = parseInt(args['batch-size'] || '100', 10);

if (!BASE44_API_KEY) {
  console.error('❌ ERRO: Nenhuma BASE44_API_KEY informada.');
  process.exit(1);
}

// Colunas estritas das tabelas no PostgreSQL (Whitelists)
const TABLE_COLUMNS = {
  consultants: new Set([
    'id', 'nome', 'email', 'telefone', 'gestor_id', 'wallet_id_asaas',
    'percentual_comissao', 'created_by_id', 'created_date', 'updated_date'
  ]),
  hubs: new Set([
    'id', 'consultant_id', 'razao_social', 'nome_exibicao', 'tipo_pessoa',
    'cnpj', 'cpf', 'nome_contato', 'telefone', 'email_login', 'saldo_disponivel',
    'saldo_seguranca', 'drive_polo_folder_id', 'acesso_bloqueado', 'data_bloqueio',
    'motivo_bloqueio', 'suspenso', 'motivo_suspensao', 'data_suspensao',
    'permite_credito_parcelado', 'limite_credito_personalizado',
    'parcela_minima_personalizada', 'parcelas_pagas_sequenciais', 'logo_url',
    'cor_primaria', 'cor_secundaria', 'atendimento_telefone', 'atendimento_email',
    'atendimento_endereco', 'perfil_comportamental', 'perfil_ultima_atualizacao',
    'polo_codigo_emec', 'polo_logradouro', 'polo_numero', 'polo_bairro',
    'polo_cep', 'polo_codigo_municipio', 'polo_nome_municipio', 'polo_uf',
    'modo_demo', 'reposicao_ativa', 'limite_reposicao', 'dia_fechamento_1',
    'dia_fechamento_2', 'asaas_wallet_id', 'piloto_vitrine_ativo',
    'is_clone_master', 'clone_instance_id', 'bloqueio_inadimplencia',
    'plano_fixo_ativo', 'valor_plano_fixo_mensal', 'categorias_ilimitadas',
    'cotas_mensais_por_categoria', 'regime_cobranca', 'percentual_comissao_polo',
    'created_by_id', 'created_date', 'updated_date'
  ]),
  students: new Set([
    'id', 'hub_id', 'nome_completo', 'nome_social', 'cpf', 'rg',
    'rg_orgao_expedidor', 'rg_uf', 'data_nascimento', 'sexo', 'naturalidade',
    'naturalidade_codigo_municipio', 'naturalidade_nome_municipio',
    'naturalidade_uf', 'nacionalidade', 'filiacao_pai_nome', 'filiacao_mae_nome',
    'email', 'telefone', 'forma_ingresso', 'ensino_medio_instituicao',
    'ensino_medio_cidade', 'ensino_medio_ano', 'plataforma_url',
    'ava_sync_status', 'ava_ultimo_erro', 'created_by_id', 'created_date',
    'updated_date'
  ]),
  academic_processes: new Set([
    'id', 'student_id', 'hub_id', 'tipo_processo', 'category_id',
    'categoria_curso', 'nome_curso', 'periodo_ingresso', 'data_inicio',
    'data_fim', 'data_colacao_grau', 'data_expedicao_diploma',
    'data_expedicao_historico', 'enade_situacao', 'numero_registro',
    'numero_livro', 'numero_folha', 'codigo_verificacao', 'url_dossie_pdf',
    'url_certificado_final', 'url_ata_assinada', 'url_relatorio_estagio',
    'url_certificado_assinado', 'url_historico_assinado',
    'url_termo_responsabilidade', 'documentacao_xml_url', 'rvdd_pdf_url',
    'historico_pdf_url', 'drive_file_id', 'status', 'motivo_recusa',
    'aprovado_por_id', 'data_aprovacao', 'valor_debitado', 'apressamento',
    'tentativas_reenvio', 'cancelado', 'simpleacademy_enviado',
    'simpleacademy_erro', 'simpleacademy_data_envio', 'simpleacademy_response',
    'integralizacao_ch_ok', 'integralizacao_tcc_ok',
    'integralizacao_atividades_ok', 'integralizacao_estagio_ok',
    'integralizacao_enade_ok', 'integralizacao_ata_ok', 'sollys_ultimo_status',
    'sollys_ultimo_protocolo', 'sollys_ultima_data_envio',
    'sollys_ambiente_usado', 'origem', 'afiliado_nome', 'combo_process_ids',
    'combo_id', 'created_by_id', 'created_date', 'updated_date'
  ])
};

// Caches de IDs conhecidos para sanitizar integridade referencial
const knownIds = {
  consultants: new Set(),
  hubs: new Set(),
  students: new Set()
};

async function fetchBase44Batch(entityName, skip, limit) {
  const url = `${BASE44_API_URL}/entities/${entityName}?skip=${skip}&limit=${limit}&sort_by=created_date`;
  const headers = { 'Content-Type': 'application/json' };
  
  if (BASE44_API_KEY.startsWith('b44u_')) {
    headers['Authorization'] = `Bearer ${BASE44_API_KEY}`;
  } else {
    headers['api_key'] = BASE44_API_KEY;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao buscar ${entityName} (skip=${skip}): ${res.status} ${errorText}`);
  }

  return await res.json();
}

function cleanRecord(table, record) {
  const allowedCols = TABLE_COLUMNS[table];
  const cleaned = {};

  // Garante que TODOS os objetos do lote possuam exatamente as mesmas chaves (requisito estrito do PostgREST)
  for (const col of allowedCols) {
    let value = record[col] !== undefined ? record[col] : null;

    // Normaliza qualquer string vazia para null (evita problemas de FK, DATE e ENUM)
    if (typeof value === 'string' && value.trim() === '') {
      value = null;
    }

    // Sanitização defensiva de chaves estrangeiras
    if (table === 'hubs' && col === 'consultant_id') {
      if (value && !knownIds.consultants.has(value)) value = null;
    }
    if (table === 'students' && col === 'hub_id') {
      if (value && !knownIds.hubs.has(value)) value = null;
    }
    if (table === 'academic_processes' && col === 'hub_id') {
      if (value && !knownIds.hubs.has(value)) value = null;
    }

    cleaned[col] = value;
  }

  return cleaned;
}

async function upsertSupabaseBatch(table, records) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(records)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro PostgREST em ${table}: ${res.status} ${errorText}`);
  }
}

async function syncEntity({ base44Name, table, label }) {
  console.log(`\n==================================================`);
  console.log(`📦 Processando: ${label} (${base44Name} ➔ public.${table})`);
  console.log(`==================================================`);

  let skip = 0;
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    let records = [];
    try {
      records = await fetchBase44Batch(base44Name, skip, BATCH_SIZE);
    } catch (err) {
      console.error(`❌ Erro na extração de ${base44Name}:`, err.message);
      break;
    }

    if (!Array.isArray(records) || records.length === 0) {
      hasMore = false;
      break;
    }

    // Registra IDs conhecidos antes de limpar dependências filhas
    if (table === 'consultants') records.forEach(r => knownIds.consultants.add(r.id));
    if (table === 'hubs') records.forEach(r => knownIds.hubs.add(r.id));
    if (table === 'students') records.forEach(r => knownIds.students.add(r.id));

    const cleanedRecords = records.map(r => cleanRecord(table, r));

    if (IS_DRY_RUN) {
      process.stdout.write(`🔎 [DRY-RUN] Lote ${skip} - ${skip + cleanedRecords.length} OK | `);
    } else {
      try {
        await upsertSupabaseBatch(table, cleanedRecords);
        process.stdout.write(`✅ Sincronizado ${skip} - ${skip + cleanedRecords.length} | `);
      } catch (err) {
        console.error(`\n❌ ${err.message}`);
        throw err;
      }
    }

    totalProcessed += cleanedRecords.length;
    skip += records.length;

    if (records.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\n🏁 Total ${label}: ${totalProcessed} registros processados.`);
  return totalProcessed;
}

const ENTITIES = [
  { base44Name: 'Consultant', table: 'consultants', label: 'Consultores' },
  { base44Name: 'Hub', table: 'hubs', label: 'Polos' },
  { base44Name: 'Student', table: 'students', label: 'Alunos' },
  { base44Name: 'AcademicProcess', table: 'academic_processes', label: 'Matrículas & Processos' }
];

async function run() {
  console.log(`🚀 KICKOFF OFICIAL: EDUCONTROL (Base44) ➔ SUPABASE (Cérebro Único)`);
  console.log(`Alvo Supabase: ${SUPABASE_URL}`);
  console.log(`Modo: ${IS_DRY_RUN ? 'DRY-RUN' : '🔴 INJEÇÃO REAL (Upsert Idempotente)'}`);

  const startTime = Date.now();
  const stats = {};

  for (const entity of ENTITIES) {
    stats[entity.label] = await syncEntity(entity);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n==================================================`);
  console.log(`📊 RELATÓRIO OFICIAL DE CARGA (SUPABASE):`);
  console.log(`==================================================`);
  for (const [ent, count] of Object.entries(stats)) {
    console.log(` • ${ent.padEnd(25)}: ${count.toLocaleString('pt-BR')} registros gravados`);
  }
  console.log(`⏱️ Tempo total da injeção: ${durationSec}s`);
  console.log(`==================================================\n`);
}

run().catch(err => {
  console.error('\n💥 Falha na execução da carga:', err);
  process.exit(1);
});
