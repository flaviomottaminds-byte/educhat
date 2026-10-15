import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import KanbanBoard from './components/KanbanBoard';
import GestaoDashboard from './components/GestaoDashboard';
import AICopilotModal from './components/AICopilotModal';
import NewItemModal from './components/NewItemModal';
import AIMemoryModal from './components/AIMemoryModal';
import WhatsAppDossierModal from './components/WhatsAppDossierModal';
import WhatsAppConnectionModal from './components/WhatsAppConnectionModal';
import UserSelectionModal from './components/UserSelectionModal';
import TaskDetailModal from './components/TaskDetailModal';
import { Shield } from 'lucide-react';
import { supabase } from './lib/supabase';
import { playMessageSound } from './lib/audioNotification';
import {
  requestDesktopNotificationPermission,
  notifyIncomingMessage,
  stopTaskbarBlink
} from './lib/desktopNotification';
import { answerCopilotQuery, analyzeTaskPriorityAI } from './lib/aiKnowledge';
import {
  INITIAL_CHANNELS,
  INITIAL_COLLABORATORS,
  INITIAL_MESSAGES,
  INITIAL_TASKS,
  getChatKey,
  normalizeChatKey
} from './data/initialData';
import {
  INITIAL_WHATSAPP_CONTACTS,
  INITIAL_WHATSAPP_MESSAGES,
  routeIncomingWhatsAppWebhook,
  processTriageResponse
} from './lib/whatsappRouting';


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

