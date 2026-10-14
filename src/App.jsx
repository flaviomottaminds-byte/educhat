import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import KanbanBoard from './components/KanbanBoard';
import GestaoDashboard from './components/GestaoDashboard';
import AICopilotModal from './components/AICopilotModal';
import {
  INITIAL_CHANNELS,
  INITIAL_COLLABORATORS,
  INITIAL_MESSAGES,
  INITIAL_TASKS
} from './data/initialData';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'kanban' | 'gestao'
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState('c-financeiro');
  const [collaborators] = useState(INITIAL_COLLABORATORS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  // Estado do Modal de IA
  const [aiModal, setAiModal] = useState({
    isOpen: false,
    mode: 'extract_task', // 'extract_task' | 'summary' | 'bottlenecks'
    sourceMessage: null,
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const currentMessages = messages[activeChannelId] || [];

  // Enviar nova mensagem no canal ativo
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
      [activeChannelId]: [...(prev[activeChannelId] || []), newMsg],
    }));

    // Se a mensagem contiver comando rápido /tarefa, cria automaticamente no Kanban!
    if (text.startsWith('/tarefa')) {
      const taskText = text.replace('/tarefa', '').trim();
      const autoTask = {
        id: 't_' + Date.now(),
        title: taskText || 'Nova demanda criada via comando',
        desc: `Criada diretamente pelo comando /tarefa no canal #${activeChannel.name}`,
        status: 'backlog',
        priority: 'alta',
        assignee: 'Fernanda Silva',
        assigneeAvatar: '👩‍💻',
        dueDate: 'Em 48h',
        channel: `#${activeChannel.name}`,
        sourceMessage: `Flávio: "${text}"`
      };
      setTasks((prev) => [autoTask, ...prev]);

      // Feedback da IA no chat
      setTimeout(() => {
        const botReply = {
          id: 'bot_' + Date.now(),
          senderId: 'bot',
          senderName: '🤖 Copiloto EduChat',
          text: `✨ Demanda identificada e criada com sucesso no Kanban!\n📌 Título: "${autoTask.title}"\n👤 Atribuído a: ${autoTask.assignee}\n📅 Prazo sugerido: ${autoTask.dueDate}`,
          timestamp: timeStr,
          actionExtracted: true,
        };
        setMessages((prev) => ({
          ...prev,
          [activeChannelId]: [...(prev[activeChannelId] || []), botReply],
        }));
      }, 500);
    }
  };

  // Abrir modal de IA para extrair tarefa de mensagem
  const handleCreateTaskFromMessage = (message) => {
    setAiModal({
      isOpen: true,
      mode: 'extract_task',
      sourceMessage: message,
    });
  };

  // Abrir modal de resumo do canal
  const handleSummarizeChannel = () => {
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatBg">
      {/* Barra Lateral estilo WhatsApp */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        channels={channels}
        activeChannelId={activeChannelId}
        setActiveChannelId={setActiveChannelId}
        collaborators={collaborators}
        onOpenAICopilot={() =>
          setAiModal({ isOpen: true, mode: 'bottlenecks', sourceMessage: null })
        }
      />

      {/* Área Central Baseada na Visualização Ativa */}
      {activeView === 'chat' && (
        <ChatArea
          channel={activeChannel}
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          onCreateTaskFromMessage={handleCreateTaskFromMessage}
          onSummarizeChannel={handleSummarizeChannel}
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
        channel={activeChannel}
        onConfirmTaskCreation={handleConfirmTaskCreation}
      />
    </div>
  );
}
