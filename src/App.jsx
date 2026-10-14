import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import KanbanBoard from './components/KanbanBoard';
import GestaoDashboard from './components/GestaoDashboard';
import AICopilotModal from './components/AICopilotModal';
import NewItemModal from './components/NewItemModal';
import {
  INITIAL_CHANNELS,
  INITIAL_COLLABORATORS,
  INITIAL_MESSAGES,
  INITIAL_TASKS
} from './data/initialData';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'kanban' | 'gestao'
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [collaborators, setCollaborators] = useState(INITIAL_COLLABORATORS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  // Chat ativo: pode ser um canal em grupo ou conversa direta 1 a 1 com um colaborador!
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

    // GATILHO 2: MODO AUTÔNOMO DA IA (A IA cria SOZINHA ao detectar ação/prazo)
    if (aiAutonomous) {
      const lower = text.toLowerCase();
      const taskKeywords = [
        'preciso que', 'favor', 'gere', 'gerar', 'envie', 'enviar',
        'verifique', 'até amanhã', 'até sexta', 'fazer', 'emitir',
        'corrigir', 'cobrar', 'retificar', 'urgente', 'aprove', 'aprovar'
      ];

      const hasAction = taskKeywords.some((kw) => lower.includes(kw));

      if (hasAction && text.length > 12) {
        setTimeout(() => {
          createAutoTask(text, text, timeStr, true);
        }, 600);
      }
    }
  };

  const createAutoTask = (rawTitle, fullText, timeStr, wasAutonomous = false) => {
    // Se estiver em DM (1 a 1), o responsável padrão é a própria pessoa da conversa!
    let targetAssignee = activeChat.type === 'dm' ? chatMeta.data.name : 'Fernanda Silva';

    // Senão, tenta achar pelo primeiro nome no texto
    const foundUser = collaborators.find(c =>
      fullText.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
    );
    if (foundUser) targetAssignee = foundUser.name;

    const channelTag = activeChat.type === 'channel'
      ? `#${chatMeta.data.name}`
      : `Privado (${chatMeta.data.name.split(' ')[0]})`;

    const autoTask = {
      id: 't_' + Date.now(),
      title: rawTitle.length > 60 ? rawTitle.slice(0, 57) + '...' : rawTitle,
      desc: `Demanda criada pela IA a partir de conversa com ${chatMeta.data.name}`,
      status: 'backlog',
      priority: fullText.toLowerCase().includes('urgente') ? 'alta' : 'media',
      assignee: targetAssignee,
      assigneeAvatar: '👤',
      dueDate: 'Em 48h',
      channel: channelTag,
      sourceMessage: `Flávio: "${fullText}"`
    };

    setTasks((prev) => [autoTask, ...prev]);

    // O Bot avisa no chat que a tarefa foi aberta sozinho no Kanban!
    const botReply = {
      id: 'bot_' + Date.now(),
      senderId: 'bot',
      senderName: '🤖 Copiloto EduChat',
      text: wasAutonomous
        ? `✨ [IA Autônoma] Detectei uma demanda nesta conversa e já abri o Card no Kanban:\n📌 "${autoTask.title}"\n👤 Responsável: ${autoTask.assignee}\n📅 Prazo estimado: ${autoTask.dueDate}`
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
    <div className="flex h-screen w-screen overflow-hidden bg-chatBg">
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
        onOpenNewChannel={() => setModalItem({ isOpen: true, type: 'channel' })}
        onOpenNewCollaborator={() => setModalItem({ isOpen: true, type: 'collaborator' })}
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

      {/* Modal Inteligente da IA */}
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
    </div>
  );
}
