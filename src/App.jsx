import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import KanbanBoard from './components/KanbanBoard';
import GestaoDashboard from './components/GestaoDashboard';
import AICopilotModal from './components/AICopilotModal';
import NewItemModal from './components/NewItemModal';
import AIMemoryModal from './components/AIMemoryModal';
import {
  INITIAL_CHANNELS,
  INITIAL_COLLABORATORS,
  INITIAL_MESSAGES,
  INITIAL_TASKS
} from './data/initialData';

const INITIAL_VIP_CLIENTS = [
  { id: 'vip1', name: 'Polo Campinas', plan: 'Plano Fixo Gold', since: '2025' },
  { id: 'vip2', name: 'Polo Salvador', plan: 'Plano Fixo Ilimitado', since: '2025' },
  { id: 'vip3', name: 'Faculdade Fama', plan: 'Contrato Corporativo', since: '2026' },
  { id: 'vip4', name: 'FM Educacional', plan: 'Plano Fixo Ilimitado', since: '2026' },
];

const INITIAL_SLAS = [
  { id: 's1', department: 'Secretaria Acadêmica', demand: 'Reposições de Aulas e Notas', slaTime: '48 horas' },
  { id: 's2', department: 'Financeiro & Splits', demand: 'Retificação de Fatura / Nota Fiscal', slaTime: '24 horas' },
  { id: 's3', department: 'Suporte a Polos', demand: 'Liberação de Cursos no eAula', slaTime: '12 horas' },
];

const INITIAL_POPS = [
  {
    id: 'p1',
    title: 'POP - Retificação de Fatura Asaas e Envio de 2ª Via',
    steps: '1. Localizar a cobrança original no painel Asaas;\n2. Cancelar e emitir nova cobrança com os valores e splits corrigidos;\n3. Gerar link e enviar no chat privado do polo;\n4. Atualizar o Card no Kanban para Concluído.'
  },
  {
    id: 'p2',
    title: 'POP - Validação de Documentação de Pós e Emissão de Certificado',
    steps: '1. Conferir RG e histórico acadêmico no eAula;\n2. Solicitar assinatura digital da diretoria;\n3. Fazer upload do PDF e liberar acesso ao aluno no portal.'
  }
];

