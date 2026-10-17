import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'yuhtzkhoxnabrsrhqdni';
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// Lê credenciais de argumentos ou ambiente
const args = process.argv.slice(2);
const dbPassword = process.env.SUPABASE_DB_PASSWORD || args[0] || '';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';

const migrationFiles = [
  'fix_storage_permissions.sql',
  'fix_channel_notifications_trigger.sql',
  'create_bug_reports.sql',
  'create_ai_knowledge_base.sql'
];

async function runViaManagementApi(token) {
  console.log('🚀 Executando migrações via Supabase Management API...');
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`⏳ Aplicando: ${file}...`);
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Falha ao aplicar ${file}: ${err}`);
    }
    console.log(`✅ ${file} aplicado com sucesso!`);
  }
}

async function runViaPostgres(password) {
  console.log(`🚀 Conectando diretamente ao PostgreSQL do Supabase (${PROJECT_REF})...`);

  // Tenta conexão direta e pelo pooler
  const connectionStrings = [
    `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  ];

  let client = null;
  let connected = false;

  for (const connStr of connectionStrings) {
    try {
      client = new pg.Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 7000
      });
      await client.connect();
      connected = true;
      break;
    } catch (e) {
      if (client) {
        try { await client.end(); } catch {}
      }
    }
  }

  if (!connected || !client) {
    throw new Error('Não foi possível conectar ao PostgreSQL. Verifique se a senha do banco está correta.');
  }

  try {
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) continue;
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳ Aplicando migração: ${file}...`);
      await client.query(sql);
      console.log(`✅ ${file} aplicado com sucesso no banco de dados!`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('====================================================');
  console.log('🤖 EduChat: Aplicador Automatizado de Migrações SQL');
  console.log('====================================================');

  if (accessToken) {
    await runViaManagementApi(accessToken);
    console.log('\n🎉 Todas as migrações foram aplicadas com sucesso no Supabase!');
    return;
  }

  if (passwordOrToken(dbPassword)) {
    if (dbPassword.startsWith('sbp_')) {
      await runViaManagementApi(dbPassword);
    } else {
      await runViaPostgres(dbPassword);
    }
    console.log('\n🎉 Todas as migrações foram aplicadas com sucesso no Supabase!');
    return;
  }

  console.log('\n⚠️ Para aplicar automaticamente direto no banco de dados, eu só preciso de UMA dessas opções:');
  console.log('1. A SENHA do banco PostgreSQL do Supabase; OU');
  console.log('2. O Supabase Access Token (começa com sbp_... gerado em https://supabase.com/dashboard/account/tokens).\n');
  console.log('Como usar:');
  console.log('  npm run migrate -- SUA_SENHA_DO_BANCO');
  console.log('  OU');
  console.log('  npm run migrate -- sbp_SEU_TOKEN_SUPABASE\n');
}

function passwordOrToken(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

main().catch((err) => {
  console.error('\n❌ Erro na automação:', err.message);
  process.exit(1);
});
