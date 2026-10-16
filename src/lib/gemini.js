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

/**
 * Constrói o System Instruction completo injetando 100% da Memória Organizacional:
 * Clientes VIP, Prazos MEC/SLAs, POPs, Documentos Aprendidos e Diretrizes da Diretoria.
 */
export function buildSystemInstruction({
  student = null,
  vipClients = [],
  learnedDocuments = [],
  pops = [],
  slas = [],
  customPrompt = '',
  department = 'Geral',
  userName = 'Colaborador'
}) {
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

  if (vipClients && vipClients.length > 0) {
    prompt += `=== CLIENTES VIP & PARCEIROS ESTRATÉGICOS (PRIORIDADE MÁXIMA) ===\n`;
    vipClients.forEach((vip) => {
      prompt += `• ${vip.name} (${vip.role || 'Parceiro VIP'}) — Tel: ${vip.phone || '-'} | Prioridade: ${vip.priority || 'Crítica / SLA 15min'}\n`;
    });
    prompt += `\n`;
  }

  if (slas && slas.length > 0) {
    prompt += `=== PRAZOS MEC & SLAS OPERACIONAIS POR SETOR ===\n`;
    slas.forEach((s) => {
      prompt += `• Setor ${s.department || s.setor}: SLA ${s.sla || s.prazo || '24h'} — Regra MEC/Interna: ${s.mecDeadline || s.regra || '-'}\n`;
    });
    prompt += `\n`;
  }

  if (pops && pops.length > 0) {
    prompt += `=== PROCEDIMENTOS OPERACIONAIS PADRÃO (POPs DA INSTITUIÇÃO) ===\n`;
    pops.forEach((p) => {
      prompt += `• [${p.department || 'Geral'}] ${p.title || p.name}: ${p.content || p.desc || p.description || p.steps || ''}\n`;
    });
    prompt += `\n`;
  }

  if (learnedDocuments && learnedDocuments.length > 0) {
    prompt += `=== DOCUMENTOS INTERNOS E MEMORANDOS CARREGADOS NO CENTRO DE APRENDIZADO ===\n`;
    learnedDocuments.forEach((doc, idx) => {
      prompt += `[DOCUMENTO ${idx + 1}: ${doc.title} | Setor: ${doc.department || 'Geral'}]\n`;
      if (doc.summary) prompt += `Resumo: ${doc.summary}\n`;
      if (doc.rules && doc.rules.length > 0) prompt += `Regras Extraídas: ${doc.rules.join(' | ')}\n`;
      if (doc.deadlines && doc.deadlines.length > 0) prompt += `Prazos Extraídos: ${doc.deadlines.join(' | ')}\n`;
      if (doc.textContent) prompt += `Conteúdo Integral/Trecho:\n${doc.textContent.slice(0, 2500)}\n`;
      prompt += `\n`;
    });
  }

  prompt += `=== LEGISLAÇÃO E DIRETRIZES OFICIAIS DO MEC ===\n`;
  prompt += `• Portaria MEC nº 1.095/2018: Expedição e registro de diplomas em até 60 dias corridos após a colação de grau (prorrogável por mais 60 dias mediante justificativa formal).\n`;
  prompt += `• Resolução CNE/CES nº 1/2018: Pós-Graduação Lato Sensu exige carga horária mínima de 360 horas e conclusão prévia de curso superior.\n`;
  prompt += `• Aproveitamento de Estudos e Convalidação: Exige análise de equivalência mínima de 75% de carga horária e conteúdo programático no Histórico Oficial e Ementas.\n\n`;

  if (customPrompt) {
    prompt += `=== DIRETRIZES ESPECÍFICAS DA DIRETORIA ===\n${customPrompt}\n\n`;
  }

  prompt += `=== INSTRUÇÕES DE RESPOSTA ===\n`;
  prompt += `1. Responda sempre em português claro, objetivo, estruturado e profissional.\n`;
  prompt += `2. Utilize prioritariamente os POPs, Prazos MEC, Clientes VIP e Documentos carregados acima no systemInstruction.\n`;
  prompt += `3. Quando pertinente, indique qual setor (${department}) ou responsável interno deve conduzir a etapa operacional.\n`;

  return prompt;
}

/**
 * Chamada direta e oficial ao endpoint REST do Google Gemini (gemini-2.5-flash)
 */
async function callGeminiEndpoint({ apiKey, contents, systemInstruction, generationConfig = {} }) {
  const body = {
    contents,
    ...(systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        }
      : {}),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      ...generationConfig
    }
  };

  let response = await fetch(
    `${GEMINI_ENDPOINT_BASE}/${PRIMARY_GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok && response.status === 404) {
    response = await fetch(
      `${GEMINI_ENDPOINT_BASE}/${FALLBACK_GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
    throw new Error(`Erro na API Gemini (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('A API do Gemini retornou uma resposta vazia.');
  }
  return text.trim();
}

/**
 * 1. Chat e Assistente IA (MEC & Processos) — 100% conectado à API oficial do Gemini (sem mocks de palavras-chave)
 */
export async function generateGeminiChatReply({
  message,
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

  const systemInstruction = buildSystemInstruction({
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
  const recentHistory = (history || []).slice(-10);
  recentHistory.forEach((h) => {
    if (!h.text) return;
    const isModel =
      h.senderId === 'u_ia_copilot' ||
      h.sender === 'ai' ||
      h.isAiAutoReply ||
      (student && !h.fromStudent && !h.senderId?.startsWith('wa-'));
    contents.push({
      role: isModel ? 'model' : 'user',
      parts: [{ text: String(h.text).slice(0, 3000) }]
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  return await callGeminiEndpoint({
    apiKey,
    contents,
    systemInstruction,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1500
    }
  });
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

  const userPrompt = `TÍTULO / ASSUNTO DA REUNIÃO: ${meetingTitle || 'Anotações da Reunião (Google Meet)'}\n\nCONTEÚDO DA ATA DO GOOGLE MEET:\n${notesText}`;

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

  const doneTasks = tasks.filter((t) => t.status === 'done');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'waiting');
  const pendingTasks = tasks.filter((t) => t.status === 'backlog');

  const formatTaskList = (list) =>
    list.length === 0
      ? 'Nenhum cartão registrado nesta coluna.'
      : list
          .map(
            (t) =>
              `- [${t.department || 'Geral'}] "${t.title}" | Responsável: ${t.assignee || 'Não atribuído'} | Prioridade: ${t.priority || 'media'} | Prazo: ${t.dueDate || '-'}${t.desc ? ` | Detalhe: ${t.desc.slice(0, 140)}` : ''}`
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
