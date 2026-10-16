export const INITIAL_COLLABORATORS = [
  { id: 'u1', name: 'Flávio Motta', email: 'flavio@educhat.com', role: 'Diretor Executivo / Gestor Geral', roleType: 'diretor', avatar: '👨‍💼', online: false, lastSeen: null, department: 'Diretoria' },
  { id: 'u2', name: 'Tatiane Salatinos', email: 'tati2009tati@gmail.com', role: 'Comercial & Matrículas', roleType: 'colaborador', avatar: '👩‍💼', online: false, lastSeen: null, department: 'Comercial' },
  { id: 'u3', name: 'Gabriel Carvalho', email: 'gahenriquecamargo@gmail.com', role: 'Comercial & Vendas', roleType: 'colaborador', avatar: '👨‍💼', online: false, lastSeen: null, department: 'Comercial' },
  { id: 'u4', name: 'Michele Cristina', email: 'migp1308@gmail.com', role: 'Comercial & Atendimento', roleType: 'colaborador', avatar: '👩‍💻', online: false, lastSeen: null, department: 'Comercial' },
  { id: 'u5', name: 'Clarice Oliveira', email: 'claricealvespj23@gmail.com', role: 'Comercial & Suporte', roleType: 'colaborador', avatar: '👩‍💼', online: false, lastSeen: null, department: 'Comercial' },
  { id: 'u6', name: 'Raquel Lopes', email: 'raquelcarmodo@gmail.com', role: 'Tutoria Acadêmica', roleType: 'colaborador', avatar: '👩‍🏫', online: false, lastSeen: null, department: 'Tutoria' },
  { id: 'u7', name: 'Ana Paula', email: 'paula.estudemais@gmail.com', role: 'Secretaria Acadêmica', roleType: 'colaborador', avatar: '👩‍💼', online: false, lastSeen: null, department: 'Secretaria' },
  { id: 'u8', name: 'Larissa Machado', email: 'larissa.machado30089@gmail.com', role: 'Secretaria & Documentos', roleType: 'colaborador', avatar: '👩‍💻', online: false, lastSeen: null, department: 'Secretaria' },
  { id: 'u9', name: 'Gislaine Santos', email: 'giih.5569@gmail.com', role: 'Secretaria & Diplomas', roleType: 'colaborador', avatar: '👩‍💼', online: false, lastSeen: null, department: 'Secretaria' },
  { id: 'u10', name: 'Ana Livia', email: 'analiviamarquesribeiro@gmail.com', role: 'Marketing & Comunicação', roleType: 'colaborador', avatar: '👩‍🎨', online: false, lastSeen: null, department: 'Marketing' },
  { id: 'u11', name: 'Paulo do Vale', email: 'paulos.dovale@gmail.com', role: 'Coordenação Pedagógica', roleType: 'colaborador', avatar: '👨‍🏫', online: false, lastSeen: null, department: 'Pedagógico' },
  { id: 'u12', name: 'Luiz Augusto', email: 'luizdomingues08844@gmail.com', role: 'Terapia Educacional & Expansão', roleType: 'colaborador', avatar: '👨‍💼', online: false, lastSeen: null, department: 'Expansão' },
  { id: 'u13', name: 'Wagner', email: 'wagner@educhat.com', role: 'Comercial & Vendas', roleType: 'colaborador', avatar: '👨‍💼', online: false, lastSeen: null, department: 'Comercial' },
  { id: 'u14', name: 'Yasmin', email: 'yasmin@educhat.com', role: 'Marketing & Comunicação', roleType: 'colaborador', avatar: '👩‍🎨', online: false, lastSeen: null, department: 'Marketing' },
  { id: 'u15', name: 'Lindomar', email: 'lindomar@educhat.com', role: 'Coordenação Pedagógica & Projetos', roleType: 'colaborador', avatar: '👨‍🏫', online: false, lastSeen: null, department: 'Pedagógico' },
  { id: 'u_ia_copilot', name: 'Assistente IA (MEC & Processos)', email: 'ia@educhat.internal', role: 'Inteligência Artificial Institucional', roleType: 'bot', avatar: '🤖', online: true, lastSeen: new Date().toISOString(), department: 'Inteligência Artificial', isBot: true },
];

