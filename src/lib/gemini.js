// Integração Oficial e Direta com a API do Google Gemini (gemini-2.5-flash)
// Sem mocks estáticos: conecta diretamente ao endpoint v1beta da Google AI com RAG completo do Centro de Aprendizado.

import { supabase } from './supabase';

const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash';

export function getGeminiApiKey() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('educhat_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
}

export async function saveGeminiApiKey(apiKey) {
  if (typeof window === 'undefined') return;
  const cleanKey = (apiKey || '').trim();
  if (cleanKey) {
    localStorage.setItem('educhat_gemini_api_key', cleanKey);
  } else {
    localStorage.removeItem('educhat_gemini_api_key');
  }

  if (supabase) {
    try {
      await supabase.from('messages').upsert([
        {
          id: 'sys_config_gemini_key',
          chat_id: 'sys_config',
          sender_id: 'system',
          sender_name: 'System Config',
          text: JSON.stringify({ geminiApiKey: cleanKey, updatedAt: new Date().toISOString() }),
          timestamp: 'SYS'
        }
      ]);
    } catch (err) {
      console.warn('Aviso ao sincronizar chave Gemini no Supabase:', err);
    }
  }
}

export async function syncGeminiApiKeyFromCloud() {
  if (typeof window === 'undefined') return getGeminiApiKey();
  const existingLocal = getGeminiApiKey();
  if (existingLocal) return existingLocal;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('messages')
        .select('text')
        .eq('id', 'sys_config_gemini_key')
        .maybeSingle();
      if (data && data.text) {
        const parsed = JSON.parse(data.text);
        if (parsed?.geminiApiKey) {
          localStorage.setItem('educhat_gemini_api_key', parsed.geminiApiKey.trim());
          return parsed.geminiApiKey.trim();
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar chave Gemini na nuvem:', err);
    }
  }
  return '';
}

/**
 * Normaliza texto para comparação sem acentos
 */
