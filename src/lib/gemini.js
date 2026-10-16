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
 * Vinculação Automática de Usuário (Requisito 2):
 * Cruza o nome extraído na ata ou o departamento com os usuários reais cadastrados no EduChat.
 */
export function matchCollaboratorToTask(responsavelNome = '', departamentoRaw = '', collaborators = []) {
  const activeUsers = (collaborators || []).filter((c) => !c.isBot && c.roleType !== 'bot');
  const normName = normalizeText(responsavelNome);
  const normDept = normalizeDepartmentName(departamentoRaw);

  // 1. Mapeamento de apelidos e nomes executivos frequentes nas reuniões do Google Meet
  const aliasRules = [
    { match: ['ana livia', 'ana lívia', 'livia'], targetName: 'Ana Livia', defaultDept: 'Marketing' },
    { match: ['yasmin'], targetName: 'Yasmin', defaultDept: 'Marketing' },
    { match: ['tati', 'tati salatinos', 'tatiane', 'tatiane salatinos'], targetName: 'Tatiane Salatinos', defaultDept: 'Comercial' },
    { match: ['gabriel', 'gabriel carvalho'], targetName: 'Gabriel Carvalho', defaultDept: 'Comercial' },
    { match: ['wagner'], targetName: 'Wagner', defaultDept: 'Comercial' },
    { match: ['michele', 'michele cristina'], targetName: 'Michele Cristina', defaultDept: 'Comercial' },
    { match: ['clarice', 'clarice oliveira'], targetName: 'Clarice Oliveira', defaultDept: 'Comercial' },
    { match: ['luiz', 'luiz augusto', 'terapia educacional'], targetName: 'Luiz Augusto', defaultDept: 'Expansão' },
    { match: ['gislaine', 'giih', 'gislaine santos'], targetName: 'Gislaine Santos', defaultDept: 'Secretaria' },
    { match: ['ana paula', 'paula'], targetName: 'Ana Paula', defaultDept: 'Secretaria' },
    { match: ['larissa', 'larissa machado'], targetName: 'Larissa Machado', defaultDept: 'Secretaria' },
    { match: ['lindomar'], targetName: 'Lindomar', defaultDept: 'Pedagógico' },
    { match: ['paulo', 'paulo do vale'], targetName: 'Paulo do Vale', defaultDept: 'Pedagógico' },
    { match: ['raquel', 'raquel lopes'], targetName: 'Raquel Lopes', defaultDept: 'Tutoria' },
    { match: ['flavio', 'flavio motta'], targetName: 'Flávio Motta', defaultDept: 'Diretoria' }
  ];

  if (normName) {
    // Tenta correspondência direta ou parcial na lista dinâmica de colaboradores do Supabase
    const directMatch = activeUsers.find((u) => {
      const uNorm = normalizeText(u.name);
      const firstToken = uNorm.split(' ')[0];
      return uNorm === normName || uNorm.includes(normName) || normName.includes(uNorm) || (firstToken.length >= 3 && normName.includes(firstToken));
    });

    if (directMatch) {
      return {
        assigneeId: directMatch.id,
        assignee: directMatch.name,
        assigneeEmail: directMatch.email || '',
        assigneeAvatar: directMatch.avatar || '👤',
        department: normDept !== 'Geral' ? normDept : (directMatch.department || 'Geral')
      };
    }

    // Tenta pelas regras de apelidos
    for (const rule of aliasRules) {
      if (rule.match.some((alias) => normName.includes(alias))) {
        const foundInCollab = activeUsers.find((u) => normalizeText(u.name).includes(normalizeText(rule.targetName)));
        if (foundInCollab) {
          return {
            assigneeId: foundInCollab.id,
            assignee: foundInCollab.name,
            assigneeEmail: foundInCollab.email || '',
            assigneeAvatar: foundInCollab.avatar || '👤',
            department: normDept !== 'Geral' ? normDept : (foundInCollab.department || rule.defaultDept)
          };
        }
        return {
          assigneeId: null,
          assignee: rule.targetName,
          assigneeEmail: '',
          assigneeAvatar: '👤',
          department: normDept !== 'Geral' ? normDept : rule.defaultDept
        };
      }
    }
  }

  // 2. Se não identificou pelo nome, vincula ao especialista titular do departamento
  if (normDept && normDept !== 'Geral') {
    const deptUser = activeUsers.find((u) => normalizeText(u.department) === normalizeText(normDept));
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

  return {
    assigneeId: null,
    assignee: responsavelNome || 'Equipe Responsável',
    assigneeEmail: '',
    assigneeAvatar: '👤',
    department: normDept || 'Geral'
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

  const teamRoster = (collaborators || [])
    .filter((c) => !c.isBot)
    .map((c) => `- ${c.name} (Setor: ${c.department || 'Geral'} | Cargo: ${c.role || 'Colaborador'} | Email: ${c.email || ''})`)
    .join('\n');

  const systemInstruction = `Você é o Motor de Automação Executiva do EduChat.
Sua função é ler atas e anotações de reuniões do Google Meet (enviadas por gemini-notes@google.com ou coladas pelo usuário), focar com máxima atenção na seção "Próximas etapas" (ou "Action Items" / "Encaminhamentos" / "Tarefas") e extrair TODAS as tarefas acionáveis.

EQUIPE OFICIAL CADASTRADA NO SISTEMA:
${teamRoster}

REGRAS DE VINCULAÇÃO DE NOMES E DEPARTAMENTOS:
- Ana Lívia / Ana Livia / Yasmin -> departamento: "Marketing"
- Tatiane Salatinos / Tati Salatinos / Gabriel Carvalho / Wagner / Michele / Clarice -> departamento: "Comercial"
- Luiz Augusto / Terapia Educacional / Polos / Expansão -> departamento: "Expansão"
- Gislaine Santos / Ana Paula / Larissa Machado -> departamento: "Secretaria"
- Lindomar / Paulo do Vale -> departamento: "Pedagógico"
- Raquel Lopes -> departamento: "Tutoria"
- Flávio Motta -> departamento: "Diretoria"

Retorne ESTRITAMENTE um array JSON válido (sem blocos markdown ao redor), onde cada objeto possui exatamente as chaves:
[
  {
    "departamento": "Marketing | Comercial | Expansão | Secretaria | Pedagógico | Tutoria | Financeiro | Diretoria",
    "titulo_curto": "Título objetivo da ação (máx 70 caracteres)",
    "descricao_tarefa": "Descrição completa e clara da tarefa extraída da ata",
    "responsavel_nome": "Nome exato do colaborador responsável identificado na ata",
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
      collaborators
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
