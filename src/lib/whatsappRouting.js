// Motor de Roteamento de Webhook WhatsApp & URA Inteligente
// Embarca as 3 Portas de Entrada: Carteira Ativa, Aluno Veterano (Opção C) e Números Inéditos (URA)

export const INITIAL_WHATSAPP_CONTACTS = [
  {
    id: 'wa-lucas-mendes',
    name: 'Lucas Mendes (Lead MBA)',
    phone: '+55 11 98765-4321',
    avatar: '👨‍💼',
    department: 'Comercial',
    assignee: 'Gabriel Carvalho',
    status: 'carteira_ativa', // 'carteira_ativa' | 'veterano_retencao' | 'ura_inedito'
    statusLabel: 'Carteira Ativa',
    aiActive: false, // Atendente humano assumiu
    lastInteraction: '10 min atrás',
    triageContext: 'Negociação ativa de matrícula com bolsa para MBA em Gestão Estratégica.'
  },
  {
    id: 'wa-juliana-rocha',
    name: 'Juliana Rocha (Aluna Pós)',
    phone: '+55 19 97123-4567',
    avatar: '👩‍🎓',
    department: 'Secretaria',
    assignee: 'Ana Paula',
    status: 'veterano_retencao',
    statusLabel: 'Aluno Veterano',
    aiActive: true, // Autoatendimento IA ativo
    lastInteraction: 'Ontem',
    triageContext: 'Aluna formada em 2025. Entrou em contato para solicitar 2ª via de histórico e consultar novo curso.'
  },
  {
    id: 'wa-carlos-eduardo',
    name: 'Carlos Eduardo (Contato Inédito)',
    phone: '+55 21 99888-1122',
    avatar: '👤',
    department: 'Triagem URA',
    assignee: 'Assistente IA',
    status: 'ura_inedito',
    statusLabel: 'Novo Lead (URA)',
    aiActive: true, // Bot URA em andamento
    lastInteraction: 'Há 2 min',
    triageContext: 'Primeiro contato recebido via WhatsApp. Aguardando seleção no menu de opções.'
  }
];

export const INITIAL_WHATSAPP_MESSAGES = {
  'wa-lucas-mendes': [
    {
      id: 'wa_msg_1',
      senderId: 'wa-lucas-mendes',
      senderName: 'Lucas Mendes',
      text: 'Olá Gabriel, boa tarde! Conseguiu verificar com a diretoria se conseguem manter a condição de 30% na matrícula do MBA para pagamento à vista?',
      timestamp: '13:10',
      isWhatsApp: true,
      fromStudent: true
    },
    {
      id: 'wa_msg_2',
      senderId: 'u3',
      senderName: 'Gabriel Carvalho',
      text: 'Fala Lucas! Tudo bem? Consegui aprovação sim com o Flávio! Vou te enviar o link de inscrição com o cupom aplicado.',
      timestamp: '13:15',
      isWhatsApp: true,
      fromStudent: false
    }
  ],
  'wa-juliana-rocha': [
    {
      id: 'wa_msg_j1',
      senderId: 'wa-juliana-rocha',
      senderName: 'Juliana Rocha',
      text: 'Oi pessoal, boa tarde! Gostaria de tirar uma dúvida sobre meu certificado e também ver se tem turmas abertas para Gestão de Pessoas.',
      timestamp: '11:40',
      isWhatsApp: true,
      fromStudent: true
    },
    {
      id: 'wa_msg_j2',
      senderId: 'bot_ia_retencao',
      senderName: '🤖 Assistente EduChat',
      text: 'Olá, Juliana! Que alegria falar com você novamente! 🎓\n\nIdentifiquei em nosso sistema que você já é aluna formada da nossa instituição. Para agilizarmos seu atendimento com prioridade, sobre o que gostaria de tratar agora?\n\n1️⃣ Secretaria Acadêmica (Certificados, Histórico e Documentos)\n2️⃣ Financeiro (2ª via de boletos, declarações fiscais)\n3️⃣ Ouvidoria e Atendimento Geral\n4️⃣ Conhecer Novos Cursos (Descontos especiais para ex-alunos)',
      timestamp: '11:40',
      isWhatsApp: true,
      fromStudent: false,
      isTriageMenu: true
    }
  ],
  'wa-carlos-eduardo': [
    {
      id: 'wa_msg_c1',
      senderId: 'wa-carlos-eduardo',
      senderName: 'Carlos Eduardo',
      text: 'Boa tarde! Gostaria de informações sobre os cursos de vocês.',
      timestamp: '13:38',
      isWhatsApp: true,
      fromStudent: true
    },
    {
      id: 'wa_msg_c2',
      senderId: 'bot_ura_inedito',
      senderName: '🤖 URA EduChat',
      text: 'Olá! Seja muito bem-vindo(a) à nossa instituição! 👋\n\nPara direcionarmos seu atendimento com máxima agilidade para o setor responsável, por favor digite o número da opção desejada:\n\n1️⃣ Matrículas e Novos Cursos\n2️⃣ Tutoria e Apoio Pedagógico\n3️⃣ Financeiro e Boletos\n4️⃣ Secretaria e Documentação',
      timestamp: '13:38',
      isWhatsApp: true,
      fromStudent: false,
      isTriageMenu: true
    }
  ]
};