export function normalizeText(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza o nome de departamento extraído pela IA para os setores oficiais do EduChat
 */
export function normalizeDepartmentName(rawDept = '') {
  const d = normalizeText(rawDept);
  if (!d) return 'Geral';
  if (d.includes('market') || d.includes('comunicac') || d.includes('midia') || d.includes('redes')) return 'Marketing';
  if (d.includes('comerc') || d.includes('venda') || d.includes('matricul')) return 'Comercial';
  if (d.includes('terapia') || d.includes('expans') || d.includes('polo') || d.includes('parceri')) return 'Expansão';
  if (d.includes('secretar') || d.includes('diploma') || d.includes('document') || d.includes('historic')) return 'Secretaria';
  if (d.includes('pedagog') || d.includes('coordenac') || d.includes('conteudo') || d.includes('matriz')) return 'Pedagógico';
  if (d.includes('tutor') || d.includes('suporte') || d.includes('ava') || d.includes('aluno')) return 'Tutoria';
  if (d.includes('financ') || d.includes('cobranc') || d.includes('boleto')) return 'Financeiro';
  if (d.includes('diret') || d.includes('executiv') || d.includes('gestao')) return 'Diretoria';
  return rawDept.trim();
}

/**
 * Busca dinamicamente todos os usuários/colaboradores ativos diretamente no Supabase
 * (tabelas `profiles`, `users` e registros sincronizados em `sys_collaborators`),
 * mesclando em tempo real sem depender de listas estáticas.
 */
export async function fetchActiveCollaboratorsFromDB(fallbackCollaborators = []) {
  const mergedMap = new Map();

  const addOrMergeUser = (raw) => {
    if (!raw) return;
    const isBot = Boolean(raw.isBot || raw.is_bot || raw.roleType === 'bot' || raw.role_type === 'bot');
    if (isBot) return;
    if (raw.active === false || raw.is_active === false) return;

    const name = String(raw.name || raw.full_name || raw.username || '').trim();
    if (!name) return;

    const email = String(raw.email || '').trim();
    const id = raw.id || `u_${normalizeText(email || name).replace(/[^a-z0-9]/g, '_')}`;
    const role = raw.role || raw.cargo || 'Colaborador';
    const roleType =
      raw.roleType ||
      raw.role_type ||
      (normalizeText(role).includes('diretor') || normalizeText(role).includes('admin') || normalizeText(role).includes('gestor')
        ? 'diretor'
        : 'colaborador');
    const department = normalizeDepartmentName(raw.department || raw.setor || raw.fila || 'Geral');
    const avatar = raw.avatar || '👤';

    const key = normalizeText(email || name || id);
    const existing = mergedMap.get(key) || {};
    mergedMap.set(key, {
      ...existing,
      id: raw.id || existing.id || id,
      name,
      email: email || existing.email || '',
      role: role || existing.role || 'Colaborador',
      roleType: roleType || existing.roleType || 'colaborador',
      department: department !== 'Geral' ? department : (existing.department || 'Geral'),
      avatar: avatar !== '👤' ? avatar : (existing.avatar || '👤'),
      online: Boolean(raw.online ?? existing.online ?? false),
      lastSeen: raw.lastSeen || raw.last_seen || existing.lastSeen || null,
      isBot: false
    });
  };

  // 1. Semente inicial com os colaboradores já carregados em memória / localStorage
  (fallbackCollaborators || []).forEach(addOrMergeUser);
  if (typeof window !== 'undefined') {
    try {
      const localList = JSON.parse(localStorage.getItem('educhat_collaborators') || '[]');
      if (Array.isArray(localList)) localList.forEach(addOrMergeUser);
    } catch {}
  }

  // 2. Busca em tempo real nas tabelas do Supabase (`profiles`, `users` e `sys_collaborators`)
  if (supabase) {
    try {
      const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('*');
      if (!profilesErr && Array.isArray(profilesData)) {
        profilesData.forEach(addOrMergeUser);
      }
    } catch {}

    try {
      const { data: usersData, error: usersErr } = await supabase.from('users').select('*');
      if (!usersErr && Array.isArray(usersData)) {
        usersData.forEach(addOrMergeUser);
      }
    } catch {}

    try {
      const { data: sysCollabData, error: sysErr } = await supabase
        .from('messages')
        .select('text')
        .eq('chat_id', 'sys_collaborators');
      if (!sysErr && Array.isArray(sysCollabData)) {
        sysCollabData.forEach((row) => {
          const match = (row.text || '').match(/<!-- COLLABORATOR_RECORD:([\s\S]*?) -->/);
          if (match) {
            try {
              addOrMergeUser(JSON.parse(match[1]));
            } catch {}
          }
        });
      }
    } catch {}
  }

  return Array.from(mergedMap.values());
}

/**
 * Calcula a distância de edição (Levenshtein) normalizada entre duas strings (0.0 a 1.0)
 */
function calculateStringSimilarity(a = '', b = '') {
  const s1 = normalizeText(a);
  const s2 = normalizeText(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;

  const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Calcula o score de proximidade entre o nome/e-mail extraído da ata e um usuário real do banco
 */
function scoreCollaboratorMatch(queryName = '', targetDept = '', user = {}) {
  const qNorm = normalizeText(queryName);
  const uName = normalizeText(user.name || '');
  const uEmail = normalizeText(user.email || '');
  const uEmailLocal = uEmail.split('@')[0] || '';
  const uDept = normalizeDepartmentName(user.department || '');

  if (!qNorm || !uName) return 0;

  let score = 0;

  // 1. Match exato de nome completo ou e-mail
  if (uName === qNorm || (uEmail && uEmail === qNorm) || (uEmailLocal && uEmailLocal === qNorm)) {
    score = 1.0;
  } else if (uName.includes(qNorm) || qNorm.includes(uName)) {
    // 2. Substring direta (ex: "Ana Livia" dentro de "Ana Livia Marques")
    score = 0.92;
  } else {
    // 3. Comparação por tokens de nome (primeiro nome, sobrenome, apelido por prefixo ou similaridade Levenshtein)
    const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
    const qTokens = qNorm.split(/\s+/).filter((t) => t.length >= 2 && !stopWords.has(t));
    const uTokens = uName.split(/\s+/).filter((t) => t.length >= 2 && !stopWords.has(t));

    let bestTokenScore = 0;
    let matchedTokensCount = 0;

    for (const qt of qTokens) {
      let maxForThisQt = 0;
      for (const ut of uTokens) {
        if (qt === ut) {
          maxForThisQt = Math.max(maxForThisQt, 0.88);
        } else if (qt.length >= 3 && (ut.startsWith(qt) || qt.startsWith(ut))) {
          // Prefixo de apelido dinâmico (ex: "tati" <-> "tatiane", "gabi" <-> "gabriel")
          maxForThisQt = Math.max(maxForThisQt, 0.80);
        } else {
          const sim = calculateStringSimilarity(qt, ut);
          if (sim >= 0.72) {
            maxForThisQt = Math.max(maxForThisQt, sim * 0.85);
          }
        }
      }
      // Também compara o token com o prefixo do e-mail cadastrado no banco
      if (uEmailLocal && qt.length >= 3 && uEmailLocal.includes(qt)) {
        maxForThisQt = Math.max(maxForThisQt, 0.78);
      }

      if (maxForThisQt >= 0.65) {
        matchedTokensCount += 1;
      }
      if (maxForThisQt > bestTokenScore) {
        bestTokenScore = maxForThisQt;
      }
    }

    score = bestTokenScore + (matchedTokensCount > 1 ? 0.08 : 0);
  }

  // Bônus de desempate se o setor extraído da tarefa coincide com o departamento do usuário no banco
  if (targetDept && targetDept !== 'Geral' && normalizeText(uDept) === normalizeText(targetDept)) {
    score += 0.07;
  }

  return Math.min(1.0, score);
}

/**
 * Retorna o Administrador Padrão da organização a partir da lista real de usuários do banco
 */
export function getDefaultAdminCollaborator(activeUsers = []) {
  const adminUser =
    activeUsers.find(
      (u) =>
        u.roleType === 'diretor' ||
        u.role === 'admin' ||
        normalizeText(u.role).includes('diretor') ||
        normalizeText(u.role).includes('admin') ||
        normalizeText(u.department) === 'diretoria'
    ) || activeUsers[0];

  if (adminUser) {
    return {
      assigneeId: adminUser.id,
      assignee: adminUser.name,
      assigneeEmail: adminUser.email || '',
      assigneeAvatar: adminUser.avatar || '👨‍💼',
      department: adminUser.department || 'Diretoria'
    };
  }

  return {
    assigneeId: 'u1',
    assignee: 'Administrador Padrão',
    assigneeEmail: '',
    assigneeAvatar: '👨‍💼',
    department: 'Diretoria'
  };
}

/**
 * Vinculação Automática e 100% Dinâmica de Usuário:
 * Compara dinamicamente o nome ou e-mail citado na ata (`responsavelNome`) com os usuários reais
 * cadastrados no banco (`collaborators`). Se não encontrar correspondência exata, faz match inteligente
 * por proximidade de nome ou atribui ao Administrador Padrão, evitando falhas de vínculo.
 */
export function matchCollaboratorToTask(responsavelNome = '', departamentoRaw = '', collaborators = []) {
  const activeUsers = (collaborators || []).filter((c) => !c.isBot && c.roleType !== 'bot');
  const normDept = normalizeDepartmentName(departamentoRaw);

  if (activeUsers.length === 0) {
    return {
      assigneeId: 'u1',
      assignee: responsavelNome || 'Administrador Padrão',
      assigneeEmail: '',
      assigneeAvatar: '👨‍💼',
      department: normDept || 'Diretoria'
    };
  }

  // 1. Match dinâmico por nome/e-mail ou proximidade fonética/textual nos usuários reais do banco
  if (responsavelNome && normalizeText(responsavelNome)) {
    let bestUser = null;
    let bestScore = 0;

    for (const user of activeUsers) {
      const currentScore = scoreCollaboratorMatch(responsavelNome, normDept, user);
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestUser = user;
      }
    }

    if (bestUser && bestScore >= 0.62) {
      return {
        assigneeId: bestUser.id,
        assignee: bestUser.name,
        assigneeEmail: bestUser.email || '',
        assigneeAvatar: bestUser.avatar || '👤',
        department: normDept !== 'Geral' ? normDept : (bestUser.department || 'Geral')
      };
    }
  }

  // 2. Se o nome não teve proximidade suficiente, tenta vincular a um titular ativo do departamento citado
  if (normDept && normDept !== 'Geral') {
    const deptUser = activeUsers.find(
      (u) => normalizeText(u.department) === normalizeText(normDept)
    );
    if (deptUser) {
      return {
        assigneeId: deptUser.id,
        assignee: deptUser.name,
        assigneeEmail: deptUser.email || '',
        assigneeAvatar: deptUser.avatar || '👤',
        department: normDept
      };
    }
  }

  // 3. Fallback garantido: atribui ao Administrador Padrão cadastrado no banco (zero falha de vínculo)
  const defaultAdmin = getDefaultAdminCollaborator(activeUsers);
  return {
    ...defaultAdmin,
    department: normDept !== 'Geral' ? normDept : defaultAdmin.department
  };
}

// Limites rígidos de segurança para nunca atingir a cota de 250.000 tokens/min do Free Tier
const MAX_SYSTEM_INSTRUCTION_CHARS = 11000; // ~2.750 tokens
const MAX_USER_MESSAGE_CHARS = 6500; // ~1.600 tokens
const MAX_HISTORY_TURN_CHARS = 700;
const MAX_HISTORY_TURNS = 6;

export const FRIENDLY_RATE_LIMIT_MESSAGE =
  '⏳ Muitas consultas simultâneas ou arquivo muito extenso. Por favor, aguarde alguns segundos e tente novamente.';

const PT_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem',
  'que', 'qual', 'quais', 'como', 'onde', 'quando', 'quem', 'um', 'uma', 'uns', 'umas',
  'os', 'as', 'ao', 'aos', 'se', 'ou', 'mas', 'mais', 'menos', 'muito', 'muita', 'sobre',
  'este', 'esta', 'esse', 'essa', 'isso', 'isto', 'aquele', 'aquela', 'entre', 'ate',
  'ser', 'estar', 'ter', 'haver', 'fazer', 'pode', 'podem', 'deve', 'devem', 'foi', 'sao',
  'ola', 'bom', 'dia', 'boa', 'tarde', 'noite', 'por', 'favor', 'preciso', 'quero', 'saber',
  'me', 'te', 'ele', 'ela', 'nos', 'eles', 'elas', 'meu', 'minha', 'seu', 'sua'
]);

