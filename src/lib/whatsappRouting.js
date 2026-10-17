// Motor de Roteamento de Webhook WhatsApp & URA Inteligente
// Embarca as 3 Portas de Entrada: Carteira Ativa, Aluno Veterano (Opção C) e Números Inéditos (URA Dinâmica)
import { matchesDepartment, normalizeName } from './portfolioAccess';

/**
 * Converte data/timestamp para o fuso horário de Brasília (America/Sao_Paulo / UTC-3)
 * e determina se está fora do expediente comercial (19:00 ou mais, antes das 08:00 ou fim de semana).
 */
export function getBrasiliaTime(dateOrTimestamp = new Date()) {
  let date;
  if (!dateOrTimestamp) {
    date = new Date();
  } else if (dateOrTimestamp instanceof Date) {
    date = dateOrTimestamp;
  } else if (typeof dateOrTimestamp === 'number') {
    date = new Date(dateOrTimestamp > 1e11 ? dateOrTimestamp : dateOrTimestamp * 1000);
  } else if (typeof dateOrTimestamp === 'string' && !isNaN(Number(dateOrTimestamp))) {
    const n = Number(dateOrTimestamp);
    date = new Date(n > 1e11 ? n : n * 1000);
  } else {
    date = new Date(dateOrTimestamp);
    if (isNaN(date.getTime())) date = new Date();
  }

  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short'
    });
    const parts = formatter.formatToParts(date);
    let hour = 0;
    let minute = 0;
    let weekday = '';
    for (const p of parts) {
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
      if (p.type === 'weekday') weekday = p.value;
    }
    const isWeekend =
      weekday.toLowerCase().startsWith('sáb') ||
      weekday.toLowerCase().startsWith('dom') ||
      weekday.toLowerCase().startsWith('sat') ||
      weekday.toLowerCase().startsWith('sun');
    // Regra 1: Fora de expediente = 19:00 ou mais (hour >= 19), antes das 08:00 (hour < 8) ou fim de semana
    const isAfterHours = hour >= 19 || hour < 8 || isWeekend;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, weekday, isAfterHours, timeStr };
  } catch (_e) {
    const spMs = date.getTime() - (3 * 3600 * 1000);
    const spDate = new Date(spMs);
    const hour = spDate.getUTCHours();
    const minute = spDate.getUTCMinutes();
    const day = spDate.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const isAfterHours = hour >= 19 || hour < 8 || isWeekend;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, weekday: '', isAfterHours, timeStr };
  }
}

export const INITIAL_WHATSAPP_CONTACTS = [
  {
    id: 'wa-5511930594591',
    remoteJid: '91122697298017@lid',
    remoteJidAlt: '5511930594591@s.whatsapp.net',
    name: 'Flávio Alexandre Motta',
    phone: '+55 11 93059-4591',
    avatar: '👨‍💼',
    department: 'Diretoria / Gestão',
    assignee: 'Flávio Motta',
    assigned_to: 'u1',
    status: 'carteira_ativa',
    statusLabel: 'WhatsApp Oficial (Ativo)',
    aiActive: false,
    lastInteraction: 'Agora',
    triageContext: 'Canal direto com a Diretoria no WhatsApp Oficial (+55 11 93059-4591).'
  },
  {
    id: 'wa-152093449003127_lid',
    remoteJid: '152093449003127@lid',
    name: 'Evyllinn Gomes',
    phone: '152093449003127',
    avatar: '👩‍🎓',
    department: 'Secretaria Acadêmica',
    assignee: 'Ana Paula',
    assigned_to: 'u7',
    status: 'carteira_ativa',
    statusLabel: 'Aluna Ativa',
    aiActive: false,
    lastInteraction: 'Recente',
    triageContext: 'Aguardando retorno sobre emissão de documentos e status de matrícula.'
  },
  {
    id: 'wa-49371504767063_lid',
    remoteJid: '49371504767063@lid',
    name: 'Gabriel Camargo',
    phone: '49371504767063',
    avatar: '👨‍💼',
    department: 'Comercial & Vendas',
    assignee: 'Gabriel Carvalho',
    assigned_to: 'u3',
    status: 'carteira_ativa',
    statusLabel: 'Equipe / Comercial',
    aiActive: false,
    lastInteraction: 'Recente',
    triageContext: 'Acompanhamento de demandas comerciais e novos polos.'
  },
  {
    id: 'wa-lucas-mendes',
    name: 'Lucas Mendes (Lead MBA)',
    phone: '+55 11 98765-4321',
    avatar: '👨‍💼',
    department: 'Comercial',
    assignee: 'Gabriel Carvalho',
    assigned_to: 'u3',
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
    assigned_to: 'u2',
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
    assigned_to: 'u7',
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
    assigned_to: null,
    status: 'ura_inedito',
    statusLabel: 'Novo Lead (URA)',
    aiActive: true, // Bot URA em andamento
    lastInteraction: 'Há 2 min',
    triageContext: 'Primeiro contato recebido via WhatsApp. Aguardando seleção no menu de opções.'
  }
];

