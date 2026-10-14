export const INITIAL_COLLABORATORS = [
  { id: 'u1', name: 'Flávio Motta', role: 'Diretor / Gestor', roleType: 'diretor', avatar: '👨‍💼', online: true, department: 'Diretoria' },
  { id: 'u2', name: 'Fernanda Silva', role: 'Financeiro & Splits', roleType: 'colaborador', avatar: '👩‍💻', online: true, department: 'Financeiro' },
  { id: 'u3', name: 'Carlos Eduardo', role: 'Suporte a Polos', roleType: 'colaborador', avatar: '👨‍🔧', online: true, department: 'Atendimento' },
  { id: 'u4', name: 'Juliana Mendes', role: 'Secretaria Acadêmica', roleType: 'colaborador', avatar: '👩‍🏫', online: false, department: 'Secretaria' },
  { id: 'u5', name: 'Roberto Lima', role: 'Comercial & Matrículas', roleType: 'colaborador', avatar: '👨‍💼', online: true, department: 'Comercial' },
];

export const INITIAL_CHANNELS = [
  { id: 'c-geral', name: 'geral', desc: 'Comunicados e avisos gerais da empresa', unread: 0, department: 'Todos' },
  { id: 'c-financeiro', name: 'financeiro', desc: 'Fechamentos, notas fiscais, Asaas e splits', unread: 2, department: 'Financeiro' },
  { id: 'c-pedagogico', name: 'secretaria-pedagogica', desc: 'Emissão de certificados, eAula e processos', unread: 1, department: 'Secretaria' },
  { id: 'c-polos', name: 'suporte-polos', desc: 'Atendimento e demandas dos polos parceiros', unread: 0, department: 'Atendimento' },
  { id: 'c-diretoria', name: 'diretoria-estrategica', desc: 'Alinhamentos executivos e decisões', unread: 0, department: 'Diretoria' },
];

export const INITIAL_MESSAGES = {
  // Canais Departamentais (Múltiplos Colaboradores)
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
  ],

  // Conversas Privadas 1 a 1 (Estilo WhatsApp) entre Flávio e cada colaborador
  'dm-u2': [
    {
      id: 'dm1_1',
      senderId: 'u2',
      senderName: 'Fernanda Silva',
      text: 'Oi Flávio, boa tarde! Você tem 5 minutinhos para alinharmos o fechamento de comissões dos polos do mês passado?',
      timestamp: '15:10',
      actionExtracted: false,
    },
    {
      id: 'dm1_2',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Oi Fernanda! Pode falar. Os relatórios do Asaas já bateram com o extrato?',
      timestamp: '15:12',
      actionExtracted: false,
    },
    {
      id: 'dm1_3',
      senderId: 'u2',
      senderName: 'Fernanda Silva',
      text: 'Sim, tudo conciliado. Só preciso que você aprove a transferência de R$ 4.200 do Polo Salvador.',
      timestamp: '15:14',
      actionExtracted: false,
    }
  ],
  'dm-u3': [
    {
      id: 'dm2_1',
      senderId: 'u3',
      senderName: 'Carlos Eduardo',
      text: 'Flávio, o coordenador do polo de Manaus ligou elogiando a nova velocidade de liberação de cursos no eAula!',
      timestamp: '13:05',
      actionExtracted: false,
    },
    {
      id: 'dm2_2',
      senderId: 'u1',
      senderName: 'Flávio Motta',
      text: 'Excelente notícia Carlos! Esse era o nosso objetivo principal com a automação.',
      timestamp: '13:10',
      actionExtracted: false,
    }
  ],
  'dm-u4': [
    {
      id: 'dm3_1',
      senderId: 'u4',
      senderName: 'Juliana Mendes',
      text: 'Flávio, deixei na sua mesa virtual o documento de colação de grau para colher sua assinatura digital.',
      timestamp: '10:30',
      actionExtracted: false,
    }
  ],
  'dm-u5': [
    {
      id: 'dm4_1',
      senderId: 'u5',
      senderName: 'Roberto Lima',
      text: 'Fechamos mais 15 matrículas corporativas hoje com o polo de Curitiba! 🎉',
      timestamp: '16:00',
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
    department: 'Financeiro',
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
    department: 'Secretaria',
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
    department: 'Atendimento',
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
    department: 'Diretoria',
    dueDate: '14/10/2026',
    channel: '#diretoria-estrategica',
    sourceMessage: 'Concluído com sucesso na Matriz.'
  }
];