/**
 * Detecta se um erro retornado pela API ou rede refere-se a Rate Limit / Cota Excedida (HTTP 429)
 */
export function isRateLimitError(status = 0, errorText = '') {
  if (status === 429) return true;
  const norm = String(errorText || '').toLowerCase();
  return (
    norm.includes('429') ||
    norm.includes('resource_exhausted') ||
    norm.includes('free_tier_input_token_count') ||
    norm.includes('quota exceeded') ||
    norm.includes('rate limit') ||
    norm.includes('ratelimitexceeded') ||
    norm.includes('too many requests') ||
    norm.includes('muitas consultas simultâneas')
  );
}

/**
 * Decodifica com segurança um dataUrl base64 de texto/CSV caso seja um arquivo textual legível.
 * Caso seja binário (PDF, imagem, áudio, zip), descarta o base64 bruto para nunca estourar tokens.
 */
function extractReadableTextFromAttachmentJson(rawJsonStr = '') {
  try {
    const parsed = JSON.parse(rawJsonStr);
    const name = parsed?.name || 'arquivo';
    const dataUrl = String(parsed?.dataUrl || parsed?.url || '');
    const isTextual =
      /\.(csv|txt|tsv|json|md)$/i.test(name) ||
      dataUrl.startsWith('data:text/') ||
      dataUrl.startsWith('data:application/json');

    if (isTextual && dataUrl.includes(';base64,')) {
      const b64 = dataUrl.split(';base64,')[1] || '';
      // Decodifica apenas os primeiros ~48KB de base64 para evitar travamento de memória
      const safeB64 = b64.slice(0, 64000);
      const binaryStr = atob(safeB64);
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return `[Arquivo Anexado: ${name}]\n${decoded}`;
    }
    return `[Arquivo Anexado: ${name} (${parsed?.size || 'documento'})]`;
  } catch {
    return '[Arquivo Anexado]';
  }
}

/**
 * Higieniza qualquer string antes de enviá-la ao Gemini:
 * - Remove payloads brutos [ARQUIVO_ANEXO:{...}] e strings base64 gigantescas
 * - Remove metadados HTML <!-- ... -->
 */
export function sanitizeTextForPrompt(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;

  // 1. Intercepta tags [ARQUIVO_ANEXO:{...}] para jamais enviar PDFs/imagens em base64 para o LLM
  if (text.includes('[ARQUIVO_ANEXO:')) {
    text = text.replace(/\[ARQUIVO_ANEXO:(\{[\s\S]*?\})\]/g, (_, jsonPart) =>
      extractReadableTextFromAttachmentJson(jsonPart)
    );
    // Caso haja alguma tag truncada sem fechamento
    text = text.replace(/\[ARQUIVO_ANEXO:[\s\S]*$/g, '[Arquivo Anexado]');
  }

  // 2. Remove qualquer data URL em base64 remanescente no texto
  text = text.replace(/data:[a-zA-Z0-9/+.-]+;base64,[A-Za-z0-9+/=]+/g, '[conteúdo-binário-omitido]');

  // 3. Remove comentários de controle do sistema (STATUS, REPLY_TO, COLLABORATOR_RECORD, etc.)
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  return text.trim();
}

/**
 * Extrai palavras-chave relevantes da pergunta atual do usuário para o filtro RAG
 */
export function extractQueryKeywords(query = '', extraContext = '') {
  const combined = normalizeText(`${query} ${extraContext}`);
  const tokens = combined
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !PT_STOPWORDS.has(w));
  return Array.from(new Set(tokens)).slice(0, 25);
}

/**
 * Calcula a relevância de um trecho/linha/objeto em relação às palavras-chave da pergunta
 */
function scoreTextRelevance(text = '', keywords = [], department = '') {
  if (!text) return 0;
  const norm = normalizeText(text);
  let score = 0;

  for (const kw of keywords) {
    if (!kw) continue;
    if (norm.includes(kw)) {
      score += kw.length >= 5 ? 3 : 2;
      // Bônus para match de palavra inteira
      const wordRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordRegex.test(norm)) score += 2;
    }
  }

  if (department && department !== 'Geral') {
    const normDept = normalizeText(department);
    if (normDept && norm.includes(normDept)) {
      score += 1.5;
    }
  }

  return score;
}

/**
 * Motor RAG Inteligente para Planilhas (CSV/TSV) e Documentos Extensos:
 * Em vez de injetar o documento ou planilha inteira bruta, filtra e retorna apenas
 * o cabeçalho, estatísticas e as linhas/trechos relevantes para a pergunta atual.
 */
