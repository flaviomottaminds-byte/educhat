export const INITIAL_COLLABORATORS = [
  { id: 'u1', name: 'Flávio Motta', role: 'Diretor / Gestor', avatar: '👨‍💼', online: true },
  { id: 'u2', name: 'Fernanda Silva', role: 'Financeiro & Splits', avatar: '👩‍💻', online: true },
  { id: 'u3', name: 'Carlos Eduardo', role: 'Suporte a Polos', avatar: '👨‍🔧', online: true },
  { id: 'u4', name: 'Juliana Mendes', role: 'Secretaria Acadêmica', avatar: '👩‍🏫', online: false },
  { id: 'u5', name: 'Roberto Lima', role: 'Comercial & Matrículas', avatar: '👨‍💼', online: true },
];

export const INITIAL_CHANNELS = [
  { id: 'c-geral', name: 'geral', desc: 'Comunicados e avisos gerais da empresa', unread: 0 },
  { id: 'c-financeiro', name: 'financeiro', desc: 'Fechamentos, notas fiscais, Asaas e splits', unread: 2 },
  { id: 'c-pedagogico', name: 'secretaria-pedagogica', desc: 'Emissão de certificados, eAula e processos', unread: 1 },
  { id: 'c-polos', name: 'suporte-polos', desc: 'Atendimento e demandas dos polos parceiros', unread: 0 },
  { id: 'c-diretoria', name: 'diretoria-estrategica', desc: 'Alinhamentos executivos e decisões', unread: 0 },
];

export const INITIAL_MESSAGES = {
  'c-financeiro': [
    {
      id: 'm1',
      senderId: 'u2',
      senderName: 'Fernanda Silva',
      text: 'Flávio, conferi o fechamento mensal do Polo Campinas. Teve uma divergência de R$ 350 no split da fatura nº 408.',
      timestamp: '14:20',
      actionExtracted: true,
    },
    {
      id: 'm2',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Ok Fernanda, por favor gere a 2ª via corrigida no Asaas e envie para o diretor do polo até amanhã às 12h.',
      timestamp: '14:25',
      actionExtracted: false,
    },
    {
      id: 'm3',
      senderId: 'u2',
      senderName: 'Fernanda Silva',
      text: 'Perfeito, já estou abrindo o chamado no Asaas para retificar a NFS-e também.',
      timestamp: '14:32',
      actionExtracted: false,
    }
  ],
  'c-pedagogico': [
    {
      id: 'm4',
      senderId: 'u4',
      senderName: 'Juliana Mendes',
      text: 'Temos 8 alunos que concluíram a Pós-Graduação e estão aguardando liberação do certificado de conclusão.',
      timestamp: '11:15',
      actionExtracted: false,
    },
    {
      id: 'm5',
      senderId: 'u3',
      senderName: 'Carlos Eduardo',
      text: 'Já conferi a documentação no eAula, 7 estão 100% aprovados, apenas 1 está com RG pendente.',
      timestamp: '11:40',
      actionExtracted: false,
    }
  ],
  'c-geral': [
    {
      id: 'm6',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Equipe, a partir de hoje todas as comunicações internas e alinhamentos de demandas serão centralizados aqui no EduChat. WhatsApp apenas para atendimento a clientes externos!',
      timestamp: '09:00',
      actionExtracted: false,
    }
  ]
};

export const INITIAL_TASKS = [
  {
    id: 't1',
    title: 'Retificar fatura nº 408 e emitir 2ª via Asaas (Polo Campinas)',
    desc: 'Corrigir divergência de R$ 350 no fechamento mensal do polo.',
    status: 'in_progress', // backlog, in_progress, waiting, done
    priority: 'alta', // alta, media, baixa
    assignee: 'Fernanda Silva',
    assigneeAvatar: '👩‍💻',
    dueDate: 'Amanhã, 12:00',
    channel: '#financeiro',
    sourceMessage: 'Flávio: "gere a 2ª via corrigida no Asaas e envie para o diretor do polo até amanhã às 12h."'
  },
  {
    id: 't2',
    title: 'Liberar certificados de 7 alunos de Pós-Graduação',
    desc: 'Documentação validada no eAula pela secretaria.',
    status: 'backlog',
    priority: 'media',
    assignee: 'Juliana Mendes',
    assigneeAvatar: '👩‍🏫',
    dueDate: '16/10/2026',
    channel: '#secretaria-pedagogica',
    sourceMessage: 'Juliana: "Temos 8 alunos que concluíram a Pós-Graduação..."'
  },
  {
    id: 't3',
    title: 'Cobrar RG pendente do aluno Carlos Alberto',
    desc: 'Documento faltante para emissão do diploma.',
    status: 'waiting',
    priority: 'baixa',
    assignee: 'Carlos Eduardo',
    assigneeAvatar: '👨‍🔧',
    dueDate: '18/10/2026',
    channel: '#secretaria-pedagogica',
    sourceMessage: 'Carlos: "apenas 1 está com RG pendente."'
  },
  {
    id: 't4',
    title: 'Configuração do Certificado Digital A1 no Asaas',
    desc: 'Ativação das NFS-e automatizadas para os fechamentos.',
    status: 'done',
    priority: 'alta',
    assignee: 'Flávio Motta',
    assigneeAvatar: '👨‍💼',
    dueDate: '14/10/2026',
    channel: '#diretoria-estrategica',
    sourceMessage: 'Concluído com sucesso na Matriz.'
  }
];