export const INITIAL_WHATSAPP_MESSAGES = {
  'wa-5511930594591': [
    {
      id: 'wa_flavio_1',
      senderId: 'wa-5511930594591',
      senderName: 'Flávio Alexandre Motta',
      text: 'Flávio, consegui eliminar todas as matrículas e analisei todos os documentos.',
      timestamp: '14:30',
      isWhatsApp: true,
      fromStudent: true
    },
    {
      id: 'wa_flavio_2',
      senderId: 'u1',
      senderName: 'Você',
      text: 'Excelente! Amanhã pegamos o dia para fechar os Ejas restantes.',
      timestamp: '14:32',
      isWhatsApp: true,
      fromStudent: false
    },
    {
      id: 'wa_flavio_3',
      senderId: 'wa-5511930594591',
      senderName: 'Flávio Alexandre Motta',
      text: 'ola .. teste',
      timestamp: 'Agora',
      isWhatsApp: true,
      fromStudent: true
    }
  ],
  'wa-91122697298017_lid': [
    {
      id: 'wa_flavio_1',
      senderId: 'wa-91122697298017_lid',
      senderName: 'Flávio Alexandre Motta',
      text: 'Flávio, consegui eliminar todas as matrículas e analisei todos os documentos.',
      timestamp: '14:30',
      isWhatsApp: true,
      fromStudent: true
    },
    {
      id: 'wa_flavio_2',
      senderId: 'u1',
      senderName: 'Você',
      text: 'Excelente! Amanhã pegamos o dia para fechar os Ejas restantes.',
      timestamp: '14:32',
      isWhatsApp: true,
      fromStudent: false
    },
    {
      id: 'wa_flavio_3',
      senderId: 'wa-91122697298017_lid',
      senderName: 'Flávio Alexandre Motta',
      text: 'ola .. teste',
      timestamp: 'Agora',
      isWhatsApp: true,
      fromStudent: true
    }
  ],
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
// REGRA REESTRUTURADA: Nenhuma auto-atribuição de atendente ocorre antes da escolha da URA.
// A atribuição DEVE ocorrer estritamente APÓS a escolha do departamento na URA.
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
  const timeInfo = getBrasiliaTime();

  if (!timeInfo.isAfterHours) {
    console.log(`⏸️ [Decisão Webhook] Horário Comercial (Hora Brasília: ${timeInfo.timeStr})`);
  } else {
    console.log(`🤖 [Decisão Webhook] Fora de Expediente (Hora Brasília: ${timeInfo.timeStr})`);
  }

  const existingContact = (contacts || []).find((c) => {
    if (!c) return false;
    const cPhone = (c.phone || '').replace(/\D/g, '');
    const cIdDigits = (c.id || '').replace(/\D/g, '');
    return (cPhone && cPhone === cleanPhone) || (cIdDigits && cIdDigits === cleanPhone);
  });

  // Se o contato JÁ FOI explicitamente atendido/atribuído pós-URA por um consultor humano,
  // mantém o atendimento com ele (sem reatribuir desnecessariamente a cada mensagem recebida)
  const isAlreadyAssigned =
    existingContact &&
    existingContact.assignee &&
    existingContact.assignee !== 'Bot de Triagem URA' &&
    existingContact.assignee !== 'Assistente IA' &&
    existingContact.assignee !== 'Aguardando' &&
    existingContact.assignee !== 'Aguardando URA' &&
    existingContact.status !== 'ura_inedito';

  if (isAlreadyAssigned) {
    const consultant = collaborators.find((c) => c.name === existingContact.assignee || c.id === existingContact.assigned_to);
    return {
      routeType: 'EXISTING_ASSIGNMENT',
      door: 1,
      doorName: 'Atendimento em Andamento (Já Atribuído Pós-URA)',
      isDirectToConsultant: true,
      targetAssignee: existingContact.assignee,
      assigned_to: existingContact.assigned_to || consultant?.id || null,
      targetDepartment: existingContact.department || 'Comercial',
      consultantId: consultant?.id || existingContact.assigned_to || null,
      notificationText: `📌 Mensagem de ${senderName} (${existingContact.assignee})`,
      badgeNotificationUserIds: consultant ? [consultant.id] : [],
      autoReply: null
    };
  }

  // Se for fora de expediente e NÃO houver atendimento humano em andamento:
  if (timeInfo.isAfterHours) {
    return {
      routeType: 'AFTER_HOURS_AI',
      door: 4,
      doorName: 'Porta Noturna: Autoatendimento IA Fora de Expediente',
      isDirectToConsultant: false,
      targetAssignee: null,
      assigned_to: null,
      targetDepartment: existingContact?.department || 'Triagem URA',
      notificationText: `🌙 [Fora de Expediente] Mensagem de ${senderName} recebida pela IA.`,
      badgeNotificationUserIds: [],
      aiActive: true,
      systemMessage: `Fora de Expediente: IA assumiu o atendimento de ${senderName} (${timeInfo.timeStr} BRT).`,
      autoReply: null
    };
  }

  // ENTRADA NORMAL: Qualquer nova mensagem antes da URA entra SEM atendente atribuído (assigned_to = null)
  const uraMenuText = generateDynamicURAMenu(channels, collaborators);
  return {
    routeType: 'BRAND_NEW_URA',
    door: 3,
    doorName: 'Triagem URA (Aguardando Seleção de Departamento)',
    isDirectToConsultant: false,
    targetAssignee: null,
    assigned_to: null,
    targetDepartment: 'Triagem URA',
    notificationText: `✨ Novo contato ${senderName} aguardando escolha na URA.`,
    badgeNotificationUserIds: [],
    autoReply: uraMenuText,
    triagePrompt: 'URA disparada. Aguardando escolha de departamento do aluno.'
  };
}