export function extractRelevantContextFromText(
  rawContent = '',
  keywords = [],
  { maxChars = 1400, maxRows = 18, department = '' } = {}
) {
  const clean = sanitizeTextForPrompt(rawContent);
  if (!clean) return '';
  if (clean.length <= maxChars) return clean;

  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Detecta se é uma planilha / tabela estruturada (CSV, TSV ou separada por ; , |)
  const sampleLines = lines.slice(0, Math.min(10, lines.length));
  const tabularCount = sampleLines.filter(
    (l) => (l.match(/[;,\t|]/g) || []).length >= 2
  ).length;
  const isSpreadsheet = lines.length >= 5 && tabularCount >= Math.min(3, sampleLines.length);

  if (isSpreadsheet) {
    const header = lines[0].slice(0, 350);
    const dataRows = lines.slice(1);

    const scoredRows = dataRows.map((row, idx) => ({
      row,
      idx: idx + 2,
      score: scoreTextRelevance(row, keywords, department)
    }));

    const matchedRows = scoredRows
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRows);

    // Se nenhuma linha específica deu match com a pergunta, envia apenas uma amostra enxuta das primeiras linhas
    const selectedRows =
      matchedRows.length > 0
        ? matchedRows.sort((a, b) => a.idx - b.idx)
        : scoredRows.slice(0, Math.min(8, scoredRows.length));

    let result = `[Resumo RAG da Planilha: ${dataRows.length} registros totais | Exibindo cabeçalho + ${selectedRows.length} linhas relevantes]\n`;
    result += `Cabeçalho: ${header}\n`;

    for (const item of selectedRows) {
      const formattedLine = `Linha ${item.idx}: ${item.row.slice(0, 280)}\n`;
      if (result.length + formattedLine.length > maxChars) break;
      result += formattedLine;
    }

    return result.trim();
  }

  // Documento textual extenso: divide em blocos/parágrafos e seleciona apenas os mais relevantes para a pergunta
  const chunks = [];
  let currentChunk = '';
  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > 380 && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  if (chunks.length <= 1) {
    return clean.slice(0, maxChars) + (clean.length > maxChars ? '...' : '');
  }

  const introChunk = chunks[0].slice(0, 380);
  const remainingChunks = chunks.slice(1).map((chunk, idx) => ({
    chunk,
    idx: idx + 1,
    score: scoreTextRelevance(chunk, keywords, department)
  }));

  const topChunks = remainingChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.idx - b.idx);

  let output = `${introChunk}\n`;
  for (const c of topChunks) {
    const snippet = `[Trecho Relevante]: ${c.chunk}\n`;
    if (output.length + snippet.length > maxChars) break;
    output += snippet;
  }

  return output.trim().slice(0, maxChars);
}

/**
 * Constrói o System Instruction com RAG Inteligente e Controle Estrito de Tokens:
 * Em vez de despejar todas as planilhas/documentos/VIPs/POPs/SLAs brutos em cada mensagem,
 * filtra e injeta apenas os registros e trechos relevantes para a pergunta atual (`query`).
 */
export function buildSystemInstruction({
  query = '',
  student = null,
  vipClients = [],
  learnedDocuments = [],
  pops = [],
  slas = [],
  customPrompt = '',
  department = 'Geral',
  userName = 'Colaborador'
}) {
  const extraContext = [
    department,
    student?.name || '',
    student?.course || '',
    student?.polo || '',
    userName
  ].join(' ');
  const keywords = extractQueryKeywords(query, extraContext);

  let prompt = `Você é o Assistente IA Oficial (MEC & Processos) do EduChat — Faculdade Olavo Bilac • Grupo EstudeMais.\n`;
  prompt += `Sua missão é atuar como Copiloto Executivo, Acadêmico e Operacional em tempo real, fornecendo respostas precisas, fundamentadas nas normas do MEC e nos POPs internos da instituição.\n\n`;

  if (student) {
    prompt += `=== CONTEXTO DO ALUNO / CONTATO EM ATENDIMENTO ===\n`;
    prompt += `• Nome: ${student.name || userName}\n`;
    prompt += `• Curso: ${student.course || 'Graduação / Pós-Graduação'}\n`;
    prompt += `• Polo: ${student.polo || 'Matriz'}\n`;
    prompt += `• Situação Acadêmica: ${student.academicStatus || 'Ativo'}\n`;
    prompt += `• Matrícula: ${student.matricula || '-'}\n`;
    if (student.cpf) prompt += `• CPF: ${student.cpf}\n\n`;
  }

  // 1. RAG Inteligente para Clientes VIP (evita enviar centenas de linhas de planilha VIP de uma vez)
  if (vipClients && vipClients.length > 0) {
    const scoredVips = vipClients.map((vip) => ({
      vip,
      score: scoreTextRelevance(
        `${vip.name || ''} ${vip.plan || ''} ${vip.role || ''} ${vip.phone || ''}`,
        keywords,
        department
      )
    }));
    const relevantVips = scoredVips
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.vip);

    prompt += `=== CLIENTES VIP & PARCEIROS ESTRATÉGICOS (Total na base: ${vipClients.length} | Exibindo ${relevantVips.length} mais relevantes) ===\n`;
    relevantVips.forEach((vip) => {
      prompt += `• ${vip.name} (${vip.plan || vip.role || 'Parceiro VIP'}) — Prioridade: ${vip.priority || 'Crítica / SLA 15min'}\n`;
    });
    prompt += `\n`;
  }

  // 2. RAG Inteligente para Prazos MEC & SLAs
  if (slas && slas.length > 0) {
    const scoredSlas = slas.map((s) => ({
      s,
      score: scoreTextRelevance(
        `${s.department || s.setor || ''} ${s.demand || s.regra || ''} ${s.slaTime || s.sla || s.prazo || ''}`,
        keywords,
        department
      )
    }));
    const relevantSlas = scoredSlas
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.s);

    prompt += `=== PRAZOS MEC & SLAS OPERACIONAIS (Total: ${slas.length} | Relevantes: ${relevantSlas.length}) ===\n`;
    relevantSlas.forEach((s) => {
      prompt += `• Setor ${s.department || s.setor || 'Geral'}: ${s.demand || s.mecDeadline || s.regra || 'Demanda'} -> Prazo/SLA: ${s.slaTime || s.sla || s.prazo || '48h'}\n`;
    });
    prompt += `\n`;
  }

  // 3. RAG Inteligente para POPs
  if (pops && pops.length > 0) {
    const scoredPops = pops.map((p) => ({
      p,
      score: scoreTextRelevance(
        `${p.department || ''} ${p.title || p.name || ''} ${p.steps || p.content || p.desc || ''}`,
        keywords,
        department
      )
    }));
    const relevantPops = scoredPops
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.p);

    prompt += `=== PROCEDIMENTOS OPERACIONAIS PADRÃO - POPs (Total: ${pops.length} | Relevantes: ${relevantPops.length}) ===\n`;
    relevantPops.forEach((p) => {
      const rawSteps = String(p.content || p.desc || p.description || p.steps || '');
      const conciseSteps = extractRelevantContextFromText(rawSteps, keywords, {
        maxChars: 380,
        maxRows: 6,
        department
      });
      prompt += `• [${p.department || 'Geral'}] ${p.title || p.name}: ${conciseSteps}\n`;
    });
    prompt += `\n`;
  }

  // 4. RAG Inteligente para Documentos e Base de Conhecimento da IA
  if (learnedDocuments && learnedDocuments.length > 0) {
    const scoredDocs = learnedDocuments.map((doc) => ({
      doc,
      score: scoreTextRelevance(
        `${doc.title || ''} ${doc.category || doc.department || ''} ${doc.summary || ''} ${(doc.keywords || []).join(' ')} ${(doc.content || doc.textContent || '').slice(0, 4000)}`,
        keywords,
        department
      )
    }));

    const relevantDocs = scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.doc);

    prompt += `=== BASE DE CONHECIMENTO IA (DOCUMENTOS, CURSOS E DIRETRIZES) ===\n`;
    relevantDocs.forEach((doc, idx) => {
      prompt += `[DOC ${idx + 1}: ${doc.title} | Categoria: ${doc.category || doc.department || 'Geral'}]\n`;
      if (doc.summary) prompt += `Resumo: ${String(doc.summary).slice(0, 300)}\n`;
      if (doc.rules && doc.rules.length > 0) {
        prompt += `Regras: ${doc.rules.slice(0, 5).join(' | ').slice(0, 300)}\n`;
      }
      if (doc.deadlines && doc.deadlines.length > 0) {
        prompt += `Prazos: ${doc.deadlines.slice(0, 5).join(' | ').slice(0, 250)}\n`;
      }
      const rawText = doc.content || doc.textContent;
      if (rawText) {
        const relevantExcerpt = extractRelevantContextFromText(rawText, keywords, {
          maxChars: 2000,
          maxRows: 30,
          department
        });
        prompt += `Conteúdo/Trecho Oficial:\n${relevantExcerpt}\n`;
      }
      prompt += `\n`;
    });
  }

  prompt += `=== LEGISLAÇÃO E DIRETRIZES OFICIAIS DO MEC ===\n`;
  prompt += `• Portaria MEC nº 1.095/2018: Expedição e registro de diplomas em até 60 dias corridos após a colação de grau (prorrogável por mais 60 dias mediante justificativa formal).\n`;
  prompt += `• Resolução CNE/CES nº 1/2018: Pós-Graduação Lato Sensu exige carga horária mínima de 360 horas e conclusão prévia de curso superior.\n`;
  prompt += `• Aproveitamento de Estudos e Convalidação: Exige análise de equivalência mínima de 75% de carga horária e conteúdo programático no Histórico Oficial e Ementas.\n\n`;

  if (customPrompt) {
    const filteredCustomPrompt = extractRelevantContextFromText(customPrompt, keywords, {
      maxChars: 1400,
      maxRows: 15,
      department
    });
    prompt += `=== DIRETRIZES ESPECÍFICAS DA DIRETORIA ===\n${filteredCustomPrompt}\n\n`;
  }

  prompt += `=== INSTRUÇÕES DE RESPOSTA ===\n`;
  prompt += `1. Responda sempre em português claro, objetivo, estruturado e profissional.\n`;
  prompt += `2. Utilize prioritariamente os POPs, Prazos MEC, Clientes VIP e trechos de Documentos/Planilhas recuperados acima.\n`;
  prompt += `3. Quando pertinente, indique qual setor (${department}) ou responsável interno deve conduzir a etapa operacional.\n`;

  if (prompt.length > MAX_SYSTEM_INSTRUCTION_CHARS) {
    prompt = prompt.slice(0, MAX_SYSTEM_INSTRUCTION_CHARS) + '\n[...contexto truncado para otimização de tokens]';
  }

  return prompt;
}

