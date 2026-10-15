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

// Motor de Resposta do Copiloto de IA para Consultas de Colaboradores (com RAG de Documentos Aprendidos)
export function answerCopilotQuery(query, user, vipClients = [], customGuidelines = '', learnedDocuments = []) {
  const q = query.toLowerCase();

  // 1. Busca em Documentos e Memorandos Aprendidos (RAG Institucional)
  const matchingDoc = learnedDocuments.find((doc) => {
    const titleMatch = q.includes(doc.title.toLowerCase().slice(0, 15));
    const keywordMatch = doc.keywords && doc.keywords.some((kw) => q.includes(kw.toLowerCase()));
    const textMatch = doc.textContent && doc.textContent.toLowerCase().includes(q.slice(0, 20));
    return titleMatch || keywordMatch || textMatch;
  });

  if (matchingDoc) {
    return `Olá ${user?.name.split(' ')[0]}! Localizei a resposta diretamente nos nossos **documentos internos aprendidos**:\n\n` +
      `📄 **Documento:** *${matchingDoc.title}*\n` +
      `📅 **Data de Publicação:** ${matchingDoc.uploadDate}\n` +
      `💡 **Resumo da Diretriz:**\n${matchingDoc.summary || matchingDoc.textContent?.slice(0, 250) + '...'}\n\n` +
      `Essa regra foi devidamente memorizada e está sendo aplicada automaticamente nas demandas do Kanban!`;
  }

  // 2. Dúvidas sobre o MEC
  if (q.includes('mec') || q.includes('portaria') || q.includes('legislação') || q.includes('lei') || q.includes('prazo de diploma') || q.includes('diploma') || q.includes('certificado')) {
    return `Olá ${user?.name.split(' ')[0]}! Consultando as diretrizes oficiais do MEC e nossos regulamentos:\n\n` +
      `📜 **Prazos Oficiais do MEC (Portaria 1.095/2018):**\n` +
      `• **Graduação:** O prazo legal para emissão e registro do diploma é de até **60 dias corridos** após a colação de grau (prorrogável por mais 60 com justificativa comprovada).\n` +
      `• **Pós-Graduação (Resolução CNE/CES 1/2018):** Certificados de pós lato sensu exigem carga mínima de 360 horas e histórico integralizado.\n` +
      `• **Documentos Obrigatórios:** RG/CNH legível, histórico escolar e certidão de nascimento/casamento sem divergência.\n\n` +
      `Se precisar que a Secretaria Acadêmica atue nesse processo, posso abrir uma demanda automática agora. Deseja registrar?`;
  }

  // 3. Dúvidas sobre Financeiro, Asaas, Splits e Notas Fiscais
  if (q.includes('asaas') || q.includes('split') || q.includes('fatura') || q.includes('nota fiscal') || q.includes('financeiro') || q.includes('comissão')) {
    return `Olá ${user?.name.split(' ')[0]}! Sobre procedimentos financeiros e Asaas:\n\n` +
      `💰 **Procedimento Padrão (POP Asaas):**\n` +
      `1. Em caso de divergência em fatura ou split de polo, localize a cobrança original no painel Asaas;\n` +
      `2. Cancele e emita nova cobrança com os valores e repasses corrigidos;\n` +
      `3. O SLA para retificação de faturas é de **até 24 horas** (ou **4 horas** para Polos VIP com Plano Fixo);\n` +
      `4. Notas Fiscais (NFS-e) são emitidas com base no split líquido conciliado.\n\n` +
      `Caso precise que o setor Financeiro analise uma fatura específica, basta me informar os detalhes!`;
  }

  // 4. Dúvidas sobre Polos VIP e Clientes
  if (q.includes('vip') || q.includes('polo') || q.includes('parceiro') || q.includes('plano fixo')) {
    const vipList = vipClients.map(v => `• **${v.name}:** ${v.plan}`).join('\n');
    return `Olá ${user?.name.split(' ')[0]}! Aqui está a nossa lista de Polos VIP e diretrizes de atendimento prioritário:\n\n` +
      `👑 **Polos com Plano Fixo (Atendimento VIP - SLA máx. 4h):**\n` +
      `${vipList}\n\n` +
      `📌 *Regra da Diretoria:* Qualquer chamado ou dúvida originada desses parceiros ganha automaticamente a tag VIP e prioridade máxima no Kanban!`;
  }

  // 5. Dúvidas sobre Expansão e Matrículas
  if (q.includes('matrícula') || q.includes('matricula') || q.includes('comercial') || q.includes('expansão') || q.includes('polo novo')) {
    return `Olá ${user?.name.split(' ')[0]}! Para novas matrículas e abertura de polos parceiros:\n\n` +
      `🎯 **Fluxo Comercial & Expansão:**\n` +
      `• Cadastro inicial e envio da proposta pelo Comercial;\n` +
      `• Validação contratual e integração com a Expansão (Luiz Augusto);\n` +
      `• Liberação de turmas e acessos no eAula pela Secretaria.\n\n` +
      `Posso te ajudar a encaminhar alguma solicitação para o Comercial ou Expansão?`;
  }

  // Resposta Geral Inteligente
  return `Olá ${user?.name.split(' ')[0]}! Sou o Copiloto de IA do EduChat. Estou conectado às regras da empresa, diretrizes do MEC e histórico de processos.\n\n` +
    `Como posso te orientar? Você pode me perguntar sobre:\n` +
    `• 📜 **Prazos e portarias do MEC** (diplomas, certificados, pós);\n` +
    `• 💳 **Fechamentos no Asaas e splits de polos**;\n` +
    `• 👑 **Polos VIP e SLAs prioritários**;\n` +
    `• 📄 **Memorandos e documentos internos aprendidos**;\n` +
    `• 📋 **Abertura e acompanhamento de demandas no Kanban**.\n\n` +
    `Digite sua dúvida ou instrução com o que você precisa!`;
}