const INITIAL_LEARNED_DOCS = [
  {
    id: 'doc_init_1',
    title: 'Memorando Diretoria 01/2026 - Prazos de Matrícula e Reposição.pdf',
    size: '142.0 KB',
    uploadDate: '15/10/2026',
    summary: 'Determina que todas as solicitações de reposição de aula e certidões devem ser concluídas em no máximo 48h pela Secretaria Acadêmica.',
    keywords: ['Prazos', 'Secretaria', 'SLA'],
    textContent: 'Memorando 01/2026: Fica determinado que todas as reposições de aulas e certidões devem ser tratadas em no máximo 48h.'
  }
];

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
  const [isUserSelectOpen, setIsUserSelectOpen] = useState(() => {
    try {
      return !localStorage.getItem('educhat_user_id');
    } catch {
      return false;
    }
  });
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [whatsAppContacts, setWhatsAppContacts] = useState(INITIAL_WHATSAPP_CONTACTS);
  const [whatsAppModal, setWhatsAppModal] = useState({ isOpen: false, tab: 'qrcode' });
  const [messages, setMessages] = useState(() => ({
    ...INITIAL_MESSAGES,
    ...INITIAL_WHATSAPP_MESSAGES
  }));
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connected' | 'connecting' | 'error'
  const [lastSyncTime, setLastSyncTime] = useState('');

  // Documentos e Memorandos Aprendidos pela IA (Item 3)
  const [learnedDocuments, setLearnedDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_learned_docs');
      return saved ? JSON.parse(saved) : INITIAL_LEARNED_DOCS;
    } catch {
      return INITIAL_LEARNED_DOCS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('educhat_learned_docs', JSON.stringify(learnedDocuments));
    } catch {}
  }, [learnedDocuments]);

  // Contador de Mensagens Não Lidas por Canal/Colaborador
  const [unreadCounts, setUnreadCounts] = useState({});

  // Card do Kanban ampliado para detalhes
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  // Base de Conhecimento, SLAs e Memória da IA
  const [vipClients, setVipClients] = useState(INITIAL_VIP_CLIENTS);
  const [slas, setSlas] = useState(INITIAL_SLAS);
  const [pops, setPops] = useState(INITIAL_POPS);
  const [customAIPrompt, setCustomAIPrompt] = useState(DEFAULT_AI_PROMPT);
  const [isAIMemoryOpen, setIsAIMemoryOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Chat ativo: canal, dm ou whatsapp (padrão canal #geral)
  const [activeChat, setActiveChat] = useState({
    type: 'channel', // 'channel' | 'dm' | 'whatsapp'
    id: 'c-geral'
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

  // Metadados do chat atual (Canais, DMs privadas ou Contatos de WhatsApp de Alunos)
  const chatMeta = activeChat?.type === 'channel'
    ? {
        type: 'channel',
        data: (channels || []).find((c) => c?.id === activeChat?.id) || channels?.[0] || INITIAL_CHANNELS[0],
      }
    : activeChat?.type === 'whatsapp'
    ? {
        type: 'whatsapp',
        data: (whatsAppContacts || []).find((w) => w?.id === activeChat?.id) || whatsAppContacts?.[0],
      }
    : {
        type: 'dm',
        data: (collaborators || []).find((u) => u?.id === activeChat?.id) || (collaborators || [])[1] || INITIAL_COLLABORATORS[1],
      };

  const currentChatKey = getChatKey(activeChat, currentUser?.id || 'u1');
  const currentMessages = messages[currentChatKey] || [];

  // Solicitar permissão nativa de notificação do Windows ao carregar
  useEffect(() => {
    requestDesktopNotificationPermission();
  }, []);

  // Helper para limpar contador de mensagens não lidas instantaneamente (Item 7)
  const clearUnread = (targetId) => {
    if (!targetId) return;
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[targetId];
      if (targetId.startsWith('c-')) {
        delete next[targetId.replace('c-', '')];
        delete next[`#${targetId.replace('c-', '')}`];
      } else {
        delete next[`c-${targetId}`];
        delete next[`#${targetId}`];
      }
      // Limpa também chaves compostas vinculadas (ex: dm-u1-u9, u9)
      Object.keys(next).forEach((k) => {
        if (k === targetId || k.includes(`-${targetId}`) || k.includes(`${targetId}-`)) {
          delete next[k];
        }
      });
      const totalUnread = Object.values(next).reduce((a, b) => a + (Number(b) || 0), 0);
      document.title = totalUnread > 0 ? `(${totalUnread}) EduChat` : 'EduChat';
      return next;
    });
    stopTaskbarBlink();
  };

  // Helper para marcar mensagens da conversa ativa como lidas no banco e no estado (Item 3)
  const markMessagesAsRead = (chat) => {
    if (!chat) return;
    const cKey = getChatKey(chat, currentUser.id);
    clearUnread(chat.id);

    setMessages((prev) => {
      const list = prev[cKey];
      if (!list || list.length === 0) return prev;

      let hasUnread = false;
      const updated = list.map((m) => {
        if (m.senderId !== currentUser.id && m.status !== 'read') {
          hasUnread = true;
          return { ...m, status: 'read' };
        }
        return m;
      });

      if (!hasUnread) return prev;

      // Dispara atualização assíncrona no Supabase para que o remetente receba os dois checks azuis
      supabase
        .from('messages')
        .select('id, text')
        .eq('chat_id', cKey)
        .neq('sender_id', currentUser.id)
        .not('text', 'like', '%<!-- STATUS:read -->%')
        .then(({ data }) => {
          if (data && data.length > 0) {
            data.forEach((row) => {
              const newText = row.text.includes('<!-- STATUS:')
                ? row.text.replace(/<!-- STATUS:[^\s>]+ -->/, '<!-- STATUS:read -->')
                : `${row.text}\n<!-- STATUS:read -->`;
              supabase.from('messages').update({ text: newText }).eq('id', row.id).then(() => {});
            });
          }
        });

      return { ...prev, [cKey]: updated };
    });
  };

  // Sincroniza limpeza de notificação ao alternar de chat ou receber mensagem no chat aberto (Item 7)
  useEffect(() => {
    if (activeChat?.id) {
      clearUnread(activeChat.id);
      markMessagesAsRead(activeChat);
    }
  }, [activeChat?.id, currentMessages?.length]);

  // Limpa notificações fantasmas quando a janela/aba do navegador ganha foco (Item 7)
  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeChat?.id) {
        clearUnread(activeChat.id);
        markMessagesAsRead(activeChat);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [activeChat]);

  // Helper para processar mensagem recebida, disparar som e piscar barra do Windows (Item 1, 4 e 7)
  const handleIncomingNotification = (msg, cKey) => {
    if (msg.senderId === currentUser.id) return;

    // Trava de Privacidade: Se for conversa privada 1 a 1 (DM), só notifica os dois participantes
    if (cKey.startsWith('dm-')) {
      const parts = cKey.replace('dm-', '').split('-');
      if (parts.length >= 2) {
        const id1 = parts[0];
        const id2 = parts[1];
        if (currentUser.id !== id1 && currentUser.id !== id2 && currentUser.roleType !== 'diretor') {
          return; // Conversa confidencial de terceiros
        }
      }
    }

    // Trava de Carteira Ativa do WhatsApp: Se o lead tiver card ativo com um consultor específico, notifica APENAS ele!
    if (cKey.startsWith('wa-')) {
      const contact = whatsAppContacts.find((c) => c.id === cKey);
      if (contact && contact.status === 'carteira_ativa' && contact.assignee) {
        if (currentUser.name !== contact.assignee && currentUser.roleType !== 'diretor') {
          return; // Exclusivo do consultor dono da carteira
        }
      }
    }

    const currentKey = getChatKey(activeChat, currentUser.id);
    const isCurrentActive = cKey === currentKey && !document.hidden;

    if (isCurrentActive) {
      // Se a conversa já está visível e aberta, marca como lida imediatamente sem criar badge
      markMessagesAsRead(activeChat);
    } else {
      // Identifica o identificador correto da badge (para DMs, o outro usuário; para canais, o ID do canal)
      let targetBadgeKey = cKey;
      let notificationTitle = msg.senderName;
      if (cKey.startsWith('dm-')) {
        const parts = cKey.replace('dm-', '').split('-');
        targetBadgeKey = parts[0] === currentUser.id ? parts[1] : parts[0];
      } else if (cKey.startsWith('wa-')) {
        targetBadgeKey = cKey;
      } else if (cKey.startsWith('c-')) {
        targetBadgeKey = cKey;
        const channelName = cKey.replace('c-', '');
        notificationTitle = `#${channelName} • ${msg.senderName}`;
      }

      setUnreadCounts((prev) => {
        const next = { ...prev, [targetBadgeKey]: (prev[targetBadgeKey] || 0) + 1 };
        return next;
      });

      // Toca áudio e faz a barra de tarefas do Windows piscar
      playMessageSound();
      notifyIncomingMessage(notificationTitle, msg.text);
    }
  };

  // =========================================================================
  // SUPABASE REALTIME & SINCRONIZAÇÃO A CADA 2 MINUTOS
  // =========================================================================
  const fetchSupabaseData = async (silent = false) => {
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setLastSyncTime(timeStr);

      // 1. Mensagens
      const { data: dbMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (dbMessages && dbMessages.length > 0) {
        const grouped = {};
        dbMessages.forEach((m) => {
          const key = normalizeChatKey(m.chat_id, currentUser.id);

          // Trava de Privacidade no Carregamento: Não carregar DMs de terceiros (Item 4)
          if (key.startsWith('dm-')) {
            const parts = key.replace('dm-', '').split('-');
            if (parts.length >= 2) {
              const id1 = parts[0];
              const id2 = parts[1];
              if (currentUser.id !== id1 && currentUser.id !== id2 && currentUser.roleType !== 'diretor') {
                return;
              }
            }
          }

          if (!grouped[key]) grouped[key] = [];

          let cleanText = m.text || '';
          let parsedAttachment = null;
          let linkedTaskId = null;
          let parsedReplyTo = null;
          let parsedStatus = 'sent';

          if (cleanText.includes('[ARQUIVO_ANEXO:')) {
            const match = cleanText.match(/\[ARQUIVO_ANEXO:([\s\S]+?)\]$/);
            if (match) {
              try {
                parsedAttachment = JSON.parse(match[1]);
                cleanText = cleanText.replace(/\[ARQUIVO_ANEXO:[\s\S]+?\]$/, '').trim();
              } catch {}
            }
          }

          if (cleanText.includes('<!-- REPLY_TO:')) {
            const match = cleanText.match(/<!-- REPLY_TO:([\s\S]+?) -->/);
            if (match) {
              try {
                parsedReplyTo = JSON.parse(match[1]);
                cleanText = cleanText.replace(/<!-- REPLY_TO:[\s\S]+? -->/, '').trim();
              } catch {}
            }
          }

          if (cleanText.includes('<!-- STATUS:')) {
            const match = cleanText.match(/<!-- STATUS:([^\s>]+) -->/);
            if (match) {
              parsedStatus = match[1];
              cleanText = cleanText.replace(/<!-- STATUS:[^\s>]+ -->/, '').trim();
            }
          }

          if (cleanText.includes('<!-- TASK_ID:')) {
            const match = cleanText.match(/<!-- TASK_ID:([^\s>]+) -->/);
            if (match) {
              linkedTaskId = match[1];
              cleanText = cleanText.replace(/<!-- TASK_ID:[^\s>]+ -->/, '').trim();
            }
          }

          grouped[key].push({
            id: m.id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            text: cleanText,
            timestamp: m.timestamp,
            attachment: parsedAttachment,
            replyTo: parsedReplyTo,
            status: parsedStatus,
            taskId: linkedTaskId,
            actionExtracted: false
          });
        });
        setMessages((prev) => ({ ...prev, ...grouped }));
      }

      // 2. Tarefas do Kanban
      const { data: dbTasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbTasks && dbTasks.length > 0) {
        setTasks(dbTasks.map((t) => {
          let reqName = t.requester || '';
          let reqDept = t.requester_dept || '';
          if (!reqName && t.source_message && t.source_message.includes('Solicitado por:')) {
            const match = t.source_message.match(/Solicitado por:\s*([^(•]+)\s*(?:\(([^)]+)\))?/);
            if (match) {
              reqName = match[1].trim();
              reqDept = match[2]?.trim() || '';
            }
          }

          let cleanDesc = t.description || '';
          let comments = [];
          let attachments = [];
          if (cleanDesc.includes('<!-- TASK_META:')) {
            const match = cleanDesc.match(/<!-- TASK_META:([\s\S]+?) -->/);
            if (match) {
              try {
                const meta = JSON.parse(match[1]);
                comments = meta.comments || [];
                attachments = meta.attachments || [];
                cleanDesc = cleanDesc.replace(/<!-- TASK_META:[\s\S]+? -->/, '').trim();
              } catch {}
            }
          }

          return {
            id: t.id,
            title: t.title,
            desc: cleanDesc,
            status: t.status,
            priority: t.priority,
            isVip: t.is_vip,
            assignee: t.assignee,
            assigneeAvatar: t.assignee_avatar || '👤',
            department: t.department || 'Geral',
            dueDate: t.due_date,
            channel: t.channel,
            sourceMessage: t.source_message,
            requester: reqName,
            requesterDept: reqDept,
            comments,
            attachments
          };
        }));
      }

      // 3. Canais (sincroniza com Supabase se tabela 'channels' existir)
      try {
        const { data: dbChannels, error: chErr } = await supabase.from('channels').select('*');
        if (!chErr && dbChannels && Array.isArray(dbChannels) && dbChannels.length > 0) {
          setChannels(dbChannels.map((c) => ({
            id: c.id,
            name: c.name || 'geral',
            desc: c.desc || c.description || '',
            department: c.department || 'Todos',
            unread: 0
          })));
        }
      } catch (err) {
        // Tabela channels ainda não criada ou RLS; mantém INITIAL_CHANNELS
      }

      // 4. Colaboradores / Perfis (sincroniza com Supabase se tabela 'profiles' existir)
      try {
        const { data: dbProfiles, error: profErr } = await supabase.from('profiles').select('*');
        if (!profErr && dbProfiles && Array.isArray(dbProfiles) && dbProfiles.length > 0) {
          setCollaborators(dbProfiles.map((p) => ({
            id: p.id,
            name: p.name || p.full_name || 'Colaborador',
            email: p.email || '',
            role: p.role || 'Colaborador',
            roleType: p.role_type || (p.role === 'admin' || p.role === 'diretor' ? 'diretor' : 'colaborador'),
            avatar: p.avatar || '👤',
            online: p.online !== false,
            department: p.department || 'Comercial',
            isBot: p.is_bot || false
          })));
        }
      } catch (err) {
        // Tabela profiles ainda não criada ou RLS; mantém INITIAL_COLLABORATORS
      }
    } catch (err) {
      console.warn('Erro ao sincronizar dados com Supabase:', err);
    }
  };

  useEffect(() => {
    fetchSupabaseData(false);

    const syncInterval = setInterval(() => {
      fetchSupabaseData(true);
    }, 120000);

    const channelListener = supabase
      .channel('educhat_realtime_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          const cKey = normalizeChatKey(row.chat_id, currentUser.id);

          // Trava de Privacidade Realtime: Se for DM, só processa se o usuário for participante (Item 4)
          if (cKey.startsWith('dm-')) {
            const parts = cKey.replace('dm-', '').split('-');
            if (parts.length >= 2) {
              const id1 = parts[0];
              const id2 = parts[1];
              if (currentUser.id !== id1 && currentUser.id !== id2 && currentUser.roleType !== 'diretor') {
                return; // Conversa privada de terceiros
              }
            }
          }

          // Verificação de Canais para Usuários Não-Diretores (Item 4)
          if (cKey.startsWith('c-')) {
            const ch = channels.find((c) => c.id === cKey);
            const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            if (ch && ch.department !== 'Todos' && norm(ch.department) !== norm(currentUser.department) && currentUser.roleType !== 'diretor') {
              return; // Canal restrito de outro departamento
            }
          }

          let cleanText = row.text || '';
          let parsedAttachment = null;
          let linkedTaskId = null;
          let parsedReplyTo = null;
          let parsedStatus = 'sent';

          if (cleanText.includes('[ARQUIVO_ANEXO:')) {
            const match = cleanText.match(/\[ARQUIVO_ANEXO:([\s\S]+?)\]$/);
            if (match) {
              try {
                parsedAttachment = JSON.parse(match[1]);
                cleanText = cleanText.replace(/\[ARQUIVO_ANEXO:[\s\S]+?\]$/, '').trim();
              } catch {}
            }
          }

          if (cleanText.includes('<!-- REPLY_TO:')) {
            const match = cleanText.match(/<!-- REPLY_TO:([\s\S]+?) -->/);
            if (match) {
              try {
                parsedReplyTo = JSON.parse(match[1]);
                cleanText = cleanText.replace(/<!-- REPLY_TO:[\s\S]+? -->/, '').trim();
              } catch {}
            }
          }

          if (cleanText.includes('<!-- STATUS:')) {
            const match = cleanText.match(/<!-- STATUS:([^\s>]+) -->/);
            if (match) {
              parsedStatus = match[1];
              cleanText = cleanText.replace(/<!-- STATUS:[^\s>]+ -->/, '').trim();
            }
          }

          if (cleanText.includes('<!-- TASK_ID:')) {
            const match = cleanText.match(/<!-- TASK_ID:([^\s>]+) -->/);
            if (match) {
              linkedTaskId = match[1];
              cleanText = cleanText.replace(/<!-- TASK_ID:[^\s>]+ -->/, '').trim();
            }
          }

          const incoming = {
            id: row.id,
            senderId: row.sender_id,
            senderName: row.sender_name,
            text: cleanText,
            timestamp: row.timestamp,
            attachment: parsedAttachment,
            replyTo: parsedReplyTo,
            status: parsedStatus,
            taskId: linkedTaskId,
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

          handleIncomingNotification(incoming, cKey);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          const cKey = normalizeChatKey(row.chat_id, currentUser.id);

          let cleanText = row.text || '';
          let parsedStatus = 'sent';
          if (cleanText.includes('<!-- STATUS:')) {
            const match = cleanText.match(/<!-- STATUS:([^\s>]+) -->/);
            if (match) parsedStatus = match[1];
          }

          setMessages((prev) => {
            const list = prev[cKey];
            if (!list) return prev;
            return {
              ...prev,
              [cKey]: list.map((m) => (m.id === row.id ? { ...m, status: parsedStatus } : m))
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notif = payload.new;
          if (!notif) return;

          // Se a notificação for destinada ao usuário atual (ou legado recipient_id)
          const isForMe = notif.user_id === currentUser.id || notif.recipient_id === currentUser.id;
          const isNotFromMe = notif.sender_id !== currentUser.id;

          if (isForMe && isNotFromMe) {
            const rawChat = notif.chat_id || 'c-geral';
            const cKey = normalizeChatKey(rawChat, currentUser.id);
            const currentKey = getChatKey(activeChat, currentUser.id);

            if (cKey === currentKey && !document.hidden) {
              markMessagesAsRead(activeChat);
            } else {
              let targetBadgeKey = cKey;
              if (cKey.startsWith('dm-')) {
                const parts = cKey.replace('dm-', '').split('-');
                targetBadgeKey = parts[0] === currentUser.id ? parts[1] : parts[0];
              }

              setUnreadCounts((prev) => ({
                ...prev,
                [targetBadgeKey]: (prev[targetBadgeKey] || 0) + 1
              }));

              playMessageSound();
              notifyIncomingMessage(notif.title || 'EduChat', notif.content || 'Nova mensagem');
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            let reqName = row.requester || '';
            let reqDept = row.requester_dept || '';
            if (!reqName && row.source_message && row.source_message.includes('Solicitado por:')) {
              const match = row.source_message.match(/Solicitado por:\s*([^(•]+)\s*(?:\(([^)]+)\))?/);
              if (match) {
                reqName = match[1].trim();
                reqDept = match[2]?.trim() || '';
              }
            }
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
              sourceMessage: row.source_message,
              requester: reqName,
              requesterDept: reqDept,
              comments: [],
              attachments: []
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
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setTasks((prev) => prev.filter((t) => t.id !== oldId));
            }
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
      clearInterval(syncInterval);
      supabase.removeChannel(channelListener);
    };
  }, [activeChat, currentUser]);

  // Enviar nova mensagem no chat ativo com suporte a anexo, resposta/citação e áudio (Item 2, 3, 5 e 7)
  const handleSendMessage = (text, attachment = null, options = {}) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Limpa a notificação pendente do chat atual imediatamente (Item 7)
    clearUnread(activeChat.id);

    // Determina status de leitura inicial: IA e contatos online recebem entrega imediata
    let initialStatus = 'sent';
    if (activeChat.type === 'dm' && activeChat.id === 'u_ia_copilot') {
      initialStatus = 'read';
    } else if (chatMeta.data?.online) {
      initialStatus = 'delivered';
    }

    const newMsg = {
      id: 'm_' + Date.now(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: text || '',
      timestamp: timeStr,
      attachment: attachment || null,
      replyTo: options.replyTo || null,
      isAudio: !!options.isAudio,
      status: initialStatus,
      actionExtracted: false,
    };

    setMessages((prev) => ({
      ...prev,
      [currentChatKey]: [...(prev[currentChatKey] || []), newMsg],
    }));

    let payloadText = text || '';
    if (attachment) {
      payloadText = `${payloadText ? payloadText + '\n' : ''}[ARQUIVO_ANEXO:${JSON.stringify(attachment)}]`;
    }
    if (options.replyTo) {
      payloadText = `${payloadText}\n<!-- REPLY_TO:${JSON.stringify(options.replyTo)} -->`;
    }
    payloadText = `${payloadText}\n<!-- STATUS:${initialStatus} -->`;

    supabase.from('messages').insert([{
      id: newMsg.id,
      chat_id: currentChatKey,
      sender_id: newMsg.senderId,
      sender_name: newMsg.senderName,
      text: payloadText,
      timestamp: newMsg.timestamp
    }]).then(({ error }) => {
      if (error) console.warn('Erro ao salvar msg no Supabase:', error);
    });

    // GATILHO IA: Se for conversa com o Assistente IA ou menção @ia / @copilot
    const isIAChat = (activeChat.type === 'dm' && activeChat.id === 'u_ia_copilot');
    const isIAMention = text.toLowerCase().includes('@ia') || text.toLowerCase().includes('@copilot');

    if (isIAChat || isIAMention) {
      setTimeout(() => {
        const cleanQuery = text.replace(/@(ia|copilot)\b/gi, '').trim();
        const aiResult = answerCopilotQuery(cleanQuery || text, currentUser, vipClients, customAIPrompt, learnedDocuments);
        const replyText = typeof aiResult === 'object' && aiResult?.reply ? aiResult.reply : aiResult;

        // Se for detecção do AI Bug Tracker (Bypass de suporte e inserção automática em bug_reports)
        if (typeof aiResult === 'object' && aiResult?.isBugReport && aiResult?.bugData) {
          const bugPayload = {
            titulo: aiResult.bugData.titulo_do_bug,
            problema: aiResult.bugData.problema_relatado,
            solucao_esperada: aiResult.bugData.solucao_esperada,
            prioridade: aiResult.bugData.prioridade,
            status: 'aberto',
            reporter_name: currentUser?.name || 'Administrador',
            reporter_id: currentUser?.id || 'admin'
          };

          // Salva no Supabase na tabela bug_reports
          supabase.from('bug_reports').insert([bugPayload]).then(({ error }) => {
            if (error) console.warn('Erro ao inserir bug_report no Supabase:', error);
          });

          // Backup persistente em localStorage
          try {
            const storedBugs = JSON.parse(localStorage.getItem('educhat_bug_reports') || '[]');
            storedBugs.unshift({
              id: 'bug_' + Date.now(),
              created_at: new Date().toISOString(),
              ...bugPayload
            });
            localStorage.setItem('educhat_bug_reports', JSON.stringify(storedBugs));
          } catch (e) {
            console.error('Erro ao armazenar bug_report em localStorage:', e);
          }
        }

        const aiReply = {
          id: 'ia_' + Date.now(),
          senderId: 'u_ia_copilot',
          senderName: 'Assistente IA (MEC & Processos)',
          text: replyText,
          timestamp: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
          actionExtracted: false
        };

        setMessages((prev) => ({
          ...prev,
          [currentChatKey]: [...(prev[currentChatKey] || []), aiReply]
        }));

        supabase.from('messages').insert([{
          id: aiReply.id,
          chat_id: currentChatKey,
          sender_id: aiReply.senderId,
          sender_name: aiReply.senderName,
          text: aiReply.text,
          timestamp: aiReply.timestamp
        }]).then(({ error }) => {
          if (error) console.warn('Erro ao salvar resposta da IA:', error);
        });

        playMessageSound();
      }, 700);
      return;
    }

    // GATILHO WHATSAPP: Se for conversa de WhatsApp com Aluno/Lead
    if (activeChat.type === 'whatsapp') {
      const contact = whatsAppContacts.find((c) => c.id === activeChat.id);

      // Se um consultor humano enviou mensagem, pausa automaticamente a IA para não haver conflito
      if (contact && contact.aiActive) {
        setWhatsAppContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? { ...c, aiActive: false } : c))
        );
      }

      // Se a mensagem enviada for a resposta de uma URA / Triagem (ex: "1", "2", "3", "4" ou texto correspondente)
      if (contact && (contact.status === 'ura_inedito' || contact.status === 'veterano_retencao')) {
        const triageResult = processTriageResponse(text, contact.status, collaborators);
        if (triageResult) {
          setTimeout(() => {
            // 1. Atualizar contato
            setWhatsAppContacts((prev) =>
              prev.map((c) =>
                c.id === contact.id
                  ? {
                      ...c,
                      department: triageResult.department,
                      assignee: triageResult.assignee,
                      status: 'carteira_ativa',
                      statusLabel: 'Em Atendimento',
                      aiActive: false,
                      triageContext: `Encaminhado via URA: [${triageResult.triageLabel}] para ${triageResult.assignee}`
                    }
                  : c
              )
            );

            // 2. Criar card no Kanban do setor correspondente
            const newTask = {
              id: 't_ura_' + Date.now(),
              title: `${triageResult.taskTitle} - ${contact.name}`,
              desc: `Demanda de atendimento WhatsApp (${contact.phone}). Classificada via URA: ${triageResult.triageLabel}.`,
              status: 'backlog',
              priority: triageResult.priority,
              isVip: false,
              assignee: triageResult.assignee,
              assigneeAvatar: '👤',
              department: triageResult.department,
              dueDate: 'Hoje (Em até 4h)',
              channel: `📱 WhatsApp (${contact.phone})`,
              clientPhone: contact.phone,
              sourceMessage: `WhatsApp: "${contact.phone}" • ${contact.name} (${triageResult.triageLabel})`,
              requester: 'URA WhatsApp',
              requesterDept: 'Triagem',
              comments: [],
              attachments: []
            };

            setTasks((prev) => [newTask, ...prev]);

            supabase.from('tasks').insert([{
              id: newTask.id,
              title: newTask.title,
              description: newTask.desc,
              status: newTask.status,
              priority: newTask.priority,
              is_vip: false,
              assignee: newTask.assignee,
              assignee_avatar: newTask.assigneeAvatar,
              department: newTask.department,
              due_date: newTask.dueDate,
              channel: newTask.channel,
              source_message: newTask.sourceMessage
            }]).then(({ error }) => {
              if (error) console.warn('Erro ao salvar task da URA no Supabase:', error);
            });

            // 3. Resposta do Bot de Confirmação no Chat com marcador de taskId
            const botReply = {
              id: 'bot_triage_' + Date.now(),
              senderId: 'bot',
              senderName: '🤖 Copiloto EduChat',
              text: `✅ ${triageResult.handOffMessage}\n📌 Card criado no Kanban do setor ${triageResult.department} com prioridade ${triageResult.priority.toUpperCase()}.\n<!-- TASK_ID:${newTask.id} -->`,
              timestamp: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
              isWhatsApp: true,
              fromStudent: false,
              taskId: newTask.id
            };

            setMessages((prev) => ({
              ...prev,
              [currentChatKey]: [...(prev[currentChatKey] || []), botReply]
            }));

            // Notifica o consultor do setor designado
            if (currentUser.name === triageResult.assignee || currentUser.roleType === 'diretor') {
              playMessageSound();
              notifyIncomingMessage('EduChat Triagem URA', `Nova demanda encaminhada para você: ${contact.name}`);
            }
          }, 600);
          return;
        }
      }
    }

    // GATILHO 1: Comando manual explícito /tarefa
    if (text.startsWith('/tarefa')) {
      const taskText = text.replace('/tarefa', '').trim();
      createAutoTask(taskText, text, timeStr);
      return;
    }

    // GATILHO 2: MODO AUTÔNOMO DA IA
    if (aiAutonomous) {
      const lower = text.toLowerCase();
      const taskKeywords = [
        'preciso que', 'favor', 'gere', 'gerar', 'envie', 'enviar',
        'verifique', 'até amanhã', 'até sexta', 'fazer', 'emitir',
        'corrigir', 'cobrar', 'retificar', 'urgente', 'aprove', 'aprovar', 'atender'
      ];

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
    // 1. Análise de Prioridade 100% IA (considerando memorandos aprendidos)
    const aiAnalysis = analyzeTaskPriorityAI(rawTitle, fullText, vipClients, learnedDocuments);

    // 2. Define o responsável
    let targetAssignee;
    let targetDept;
    let assigneeAvatar;

    const isDM = activeChat.type === 'dm';
    const otherParticipant = isDM
      ? collaborators.find((c) => c.id === activeChat.id)
      : null;

    if (isDM && otherParticipant) {
      // REGRA DE NEGÓCIO UNILATERAL (Item 6): Em conversa privada 1 a 1, o responsável é OBRIGATORIAMENTE o outro interlocutor!
      targetAssignee = otherParticipant.name;
      targetDept = otherParticipant.department;
      assigneeAvatar = otherParticipant.avatar || '👤';
    } else {
      // Em canais gerais, busca menção de colaborador no texto
      const foundUser = collaborators.find((c) =>
        !c.isBot && fullText.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
      );
      targetAssignee = foundUser ? foundUser.name : (collaborators[1]?.name || 'Tatiane Salatinos');
      const assigneeObj = collaborators.find((c) => c.name === targetAssignee);
      targetDept = assigneeObj?.department || (activeChat.type === 'channel' ? chatMeta.data.department : 'Comercial');
      assigneeAvatar = assigneeObj?.avatar || '👤';
    }

    const channelTag = isDM
      ? `🔒 Privado (${otherParticipant?.name?.split(' ')[0] || '1 a 1'})`
      : `#${chatMeta.data.name}`;

    const taskRequester = currentUser.name;
    const taskRequesterDept = currentUser.department;
    const fullSourceMessage = `Solicitado por: ${taskRequester} (${taskRequesterDept}) • "${fullText}"`;

    const autoTask = {
      id: 't_' + Date.now(),
      title: rawTitle.length > 60 ? rawTitle.slice(0, 57) + '...' : rawTitle,
      desc: aiAnalysis.reason,
      status: 'backlog',
      priority: aiAnalysis.priority,
      isVip: aiAnalysis.isVip,
      aiReason: aiAnalysis.reason,
      assignee: targetAssignee,
      assigneeAvatar: assigneeObj?.avatar || '👤',
      department: targetDept,
      dueDate: aiAnalysis.dueDate,
      channel: channelTag,
      sourceMessage: fullSourceMessage,
      requester: taskRequester,
      requesterDept: taskRequesterDept,
      comments: [],
      attachments: []
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
      department: targetDept,
      due_date: autoTask.dueDate,
      channel: autoTask.channel,
      source_message: fullSourceMessage
    }]).then(({ error }) => {
      if (error) console.warn('Erro ao salvar autoTask no Supabase:', error);
    });

    // Feedback inteligente do Bot no chat com ID para Desfazer/Excluir
    const baseReplyText = autoTask.isVip
      ? `👑 [CLIENTE VIP DETECTADO]\n📌 Demanda criada com PRIORIDADE MÁXIMA: "${autoTask.title}"\n👤 Atribuído a: ${autoTask.assignee}\n⏱️ Prazo IA: ${autoTask.dueDate}\n💡 Critério: ${autoTask.aiReason}`
      : wasAutonomous
      ? `✨ [IA Autônoma] Demanda criada no Kanban:\n📌 "${autoTask.title}"\n👤 Responsável: ${autoTask.assignee}\n📅 Prioridade: ${autoTask.priority.toUpperCase()} (${autoTask.dueDate})`
      : `✨ Demanda criada com sucesso no Kanban!\n📌 "${autoTask.title}"\n👤 Responsável: ${autoTask.assignee}`;

    const botReply = {
      id: 'bot_' + Date.now(),
      senderId: 'bot',
      senderName: '🤖 Copiloto EduChat',
      text: baseReplyText,
      timestamp: timeStr,
      taskId: autoTask.id,
      actionExtracted: true,
    };

    setMessages((prev) => ({
      ...prev,
      [currentChatKey]: [...(prev[currentChatKey] || []), botReply],
    }));

    // Salvar com marcador de taskId para persistir opção de exclusão
    const payloadBotText = `${baseReplyText}\n<!-- TASK_ID:${autoTask.id} -->`;
    supabase.from('messages').insert([{
      id: botReply.id,
      chat_id: currentChatKey,
      sender_id: botReply.senderId,
      sender_name: botReply.senderName,
      text: payloadBotText,
      timestamp: botReply.timestamp
    }]).then(({ error }) => {
      if (error) console.warn('Erro ao salvar botReply no Supabase:', error);
    });
  };

  // Excluir card do Kanban (Item 1)
  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) console.warn('Erro ao excluir tarefa no Supabase:', error);
      });
  };

  // Alternar atendimento IA vs Humano em contatos WhatsApp
  const handleToggleWhatsAppAI = (contactId) => {
    setWhatsAppContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, aiActive: !c.aiActive } : c))
    );
  };

  // Processador Central do Webhook de WhatsApp (Simulador & Produção)
  const handleWhatsAppWebhookEvent = ({ fromPhone, senderName, messageText, isAudio, audioTranscription, contactId }) => {
    const routingResult = routeIncomingWhatsAppWebhook({
      fromPhone,
      senderName,
      messageText,
      tasks,
      collaborators
    });

    const targetChatId = contactId || (whatsAppContacts.find(c => c.phone.replace(/\D/g, '') === fromPhone.replace(/\D/g, ''))?.id) || 'wa-carlos-eduardo';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const incomingMsg = {
      id: 'wa_in_' + Date.now(),
      senderId: targetChatId,
      senderName: senderName || 'Lead WhatsApp',
      text: messageText,
      timestamp: timeStr,
      isWhatsApp: true,
      fromStudent: true,
      isAudio: !!isAudio,
      audioTranscription: audioTranscription || null
    };

    setMessages((prev) => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), incomingMsg]
    }));

    // Trava de Carteira Ativa: Apenas o consultor responsável (ou o diretor) é notificado!
    const isMyLead = routingResult.targetAssignee === currentUser.name;
    if (isMyLead || (routingResult.door === 1 && currentUser.roleType === 'diretor')) {
      playMessageSound();
      notifyIncomingMessage(senderName, messageText);
    }

    if (activeChat.id !== targetChatId) {
      setUnreadCounts((prev) => ({
        ...prev,
        [targetChatId]: (prev[targetChatId] || 0) + 1
      }));
    }

    // Auto-resposta para URA (Porta 3) ou Veterano (Porta 2)
    if (routingResult.autoReply) {
      setTimeout(() => {
        const replyMsg = {
          id: 'wa_bot_' + Date.now(),
          senderId: routingResult.routeType === 'BRAND_NEW_URA' ? 'bot_ura' : 'bot_retencao',
          senderName: routingResult.routeType === 'BRAND_NEW_URA' ? '🤖 URA EduChat' : '🤖 Assistente EduChat',
          text: routingResult.autoReply,
          timestamp: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
          isWhatsApp: true,
          fromStudent: false,
          isTriageMenu: true
        };
        setMessages((prev) => ({
          ...prev,
          [targetChatId]: [...(prev[targetChatId] || []), replyMsg]
        }));
        playMessageSound();
      }, 700);
    }

    return routingResult;
  };

  // Excluir card criado pela IA diretamente a partir da conversa (Item 1)
  const handleDeleteTaskFromMessage = (taskId, messageId) => {
    handleDeleteTask(taskId);

    // Atualiza o balão do bot no chat para avisar que foi descartado
    setMessages((prev) => {
      const chatMsgs = prev[currentChatKey] || [];
      const updated = chatMsgs.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            text: `❌ [Demanda Cancelada] O card foi removido do Kanban por ${currentUser.name}.`,
            taskId: null
          };
        }
        return m;
      });
      return { ...prev, [currentChatKey]: updated };
    });

    supabase
      .from('messages')
      .update({ text: `❌ [Demanda Cancelada] O card foi removido do Kanban por ${currentUser.name}.` })
      .eq('id', messageId)
      .then(({ error }) => {
        if (error) console.warn('Erro ao atualizar mensagem de cancelamento no Supabase:', error);
      });
  };

  // Delegar Tarefa para outro colaborador (Item 5)
  const handleDelegateTask = (taskId, newAssigneeName) => {
    const newCollab = collaborators.find((c) => c.name === newAssigneeName);
    if (!newCollab) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const commentObj = {
      id: 'c_' + Date.now(),
      author: currentUser.name,
      avatar: currentUser.avatar,
      dept: currentUser.department,
      text: `🔄 Demanda delegada para ${newCollab.name} (${newCollab.department}) por ${currentUser.name}.`,
      timestamp: `${timeStr} - ${now.toLocaleDateString('pt-BR')}`
    };

    handleUpdateTaskDetails(taskId, {
      assignee: newCollab.name,
      assigneeAvatar: newCollab.avatar || '👤',
      department: newCollab.department,
      comments: [
        ...((tasks.find((t) => t.id === taskId)?.comments) || []),
        commentObj
      ]
    });
  };

  // Agendar Prazo para a Demanda (Item 3)
  const handleScheduleTask = (taskId, newDueDate) => {
    if (!newDueDate) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const commentObj = {
      id: 'c_' + Date.now(),
      author: currentUser.name,
      avatar: currentUser.avatar,
      dept: currentUser.department,
      text: `📅 Prazo reagendado para: "${newDueDate}" por ${currentUser.name}.`,
      timestamp: `${timeStr} - ${now.toLocaleDateString('pt-BR')}`
    };

    handleUpdateTaskDetails(taskId, {
      dueDate: newDueDate,
      comments: [
        ...((tasks.find((t) => t.id === taskId)?.comments) || []),
        commentObj
      ]
    });
  };

  const handleCreateTaskFromMessage = (message) => {
    setAiModal({
      isOpen: true,
      mode: 'extract_task',
      sourceMessage: message,
    });
  };

  const handleSummarizeChat = () => {
    setAiModal({
      isOpen: true,
      mode: 'summary',
      sourceMessage: null,
    });
  };

  const handleUpdateTaskStatus = (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) console.warn('Erro ao atualizar status da tarefa no Supabase:', error);
      });
  };

  // Atualizar dados completos da tarefa (comentários, anexos, etc.)
  const handleUpdateTaskDetails = (taskId, partial) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = { ...t, ...partial };
        const metaPayload = JSON.stringify({
          comments: updated.comments || [],
          attachments: updated.attachments || []
        });
        const serializedDesc = `${updated.desc || ''}\n<!-- TASK_META:${metaPayload} -->`;
        supabase
          .from('tasks')
          .update({
            status: updated.status,
            title: updated.title,
            description: serializedDesc,
            priority: updated.priority,
            assignee: updated.assignee,
            due_date: updated.dueDate
          })
          .eq('id', taskId)
          .then(({ error }) => {
            if (error) console.warn('Erro ao salvar detalhes da tarefa no Supabase:', error);
          });
        return updated;
      })
    );
  };

  const handleConfirmTaskCreation = (newTask) => {
    const taskRequester = newTask.requester || currentUser.name;
    const taskRequesterDept = newTask.requesterDept || currentUser.department;
    const fullSourceMessage = `Solicitado por: ${taskRequester} (${taskRequesterDept})${newTask.sourceMessage ? ' • ' + newTask.sourceMessage : ''}`;

    const completeTask = {
      ...newTask,
      requester: taskRequester,
      requesterDept: taskRequesterDept,
      sourceMessage: fullSourceMessage,
      comments: [],
      attachments: []
    };

    setTasks((prev) => [completeTask, ...prev]);

    supabase.from('tasks').insert([{
      id: completeTask.id,
      title: completeTask.title,
      description: completeTask.desc || '',
      status: completeTask.status || 'backlog',
      priority: completeTask.priority || 'media',
      is_vip: completeTask.isVip || false,
      assignee: completeTask.assignee,
      assignee_avatar: completeTask.assigneeAvatar || '👤',
      department: completeTask.department || 'Geral',
      due_date: completeTask.dueDate,
      channel: completeTask.channel,
      source_message: fullSourceMessage
    }]).then(({ error }) => {
      if (error) console.warn('Erro ao salvar nova tarefa no Supabase:', error);
    });
  };

  const handleSaveChannel = (newChannel) => {
    setChannels((prev) => [...prev, newChannel]);
    setActiveChat({ type: 'channel', id: newChannel.id });
    setActiveView('chat');
  };

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

  const handleCreateTasksFromDossier = (tasksToAdd) => {
    const mapped = tasksToAdd.map((t, idx) => ({
      ...t,
      id: 'dossier_t_' + Date.now() + '_' + idx,
      status: 'backlog',
      assigneeAvatar: t.assignee?.includes('Fernanda') ? '👩‍💻' : '👨‍🔧',
      channel: t.department === 'Financeiro' ? '#financeiro' : '#secretaria-pedagogica',
      sourceMessage: `Dossiê WhatsApp: "${t.desc}"`,
      comments: [],
      attachments: []
    }));
    setTasks((prev) => [...mapped, ...prev]);
  };

  const handleFeedAIMemory = (learnings) => {
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
    if (learnings.newFacts && learnings.newFacts.length > 0) {
      setCustomAIPrompt((prev) => `${prev}\n\nREGRAS APRENDIDAS VIA HISTÓRICO DO WHATSAPP:\n- ${learnings.newFacts.join('\n- ')}`);
    }
  };

  // Gerenciamento de Documentos Aprendidos
  const handleAddDocument = (newDoc) => {
    setLearnedDocuments((prev) => [newDoc, ...prev]);
  };

  const handleRemoveDocument = (docId) => {
    setLearnedDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-chatBg font-sans text-chatTextBody ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Barra Lateral estilo WhatsApp */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        channels={channels}
        collaborators={collaborators}
        whatsAppContacts={whatsAppContacts}
        activeChat={activeChat}
        onSelectChannel={(channelId) => {
          setActiveChat({ type: 'channel', id: channelId });
          setActiveView('chat');
          clearUnread(channelId);
        }}
        onSelectCollaborator={(userId) => {
          setActiveChat({ type: 'dm', id: userId });
          setActiveView('chat');
          clearUnread(userId);
        }}
        onSelectWhatsAppContact={(contactId) => {
          setActiveChat({ type: 'whatsapp', id: contactId });
          setActiveView('chat');
          clearUnread(contactId);
        }}
        onOpenWhatsAppConnection={(tab = 'qrcode') => setWhatsAppModal({ isOpen: true, tab })}
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
        onOpenUserSelectModal={() => setIsUserSelectOpen(true)}
        unreadCounts={unreadCounts}
        lastSyncTime={lastSyncTime}
      />

      {/* Área Central Baseada na Visualização Ativa */}
      {activeView === 'chat' && (
        <ChatArea
          chatMeta={chatMeta}
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          onCreateTaskFromMessage={handleCreateTaskFromMessage}
          onDeleteTaskFromMessage={handleDeleteTaskFromMessage}
          onOpenTaskDetail={(taskId) => {
            const found = tasks.find((t) => t.id === taskId);
            if (found) setSelectedTaskDetail(found);
          }}
          onScheduleTask={handleScheduleTask}
          onDelegateTask={handleDelegateTask}
          onSummarizeChat={handleSummarizeChat}
          onOpenWhatsAppDossier={() => setIsDossierOpen(true)}
          onToggleWhatsAppAI={handleToggleWhatsAppAI}
          currentUser={currentUser}
          realtimeStatus={realtimeStatus}
          collaborators={collaborators}
        />
      )}

      {activeView === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          currentUser={currentUser}
          collaborators={collaborators}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onAddTask={() =>
            setAiModal({ isOpen: true, mode: 'extract_task', sourceMessage: null })
          }
          onCardClick={(task) => setSelectedTaskDetail(task)}
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

      {/* Modal Inteligente da IA (Copiloto) com Responsável com Scroll e Prioridade IA */}
      <AICopilotModal
        isOpen={aiModal.isOpen}
        onClose={() => setAiModal({ ...aiModal, isOpen: false })}
        mode={aiModal.mode}
        sourceMessage={aiModal.sourceMessage}
        channel={activeChat.type === 'channel' ? chatMeta.data : null}
        activeChat={activeChat}
        onConfirmTaskCreation={handleConfirmTaskCreation}
        collaborators={collaborators}
        vipClients={vipClients}
      />

      {/* Modal para Criar Canal ou Colaborador */}
      <NewItemModal
        isOpen={modalItem.isOpen}
        type={modalItem.type}
        onClose={() => setModalItem({ ...modalItem, isOpen: false })}
        onSave={modalItem.type === 'channel' ? handleSaveChannel : handleSaveCollaborator}
      />

      {/* Modal de Memória e Ingestão de Documentos da IA (Item 3) */}
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
        learnedDocuments={learnedDocuments}
        onAddDocument={handleAddDocument}
        onRemoveDocument={handleRemoveDocument}
      />

      {/* Modal de Dossiê 360º & Auto-Aprendizado do WhatsApp */}
      <WhatsAppDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onCreateTasks={handleCreateTasksFromDossier}
        onFeedAIMemory={handleFeedAIMemory}
      />

      {/* Modal de Seleção de Usuário (Login / Identificação Opção A) */}
      <UserSelectionModal
        isOpen={isUserSelectOpen}
        onClose={() => setIsUserSelectOpen(false)}
        collaborators={collaborators}
        onSelectUser={handleSwitchUser}
        currentUserId={currentUser?.id}
      />

      {/* Modal Ampliado de Detalhes da Demanda com Exclusão e Delegação (Item 1, 5, 7 e 8) */}
      <TaskDetailModal
        isOpen={!!selectedTaskDetail}
        onClose={() => setSelectedTaskDetail(null)}
        task={selectedTaskDetail}
        onUpdateStatus={(taskId, newStatus) => {
          handleUpdateTaskStatus(taskId, newStatus);
          setSelectedTaskDetail((prev) => prev && prev.id === taskId ? { ...prev, status: newStatus } : prev);
        }}
        onUpdateTask={(taskId, partial) => {
          handleUpdateTaskDetails(taskId, partial);
          setSelectedTaskDetail((prev) => prev && prev.id === taskId ? { ...prev, ...partial } : prev);
        }}
        onDeleteTask={handleDeleteTask}
        currentUser={currentUser}
        collaborators={collaborators}
      />

      {/* Modal de Conexão WhatsApp & Simulador de Webhooks */}
      <WhatsAppConnectionModal
        isOpen={whatsAppModal.isOpen}
        initialTab={whatsAppModal.tab}
        onClose={() => setWhatsAppModal((prev) => ({ ...prev, isOpen: false }))}
        onSimulateWebhook={handleWhatsAppWebhookEvent}
      />
    </div>
  );
}