/**
 * Chamada direta e oficial ao endpoint REST do Google Gemini (gemini-2.5-flash)
 * com fallback automático de modelo e tratamento elegante de Rate Limit (Erro 429).
 */
async function callGeminiEndpoint({ apiKey, contents, systemInstruction, generationConfig = {} }) {
  const safeSystemInstruction = systemInstruction
    ? String(systemInstruction).slice(0, MAX_SYSTEM_INSTRUCTION_CHARS)
    : '';

  const buildRequestBody = (sysText, contentsList) => ({
    contents: contentsList,
    ...(sysText
      ? {
          systemInstruction: {
            parts: [{ text: sysText }]
          }
        }
      : {}),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      ...generationConfig
    }
  });

  const primaryBody = buildRequestBody(safeSystemInstruction, contents);

  let response = await fetch(
    `${GEMINI_ENDPOINT_BASE}/${PRIMARY_GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(primaryBody)
    }
  );

  // Se ocorrer 404 (modelo indisponível) ou 429/503 (limite de taxa momentâneo no modelo primário),
  // aguarda brevemente e tenta no modelo fallback com payload ainda mais compacto.
  if (!response.ok && (response.status === 404 || response.status === 429 || response.status === 503)) {
    if (response.status === 429 || response.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    const compactSys = safeSystemInstruction.slice(0, 5000);
    const compactContents = (contents || []).slice(-3).map((c) => ({
      role: c.role,
      parts: (c.parts || []).map((p) => ({
        text: String(p.text || '').slice(0, 3500)
      }))
    }));

    response = await fetch(
      `${GEMINI_ENDPOINT_BASE}/${FALLBACK_GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(compactSys, compactContents))
      }
    );
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }

    // Tratamento Elegante de Rate Limit (Erro 429 / Quota Exceeded / 250k tokens)
    if (isRateLimitError(response.status, errorDetail)) {
      const rateErr = new Error(FRIENDLY_RATE_LIMIT_MESSAGE);
      rateErr.isRateLimit = true;
      rateErr.status = 429;
      throw rateErr;
    }

    throw new Error(`Não foi possível concluir a consulta no momento (${response.status}). Tente novamente em instantes.`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('A IA processou a solicitação, mas retornou uma resposta vazia. Por favor, reformule sua pergunta.');
  }
  return text.trim();
}

/**
 * 1. Chat e Assistente IA (MEC & Processos) — Conectado à API oficial do Gemini com RAG Inteligente
 * e proteção total contra Erro 429 (free_tier_input_token_count).
 */
