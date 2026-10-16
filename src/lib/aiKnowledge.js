// Base de Conhecimento Operacional e do MEC para a IA
export const MEC_GUIDELINES = [
  {
    topic: 'Emissão e Registro de Diplomas (Graduação)',
    rule: 'Portaria MEC nº 1.095/2018: O prazo para expedição do diploma é de até 60 dias corridos após a colação de grau, prorrogável uma única vez por igual período (máx. 120 dias). A certidão de conclusão com colação de grau tem validade provisória equivalente.'
  },
  {
    topic: 'Certificação de Pós-Graduação Lato Sensu',
    rule: 'Resolução CNE/CES nº 1/2018: Cursos de pós-graduação lato sensu exigem carga mínima de 360 horas. A emissão de certificado independe de defesa pública se o TCC for facultativo pela instituição, devendo conter obrigatoriamente o histórico com notas e frequência.'
  },
  {
    topic: 'Documentação Acadêmica Obrigatória',
    rule: 'Para expedição de qualquer certificado ou diploma, são indispensáveis: Documento oficial com foto (RG/CNH), Histórico Escolar autenticado, Certidão de Nascimento/Casamento e Diploma de Graduação (para ingressantes na Pós).'
  },
  {
    topic: 'Regulamentação e Suporte a Polos EAD',
    rule: 'Decreto nº 9.057/2017 e Portaria Normativa nº 11/2017: Os polos de apoio presencial devem garantir infraestrutura mínima para avaliações e suporte pedagógico. Demandas de polos parceiros devem ser tratadas com prioridade contratual.'
  }
];

// Cálculo Automático de Prioridade Inteligente da IA (com aprendizado contínuo de documentos)
export function analyzeTaskPriorityAI(title, description, vipClients = [], learnedDocuments = []) {
  const fullText = `${title} ${description}`.toLowerCase();

  // 1. Verifica se envolve Cliente/Polo VIP (Plano Fixo)
  const matchedVip = vipClients.find((v) => fullText.includes(v.name.toLowerCase()));
  if (matchedVip) {
    return {
      priority: 'vip',
      isVip: true,
      dueDate: 'Hoje (Até 4 horas - VIP)',
      reason: `👑 Parceiro VIP detectado: ${matchedVip.name} (${matchedVip.plan}). SLA prioritário de até 4 horas.`
    };
  }

  // 2. Consulta Documentos e Memorandos Aprendidos (Item 3)
  for (const doc of learnedDocuments) {
    const docSummaryLower = (doc.summary || '').toLowerCase();
    const docTextLower = (doc.textContent || '').toLowerCase();

    // Se o memorando estipular prazo específico ou urgência para termos citados na tarefa
    if (doc.keywords && doc.keywords.some((kw) => fullText.includes(kw.toLowerCase()))) {
      return {
        priority: doc.suggestedPriority || 'alta',
        isVip: false,
        dueDate: doc.suggestedDueDate || 'Conforme Memorando',
        reason: `📄 Regra aplicada do memorando: "${doc.title}". ${doc.summary || 'Diretriz interna institucional cadastrada.'}`
      };
    }
  }

  // 3. Verifica se envolve termos críticos do MEC, notas fiscais ou bloqueios
  const highPriorityKeywords = [
    'mec', 'portaria', 'diploma', 'nota fiscal', 'nfse', 'divergência', 'divergencia',
    'split', 'asaas', 'bloqueado', 'bloqueio', 'revisão de nota', 'colação', 'cancelamento',
    'urgente', 'rejeição', 'erro de acesso'
  ];

  const isHigh = highPriorityKeywords.some((kw) => fullText.includes(kw));
  if (isHigh) {
    return {
      priority: 'alta',
      isVip: false,
      dueDate: 'Em até 24 horas',
      reason: '⚡ Prioridade Alta definida pela IA: Demanda com impacto regulatório do MEC, financeiro (Asaas/Split) ou crítico.'
    };
  }

  // 4. Verifica demandas médias (documentação, certificados comuns, matrículas)
  const mediumPriorityKeywords = [
    'certificado', 'matrícula', 'matricula', 'histórico', 'historico', 'comprovante',
    'ementa', 'declaração', 'declaracao', 'reposição'
  ];

  const isMedium = mediumPriorityKeywords.some((kw) => fullText.includes(kw));
  if (isMedium) {
    return {
      priority: 'media',
      isVip: false,
      dueDate: 'Em até 48 horas',
      reason: '📋 Prioridade Média definida pela IA: Processo operacional padrão de secretaria ou comercial.'
    };
  }

  // 5. Demanda rotineira / Baixa
  return {
    priority: 'baixa',
    isVip: false,
    dueDate: 'Em até 72 horas',
    reason: '☕ Prioridade Baixa definida pela IA: Demanda informativa ou rotina sem prazo regulatório estrito.'
  };
}

