import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import KanbanBoard from './components/KanbanBoard';
import GestaoDashboard from './components/GestaoDashboard';
import AICopilotModal from './components/AICopilotModal';
import NewItemModal from './components/NewItemModal';
import AIMemoryModal from './components/AIMemoryModal';
import WhatsAppDossierModal from './components/WhatsAppDossierModal';
import { Shield } from 'lucide-react';
import { supabase } from './lib/supabase';
import {
  INITIAL_CHANNELS,
  INITIAL_COLLABORATORS,
  INITIAL_MESSAGES,
  INITIAL_TASKS,
  getChatKey
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
  const [collaborators, setCollaborators] = useState(INITIAL_COLLABORATORS);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_user_id');
      const found = INITIAL_COLLABORATORS.find((u) => u.id === saved);
      return found || INITIAL_COLLABORATORS[0];
    } catch {
      return INITIAL_COLLABORATORS[0];
    }
  });
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connected' | 'connecting' | 'error'

  // Base de Conhecimento, SLAs e Memória da IA
  const [vipClients, setVipClients] = useState(INITIAL_VIP_CLIENTS);
  const [slas, setSlas] = useState(INITIAL_SLAS);
  const [pops, setPops] = useState(INITIAL_POPS);
  const [customAIPrompt, setCustomAIPrompt] = useState(DEFAULT_AI_PROMPT);
  const [isAIMemoryOpen, setIsAIMemoryOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

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

  const currentChatKey = getChatKey(activeChat, currentUser.id);
  const currentMessages = messages[currentChatKey] || [];

  // =========================================================================
  // SUPABASE REALTIME: CARREGAR DADOS DA NUVEM & OUVIR ATUALIZAÇÕES INSTANTÂNEAS
  // =========================================================================
  useEffect(() => {
    const initSupabase = async () => {
      try {
        // 1. Carregar Mensagens existentes da nuvem
        const { data: dbMessages, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true });

        if (dbMessages && dbMessages.length > 0) {
          const grouped = {};
          dbMessages.forEach((m) => {
            const rawKey = m.chat_id;
            const key = rawKey === 'dm-u2' ? 'dm-u1-u2' :
                        rawKey === 'dm-u3' ? 'dm-u1-u3' :
                        rawKey === 'dm-u4' ? 'dm-u1-u4' :
                        rawKey === 'dm-u5' ? 'dm-u1-u5' : rawKey;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({
              id: m.id,
              senderId: m.sender_id,
              senderName: m.sender_name,
              text: m.text,
              timestamp: m.timestamp,
              actionExtracted: false
            });
          });
          setMessages((prev) => ({ ...prev, ...grouped }));
        } else if (!msgError) {
          // Inicializar tabela vazia com dados iniciais
          const seedMsgs = [];
          Object.entries(INITIAL_MESSAGES).forEach(([cId, mList]) => {
            mList.forEach((msg) => {
              seedMsgs.push({
                id: msg.id,
                chat_id: cId,
                sender_id: msg.senderId,
                sender_name: msg.senderName,
                text: msg.text,
                timestamp: msg.timestamp
              });
            });
          });
          if (seedMsgs.length > 0) {
            await supabase.from('messages').insert(seedMsgs);
          }
        }

        // 2. Carregar Tarefas do Kanban existentes da nuvem
        const { data: dbTasks, error: taskError } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbTasks && dbTasks.length > 0) {
          setTasks(dbTasks.map((t) => ({
            id: t.id,
            title: t.title,
            desc: t.description || '',
            status: t.status,
            priority: t.priority,
            isVip: t.is_vip,
            assignee: t.assignee,
            assigneeAvatar: t.assignee_avatar || '👤',
            department: t.department || 'Geral',
            dueDate: t.due_date,
            channel: t.channel,
            sourceMessage: t.source_message
          })));
        } else if (!taskError) {
          // Inicializar tabela de tarefas
          const seedTasks = INITIAL_TASKS.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.desc || '',
            status: t.status,
            priority: t.priority,
            is_vip: t.isVip || false,
            assignee: t.assignee,
            assignee_avatar: t.assigneeAvatar || '👤',
            department: t.department || 'Geral',
            due_date: t.dueDate,
            channel: t.channel,
            source_message: t.sourceMessage
          }));
          await supabase.from('tasks').insert(seedTasks);
        }
      } catch (err) {
        console.warn('Conexão Supabase inicial:', err);
      }
    };

    initSupabase();

    // 3. Ouvir Mensagens em Tempo Real via WebSockets
    const channelListener = supabase
      .channel('educhat_realtime_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          const rawKey = row.chat_id;
          const cKey = rawKey === 'dm-u2' ? 'dm-u1-u2' :
                       rawKey === 'dm-u3' ? 'dm-u1-u3' :
                       rawKey === 'dm-u4' ? 'dm-u1-u4' :
                       rawKey === 'dm-u5' ? 'dm-u1-u5' : rawKey;
          const incoming = {
            id: row.id,
            senderId: row.sender_id,
            senderName: row.sender_name,
            text: row.text,
            timestamp: row.timestamp,
            actionExtracted: false
          };
          setMessages((prev) => {
            const list = prev[cKey] || [];
            if (list.some((m) => m.id === incoming.id)) return prev;
            return {
              ...prev,
              [cKey]: [...list, incoming]
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            const newTask = {
              id: row.id,
              title: row.title,
              desc: row.description || '',
              status: row.status,
              priority: row.priority,
              isVip: row.is_vip,
              assignee: row.assignee,
              assigneeAvatar: row.assignee_avatar || '👤',
              department: row.department || 'Geral',
              dueDate: row.due_date,
              channel: row.channel,
              sourceMessage: row.source_message
            };
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            setTasks((prev) =>
              prev.map((t) =>
                t.id === row.id
                  ? {
                      ...t,
                      status: row.status,
                      title: row.title,
                      priority: row.priority,
                      assignee: row.assignee,
                      dueDate: row.due_date
                    }
                  : t
              )
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channelListener);
    };
  }, []);

  // Enviar nova mensagem no chat ativo
  const handleSendMessage = (text) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      id: 'm_' + Date.now(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text,
      timestamp: timeStr,
      actionExtracted: false,
    };

    setMessages((prev) => ({
      ...prev,
      [currentChatKey]: [...(prev[currentChatKey] || []), newMsg],
    }));

    // Sincronizar Mensagem em Tempo Real com o Supabase
    supabase.from('messages').insert([{
      id: newMsg.id,
      chat_id: currentChatKey,
      sender_id: newMsg.senderId,
      sender_name: newMsg.senderName,
      text: newMsg.text,
      timestamp: newMsg.timestamp
    }]).catch((err) => console.warn('Erro ao salvar msg no Supabase:', err));

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

    // Persistir Tarefa Automática no Supabase
    supabase.from('tasks').insert([{
      id: autoTask.id,
      title: autoTask.title,
      description: autoTask.desc || '',
      status: autoTask.status,
      priority: autoTask.priority,
      is_vip: autoTask.isVip || false,
      assignee: autoTask.assignee,
      assignee_avatar: autoTask.assigneeAvatar || '👤',
      department: targetAssignee.includes('Fernanda') ? 'Financeiro' : targetAssignee.includes('Juliana') ? 'Secretaria' : 'Atendimento',
      due_date: autoTask.dueDate,
      channel: autoTask.channel,
      source_message: autoTask.sourceMessage
    }]).catch((err) => console.warn('Erro ao salvar autoTask no Supabase:', err));

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

    // Sincronizar Resposta do Bot com o Supabase
    supabase.from('messages').insert([{
      id: botReply.id,
      chat_id: currentChatKey,
      sender_id: botReply.senderId,
      sender_name: botReply.senderName,
      text: botReply.text,
      timestamp: botReply.timestamp
    }]).catch((err) => console.warn('Erro ao salvar botReply no Supabase:', err));
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
    // Sincronizar com Supabase em Tempo Real
    supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
      .catch((err) => console.warn('Erro ao atualizar status da tarefa no Supabase:', err));
  };

  // Adicionar tarefa confirmada pelo modal de IA ou manualmente
  const handleConfirmTaskCreation = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    // Sincronizar criação no Supabase
    supabase.from('tasks').insert([{
      id: newTask.id,
      title: newTask.title,
      description: newTask.desc || '',
      status: newTask.status || 'backlog',
      priority: newTask.priority || 'media',
      is_vip: newTask.isVip || false,
      assignee: newTask.assignee,
      assignee_avatar: newTask.assigneeAvatar || '👤',
      department: newTask.department || 'Geral',
      due_date: newTask.dueDate,
      channel: newTask.channel,
      source_message: newTask.sourceMessage
    }]).catch((err) => console.warn('Erro ao salvar nova tarefa no Supabase:', err));
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

  const handleSwitchUser = (newUser) => {
    setCurrentUser(newUser);
    try {
      localStorage.setItem('educhat_user_id', newUser.id);
    } catch {}
    if (activeChat.type === 'dm' && activeChat.id === newUser.id) {
      setActiveChat({ type: 'dm', id: newUser.id === 'u1' ? 'u2' : 'u1' });
    }
  };

  // Importar tarefas a partir do Dossiê do WhatsApp
  const handleCreateTasksFromDossier = (tasksToAdd) => {
    const mapped = tasksToAdd.map((t, idx) => ({
      ...t,
      id: 'dossier_t_' + Date.now() + '_' + idx,
      status: 'backlog',
      assigneeAvatar: t.assignee.includes('Fernanda') ? '👩‍💻' : t.assignee.includes('Juliana') ? '👩‍🏫' : '👨‍🔧',
      channel: t.department === 'Financeiro' ? '#financeiro' : '#secretaria-pedagogica',
      sourceMessage: `Dossiê WhatsApp: "${t.desc}"`
    }));
    setTasks((prev) => [...mapped, ...prev]);
  };

  // Auto-alimentar memória da IA com insights e procedimentos minerados da conversa
  const handleFeedAIMemory = (learnings) => {
    // 1. Incorporar novo POP se identificado
    if (learnings.discoveredPop) {
      setPops((prev) => [
        {
          id: 'pop_' + Date.now(),
          title: learnings.discoveredPop.title,
          steps: learnings.discoveredPop.steps
        },
        ...prev
      ]);
    }
    // 2. Incorporar novo SLA se identificado
    if (learnings.slaInsight) {
      setSlas((prev) => [
        {
          id: 'sla_' + Date.now(),
          department: 'Secretaria Acadêmica',
          demand: 'Certificação de Concurseiros (Pós)',
          slaTime: '48 horas (Prioritário)'
        },
        ...prev
      ]);
    }
    // 3. Acrescentar fatos aprendidos às Diretrizes Gerais da IA
    if (learnings.newFacts && learnings.newFacts.length > 0) {
      setCustomAIPrompt((prev) => `${prev}\n\nREGRAS APRENDIDAS VIA HISTÓRICO DO WHATSAPP:\n- ${learnings.newFacts.join('\n- ')}`);
    }
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
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        realtimeStatus={realtimeStatus}
      />

      {/* Área Central Baseada na Visualização Ativa */}
      {activeView === 'chat' && (
        <ChatArea
          chatMeta={chatMeta}
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          onCreateTaskFromMessage={handleCreateTaskFromMessage}
          onSummarizeChat={handleSummarizeChat}
          onOpenWhatsAppDossier={() => setIsDossierOpen(true)}
          currentUser={currentUser}
          realtimeStatus={realtimeStatus}
        />
      )}

      {activeView === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          currentUser={currentUser}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onAddTask={() =>
            setAiModal({ isOpen: true, mode: 'extract_task', sourceMessage: null })
          }
        />
      )}

      {activeView === 'gestao' && (
        currentUser.roleType === 'diretor' ? (
          <GestaoDashboard
            tasks={tasks}
            channels={channels}
            collaborators={collaborators}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-chatBg p-8 text-center transition-colors">
            <div className="bg-white dark:bg-chatCard p-8 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-md shadow-sm space-y-4">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center mx-auto">
                <Shield size={28} />
              </div>
              <h3 className="text-lg font-bold text-chatTextTitle">Acesso Restrito à Diretoria</h3>
              <p className="text-xs text-chatTextMuted leading-relaxed">
                O Painel de Gestão e Inteligência Operacional é confidencial e exclusivo para a Diretoria Executiva da empresa.
                <br /><br />
                Você está simulando o acesso como <strong>{currentUser.name}</strong> ({currentUser.department}).
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => setActiveView('chat')}
                  className="px-4 py-2 bg-slate-100 dark:bg-chatSidebar hover:bg-slate-200 text-chatTextTitle text-xs font-semibold rounded-lg transition"
                >
                  Voltar para Conversas
                </button>
                <button
                  onClick={() => handleSwitchUser(collaborators[0])}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Alternar para Flávio Motta (Diretor)
                </button>
              </div>
            </div>
          </div>
        )
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

      {/* Modal de Dossiê 360º & Auto-Aprendizado do WhatsApp */}
      <WhatsAppDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onCreateTasks={handleCreateTasksFromDossier}
        onFeedAIMemory={handleFeedAIMemory}
      />
    </div>
  );
}