// Motor Central de Decisão do Webhook
export function routeIncomingWhatsAppWebhook({
  fromPhone,
  senderName = 'Contato WhatsApp',
  messageText = '',
  audioUrl = null,
  audioTranscription = null,
  tasks = [],
  collaborators = [],
  contacts = []
}) {
  const cleanPhone = (fromPhone || '').replace(/\D/g, '');

  // =========================================================================
  // REGRA DE PERMANÊNCIA DE CARTEIRA (STICKY ASSIGNMENT - ITEM 2)
  // Se o lead ou aluno já possui consultor previamente atribuído neste contato/chat,
  // NÃO sobrescreve para fila genérica ou URA: direciona estritamente para ele.
  // =========================================================================
  const existingContact = (contacts || []).find((c) => {
    if (!c) return false;
    const cPhone = (c.phone || '').replace(/\D/g, '');
    const cIdDigits = (c.id || '').replace(/\D/g, '');
    return (cPhone && cPhone === cleanPhone) || (cIdDigits && cIdDigits === cleanPhone);
  });

  if (
    existingContact &&
    existingContact.assignee &&
    existingContact.assignee !== 'Bot de Triagem URA' &&
    existingContact.assignee !== 'Assistente IA' &&
    existingContact.assignee !== 'Aguardando'
  ) {
    const consultant = collaborators.find((c) => c.name === existingContact.assignee);
    return {
      routeType: 'STICKY_PORTFOLIO',
      door: 1,
      doorName: 'Porta 1: Permanência de Carteira (Sticky Assignment)',
      isDirectToConsultant: true,
      targetAssignee: existingContact.assignee,
      targetDepartment: existingContact.department || 'Comercial',
      consultantId: consultant?.id || null,
      taskId: null,
      taskTitle: `Atendimento Contínuo: ${senderName}`,
      notificationText: `📌 Mensagem de rechamada do seu lead ${senderName} (${existingContact.assignee})`,
      badgeNotificationUserIds: consultant ? [consultant.id] : [],
      kanbanBadgeUpdate: '🔥 Mensagem de Rechamada',
      systemMessage: `Permanência de Carteira: Rechamada de ${senderName} mantida diretamente com ${existingContact.assignee} (${existingContact.department || 'Comercial'}).`,
      autoReply: null // Sem URA genérica: continuidade da relação comercial garantida
    };
  }

  // 1. Procura cards no Kanban atrelados a este telefone
  const matchingTasks = tasks.filter((t) => {
    const tPhone = (t.clientPhone || '').replace(/\D/g, '');
    const inDesc = (t.desc || '').includes(cleanPhone) || (t.sourceMessage || '').includes(cleanPhone);
    const inTitle = (t.title || '').toLowerCase().includes(senderName.toLowerCase().split(' ')[0]);
    return (tPhone && tPhone === cleanPhone) || inDesc || inTitle;
  });

  // PORTA 1: Existe Card ATIVO com Consultor Específico (Carteira Ativa)
  const activeTask = matchingTasks.find(
    (t) => t.status !== 'done' && t.status !== 'concluido'
  );

  if (activeTask) {
    const consultant = collaborators.find((c) => c.name === activeTask.assignee);
    return {
      routeType: 'ACTIVE_PORTFOLIO',
      door: 1,
      doorName: 'Porta 1: Carteira Ativa',
      isDirectToConsultant: true,
      targetAssignee: activeTask.assignee,
      targetDepartment: activeTask.department,
      consultantId: consultant?.id || null,
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      notificationText: `🔥 Mensagem do seu lead ${senderName} (${activeTask.title})`,
      badgeNotificationUserIds: consultant ? [consultant.id] : [],
      kanbanBadgeUpdate: '🔥 Mensagem Nova do Aluno',
      systemMessage: `Mensagem roteada diretamente para a fila de ${activeTask.assignee} (Carteira Ativa). A triagem geral foi poupada de notificações.`,
      autoReply: null
    };
  }

  // PORTA 2: Existe Card CONCLUÍDO (Aluno Veterano / Opção C - Retenção via IA)
  const concludedTask = matchingTasks.find(
    (t) => t.status === 'done' || t.status === 'concluido'
  );

  if (concludedTask) {
    return {
      routeType: 'VETERAN_RETENTION',
      door: 2,
      doorName: 'Porta 2: Aluno Veterano (Opção C)',
      isDirectToConsultant: false,
      targetAssignee: 'Assistente IA (Retenção)',
      targetDepartment: 'Autoatendimento IA',
      taskId: concludedTask.id,
      notificationText: `🎓 Aluno veterano ${senderName} em autoatendimento IA.`,
      badgeNotificationUserIds: [], // IA cuida primeiro, zero interrupção nos vendedores
      autoReply: `Olá, ${senderName}! Que bom falar com você novamente! 🎓\n\nIdentifiquei em nosso sistema que você já é nosso aluno(a). Para direcionarmos seu atendimento com rapidez, escolha uma opção:\n\n1️⃣ Secretaria Acadêmica (Certificados, Histórico e Documentos)\n2️⃣ Financeiro (2ª via de boletos, declarações fiscais)\n3️⃣ Ouvidoria e Atendimento Geral\n4️⃣ Conhecer Novos Cursos (Descontos especiais para ex-alunos)`,
      triagePrompt: 'Aguardando seleção do veterano no menu de 4 opções'
    };
  }

  // PORTA 3: Número Inédito (Primeiro Contato / URA Inteligente)
  return {
    routeType: 'BRAND_NEW_URA',
    door: 3,
    doorName: 'Porta 3: Número Inédito (URA de Entrada)',
    isDirectToConsultant: false,
    targetAssignee: 'Bot de Triagem URA',
    targetDepartment: 'Triagem Inicial',
    taskId: null,
    notificationText: `✨ Novo lead inédito ${senderName} recebido na URA.`,
    badgeNotificationUserIds: [], // Notifica somente após a URA classificar o setor!
    autoReply: `Olá! Seja muito bem-vindo(a) à nossa instituição! 👋\n\nPara agilizarmos seu atendimento com o consultor ideal, sobre o que gostaria de falar?\n\n1️⃣ Matrículas e Novos Cursos\n2️⃣ Tutoria e Apoio Pedagógico\n3️⃣ Financeiro e Boletos\n4️⃣ Secretaria e Documentação`,
    triagePrompt: 'URA de Entrada disparada. Aguardando escolha do lead.'
  };
}