const DEFAULT_AI_PROMPT = `REGRAS DE CLASSIFICAÇÃO DA IA:
1. CLIENTES VIP (PLANO FIXO): Se a conversa mencionar Polos cadastrados como VIP (ex: Campinas, Salvador, Fama, FM Educacional), classifique a demanda como Prioridade MÁXIMA (VIP), ative a tag 👑 VIP e defina SLA prioritário de até 4 horas.
2. CLIENTES AVULSOS: Se o cliente for avulso ou comum, classifique como Prioridade Média/Baixa com prazo de 48 horas.
3. EXCEÇÕES CRÍTICAS: Questões sobre divergência de nota fiscal, bloqueio indevido no eAula ou erro de split devem ter prioridade Alta mesmo para avulsos.`;

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'kanban' | 'gestao'
  const [theme, setTheme] = useState('light'); // 'light' (Clean White WhatsApp) | 'dark'
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [collaborators, setCollaborators] = useState(INITIAL_COLLABORATORS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  // Base de Conhecimento, SLAs e Memória da IA
  const [vipClients, setVipClients] = useState(INITIAL_VIP_CLIENTS);
  const [slas, setSlas] = useState(INITIAL_SLAS);
  const [pops, setPops] = useState(INITIAL_POPS);
  const [customAIPrompt, setCustomAIPrompt] = useState(DEFAULT_AI_PROMPT);
  const [isAIMemoryOpen, setIsAIMemoryOpen] = useState(false);

  // Chat ativo: canal ou DM
  const [activeChat, setActiveChat] = useState({
    type: 'channel', // 'channel' | 'dm'
    id: 'c-financeiro'
  });

  // Modo da IA Autônoma (Se ativo, cria o card sozinho ao detectar intenção de tarefa)
  const [aiAutonomous, setAiAutonomous] = useState(true);

  // Modais de Criação
  const [modalItem, setModalItem] = useState({ isOpen: false, type: 'channel' });

  // Estado do Modal de IA
  const [aiModal, setAiModal] = useState({
    isOpen: false,
    mode: 'extract_task', // 'extract_task' | 'summary' | 'bottlenecks'
    sourceMessage: null,
  });

  // Metadados do chat atual
  const chatMeta = activeChat.type === 'channel'
    ? {
        type: 'channel',
        data: channels.find((c) => c.id === activeChat.id) || channels[0],
      }
    : {
        type: 'dm',
        data: collaborators.find((u) => u.id === activeChat.id) || collaborators[1],
      };

  const currentChatKey = activeChat.type === 'channel' ? activeChat.id : `dm-${activeChat.id}`;
  const currentMessages = messages[currentChatKey] || [];

  // Enviar nova mensagem no chat ativo
  const handleSendMessage = (text) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      id: 'm_' + Date.now(),
      senderId: 'u1', // Flávio
      senderName: 'Flávio Motta',
      text,
      timestamp: timeStr,
      actionExtracted: false,
    };

    setMessages((prev) => ({
      ...prev,
      [currentChatKey]: [...(prev[currentChatKey] || []), newMsg],
    }));

    // GATILHO 1: Comando manual explícito /tarefa
    if (text.startsWith('/tarefa')) {
      const taskText = text.replace('/tarefa', '').trim();
      createAutoTask(taskText, text, timeStr);
      return;
    }

    // GATILHO 2: MODO AUTÔNOMO DA IA COM DETECÇÃO INTELIGENTE DE CLIENTES VIP
    if (aiAutonomous) {
      const lower = text.toLowerCase();
      const taskKeywords = [
        'preciso que', 'favor', 'gere', 'gerar', 'envie', 'enviar',
        'verifique', 'até amanhã', 'até sexta', 'fazer', 'emitir',
        'corrigir', 'cobrar', 'retificar', 'urgente', 'aprove', 'aprovar', 'atender'
      ];

      // Checa se mencionou algum cliente VIP
      const matchedVip = vipClients.find((v) => lower.includes(v.name.toLowerCase()));
      const hasAction = taskKeywords.some((kw) => lower.includes(kw));

      if ((hasAction || matchedVip) && text.length > 10) {
        setTimeout(() => {
          createAutoTask(text, text, timeStr, true, matchedVip);
        }, 600);
      }
    }
  };

  const createAutoTask = (rawTitle, fullText, timeStr, wasAutonomous = false, matchedVip = null) => {
    // 1. Verifica se é cliente VIP cadastrado na base de conhecimento
    const isVip = !!matchedVip || vipClients.some(v => fullText.toLowerCase().includes(v.name.toLowerCase()));
    const vipInfo = matchedVip || vipClients.find(v => fullText.toLowerCase().includes(v.name.toLowerCase()));

    // 2. Define o responsável
    let targetAssignee = activeChat.type === 'dm' ? chatMeta.data.name : 'Fernanda Silva';
    const foundUser = collaborators.find(c =>
      fullText.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
    );
    if (foundUser) targetAssignee = foundUser.name;

    const channelTag = activeChat.type === 'channel'
      ? `#${chatMeta.data.name}`
      : `Privado (${chatMeta.data.name.split(' ')[0]})`;

    // 3. Aplica a Regra VIP: se for VIP, vira prioridade Máxima com SLA urgente!
    const autoTask = {
      id: 't_' + Date.now(),
      title: rawTitle.length > 60 ? rawTitle.slice(0, 57) + '...' : rawTitle,
      desc: isVip
        ? `⭐ ATENDIMENTO EXCLUSIVO VIP (${vipInfo?.name} - ${vipInfo?.plan}). Demanda prioritária com SLA rápido.`
        : `Demanda de rotina aberta via EduChat a partir de conversa no ${channelTag}.`,
      status: 'backlog',
      priority: isVip ? 'vip' : fullText.toLowerCase().includes('urgente') ? 'alta' : 'baixa',
      isVip: isVip,
      assignee: targetAssignee,
      assigneeAvatar: '👤',
      dueDate: isVip ? 'Prioridade VIP (Hoje, 4h)' : 'Em 48h',
      channel: channelTag,
      sourceMessage: `Flávio: "${fullText}"`
    };

    setTasks((prev) => [autoTask, ...prev]);

    // O Bot dá o feedback inteligente no chat destacando o status VIP
    const botReply = {
      id: 'bot_' + Date.now(),
      senderId: 'bot',
      senderName: '🤖 Copiloto EduChat',
      text: isVip
        ? `👑 [CLIENTE VIP DETECTADO: ${vipInfo?.name.toUpperCase()}]\nIdentifiquei que este parceiro possui o ${vipInfo?.plan} (Plano Fixo Exclusivo)!\n📌 Demanda criada com PRIORIDADE MÁXIMA no Kanban: "${autoTask.title}"\n👤 Atribuído a: ${autoTask.assignee}\n⏱️ SLA VIP: ${autoTask.dueDate}`
        : wasAutonomous
        ? `✨ [IA Autônoma] Demanda criada no Kanban:\n📌 "${autoTask.title}"\n👤 Responsável: ${autoTask.assignee}\n📅 Prioridade: Comum (Avulso)`
        : `✨ Demanda criada com sucesso no Kanban!\n📌 "${autoTask.title}"\n👤 Responsável: ${autoTask.assignee}`,
      timestamp: timeStr,
      actionExtracted: true,
    };

    setMessages((prev) => ({
      ...prev,
      [currentChatKey]: [...(prev[currentChatKey] || []), botReply],
    }));
  };

  // Abrir modal de IA para extrair tarefa de mensagem específica
  const handleCreateTaskFromMessage = (message) => {
    setAiModal({
      isOpen: true,
      mode: 'extract_task',
      sourceMessage: message,
    });
  };

  // Abrir modal de resumo do chat atual
  const handleSummarizeChat = () => {
    setAiModal({
      isOpen: true,
      mode: 'summary',
      sourceMessage: null,
    });
  };

  // Atualizar status de tarefa no Kanban
  const handleUpdateTaskStatus = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  // Adicionar tarefa confirmada pelo modal de IA ou manualmente
  const handleConfirmTaskCreation = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  // Salvar novo canal
  const handleSaveChannel = (newChannel) => {
    setChannels((prev) => [...prev, newChannel]);
    setActiveChat({ type: 'channel', id: newChannel.id });
    setActiveView('chat');
  };

  // Salvar novo colaborador
  const handleSaveCollaborator = (newCollaborator) => {
    setCollaborators((prev) => [...prev, newCollaborator]);
    setActiveChat({ type: 'dm', id: newCollaborator.id });
    setActiveView('chat');
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-chatBg font-sans text-chatTextBody ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Barra Lateral estilo WhatsApp */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        channels={channels}
        collaborators={collaborators}
        activeChat={activeChat}
        onSelectChannel={(channelId) => {
          setActiveChat({ type: 'channel', id: channelId });
          setActiveView('chat');
        }}
        onSelectCollaborator={(userId) => {
          setActiveChat({ type: 'dm', id: userId });
          setActiveView('chat');
        }}
        aiAutonomous={aiAutonomous}
        setAiAutonomous={setAiAutonomous}
        onOpenAICopilot={() =>
          setAiModal({ isOpen: true, mode: 'bottlenecks', sourceMessage: null })
        }
        onOpenAIMemory={() => setIsAIMemoryOpen(true)}
        onOpenNewChannel={() => setModalItem({ isOpen: true, type: 'channel' })}
        onOpenNewCollaborator={() => setModalItem({ isOpen: true, type: 'collaborator' })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Área Central Baseada na Visualização Ativa */}
      {activeView === 'chat' && (
        <ChatArea
          chatMeta={chatMeta}
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          onCreateTaskFromMessage={handleCreateTaskFromMessage}
          onSummarizeChat={handleSummarizeChat}
        />
      )}

      {activeView === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onAddTask={() =>
            setAiModal({ isOpen: true, mode: 'extract_task', sourceMessage: null })
          }
        />
      )}

      {activeView === 'gestao' && (
        <GestaoDashboard
          tasks={tasks}
          channels={channels}
          collaborators={collaborators}
        />
      )}

      {/* Modal Inteligente da IA (Copiloto) */}
      <AICopilotModal
        isOpen={aiModal.isOpen}
        onClose={() => setAiModal({ ...aiModal, isOpen: false })}
        mode={aiModal.mode}
        sourceMessage={aiModal.sourceMessage}
        channel={activeChat.type === 'channel' ? chatMeta.data : null}
        onConfirmTaskCreation={handleConfirmTaskCreation}
      />

      {/* Modal para Criar Canal ou Colaborador */}
      <NewItemModal
        isOpen={modalItem.isOpen}
        type={modalItem.type}
        onClose={() => setModalItem({ ...modalItem, isOpen: false })}
        onSave={modalItem.type === 'channel' ? handleSaveChannel : handleSaveCollaborator}
      />

      {/* Modal de Memória e Aprendizado da IA (Regras VIP) */}
      <AIMemoryModal
        isOpen={isAIMemoryOpen}
        onClose={() => setIsAIMemoryOpen(false)}
        vipClients={vipClients}
        onAddVipClient={(newVip) => setVipClients((prev) => [...prev, newVip])}
        onRemoveVipClient={(id) => setVipClients((prev) => prev.filter((v) => v.id !== id))}
        slas={slas}
        onAddSla={(newSla) => setSlas((prev) => [...prev, newSla])}
        onRemoveSla={(id) => setSlas((prev) => prev.filter((s) => s.id !== id))}
        pops={pops}
        onAddPop={(newPop) => setPops((prev) => [...prev, newPop])}
        onRemovePop={(id) => setPops((prev) => prev.filter((p) => p.id !== id))}
        customPrompt={customAIPrompt}
        onSaveCustomPrompt={(newPrompt) => setCustomAIPrompt(newPrompt)}
      />
    </div>
  );
}