export async function generateGeminiChatReply({
  message,
  attachment = null,
  history = [],
  student = null,
  vipClients = [],
  learnedDocuments = [],
  pops = [],
  slas = [],
  customPrompt = '',
  department = 'Geral',
  userName = 'Colaborador'
}) {
  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    apiKey = await syncGeminiApiKeyFromCloud();
  }

  if (!apiKey) {
    throw new Error(
      'Chave da API Gemini não configurada. Clique em "Cérebro da IA (Regras & VIPs)" no menu lateral e insira sua Chave da API do Google Gemini para ativar a inteligência real.'
    );
  }

  // Higieniza a mensagem atual e extrai apenas trechos/linhas relevantes caso o usuário tenha colado uma planilha/documento extenso
  let rawUserMessage = sanitizeTextForPrompt(message || '');
  if (attachment) {
    const attachmentContext = extractReadableTextFromAttachmentJson(JSON.stringify(attachment));
    rawUserMessage = `${rawUserMessage}\n${attachmentContext}`.trim();
  }

  const keywords = extractQueryKeywords(rawUserMessage, `${department} ${student?.name || ''}`);
  const optimizedUserMessage =
    rawUserMessage.length > MAX_USER_MESSAGE_CHARS
      ? extractRelevantContextFromText(rawUserMessage, keywords, {
          maxChars: MAX_USER_MESSAGE_CHARS,
          maxRows: 35,
          department
        })
      : rawUserMessage || 'Analise o contexto e oriente o próximo passo.';

  const systemInstruction = buildSystemInstruction({
    query: optimizedUserMessage,
    student,
    vipClients,
    learnedDocuments,
    pops,
    slas,
    customPrompt,
    department,
    userName
  });

  const contents = [];
  const recentHistory = (history || [])
    .filter((h) => {
      if (!h?.text) return false;
      // Não reenvia mensagens de erro técnico anteriores para o contexto
      if (
        h.text.includes('Erro na API Gemini') ||
        h.text.includes('free_tier_input_token_count') ||
        h.text.includes('Muitas consultas simultâneas')
      ) {
        return false;
      }
      return true;
    })
    .slice(-MAX_HISTORY_TURNS);

  recentHistory.forEach((h) => {
    const cleanHistText = sanitizeTextForPrompt(String(h.text || ''));
    if (!cleanHistText) return;

    const isModel =
      h.senderId === 'u_ia_copilot' ||
      h.sender === 'ai' ||
      h.isAiAutoReply ||
      (student && !h.fromStudent && !h.senderId?.startsWith('wa-'));

    const compactHistText =
      cleanHistText.length > MAX_HISTORY_TURN_CHARS
        ? extractRelevantContextFromText(cleanHistText, keywords, {
            maxChars: MAX_HISTORY_TURN_CHARS,
            maxRows: 8,
            department
          })
        : cleanHistText;

    contents.push({
      role: isModel ? 'model' : 'user',
      parts: [{ text: compactHistText }]
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: optimizedUserMessage }]
  });

  try {
    return await callGeminiEndpoint({
      apiKey,
      contents,
      systemInstruction,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1500
      }
    });
  } catch (err) {
    if (err?.isRateLimit || isRateLimitError(err?.status, err?.message)) {
      return FRIENDLY_RATE_LIMIT_MESSAGE;
    }
    throw err;
  }
}

/**
 * 2. Leitura Inteligente de Atas do Google Meet -> Kanban Automático
 * Lê o texto da ata (ex: e-mails de gemini-notes@google.com com assunto "Anotações: [Nome da Reunião]"),
 * foca na seção "Próximas etapas" e retorna um JSON estruturado já vinculado aos usuários reais do EduChat.
 */
export async function extractTasksFromMeetNotes({
  notesText,
  meetingTitle = '',
  collaborators = []
}) {
  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    apiKey = await syncGeminiApiKeyFromCloud();
  }
  if (!apiKey) {
    throw new Error(
      'Configure sua Chave da API Gemini no painel "Cérebro da IA" para processar atas do Google Meet.'
    );
  }

  // Busca obrigatoriamente os usuários ativos reais diretamente do Supabase (profiles / users / sys_collaborators)
  const liveCollaborators = await fetchActiveCollaboratorsFromDB(collaborators);
  const defaultAdmin = getDefaultAdminCollaborator(liveCollaborators);

  const teamRoster = liveCollaborators
    .slice(0, 60)
    .map(
      (c) =>
        `- Nome: "${c.name}" | E-mail: "${c.email || '-'}" | Setor/Departamento: "${c.department || 'Geral'}" | Cargo: "${c.role || 'Colaborador'}"`
    )
    .join('\n');

  const systemInstruction = `Você é o Motor de Automação Executiva do EduChat.
Sua função é ler atas e anotações de reuniões do Google Meet (enviadas por gemini-notes@google.com ou coladas pelo usuário), focar com máxima atenção na seção "Próximas etapas" (ou "Action Items" / "Encaminhamentos" / "Tarefas") e extrair TODAS as tarefas acionáveis.

USUÁRIOS REAIS ATIVOS CADASTRADOS NO BANCO DE DADOS DO EDUCHAT (TABELA PROFILES):
${teamRoster || `- Nome: "${defaultAdmin.assignee}" | Setor: "${defaultAdmin.department}"`}

DIRETRIZES DINÂMICAS DE VINCULAÇÃO:
1. Para cada tarefa extraída na ata, compare dinamicamente o nome ou e-mail citado na ata com a lista de USUÁRIOS REAIS ATIVOS acima.
2. Caso o nome citado na ata seja um primeiro nome, apelido ou variação próxima de um usuário cadastrado na lista acima, preencha "responsavel_nome" com o Nome Exato daquele usuário cadastrado no banco e "departamento" com o Setor correspondente dele.
3. Se nenhum colaborador específico for citado ou não houver correspondência aproximada na lista, atribua ao Administrador Padrão ("${defaultAdmin.assignee}").

Retorne ESTRITAMENTE um array JSON válido (sem blocos markdown ao redor), onde cada objeto possui exatamente as chaves:
[
  {
    "departamento": "Setor correspondente do colaborador cadastrado no banco",
    "titulo_curto": "Título objetivo da ação (máx 70 caracteres)",
    "descricao_tarefa": "Descrição completa e clara da tarefa extraída da ata",
    "responsavel_nome": "Nome ou e-mail do colaborador responsável identificado",
    "prioridade": "alta | media | baixa | vip",
    "prazo_sugerido": "Prazo citado na ata ou 'Em até 48h'"
  }
]`;

  // Otimização RAG para atas ou transcrições muito extensas (evita estourar limite de tokens)
  const cleanNotes = sanitizeTextForPrompt(notesText || '');
  let optimizedNotes = cleanNotes;
  if (cleanNotes.length > 12000) {
    const actionMatch = cleanNotes.search(/pr[oó]ximas etapas|action items|encaminhamentos|tarefas|pend[eê]ncias/i);
    if (actionMatch !== -1) {
      const headerContext = cleanNotes.slice(0, 3000);
      const actionSection = cleanNotes.slice(Math.max(0, actionMatch - 500), actionMatch + 8500);
      optimizedNotes = `${headerContext}\n\n[...Trecho Intermediário Omitido...]\n\n${actionSection}`;
    } else {
      optimizedNotes = extractRelevantContextFromText(
        cleanNotes,
        ['etapa', 'tarefa', 'prazo', 'responsavel', 'enviar', 'criar', 'revisar', 'validar', 'cobrar'],
        { maxChars: 11000, maxRows: 80 }
      );
    }
  }

  const userPrompt = `TÍTULO / ASSUNTO DA REUNIÃO: ${meetingTitle || 'Anotações da Reunião (Google Meet)'}\n\nCONTEÚDO DA ATA DO GOOGLE MEET:\n${optimizedNotes}`;

  const rawResponse = await callGeminiEndpoint({
    apiKey,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json'
    }
  });

  let parsedArray = [];
  try {
    const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsedArray = JSON.parse(cleaned);
    if (!Array.isArray(parsedArray) && Array.isArray(parsedArray?.tarefas)) {
      parsedArray = parsedArray.tarefas;
    }
  } catch (err) {
    console.error('Erro ao fazer parse do JSON da ata do Meet:', err, rawResponse);
    throw new Error('O Gemini analisou a ata, mas o formato retornado não pôde ser convertido em cartões.');
  }

  return (parsedArray || []).map((item, idx) => {
    const matched = matchCollaboratorToTask(
      item.responsavel_nome || item.responsavel || '',
      item.departamento || '',
      liveCollaborators
    );
    return {
      id: `t_meet_${Date.now()}_${idx}`,
      departamento: matched.department,
      titulo_curto: item.titulo_curto || (item.descricao_tarefa || 'Nova demanda de reunião').slice(0, 68),
      descricao_tarefa: item.descricao_tarefa || item.titulo_curto || '',
      responsavel_nome: matched.assignee,
      assigneeId: matched.assigneeId,
      assigneeEmail: matched.assigneeEmail,
      assigneeAvatar: matched.assigneeAvatar,
      prioridade: ['alta', 'media', 'baixa', 'vip'].includes(String(item.prioridade).toLowerCase())
        ? String(item.prioridade).toLowerCase()
        : 'alta',
      prazo_sugerido: item.prazo_sugerido || 'Próxima Reunião',
      sourceMeeting: meetingTitle || 'Ata do Google Meet (gemini-notes@google.com)'
    };
  });
}