// Processador de Resposta da URA ou Menu da IA
export function processTriageResponse(userChoiceText, contextType = 'ura_inedito', collaborators = []) {
  const text = (userChoiceText || '').toLowerCase().trim();

  // Opção 1: Matrículas e Novos Cursos (Comercial)
  if (text.includes('1') || text.includes('matr') || text.includes('curso') || text.includes('preço') || text.includes('valor') || text.includes('inscri')) {
    const commercialUser = collaborators.find((c) => c.department === 'Comercial' && !c.isBot) || { name: 'Tatiane Salatinos', id: 'u2' };
    return {
      department: 'Comercial',
      assignee: commercialUser.name,
      assigneeId: commercialUser.id,
      channelId: 'c-comercial',
      triageLabel: '1️⃣ Matrículas e Novos Cursos',
      taskTitle: 'Novo Lead: Atendimento Comercial & Matrícula',
      priority: 'alta',
      isUpsell: contextType === 'veterano_retencao',
      handOffMessage: `🎯 Demanda classificada e encaminhada para o Comercial (${commercialUser.name}). O consultor já tem acesso a este histórico completo.`
    };
  }

  // Opção 2: Tutoria / Apoio Pedagógico
  if (text.includes('2') || text.includes('tutor') || text.includes('pedag') || text.includes('aula') || text.includes('dúvida acad') || text.includes('professor')) {
    const tutoriaUser = collaborators.find((c) => c.department === 'Tutoria' && !c.isBot) || { name: 'Raquel Lopes', id: 'u6' };
    return {
      department: 'Tutoria',
      assignee: tutoriaUser.name,
      assigneeId: tutoriaUser.id,
      channelId: 'c-tutoria',
      triageLabel: '2️⃣ Tutoria e Apoio Pedagógico',
      taskTitle: 'Dúvida Acadêmica / Acompanhamento Pedagógico',
      priority: 'media',
      isUpsell: false,
      handOffMessage: `🎓 Demanda classificada e encaminhada para a Tutoria Acadêmica (${tutoriaUser.name}).`
    };
  }

  // Opção 3: Financeiro e Boletos
  if (text.includes('3') || text.includes('financ') || text.includes('boleto') || text.includes('pagamento') || text.includes('acordo') || text.includes('fatura')) {
    const dirUser = collaborators.find((c) => c.roleType === 'diretor') || { name: 'Flávio Motta', id: 'u1' };
    return {
      department: 'Financeiro',
      assignee: dirUser.name,
      assigneeId: dirUser.id,
      channelId: 'c-geral',
      triageLabel: '3️⃣ Financeiro e Boletos',
      taskTitle: 'Solicitação Financeira: 2ª Via / Negociação',
      priority: 'alta',
      isUpsell: false,
      handOffMessage: `💰 Demanda classificada e encaminhada para o Financeiro.`
    };
  }

  // Opção 4: Secretaria e Documentos
  if (text.includes('4') || text.includes('secret') || text.includes('certif') || text.includes('diploma') || text.includes('hist') || text.includes('document')) {
    const secUser = collaborators.find((c) => c.department === 'Secretaria' && !c.isBot) || { name: 'Ana Paula', id: 'u7' };
    return {
      department: 'Secretaria',
      assignee: secUser.name,
      assigneeId: secUser.id,
      channelId: 'c-secretaria',
      triageLabel: '4️⃣ Secretaria e Documentação',
      taskTitle: 'Demanda de Secretaria: Emissão de Documento / Certidão',
      priority: 'media',
      isUpsell: false,
      handOffMessage: `📋 Demanda classificada e encaminhada para a Secretaria Acadêmica (${secUser.name}).`
    };
  }

  // Fallback: Resposta livre não mapeada diretamente nos números
  return null;
}