export const INITIAL_CHANNELS = [
  { id: 'c-geral', name: 'geral', desc: 'Comunicados oficiais e avisos gerais para toda a equipe', unread: 0, department: 'Todos' },
  { id: 'c-comercial', name: 'comercial', desc: 'Atendimentos, negociações e matrículas', unread: 0, department: 'Comercial' },
  { id: 'c-tutoria', name: 'tutoria', desc: 'Acompanhamento e suporte acadêmico aos alunos', unread: 0, department: 'Tutoria' },
  { id: 'c-secretaria', name: 'secretaria', desc: 'Processos, documentação, históricos e certidões', unread: 0, department: 'Secretaria' },
  { id: 'c-marketing', name: 'marketing', desc: 'Campanhas, captação de leads, mídias e comunicação', unread: 0, department: 'Marketing' },
  { id: 'c-pedagogico', name: 'pedagogico', desc: 'Conteúdos, matrizes curriculares e professores', unread: 0, department: 'Pedagógico' },
  { id: 'c-expansao', name: 'expansao', desc: 'Terapia Educacional, novos polos, parceiros e expansão', unread: 0, department: 'Expansão' },
  { id: 'c-diretoria', name: 'diretoria', desc: 'Alinhamentos executivos e decisões estratégicas', unread: 0, department: 'Diretoria' },
];