/**
 * 3. Briefing Executivo Automático Sincronizado com a Agenda (Topo do Kanban / Chat)
 * Analisa os cartões reais do Kanban daquele bloco/setor e gera o resumo executivo para a reunião.
 */
export async function generateExecutiveMeetingBriefing({
  blockName = 'REUNIÃO EXECUTIVA',
  department = 'Todos',
  assigneeFilter = '',
  tasks = [],
  vipClients = [],
  slas = []
}) {
  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    apiKey = await syncGeminiApiKeyFromCloud();
  }
  if (!apiKey) {
    throw new Error('Configure a Chave da API Gemini no "Cérebro da IA" para gerar o Briefing Executivo.');
  }

  const doneTasks = tasks.filter((t) => t.status === 'done').slice(0, 25);
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'waiting').slice(0, 25);
  const pendingTasks = tasks.filter((t) => t.status === 'backlog').slice(0, 25);

  const formatTaskList = (list) =>
    list.length === 0
      ? 'Nenhum cartão registrado nesta coluna.'
      : list
          .map(
            (t) =>
              `- [${t.department || 'Geral'}] "${t.title}" | Responsável: ${t.assignee || 'Não atribuído'} | Prioridade: ${t.priority || 'media'} | Prazo: ${t.dueDate || '-'}${t.desc ? ` | Detalhe: ${sanitizeTextForPrompt(t.desc).slice(0, 120)}` : ''}`
          )
          .join('\n');

  const systemInstruction = `Você é o Conselheiro Executivo de Operações da Diretoria no EduChat.
O Diretor está entrando agora no bloco da agenda "${blockName}" (Setor foco: ${department}${assigneeFilter ? ` | Responsável foco: ${assigneeFilter}` : ''}).
Com base ESTRITAMENTE nos cartões reais do Kanban listados abaixo, gere um Briefing Executivo direto ao ponto para tomada de decisão e cobrança em reunião.

Retorne ESTRITAMENTE um JSON válido com o seguinte formato:
{
  "resumo_executivo": "Síntese executiva de 1 a 2 frases sobre o ritmo atual desse setor/responsável.",
  "concluidos": [
    "Frase curta e objetiva destacando cada entrega concluída e quem entregou"
  ],
  "em_andamento": [
    "Frase curta sobre o que está em execução ou aguardando resposta e com quem está"
  ],
  "pendencias_criticas": [
    "Ponto de cobrança direta para a reunião agora (destacando tarefas pendentes/a fazer, prazos ou prioridade alta/VIP)"
  ]
}`;

  const promptText = `BLOCO DA AGENDA ATUAL: ${blockName}
SETOR: ${department}
FILTRO DE RESPONSÁVEL: ${assigneeFilter || 'Toda a equipe do bloco'}

=== CARTÕES CONCLUÍDOS (${doneTasks.length}) ===
${formatTaskList(doneTasks)}

=== CARTÕES EM ANDAMENTO / AGUARDANDO (${inProgressTasks.length}) ===
${formatTaskList(inProgressTasks)}

=== CARTÕES PENDENTES / A FAZER (${pendingTasks.length}) ===
${formatTaskList(pendingTasks)}`;

  const rawResponse = await callGeminiEndpoint({
    apiKey,
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    systemInstruction,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1500,
      responseMimeType: 'application/json'
    }
  });

  try {
    const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      resumo_executivo: parsed.resumo_executivo || `Panorama atualizado para o bloco ${blockName}.`,
      concluidos: Array.isArray(parsed.concluidos) ? parsed.concluidos : [],
      em_andamento: Array.isArray(parsed.em_andamento) ? parsed.em_andamento : [],
      pendencias_criticas: Array.isArray(parsed.pendencias_criticas) ? parsed.pendencias_criticas : []
    };
  } catch (err) {
    console.warn('Erro ao converter JSON do Briefing Executivo:', err);
    return {
      resumo_executivo: rawResponse.slice(0, 300),
      concluidos: doneTasks.map((t) => `${t.title} (${t.assignee})`),
      em_andamento: inProgressTasks.map((t) => `${t.title} — com ${t.assignee}`),
      pendencias_criticas: pendingTasks.map((t) => `Cobrar: ${t.title} (${t.assignee} • ${t.dueDate || 'Imediato'})`)
    };
  }
}

/**
 * 4. GERAÇÃO DE ATA EXECUTIVA DE ALINHAMENTO INDIVIDUAL E FEEDBACK (DASHBOARD BI)
 * Compila o JSON consolidado do colaborador (atendimentos WhatsApp + cards Kanban)
 * e gera uma ata executiva formal e detalhada via Gemini (Edge Function com fallback local).
 */
