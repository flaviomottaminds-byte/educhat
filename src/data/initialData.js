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
  if (activeChat.type === 'channel') return activeChat.id;
  const ids = [currentUserId, activeChat.id].sort();
  return `dm-${ids[0]}-${ids[1]}`;
};

export const INITIAL_TASKS = [];
