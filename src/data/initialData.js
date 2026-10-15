export const INITIAL_COLLABORATORS = [
  { id: 'u1', name: 'Flávio Motta', email: 'flavio@educhat.com', role: 'Diretor Executivo / Gestor Geral', roleType: 'diretor', avatar: '👨‍💼', online: true, department: 'Diretoria' },
  { id: 'u2', name: 'Tatiane Salatinos', email: 'tati2009tati@gmail.com', role: 'Comercial & Matrículas', roleType: 'colaborador', avatar: '👩‍💼', online: true, department: 'Comercial' },
  { id: 'u3', name: 'Gabriel Carvalho', email: 'gahenriquecamargo@gmail.com', role: 'Comercial & Vendas', roleType: 'colaborador', avatar: '👨‍💼', online: true, department: 'Comercial' },
  { id: 'u4', name: 'Michele Cristina', email: 'migp1308@gmail.com', role: 'Comercial & Atendimento', roleType: 'colaborador', avatar: '👩‍💻', online: true, department: 'Comercial' },
  { id: 'u5', name: 'Clarice Oliveira', email: 'claricealvespj23@gmail.com', role: 'Comercial & Suporte', roleType: 'colaborador', avatar: '👩‍💼', online: true, department: 'Comercial' },
  { id: 'u6', name: 'Raquel Lopes', email: 'raquelcarmodo@gmail.com', role: 'Tutoria Acadêmica', roleType: 'colaborador', avatar: '👩‍🏫', online: true, department: 'Tutoria' },
  { id: 'u7', name: 'Ana Paula', email: 'paula.estudemais@gmail.com', role: 'Secretaria Acadêmica', roleType: 'colaborador', avatar: '👩‍💼', online: true, department: 'Secretaria' },
  { id: 'u8', name: 'Larissa Machado', email: 'larissa.machado30089@gmail.com', role: 'Secretaria & Documentos', roleType: 'colaborador', avatar: '👩‍💻', online: true, department: 'Secretaria' },
  { id: 'u9', name: 'Gislaine Santos', email: 'giih.5569@gmail.com', role: 'Secretaria & Diplomas', roleType: 'colaborador', avatar: '👩‍💼', online: true, department: 'Secretaria' },
  { id: 'u10', name: 'Ana Livia', email: 'analiviamarquesribeiro@gmail.com', role: 'Marketing & Comunicação', roleType: 'colaborador', avatar: '👩‍🎨', online: true, department: 'Marketing' },
  { id: 'u11', name: 'Paulo do Vale', email: 'paulos.dovale@gmail.com', role: 'Coordenação Pedagógica', roleType: 'colaborador', avatar: '👨‍🏫', online: true, department: 'Pedagógico' },
  { id: 'u12', name: 'Luiz Augusto', email: 'luizdomingues08844@gmail.com', role: 'Expansão & Parcerias de Polos', roleType: 'colaborador', avatar: '👨‍💼', online: true, department: 'Expansão' },
  { id: 'u_ia_copilot', name: 'Assistente IA (MEC & Processos)', email: 'ia@educhat.internal', role: 'Inteligência Artificial Institucional', roleType: 'bot', avatar: '🤖', online: true, department: 'Inteligência Artificial', isBot: true },
];

export const INITIAL_CHANNELS = [
  { id: 'c-geral', name: 'geral', desc: 'Comunicados oficiais e avisos gerais para toda a equipe', unread: 0, department: 'Todos' },
  { id: 'c-comercial', name: 'comercial', desc: 'Atendimentos, negociações e matrículas', unread: 0, department: 'Comercial' },
  { id: 'c-tutoria', name: 'tutoria', desc: 'Acompanhamento e suporte acadêmico aos alunos', unread: 0, department: 'Tutoria' },
  { id: 'c-secretaria', name: 'secretaria', desc: 'Processos, documentação, históricos e certidões', unread: 0, department: 'Secretaria' },
  { id: 'c-marketing', name: 'marketing', desc: 'Campanhas, captação de leads, mídias e comunicação', unread: 0, department: 'Marketing' },
  { id: 'c-pedagogico', name: 'pedagogico', desc: 'Conteúdos, matrizes curriculares e professores', unread: 0, department: 'Pedagógico' },
  { id: 'c-expansao', name: 'expansao', desc: 'Novos polos, parceiros e crescimento institucional', unread: 0, department: 'Expansão' },
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
      actionExtracted: false,
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