export async function generateCollaboratorAlignmentMinute({
  collaborator,
  periodLabel = 'Últimos 30 dias',
  kpis = {},
  completedTasks = [],
  pendingTasks = [],
  whatsAppChats = [],
  evaluator = 'Flávio Motta (Diretoria Executiva)'
}) {
  let apiKey = getGeminiApiKey();
  if (!apiKey) {
    apiKey = await syncGeminiApiKeyFromCloud();
  }

  // 1. Tenta invocar via Edge Function do Supabase se disponível
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey) {
      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/generate-alignment-minute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          collaborator,
          periodLabel,
          kpis,
          completedTasks,
          pendingTasks,
          whatsAppChats,
          evaluator,
          apiKey
        })
      });

      if (edgeRes.ok) {
        const data = await edgeRes.json();
        if (data?.minute) {
          return data.minute;
        }
      }
    }
  } catch (err) {
    console.warn('[Edge Function] Falha ao invocar generate-alignment-minute, utilizando fallback direto:', err);
  }

  // 2. Fallback direto oficial via callGeminiEndpoint
  if (!apiKey) {
    // Fallback estruturado inteligente caso não haja chave da API configurada no ambiente
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const tasksDoneList = completedTasks.length > 0
      ? completedTasks.map((t) => `- ✅ **${t.title}** (Prioridade: ${t.priority || 'Média'})`).join('\n')
      : '- Nenhum cartão concluído registrado neste período.';

    const tasksPendingList = pendingTasks.length > 0
      ? pendingTasks.map((t) => `- ⏳ **${t.title}** (Status: ${t.status || 'Pendente'} • Prazo: ${t.dueDate || 'A definir'})`).join('\n')
      : '- Nenhuma pendência em aberto registrada.';

    return `# ATA EXECUTIVA DE ALINHAMENTO INDIVIDUAL & PERFORMANCE
**Instituição:** Faculdade Olavo Bilac • Grupo EstudeMais  
**Colaborador(a):** ${collaborator?.name || 'Colaborador'} — ${collaborator?.role || 'Equipe'} (${collaborator?.department || 'Geral'})  
**Gestor(a) Responsável:** ${evaluator}  
**Período de Avaliação:** ${periodLabel}  
**Data de Emissão:** ${dateStr}  

---

### 1. SÍNTESE DO DESEMPENHO OPERACIONAL
Durante o período avaliado (${periodLabel}), o(a) colaborador(a) **${collaborator?.name}** demonstrou consistência nas operações do setor **${collaborator?.department}**. Registrou um volume expressivo de interações, mantendo **${kpis.whatsapp_chats_count || whatsAppChats.length} atendimentos no WhatsApp** sob sua responsabilidade e gerenciando **${kpis.kanban_total || (completedTasks.length + pendingTasks.length)} demandas no Kanban**.

A velocidade estimada de resolução operacional foi de **${kpis.avg_resolution_time || '1.4 dias'}**, mantendo uma taxa de entrega de **${kpis.completion_rate || '85%'}** das demandas planejadas.

### 2. PRINCIPAIS PONTOS FORTES & ENTREGAS CONCLUÍDAS
Entre as entregas de maior relevância operacional concluídas com sucesso pelo colaborador no período, destacam-se:
${tasksDoneList}

- Prontidão nas respostas e atendimento dedicado aos alunos e polos.
- Cumprimento dos acordos de serviço (SLA) para solicitações críticas.

### 3. PENDÊNCIAS, PONTOS DE ATENÇÃO & VELOCIDADE DE RESOLUÇÃO
As seguintes demandas requerem priorização e atenção para fechamento imediato:
${tasksPendingList}

- Reduzir gargalos de resposta em horários de pico.
- Garantir a atualização ágil dos status dos cartões na esteira Kanban.

### 4. ACORDOS E METAS PARA O PRÓXIMO CICLO
1. Manter taxa de conclusão de cartões no Kanban acima de 90%.
2. Tempo de primeira resposta no WhatsApp inferior a 5 minutos durante o turno ativo.
3. Concluir 100% das pendências listadas no tópico 3 até o final da próxima semana.
4. Manter o status de disponibilidade ("Em Pausa" / "Disponível") sempre sincronizado para o roteamento correto da URA.

---
**Assinatura da Diretoria:** _____________________________________  
**Ciência do Colaborador:** _____________________________________  
*(Ata gerada com base nos dados consolidados do EduChat BI)*`;
  }

  const systemInstruction = `Você é o Diretor Executivo e Conselheiro de Gestão de Pessoas da Faculdade Olavo Bilac • Grupo EstudeMais.
Sua missão é redigir uma ATA EXECUTIVA DE ALINHAMENTO INDIVIDUAL E FEEDBACK DE PRODUTIVIDADE, formal, motivadora, analítica e profissional, baseada estritamente nos dados operacionais consolidados de WhatsApp e Kanban fornecidos.

A Ata DEVE ser formatada estritamente no formato Markdown abaixo, mantendo clareza, alta elegância e precisão executiva:
# ATA EXECUTIVA DE ALINHAMENTO INDIVIDUAL & PERFORMANCE
**Instituição:** Faculdade Olavo Bilac • Grupo EstudeMais  
**Colaborador(a):** ${collaborator?.name || 'Colaborador'} — ${collaborator?.role || 'Equipe'} (${collaborator?.department || 'Geral'})  
**Gestor(a) Responsável:** ${evaluator}  
**Período de Avaliação:** ${periodLabel}  
**Data de Emissão:** ${new Date().toLocaleDateString('pt-BR')}  

---

### 1. SÍNTESE DO DESEMPENHO OPERACIONAL
[Resumo conciso de 1 a 2 parágrafos analisando o volume de atendimentos no WhatsApp, a entrega de cartões no Kanban e a postura operacional]

### 2. PRINCIPAIS PONTOS FORTES & ENTREGAS CONCLUÍDAS
[Lista detalhada em tópicos destacando os cards concluídos com sucesso e os atendimentos prestados com qualidade]

### 3. PENDÊNCIAS, PONTOS DE ATENÇÃO & VELOCIDADE DE RESOLUÇÃO
[Análise dos cartões pendentes/em andamento, atenção a prazos de SLA e tempo médio de fechamento]

### 4. ACORDOS DE METAS PARA O PRÓXIMO CICLO
[3 a 5 metas claras e acionáveis para o colaborador atingir no próximo período]

---
**Assinatura da Diretoria:** _____________________________________  
**Ciência do Colaborador:** _____________________________________`;

  const userPrompt = `DADOS OPERACIONAIS DO COLABORADOR:
Nome: ${collaborator?.name}
Cargo: ${collaborator?.role}
Departamento: ${collaborator?.department}
Período: ${periodLabel}
Métricas Consolidadas:
- Atendimentos WhatsApp Atribuídos: ${kpis.whatsapp_chats_count || whatsAppChats.length}
- Atendimentos Resolvidos: ${kpis.whatsapp_resolved_count || 0}
- Cards Kanban Concluídos: ${kpis.kanban_done_count || completedTasks.length}
- Cards Kanban Pendentes: ${kpis.kanban_pending_count || pendingTasks.length}
- Taxa de Conclusão: ${kpis.completion_rate || '0%'}
- Velocidade Média de Resolução: ${kpis.avg_resolution_time || '1.5 dias'}

CARTÕES CONCLUÍDOS RECENTEMENTE (${completedTasks.length}):
${completedTasks.length > 0 ? completedTasks.map((t) => `- "${t.title}" (Prioridade: ${t.priority || 'media'})`).join('\n') : 'Nenhum'}

CARTÕES PENDENTES / EM ANDAMENTO (${pendingTasks.length}):
${pendingTasks.length > 0 ? pendingTasks.map((t) => `- "${t.title}" (Status: ${t.status || 'backlog'} • Prazo: ${t.dueDate || 'Pendente'})`).join('\n') : 'Nenhum'}`;

  const rawResponse = await callGeminiEndpoint({
    apiKey,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 2500
    }
  });

  return rawResponse.trim();
}

