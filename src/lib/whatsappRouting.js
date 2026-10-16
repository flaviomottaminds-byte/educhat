// Motor de Roteamento de Webhook WhatsApp & URA Inteligente
// Embarca as 3 Portas de Entrada: Carteira Ativa, Aluno Veterano (Opção C) e Números Inéditos (URA Dinâmica)
import { matchesDepartment, normalizeName } from './portfolioAccess';

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
    id: 'wa-mariana-costa',
    name: 'Mariana Costa (Lead Graduação)',
    phone: '+55 11 97654-3210',
    avatar: '👩‍💼',
    department: 'Comercial',
    assignee: 'Tatiane Salatinos',
    status: 'carteira_ativa',
    statusLabel: 'Carteira Ativa',
    aiActive: false,
    lastInteraction: '15 min atrás',
    triageContext: 'Interessada no curso de Pedagogia EAD. Atendimento da carteira de Tatiane Salatinos.'
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
  'wa-mariana-costa': [
    {
      id: 'wa_msg_m1',
      senderId: 'wa-mariana-costa',
      senderName: 'Mariana Costa',
      text: 'Olá Tatiane, boa tarde! Gostaria de saber os valores e a grade da licenciatura em Pedagogia EAD.',
      timestamp: '14:20',
      isWhatsApp: true,
      fromStudent: true
    },
    {
      id: 'wa_msg_m2',
      senderId: 'u2',
      senderName: 'Tatiane Salatinos',
      text: 'Olá Mariana! Tudo ótimo? Claro! Vou te encaminhar a matriz curricular e o plano com condição especial desta semana.',
      timestamp: '14:25',
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
      text: 'Olá, Juliana! Que alegria falar com você novamente! 🎓\n\nIdentifiquei em nosso sistema que você já é aluna formada da nossa instituição. Para agilizarmos seu atendimento com prioridade, sobre o que gostaria de tratar agora?\n\n1️⃣ Tutoria & Apoio Pedagógico\n2️⃣ Secretaria Acadêmica & Documentos\n3️⃣ Coordenação Pedagógica\n4️⃣ Comercial & Novas Matrículas\n5️⃣ Expansão & Polos',
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
      text: 'Olá! Seja muito bem-vindo(a) à nossa instituição! 👋\n\nPara direcionarmos seu atendimento com máxima agilidade para o setor responsável, por favor digite o número da opção desejada:\n\n1️⃣ Tutoria e Apoio Pedagógico\n2️⃣ Secretaria Acadêmica e Documentos\n3️⃣ Coordenação Pedagógica\n4️⃣ Comercial e Novas Matrículas\n5️⃣ Expansão e Polos Parceiros',
      timestamp: '13:38',
      isWhatsApp: true,
      fromStudent: false,
      isTriageMenu: true
    }
  ]
};

const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Mapeamento e descoberta dinâmica de Departamentos para a URA.
 * Sempre que um novo canal ou departamento for criado, é incorporado automaticamente.
 */
export function getAvailableURADepartments(channels = [], collaborators = []) {
  // Lista padrão base prioritária recomendada
  const baseOrder = [
    { name: 'Tutoria', label: 'Tutoria e Apoio Pedagógico', icon: '🎓', keywords: ['tutoria', 'tutor', 'duvida', 'aula', 'ead', 'professor'] },
    { name: 'Secretaria', label: 'Secretaria Acadêmica e Documentos', icon: '📋', keywords: ['secretaria', 'documento', 'diploma', 'certificado', 'historico', 'declaracao'] },
    { name: 'Pedagógico', label: 'Coordenação Pedagógica', icon: '👨‍🏫', keywords: ['pedagogico', 'coordenacao', 'grade', 'disciplina', 'ementa', 'matriz'] },
    { name: 'Comercial', label: 'Comercial e Novas Matrículas', icon: '🎯', keywords: ['comercial', 'matricula', 'curso', 'pos', 'mba', 'graduacao', 'valor', 'inscricao', 'preco'] },
    { name: 'Expansão', label: 'Expansão e Polos Parceiros', icon: '🚀', keywords: ['expansao', 'polo', 'parceria', 'unidade', 'convenio'] },
    { name: 'Financeiro', label: 'Financeiro e Boletos', icon: '💰', keywords: ['financeiro', 'boleto', 'pagamento', 'fatura', 'acordo', 'mensalidade', 'segunda via'] },
    { name: 'Marketing', label: 'Marketing e Comunicação', icon: '👩‍🎨', keywords: ['marketing', 'comunicacao', 'imprensa', 'divulgacao'] }
  ];

  const deptMap = new Map();
  baseOrder.forEach((d) => deptMap.set(normalizeName(d.name), d));

  // Incorporação dinâmica dos canais cadastrados no sistema
  channels.forEach((ch) => {
    if (!ch) return;
    const rawDept = ch.department || ch.name;
    if (!rawDept || rawDept === 'Todos' || rawDept === 'Geral' || rawDept === 'geral') return;

    const norm = normalizeName(rawDept);
    if (!deptMap.has(norm)) {
      deptMap.set(norm, {
        name: rawDept,
        label: rawDept,
        icon: '🏢',
        keywords: [norm, normalizeName(ch.name)]
      });
    }
  });

  return Array.from(deptMap.values());
}

/**
 * Gera o texto do menu da URA formatado com numeração automática
 */