export const INITIAL_MESSAGES = {
  'c-geral': [
    {
      id: 'msg_welcome_official',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Equipe, sejam todos muito bem-vindos ao EduChat! 🎉\n\nA partir de hoje, todas as nossas comunicações internas, alinhamentos intersetoriais e demandas no quadro Kanban serão centralizados aqui. O WhatsApp continuará sendo utilizado apenas para o atendimento aos nossos alunos e polos externos.\n\nConto com a colaboração e o empenho de todos para uma gestão mais ágil e transparente!',
      timestamp: '09:00',
      actionExtracted: false
    },
    {
      id: 'msg_geral_2',
      senderId: 'u7',
      senderName: 'Ana Paula',
      text: 'Excelente iniciativa, Flávio! O time da Secretaria já está operando 100% alinhado por aqui.',
      timestamp: '09:15',
      actionExtracted: false
    },
    {
      id: 'msg_geral_3',
      senderId: 'u2',
      senderName: 'Tatiane Salatinos',
      text: 'Comercial a postos! Vamos manter os encaminhamentos das matrículas e pendências registradas diretamente no Kanban.',
      timestamp: '09:20',
      actionExtracted: false
    }
  ],
  'c-comercial': [
    {
      id: 'msg_com_1',
      senderId: 'u3',
      senderName: 'Gabriel Carvalho',
      text: 'Bom dia time! Hoje temos 45 leads de MBA e Graduação na esteira de negociação. Vamos focar nos contatos de ontem com retorno pendente.',
      timestamp: '08:45',
      actionExtracted: false
    },
    {
      id: 'msg_com_2',
      senderId: 'u2',
      senderName: 'Tatiane Salatinos',
      text: 'Perfeito, Gabriel! Estou em contato com a aluna Mariana Costa para Pedagogia EAD. Já apresentei a matriz e condições especiais.',
      timestamp: '08:52',
      actionExtracted: false
    },
    {
      id: 'msg_com_3',
      senderId: 'u4',
      senderName: 'Michele Cristina',
      text: 'Estou atendendo os novos polos e leads corporativos vindos da campanha de pós-graduação.',
      timestamp: '09:05',
      actionExtracted: false
    }
  ],
  'c-secretaria': [
    {
      id: 'msg_sec_1',
      senderId: 'u7',
      senderName: 'Ana Paula',
      text: 'Meninas, concluímos a validação dos 28 históricos do Polo Campinas. Todos aptos para certificação.',
      timestamp: '09:10',
      actionExtracted: false
    },
    {
      id: 'msg_sec_2',
      senderId: 'u9',
      senderName: 'Gislaine Santos',
      text: 'Perfeito, Ana! Já estou emitindo as declarações de conclusão e atualizando o status dos alunos no EduControl.',
      timestamp: '09:18',
      actionExtracted: false
    },
    {
      id: 'msg_sec_3',
      senderId: 'u8',
      senderName: 'Larissa Machado',
      text: 'Lembrando que os chamados de 2ª via de diploma com prazo de 48h foram todos protocolados no sistema.',
      timestamp: '09:30',
      actionExtracted: false
    }
  ],
  'c-tutoria': [
    {
      id: 'msg_tut_1',
      senderId: 'u6',
      senderName: 'Raquel Lopes',
      text: 'Plantão de tutoria aberto! Alunos com dúvidas no TCC de Gestão e nos exercícios de Pedagogia já estão sendo respondidos no AVA.',
      timestamp: '08:30',
      actionExtracted: false
    },
    {
      id: 'msg_tut_2',
      senderId: 'u11',
      senderName: 'Paulo do Vale',
      text: 'Excelente, Raquel! Os materiais complementares do módulo 3 foram disponibilizados na biblioteca virtual.',
      timestamp: '08:45',
      actionExtracted: false
    }
  ],
  'c-marketing': [
    {
      id: 'msg_mkt_1',
      senderId: 'u10',
      senderName: 'Ana Livia',
      text: 'Criativos da campanha de inverno aprovados pela diretoria. Iniciaremos a veiculação no Meta Ads e Google Ads hoje às 14h.',
      timestamp: '10:00',
      actionExtracted: false
    },
    {
      id: 'msg_mkt_2',
      senderId: 'u14',
      senderName: 'Yasmin',
      text: 'Métricas da semana: CPL reduziu 18% na campanha de MBA Executivo. O volume de leads qualificados subiu para 68/dia.',
      timestamp: '10:15',
      actionExtracted: false
    }
  ],
  'c-pedagogico': [
    {
      id: 'msg_ped_1',
      senderId: 'u11',
      senderName: 'Paulo do Vale',
      text: 'Revisão das ementas dos cursos de pós concluída de acordo com as novas diretrizes do MEC.',
      timestamp: '09:40',
      actionExtracted: false
    },
    {
      id: 'msg_ped_2',
      senderId: 'u15',
      senderName: 'Lindomar',
      text: 'Agendamos o alinhamento com os coordenadores de polo para quinta-feira às 15h.',
      timestamp: '09:55',
      actionExtracted: false
    }
  ],
  'c-expansao': [
    {
      id: 'msg_exp_1',
      senderId: 'u12',
      senderName: 'Luiz Augusto',
      text: 'Alinhamento com o Polo Salvador e parceiros do Nordeste em andamento. Contratos do Plano Fixo em fase de assinatura.',
      timestamp: '10:30',
      actionExtracted: false
    }
  ],
  'c-diretoria': [
    {
      id: 'msg_dir_1',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Pauta da semana: monitoramento diário da esteira de conversão e acompanhamento das metas de retenção e atendimento WhatsApp.',
      timestamp: '08:00',
      actionExtracted: false
    }
  ],
  'dm-u1-u2': [
    {
      id: 'msg_dm_tati_1',
      senderId: 'u2',
      senderName: 'Tatiane Salatinos',
      text: 'Flávio, bom dia! Conseguiu avaliar a solicitação de desconto especial para o fechamento corporativo da Fama?',
      timestamp: '09:12',
      actionExtracted: false
    },
    {
      id: 'msg_dm_tati_2',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Bom dia, Tatiane! Aprovado com 25% de margem. Pode fechar o contrato com eles hoje.',
      timestamp: '09:14',
      actionExtracted: false
    }
  ],
  'dm-u1-u3': [
    {
      id: 'msg_dm_gabriel_1',
      senderId: 'u3',
      senderName: 'Gabriel Carvalho',
      text: 'Flávio, o lead Lucas Mendes do MBA fechou a matrícula à vista! Já criei a demanda no Kanban para a Secretaria.',
      timestamp: '13:20',
      actionExtracted: false
    },
    {
      id: 'msg_dm_gabriel_2',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Excelente trabalho, Gabriel! Mantenha a atenção aos demais contatos da carteira.',
      timestamp: '13:25',
      actionExtracted: false
    }
  ]
};