/**
 * Processador de Resposta da URA com Round-Robin e Controle de Disponibilidade:
 * 1. O motor de roteamento SÓ DEVE ser acionado quando o webhook/chat receber a seleção do departamento feita pelo aluno.
 * 2. O sistema busca utilizadores do departamento selecionado onde is_available === true.
 * 3. Se 1 utilizador disponível: atribui a ele (assigned_to = ID).
 * 4. Se múltiplos disponíveis: distribui via Round-Robin (para o utilizador há mais tempo sem receber atendimento).
 * 5. Se TODOS estiverem em pausa: o chat fica assigned_to = null na fila do departamento, aguardando alguém ficar online.
 */
export function processTriageResponse(
  userChoiceText,
  contextType = 'ura_inedito',
  channels = [],
  collaborators = [],
  lastAssignmentMap = {}
) {
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

  // 3. Busca utilizadores do departamento selecionado
  const deptCollabs = (collaborators || []).filter(
    (c) => !c.isBot && matchesDepartment(c.department, matchedDept.name)
  );

  // 4. Filtra apenas os que estão DISPONÍVEIS (is_available !== false)
  const availableCollabs = deptCollabs.filter(
    (c) => c.is_available !== false
  );

  let assignedUser = null;
  let isAllPaused = false;
  let handOffMessage = '';

  if (availableCollabs.length === 0) {
    // SE TODOS estiverem em pausa (ou nenhum colaborador cadastrado):
    // o chat fica assigned_to = null na fila do departamento, aguardando alguém ficar online.
    isAllPaused = true;
    assignedUser = null;
    handOffMessage = `Sua solicitação foi direcionada para a fila de **${matchedDept.name}**. No momento todos os consultores deste setor estão em intervalo/pausa (almoço). Seu atendimento está reservado e você será atendido com prioridade assim que um consultor retornar!`;
  } else if (availableCollabs.length === 1) {
    // Se 1 utilizador disponível: atribui a ele (assigned_to = ID)
    assignedUser = availableCollabs[0];
    handOffMessage = `🎯 Demanda classificada e encaminhada para o setor de **${matchedDept.name}** com o consultor(a) **${assignedUser.name}**. O consultor já recebeu seu histórico!`;
  } else {
    // Se múltiplos disponíveis: distribui via Round-Robin (para o utilizador há mais tempo sem receber atendimento)
    const sorted = [...availableCollabs].sort((a, b) => {
      const timeA = typeof lastAssignmentMap[a.id] === 'number' ? lastAssignmentMap[a.id] : 0;
      const timeB = typeof lastAssignmentMap[b.id] === 'number' ? lastAssignmentMap[b.id] : 0;
      return timeA - timeB; // menor timestamp = há mais tempo sem receber atendimento
    });
    assignedUser = sorted[0];
    handOffMessage = `🎯 Demanda classificada e encaminhada para o setor de **${matchedDept.name}** com o consultor(a) **${assignedUser.name}**. O consultor já recebeu seu histórico!`;
  }

  // Localiza canal correspondente
  const matchingChannel = (channels || []).find(
    (ch) => matchesDepartment(ch.department, matchedDept.name) || normalizeName(ch.name) === normalizeName(matchedDept.name)
  );

  const numEmoji = EMOJI_NUMBERS[optionIndex] || `${optionIndex + 1}️⃣`;

  return {
    department: matchedDept.name,
    assignee: assignedUser ? assignedUser.name : null,
    assigneeId: assignedUser ? assignedUser.id : null,
    assigned_to: assignedUser ? assignedUser.id : null,
    isAllPaused,
    availableCount: availableCollabs.length,
    channelId: matchingChannel?.id || `c-${normalizeName(matchedDept.name)}`,
    triageLabel: `${numEmoji} ${matchedDept.label}`,
    taskTitle: `Novo Atendimento: ${matchedDept.name}`,
    priority: matchedDept.name === 'Financeiro' || matchedDept.name === 'Comercial' ? 'alta' : 'media',
    isUpsell: contextType === 'veterano_retencao',
    handOffMessage
  };
}