export function generateDynamicURAMenu(channels = [], collaborators = []) {
  const departments = getAvailableURADepartments(channels, collaborators);

  const menuLines = departments.map((dept, idx) => {
    const num = EMOJI_NUMBERS[idx] || `${idx + 1}️⃣`;
    return `${num} ${dept.label}`;
  });

  return `Olá! Seja muito bem-vindo(a) à nossa instituição! 👋\n\nPara agilizarmos seu atendimento com o consultor ideal, por favor digite o número da opção desejada:\n\n${menuLines.join('\n')}`;
}

// Motor Central de Decisão do Webhook
export function routeIncomingWhatsAppWebhook({
  fromPhone,
  senderName = 'Contato WhatsApp',
  messageText = '',
  audioUrl = null,
  audioTranscription = null,
  tasks = [],
  collaborators = [],
  contacts = [],
  channels = []
}) {
  const cleanPhone = (fromPhone || '').replace(/\D/g, '');

  // =========================================================================
  // REGRA DE PERMANÊNCIA DE CARTEIRA (STICKY ASSIGNMENT)
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
      autoReply: null
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

  const uraMenuText = generateDynamicURAMenu(channels, collaborators);

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
      badgeNotificationUserIds: [],
      autoReply: `Olá, ${senderName}! Que bom falar com você novamente! 🎓\n\nIdentifiquei em nosso sistema que você já é nosso aluno(a). Para direcionarmos seu atendimento com rapidez, escolha uma opção:\n\n${uraMenuText.replace(/Olá! Seja muito bem-vindo\(a\) à nossa instituição! 👋\n\nPara agilizarmos seu atendimento com o consultor ideal, por favor digite o número da opção desejada:\n\n/, '')}`,
      triagePrompt: 'Aguardando seleção do veterano no menu da URA'
    };
  }

  // PORTA 3: Número Inédito (Primeiro Contato / URA Dinâmica de Entrada)
  return {
    routeType: 'BRAND_NEW_URA',
    door: 3,
    doorName: 'Porta 3: Número Inédito (URA de Entrada)',
    isDirectToConsultant: false,
    targetAssignee: 'Bot de Triagem URA',
    targetDepartment: 'Triagem Inicial',
    taskId: null,
    notificationText: `✨ Novo lead inédito ${senderName} recebido na URA.`,
    badgeNotificationUserIds: [],
    autoReply: uraMenuText,
    triagePrompt: 'URA de Entrada disparada. Aguardando escolha do lead.'
  };
}

/**
 * Processador de Resposta da URA ou Menu da IA com resolução dinâmica de departamentos e canais
 */
export function processTriageResponse(userChoiceText, contextType = 'ura_inedito', channels = [], collaborators = []) {
  const text = (userChoiceText || '').toLowerCase().trim();
  const departments = getAvailableURADepartments(channels, collaborators);

  let matchedDept = null;
  let optionIndex = -1;

  // 1. Tenta extrair número exato digitado (ex: "1", "2", "3", "opção 1", etc.)
  const numMatch = text.match(/\b([1-9]|10)\b/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < departments.length) {
      matchedDept = departments[idx];
      optionIndex = idx;
    }
  }

  // 2. Se não casou por número, verifica palavras-chave dos departamentos
  if (!matchedDept) {
    for (let i = 0; i < departments.length; i++) {
      const d = departments[i];
      const normD = normalizeName(d.name);
      if (text.includes(normD) || d.keywords.some((kw) => text.includes(kw))) {
        matchedDept = d;
        optionIndex = i;
        break;
      }
    }
  }

  if (!matchedDept) {
    return null;
  }

  // Localiza consultor do departamento nos colaboradores cadastrados
  const deptCollab = (collaborators || []).find(
    (c) => !c.isBot && matchesDepartment(c.department, matchedDept.name)
  );

  // Fallback inteligente de consultores por setor caso não haja colaborador cadastrado na fila
  const fallbackConsultants = {
    'tutoria': { name: 'Raquel Lopes', id: 'u6' },
    'secretaria': { name: 'Ana Paula', id: 'u7' },
    'pedagógico': { name: 'Flávio Motta', id: 'u1' },
    'comercial': { name: 'Gabriel Carvalho', id: 'u3' },
    'expansão': { name: 'Luiz Augusto', id: 'u4' },
    'marketing': { name: 'Yasmin', id: 'u_yasmin' },
    'financeiro': { name: 'Flávio Motta', id: 'u1' }
  };

  const assignedUser = deptCollab || fallbackConsultants[normalizeName(matchedDept.name)] || {
    name: deptCollab?.name || `Fila ${matchedDept.name}`,
    id: deptCollab?.id || 'u1'
  };

  // Localiza canal correspondente
  const matchingChannel = (channels || []).find(
    (ch) => matchesDepartment(ch.department, matchedDept.name) || normalizeName(ch.name) === normalizeName(matchedDept.name)
  );

  const numEmoji = EMOJI_NUMBERS[optionIndex] || `${optionIndex + 1}️⃣`;

  return {
    department: matchedDept.name,
    assignee: assignedUser.name,
    assigneeId: assignedUser.id,
    channelId: matchingChannel?.id || `c-${normalizeName(matchedDept.name)}`,
    triageLabel: `${numEmoji} ${matchedDept.label}`,
    taskTitle: `Novo Atendimento: ${matchedDept.name}`,
    priority: matchedDept.name === 'Financeiro' || matchedDept.name === 'Comercial' ? 'alta' : 'media',
    isUpsell: contextType === 'veterano_retencao',
    handOffMessage: `🎯 Demanda classificada e encaminhada para a fila de **${matchedDept.name}** com **${assignedUser.name}**. O consultor já recebeu seu histórico!`
  };
}