// =========================================================================
// AI BUG TRACKER: System Prompt Oficial & Motor de Detecção e Parsing
// =========================================================================

export const AI_BUG_TRACKER_SYSTEM_PROMPT = `Você é o módulo de inteligência técnica do EduChat (AI Bug Tracker).
Sua função primária com usuários administradores (role = admin ou diretoria) é atuar como um formulário invisível de captação e cadastro de falhas técnicas.

REGRAS OBRIGATÓRIAS DE COMPORTAMENTO:
1. GATILHO & PERMISSÃO:
   - Se o remetente possuir 'role = admin' E a mensagem relatar um erro, bug, exceção, falha de interface, inconsistência de dados ou melhoria técnica: ATIVE IMEDIATAMENTE O MODO BUG TRACKER.
2. BYPASS DE SUPORTE:
   - NÃO tente dar suporte ao administrador.
   - NÃO dê instruções de 'como usar o sistema', 'recarregue a página' ou tutoriais.
   - NÃO faça perguntas adicionais desnecessárias.
   - Você é um coletor silencioso que traduz linguagem natural em chamado de engenharia de software.
3. EXTRAÇÃO DE DADOS (PARSING):
   - Extraia as informações do relato e estruture no seguinte formato JSON:
     {
       "titulo_do_bug": "Resumo técnico objetivo do problema em até 60 caracteres",
       "problema_relatado": "Descrição completa do que está falhando no sistema e seu comportamento",
       "solucao_esperada": "O que deveria acontecer ou ação técnica corretiva esperada",
       "prioridade": "baixa" | "media" | "alta"
     }
   - Critérios de Prioridade:
     * "alta": Travamento geral, perda de dados, quebra de QR Code, autenticação, áudio, webhooks essenciais ou erro bloqueante.
     * "media": Falhas de UI, modais, contadores de notificação, formatação, botões secundários.
     * "baixa": Pequenos ajustes visuais, textos, cosméticos ou sugestões incrementais.
4. INSERÇÃO NO BANCO DE DADOS:
   - Salve o JSON gerado diretamente na tabela 'bug_reports' do Supabase.
5. RESPOSTA VISUAL OBRIGATÓRIA NO CHAT:
   - Responda EXATAMENTE E APENAS:
     "🛠️ Chamado técnico registrado com sucesso no banco de dados."
   - NADA MAIS. Sem saudações prévias, sem desculpas, sem acréscimos.`;

// Validador de privilégios de Administrador / Diretor
export function isUserAdmin(user) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const roleType = (user.roleType || '').toLowerCase();
  const email = (user.email || '').toLowerCase();

  return (
    user.id === 'u1' ||
    user.isAdmin === true ||
    role === 'admin' ||
    role === 'administrador' ||
    roleType === 'diretor' ||
    roleType === 'admin' ||
    role.includes('admin') ||
    role.includes('diretor') ||
    role.includes('gestor') ||
    email.includes('flavio') ||
    email.includes('admin')
  );
}

// Identifica se a mensagem é um relato de bug / chamado técnico
export function isBugReportIntent(text) {
  if (!text || text.trim().length < 3) return false;
  const lower = text.toLowerCase();

  // 1. Padrão estruturado explícito (ex: Problema:... Ação esperada:...)
  if (
    lower.includes('problema:') ||
    lower.includes('erro:') ||
    lower.includes('falha:') ||
    lower.includes('bug:') ||
    lower.includes('ação esperada:') ||
    lower.includes('acao esperada:')
  ) {
    return true;
  }

  // 2. Termos e intenções inequívocas de falha no sistema / bug técnico (palavras-chave e raízes)
  const singleWordKeywords = [
    'bug', 'bugs', 'erro', 'erros', 'falha', 'falhas', 'defeito', 'defeitos',
    'crash', 'crashes', 'travando', 'travou', 'trava', 'quebrou', 'quebrado',
    'quebrada', 'quebrados', 'quebradas'
  ];

  // Regex para palavras isoladas (evita falsos positivos com substrings sem contexto)
  const regexPattern = new RegExp(`\\b(${singleWordKeywords.join('|')})\\b`, 'i');
  if (regexPattern.test(lower)) {
    return true;
  }

  // 3. Expressões e frases comuns de reporte de problemas
  const bugPhrases = [
    'não funciona', 'nao funciona', 'não está funcionando', 'nao esta funcionando',
    'não abre', 'nao abre', 'não está abrindo', 'nao esta abrindo',
    'não carrega', 'nao carrega', 'não está carregando', 'nao esta carregando',
    'não renderiza', 'nao renderiza', 'não está renderizando', 'nao esta renderizando',
    'não envia', 'nao envia', 'não grava', 'nao grava',
    'tela preta', 'tela branca', 'comportamento incorreto',
    'chamado técnico', 'chamado tecnico', 'melhoria técnica', 'melhoria tecnica',
    'relato de bug', 'reportar bug', 'reportar erro',
    'botão quebrado', 'botao quebrado', 'botão não clica', 'botao nao clica',
    'failed to fetch', 'rls', 'cors'
  ];

  return bugPhrases.some((phrase) => lower.includes(phrase));
}