export const getChatKey = (activeChat, currentUserId) => {
  if (!activeChat) return 'c-geral';
  if (activeChat.type === 'channel' || activeChat.type === 'whatsapp') return activeChat.id;
  const ids = [currentUserId, activeChat.id].sort();
  return `dm-${ids[0]}-${ids[1]}`;
};

export const normalizeChatKey = (rawKey, currentUserId = 'u1') => {
  if (!rawKey) return 'c-geral';
  if (rawKey.startsWith('wa-')) return rawKey;
  if (rawKey.includes('@s.whatsapp.net') || rawKey.includes('@c.us')) {
    const digits = rawKey.split('@')[0].replace(/\D/g, '');
    if (digits) return `wa-${digits}`;
  }
  if (/^\+?\d{10,15}$/.test(String(rawKey).trim())) {
    return `wa-${String(rawKey).replace(/\D/g, '')}`;
  }
  if (rawKey.startsWith('dm-')) {
    const rawIds = rawKey.replace('dm-', '').split('-').filter(Boolean);
    if (rawIds.length === 1) {
      const otherId = rawIds[0];
      const partner = (currentUserId && currentUserId !== otherId) ? currentUserId : 'u1';
      const ids = [partner, otherId].sort();
      return `dm-${ids[0]}-${ids[1]}`;
    }
    if (rawIds.length >= 2) {
      const ids = [rawIds[0], rawIds[1]].sort();
      return `dm-${ids[0]}-${ids[1]}`;
    }
  }

  // Normalização de Canais de Comunicação (Ex: 'geral', '#geral', 'c-geral')
  const cleanChannel = rawKey.replace(/^#/, '').trim().toLowerCase();
  if (cleanChannel === 'geral' || cleanChannel === 'c-geral') return 'c-geral';

  const matchedChannel = INITIAL_CHANNELS.find(
    (c) => c.id === rawKey || c.id === `c-${cleanChannel}` || c.name.toLowerCase() === cleanChannel
  );
  if (matchedChannel) return matchedChannel.id;

  return rawKey;
};

export const INITIAL_TASKS = [
  {
    id: 't_wa_lucas',
    title: 'Matrícula MBA Gestão Estratégica - Lucas Mendes',
    desc: 'Lead qualificado com interesse em MBA. Solicitou bolsa de 30% para pagamento à vista.',
    status: 'in_progress',
    priority: 'alta',
    isVip: false,
    assignee: 'Gabriel Carvalho',
    assigneeAvatar: '👨‍💼',
    department: 'Comercial',
    dueDate: 'Hoje (16:00)',
    channel: '📱 WhatsApp (+55 11 98765-4321)',
    clientPhone: '+55 11 98765-4321',
    sourceMessage: 'WhatsApp: "+55 11 98765-4321" • Lucas Mendes',
    requester: 'WhatsApp Receptivo',
    requesterDept: 'Comercial',
    comments: [],
    attachments: []
  },
  {
    id: 't_wa_juliana',
    title: 'Emissão de Certificado de Pós - Juliana Rocha',
    desc: 'Aluna concluiu carga horária de Pós em Pedagogia. Certificado gerado e assinado digitalmente.',
    status: 'done',
    priority: 'media',
    isVip: false,
    assignee: 'Ana Paula',
    assigneeAvatar: '👩‍💼',
    department: 'Secretaria',
    dueDate: 'Concluído',
    channel: '📱 WhatsApp (+55 19 97123-4567)',
    clientPhone: '+55 19 97123-4567',
    sourceMessage: 'WhatsApp: "+55 19 97123-4567" • Juliana Rocha',
    requester: 'Secretaria Acadêmica',
    requesterDept: 'Secretaria',
    comments: [],
    attachments: []
  }
];