// Extrai e formata os dados do bug em JSON estruturado
export function parseBugReport(text, user) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  let titulo = '';
  let problema = '';
  let solucao = '';
  let prioridade = 'media';

  // 1. Parsing para formato estruturado
  if (lower.includes('problema:')) {
    const probMatch = trimmed.match(/problema:\s*([\s\S]+?)(?=(causa prov[aá]vel:|a[cç][aã]o esperada:|$))/i);
    if (probMatch) problema = probMatch[1].trim();

    const acaoMatch = trimmed.match(/a[cç][aã]o esperada:\s*([\s\S]+?)$/i);
    if (acaoMatch) solucao = acaoMatch[1].trim();

    if (!solucao) {
      const causaMatch = trimmed.match(/causa prov[aá]vel:\s*([\s\S]+?)$/i);
      if (causaMatch) solucao = `Investigar e corrigir: ${causaMatch[1].trim()}`;
    }

    if (problema) {
      const firstSentence = problema.split(/[.\n]/)[0].trim();
      titulo = firstSentence.length > 60 ? firstSentence.slice(0, 57) + '...' : firstSentence;
    }
  }

  // 2. Parsing para linguagem natural não estruturada
  if (!problema) {
    problema = trimmed;
    const clean = trimmed
      .replace(/^(tem um bug|identifiquei um bug|bug[:\s-]*|erro[:\s-]*|falha[:\s-]*|relato de bug[:\s-]*)/i, '')
      .replace(/^no sistema[:\s-]*/i, '')
      .trim();

    const first = clean.split(/[.\n!?;]/)[0].trim();
    if (first.length > 5) {
      titulo = first.charAt(0).toUpperCase() + first.slice(1);
      if (titulo.length > 60) titulo = titulo.slice(0, 57) + '...';
    } else {
      titulo = 'Falha técnica relatada pelo administrador';
    }

    if (lower.includes('deveria') || lower.includes('precisa') || lower.includes('esperado') || lower.includes('corrigir')) {
      const solMatch = trimmed.match(/(?:deveria|precisa|esperado|corrigir)\s+([\s\S]+?)(?=[.]|$)/i);
      solucao = solMatch ? `Ajustar para que ${solMatch[1].trim()}` : 'Ajustar o sistema conforme o comportamento esperado da especificação.';
    } else {
      solucao = 'Analisar causa raiz e aplicar correção no front-end/back-end.';
    }
  }

  // 3. Classificação de Prioridade
  const highPriorityKeywords = [
    'crítico', 'critico', 'urgente', 'travando', 'crash', 'login', 'banco', 'perda',
    'bloqueio', 'qr code', 'áudio', 'audio', 'não funciona nada', 'parou tudo',
    'webhook', 'pagamento', 'asaas', 'offline', 'derrubou'
  ];
  const lowPriorityKeywords = [
    'melhoria', 'sugestão', 'sugestao', 'layout', 'cor', 'ajuste visual', 'espaçamento',
    'cosmético', 'cosmetico', 'texto', 'typo'
  ];

  if (highPriorityKeywords.some((kw) => lower.includes(kw))) {
    prioridade = 'alta';
  } else if (lowPriorityKeywords.some((kw) => lower.includes(kw))) {
    prioridade = 'baixa';
  } else {
    prioridade = 'media';
  }

  return {
    titulo_do_bug: titulo || 'Correção técnica no sistema',
    problema_relatado: problema || trimmed,
    solucao_esperada: solucao || 'Corrigir falha técnica apontada no relato.',
    prioridade
  };
}

// Motor de Resposta do Copiloto de IA para Consultas de Colaboradores (100% conectado ao Gemini Real + AI Bug Tracker)
export function answerCopilotQuery(query, user) {
  const isAdmin = isUserAdmin(user);

  if (isAdmin && isBugReportIntent(query)) {
    const bugData = parseBugReport(query, user);
    return {
      isBugReport: true,
      reply: '🛠️ Chamado técnico registrado com sucesso no banco de dados.',
      bugData
    };
  }

  return '⚠️ Configure sua Chave da API do Google Gemini em "Cérebro da IA (Regras & VIPs)" para consultar o Assistente IA (MEC & Processos) em tempo real.';
}

