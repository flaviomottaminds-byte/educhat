import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import KanbanBoard from './components/KanbanBoard';
import GestaoDashboard from './components/GestaoDashboard';
import SecretariaView from './components/SecretariaView';
import AICopilotModal from './components/AICopilotModal';
import NewItemModal from './components/NewItemModal';
import AIMemoryModal from './components/AIMemoryModal';
import WhatsAppDossierModal from './components/WhatsAppDossierModal';
import WhatsAppConnectionModal from './components/WhatsAppConnectionModal';
import InstagramLeadImportModal from './components/InstagramLeadImportModal';
import EduControlSyncModal from './components/EduControlSyncModal';
import UserSelectionModal from './components/UserSelectionModal';
import TaskDetailModal from './components/TaskDetailModal';
import NewWhatsAppChatModal from './components/NewWhatsAppChatModal';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import { toast } from './lib/toast';
import { Shield } from 'lucide-react';
import { supabase } from './lib/supabase';
import { INITIAL_EDUCONTROL_STUDENTS, matchStudentByPhone } from './lib/eduControl';
import {
  requestDesktopNotificationPermission,
  notifyIncomingMessage,
  stopTaskbarBlink
} from './lib/desktopNotification';
import {
  answerCopilotQuery,
  analyzeTaskPriorityAI,
  isBugReportIntent,
  isKanbanIntent,
  isUserAdmin,
  parseBugReport
} from './lib/aiKnowledge';
import {
  INITIAL_CHANNELS,
  INITIAL_COLLABORATORS,
  INITIAL_MESSAGES,
  INITIAL_TASKS,
  getChatKey,
  normalizeChatKey,
  getCanonicalPhoneKey,
  canonicalizeChatId,
  canonicalizeWhatsAppPhone
} from './data/initialData';
import {
  INITIAL_WHATSAPP_CONTACTS,
  INITIAL_WHATSAPP_MESSAGES,
  routeIncomingWhatsAppWebhook,
  processTriageResponse,
  getAvailableURADepartments,
  generateDynamicURAMenu,
  getBrasiliaTime
} from './lib/whatsappRouting';
import {
  generateGeminiChatReply,
  syncGeminiApiKeyFromCloud,
  matchCollaboratorToTask,
  parseKanbanCardsFromText
} from './lib/gemini';
import {
  hasFullPortfolioAccess,
  isChatAssignedToUser,
  normalizeName,
  canUserViewChat,
  canUserViewTask,
  canUserViewChannel,
  isTaskAssignedToUser,
  isTaskRequestedByUser
} from './lib/portfolioAccess';
import { fetchKnowledgeBaseDocs } from './lib/knowledgeBase';
import { getSaoPauloTime, formatRelativeChatTime } from './lib/timezone';
import { normalizeKey } from './lib/listParsers';
import {
  isCollaboratorOnline,
  getLatestSeen,
  normalizePresenceKey,
  loadLocalHeartbeats,
  saveLocalHeartbeat
} from './lib/presence';
import {
  toWhatsAppNumber,
  toWhatsAppTarget,
  sendWhatsAppText,
  ensureEvolutionWebhook,
  getEvolutionState,
  fetchEvolutionRecentMessages
} from './lib/evolution';
import {
  publishInternalMessage,
  publishPresencePing,
  subscribeToInternalRelay
} from './lib/internalBus';
import {
  setIsolatedUserSession,
  validateAndEvictMismatchedAuth,
  clearAllAuthCaches
} from './lib/sessionManager';
import { extractAttachmentFromText } from './lib/attachmentParser';

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

// Helper global para evitar que requisições ao Supabase travem a interface se o banco estiver lento ou pausado
const withTimeout = (promise, ms = 2500, fallback = { data: null, error: 'timeout' }) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);

export default function App() {
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (path === '/dashboard' || path === '/relatorios' || hash === '#dashboard' || hash === '#relatorios') {
        return 'dashboard';
      }
      if (path === '/kanban' || hash === '#kanban') {
        return 'kanban';
      }
      if (path.startsWith('/secretaria') || hash === '#secretaria') {
        return 'secretaria';
      }
    }
    return 'chat';
  }); // 'chat' | 'kanban' | 'dashboard' | 'gestao' | 'secretaria'
  const [theme, setTheme] = useState('light'); // 'light' (Clean White WhatsApp) | 'dark'
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const [collaborators, setCollaborators] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_collaborators');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = [...parsed];
          INITIAL_COLLABORATORS.forEach((ic) => {
            const exists = list.some((c) => c.id === ic.id || (c.name && ic.name && c.name.trim().toLowerCase() === ic.name.trim().toLowerCase()));
            if (!exists) {
              list.push(ic);
            }
          });
          return list;
        }
      }
    } catch {}
    return INITIAL_COLLABORATORS;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedId = localStorage.getItem('educhat_user_id');
      const savedList = localStorage.getItem('educhat_collaborators');
      const allCollabs = savedList ? JSON.parse(savedList) : INITIAL_COLLABORATORS;
      const found = (Array.isArray(allCollabs) ? allCollabs : INITIAL_COLLABORATORS).find((u) => u.id === savedId);
      return found || INITIAL_COLLABORATORS[0];
    } catch {
      return INITIAL_COLLABORATORS[0];
    }
  });

  // Rastreamento de Presença em Tempo Real (Supabase Realtime Presence) e Heartbeat
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [heartbeats, setHeartbeats] = useState(() => loadLocalHeartbeats());

  const presenceChannelRef = React.useRef(null);

  // Resolução dinâmica de colaboradores: online/offline e última atividade vindos de Presence + profiles.last_seen
  const resolvedCollaborators = React.useMemo(() => {
    return (collaborators || []).map((collab) => {
      const isOnline = isCollaboratorOnline(collab, onlineUserIds, heartbeats, currentUser?.id);
      return {
        ...collab,
        online: isOnline,
        lastSeen: isOnline && !collab.isBot ? new Date().toISOString() : getLatestSeen(collab, heartbeats)
      };
    });
  }, [collaborators, onlineUserIds, heartbeats, currentUser?.id]);

  // Ao trocar de usuário logado, anuncia a nova identidade no canal de presença imediatamente
  useEffect(() => {
    const u = currentUser;
    if (!u?.id) return;
    const nowIso = new Date().toISOString();
    setHeartbeats({ ...saveLocalHeartbeat(u.id, nowIso) });
    const ch = presenceChannelRef.current;
    if (ch) {
      try {
        ch.track({ userId: u.id, userName: u.name, email: u.email || '', department: u.department, onlineAt: nowIso });
      } catch {}
    }
    supabase.from('profiles').update({ last_seen: nowIso }).eq('id', u.id).then(() => {}, () => {});
  }, [currentUser?.id]);

  // 1. SINCRONIZAÇÃO DE ROTAS E NAVEGAÇÃO (/dashboard, /kanban, /)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;
    let targetPath = '/';
    if (activeView === 'dashboard' || activeView === 'gestao') {
      targetPath = '/dashboard';
    } else if (activeView === 'kanban') {
      targetPath = '/kanban';
    } else if (activeView === 'secretaria') {
      targetPath = '/secretaria';
    }

    if (currentPath !== targetPath && (currentPath === '/' || currentPath === '/dashboard' || currentPath === '/relatorios' || currentPath === '/kanban')) {
      try {
        window.history.pushState({ view: activeView }, '', targetPath);
      } catch {}
    }
  }, [activeView]);

  useEffect(() => {
    const handlePopState = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (path === '/dashboard' || path === '/relatorios' || hash === '#dashboard' || hash === '#relatorios') {
        setActiveView('dashboard');
      } else if (path === '/kanban' || hash === '#kanban') {
        setActiveView('kanban');
      } else if (path.startsWith('/secretaria') || hash === '#secretaria') {
        setActiveView('secretaria');
      } else {
        setActiveView('chat');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fallback: sincroniza last_seen de toda a equipe direto da tabela profiles a cada 30s
  useEffect(() => {
    let cancelled = false;
    const refreshProfilesPresence = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.from('profiles').select('id,email,name,last_seen'),
          2500
        );
        if (error || !data || cancelled) return;
        setCollaborators((prev) =>
          prev.map((c) => {
            const row = data.find(
              (p) =>
                p.id === c.id ||
                (p.email && c.email && p.email.toLowerCase() === c.email.toLowerCase()) ||
                (p.name && c.name && p.name.trim().toLowerCase() === c.name.trim().toLowerCase())
            );
            return row && row.last_seen && row.last_seen !== c.lastSeen ? { ...c, lastSeen: row.last_seen } : c;
          })
        );
      } catch {}
    };
    refreshProfilesPresence();
    const id = setInterval(refreshProfilesPresence, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  // Religamento forçado do WhatsApp (Evolution API): ao abrir força o webhook -> Supabase e revalida a cada 5 min
  useEffect(() => {
    let cancelled = false;
    const check = async (force) => {
      try {
        await ensureEvolutionWebhook({ force });
      } catch (err) {
        console.warn('[WhatsApp Webhook] Erro ao sincronizar webhook:', err);
      }
      const state = await getEvolutionState();
      if (cancelled) return;
      if (state !== 'open') {
        console.warn('[WhatsApp] Evolution API estado atual: ' + state);
      }
    };
    check(true);
    const id = setInterval(() => check(false), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Sincronização Direta e Contínua com a Evolution API (WhatsApp Real):
  // Lê os chats e mensagens reais da instância 'EduChat-Matriz-01' a cada 3.5 segundos
  useEffect(() => {
    let cancelled = false;

    const syncLiveEvolution = async () => {
      try {
        const { contacts: liveContacts, messagesByChat: liveMessages } =
          await fetchEvolutionRecentMessages({ limit: 50 });

        if (cancelled) return;

        setLastSyncTime(getSaoPauloTime());
        setRealtimeStatus('connected');

        if (Array.isArray(liveContacts) && liveContacts.length > 0) {
          const activeUser = currentUserRef.current || currentUser;
          const isMgr = hasFullPortfolioAccess(activeUser);

          setWhatsAppContacts((prev) => {
            const next = [...prev];
            liveContacts.forEach((incoming) => {
              const incomingKey = getCanonicalPhoneKey(incoming);
              const idx = next.findIndex(
                (c) =>
                  c.id === incoming.id ||
                  (incoming.remoteJid && c.remoteJid === incoming.remoteJid) ||
                  (incomingKey && getCanonicalPhoneKey(c) === incomingKey) ||
                  (c.phone && incoming.phone && c.phone.replace(/\D/g, '') === incoming.phone.replace(/\D/g, ''))
              );
              if (idx !== -1) {
                const merged = {
                  ...incoming,
                  ...next[idx],
                  // Preserva estritamente a atribuição e status definidos na aplicação (evita sobrescrever com dados brutos)
                  assignee: next[idx].assignee !== undefined ? next[idx].assignee : (incoming.assignee || null),
                  assigned_to: next[idx].assigned_to !== undefined ? next[idx].assigned_to : (incoming.assigned_to || null),
                  assignees: Array.isArray(next[idx].assignees) ? next[idx].assignees : (incoming.assignees || []),
                  department: next[idx].department || incoming.department || 'Triagem URA',
                  status: next[idx].status || incoming.status || 'ura_inedito',
                  statusLabel: next[idx].statusLabel || incoming.statusLabel || 'Fila • Triagem Geral',
                  triageContext: next[idx].triageContext || incoming.triageContext,
                  name: incoming.name && incoming.hasRealName ? incoming.name : (next[idx].name || incoming.name),
                  phone: incoming.phone || next[idx].phone,
                  lastInteraction: incoming.lastInteraction || next[idx].lastInteraction,
                  lastMessageAt: incoming.lastMessageAt || next[idx].lastMessageAt,
                  remoteJid: incoming.remoteJid || next[idx].remoteJid,
                  remoteJidAlt: incoming.remoteJidAlt || next[idx].remoteJidAlt,
                  preferredTarget: incoming.preferredTarget || next[idx].preferredTarget || incoming.remoteJid || next[idx].remoteJid
                };
                if (!isMgr && !canUserViewChat(merged, activeUser)) {
                  next.splice(idx, 1);
                } else {
                  next[idx] = merged;
                }
              } else {
                if (isMgr || canUserViewChat(incoming, activeUser)) {
                  next.unshift(incoming);
                }
              }
            });
            return next;
          });
        }

        if (liveMessages && Object.keys(liveMessages).length > 0) {
          // ASSEPSIA DEFINITIVA: Desativação total da injeção cega de mensagens de contatos em `setMessages`.
          // O histórico de mensagens é gerenciado exclusivamente pelo Supabase / Realtime para o chat ativo.
          // Aqui mantemos apenas a atualização de status de IA/metadados de contatos se necessário.
          const timeInfo = getBrasiliaTime();
          Object.keys(liveMessages).forEach((chatKey) => {
            const msgs = liveMessages[chatKey] || [];
            const studentMessages = msgs.filter((m) => m.fromStudent);
            if (studentMessages.length > 0 && timeInfo.isAfterHours) {
              setWhatsAppContacts((prevContacts) =>
                prevContacts.map((c) => (c.id === chatKey ? { ...c, aiActive: true } : c))
              );
            }
          });
        }
      } catch (err) {
        console.warn('[Evolution Sync] Falha:', err);
      }
    };

    syncLiveEvolution();
    const evoInterval = setInterval(syncLiveEvolution, 3500);

    return () => {
      cancelled = true;
      clearInterval(evoInterval);
    };
  }, []);

  const [isUserSelectOpen, setIsUserSelectOpen] = useState(() => {
    try {
      return !localStorage.getItem('educhat_user_id');
    } catch {
      return false;
    }
  });
  const [channels, setChannels] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_channels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = [...parsed];
          INITIAL_CHANNELS.forEach((ic) => {
            if (!list.some((c) => c.id === ic.id || c.name === ic.name)) {
              list.push(ic);
            }
          });
          return list;
        }
      }
    } catch {}
    return INITIAL_CHANNELS;
  });

  const [whatsAppContacts, setWhatsAppContacts] = useState(() => {
    try {
      // RESET GERAL V6: limpa caches locais com atribuições residuais e tickets indevidamente presos em Flávio Motta
      const resetFlag = localStorage.getItem('educhat_reset_carteiras_v6');
      if (!resetFlag) {
        localStorage.removeItem('educhat_whatsapp_contacts');
        localStorage.removeItem('educhat_chat_assignments');
        localStorage.removeItem('educhat_messages_cache');
        localStorage.setItem('educhat_reset_carteiras_v6', 'true');
        return INITIAL_WHATSAPP_CONTACTS.map((c) => ({
          ...c,
          assignee: null,
          assigned_to: null,
          assignees: [],
          status: 'ura_inedito',
          statusLabel: 'Fila • Triagem Geral'
        }));
      }
      const saved = localStorage.getItem('educhat_whatsapp_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map((c) => {
            // Assegura que tickets sem atribuição deliberada fiquem 100% limpos na Fila Geral
            if (c.assignee === 'Flávio Motta' || c.assigned_to === 'u1') {
              return {
                ...c,
                assignee: null,
                assigned_to: null,
                assignees: [],
                status: 'ura_inedito',
                statusLabel: 'Fila • Triagem Geral'
              };
            }
            return c;
          });
          INITIAL_WHATSAPP_CONTACTS.forEach((iw) => {
            const idx = list.findIndex((c) => c.id === iw.id);
            if (idx === -1) {
              list.push(iw);
            } else {
              // Garante sincronização dos dados canônicos de atribuição
              list[idx] = {
                ...list[idx],
                assigned_to: list[idx].assigned_to !== undefined ? list[idx].assigned_to : iw.assigned_to,
                assignee: list[idx].assignee !== undefined ? list[idx].assignee : iw.assignee,
                department: iw.department || list[idx].department
              };
            }
          });
          return list;
        }
      }
    } catch {}
    return INITIAL_WHATSAPP_CONTACTS;
  });

  const [whatsAppModal, setWhatsAppModal] = useState({ isOpen: false, tab: 'qrcode' });
  const [isInstagramImportOpen, setIsInstagramImportOpen] = useState(false);

  // ASSEPSIA DEFINITIVA: Desativação total de cache local (LocalStorage) e mensagens estáticas
  // O estado inicia sempre vazio ({}) e as mensagens são hidratadas exclusivamente pelo Supabase
  const [messages, setMessages] = useState(() => {
    try {
      localStorage.removeItem('educhat_messages_cache');
    } catch {}
    return {};
  });

  // Estado do carregamento do histórico da conversa ativa: distingue "carregando" de "vazio real"
  const [chatHistoryStatus, setChatHistoryStatus] = useState({ key: null, status: 'idle', count: null });
  const [historyRetryTick, setHistoryRetryTick] = useState(0);

  // Persistência contínua e segura de canais e conversas WhatsApp (apenas metadados, NUNCA mensagens)
  useEffect(() => {
    try {
      if (Array.isArray(channels) && channels.length > 0) {
        localStorage.setItem('educhat_channels', JSON.stringify(channels));
      }
    } catch {}
  }, [channels]);

  useEffect(() => {
    try {
      if (Array.isArray(whatsAppContacts) && whatsAppContacts.length > 0) {
        localStorage.setItem('educhat_whatsapp_contacts', JSON.stringify(whatsAppContacts));
      }
    } catch {}
  }, [whatsAppContacts]);

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_tasks_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_TASKS;
  });

  useEffect(() => {
    try {
      if (Array.isArray(tasks) && tasks.length > 0) {
        localStorage.setItem('educhat_tasks_cache', JSON.stringify(tasks));
      }
    } catch {}
  }, [tasks]);

  const [realtimeStatus, setRealtimeStatus] = useState('connected'); // 'connected' | 'connecting' | 'error'
  const [lastSyncTime, setLastSyncTime] = useState(() => getSaoPauloTime());

  // Documentos e Base de Conhecimento da IA (Knowledge Base)
  const [learnedDocuments, setLearnedDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_knowledge_base') || localStorage.getItem('educhat_learned_docs');
      return saved ? JSON.parse(saved) : INITIAL_LEARNED_DOCS;
    } catch {
      return INITIAL_LEARNED_DOCS;
    }
  });

  useEffect(() => {
    let active = true;
    fetchKnowledgeBaseDocs().then((docs) => {
      if (active && Array.isArray(docs) && docs.length > 0) {
        setLearnedDocuments(docs);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('educhat_learned_docs', JSON.stringify(learnedDocuments));
      localStorage.setItem('educhat_knowledge_base', JSON.stringify(learnedDocuments));
    } catch {}
  }, [learnedDocuments]);

  // Contador de Mensagens Não Lidas por Canal/Colaborador
  const [unreadCounts, setUnreadCounts] = useState({});

  // Card do Kanban ampliado para detalhes
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  // Base de Conhecimento, SLAs e Memória da IA
  const [vipClients, setVipClients] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_vip_clients');
      return saved ? JSON.parse(saved) : INITIAL_VIP_CLIENTS;
    } catch {
      return INITIAL_VIP_CLIENTS;
    }
  });

  const [slas, setSlas] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_slas');
      return saved ? JSON.parse(saved) : INITIAL_SLAS;
    } catch {
      return INITIAL_SLAS;
    }
  });

  const [pops, setPops] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_pops');
      return saved ? JSON.parse(saved) : INITIAL_POPS;
    } catch {
      return INITIAL_POPS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('educhat_vip_clients', JSON.stringify(vipClients));
    } catch {}
  }, [vipClients]);

  useEffect(() => {
    try {
      localStorage.setItem('educhat_slas', JSON.stringify(slas));
    } catch {}
  }, [slas]);

  useEffect(() => {
    try {
      localStorage.setItem('educhat_pops', JSON.stringify(pops));
    } catch {}
  }, [pops]);

  const [customAIPrompt, setCustomAIPrompt] = useState(DEFAULT_AI_PROMPT);
  const [isAIMemoryOpen, setIsAIMemoryOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Base de Alunos e Clientes do EduControl (Reconhecimento Inteligente e Sincronização)
  const [eduControlStudents, setEduControlStudents] = useState(() => {
    try {
      const stored = localStorage.getItem('educhat_educontrol_students');
      if (stored) return JSON.parse(stored);
    } catch {}
    return INITIAL_EDUCONTROL_STUDENTS;
  });
  const [isEduControlModalOpen, setIsEduControlModalOpen] = useState(false);

  // Chat ativo: canal, dm ou whatsapp (padrão canal #geral ou última conversa ativa salva)
  const [activeChat, setActiveChat] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_active_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.type && parsed.id) return parsed;
      }
    } catch {}
    return {
      type: 'channel',
      id: 'c-geral'
    };
  });

  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const collaboratorsRef = useRef(collaborators);
  collaboratorsRef.current = collaborators;

  const whatsAppContactsRef = useRef(whatsAppContacts);
  whatsAppContactsRef.current = whatsAppContacts;

  const eduControlStudentsRef = useRef(eduControlStudents);
  eduControlStudentsRef.current = eduControlStudents;

  const learnedDocumentsRef = useRef(learnedDocuments);
  learnedDocumentsRef.current = learnedDocuments;

  const handleLogoutRef = useRef(null);

  // 0. Sincronização e Blindagem de Sessão com Supabase Auth (Prevenção de Session Leakage)
  useEffect(() => {
    let isMounted = true;

    const syncAuthSession = (session) => {
      if (!isMounted) return;
      if (session?.user) {
        const u = session.user;
        const savedId = localStorage.getItem('educhat_user_id');
        const currentList = collaboratorsRef.current || [];
        const matched = currentList.find(
          (c) =>
            c.id === u.id ||
            (c.email && u.email && c.email.toLowerCase() === u.email.toLowerCase()) ||
            (u.email && u.email.toLowerCase().includes('flavio') && c.id === 'u1') ||
            (u.user_metadata?.name && c.name && u.user_metadata.name.toLowerCase() === c.name.toLowerCase())
        );

        // BLINDAGEM DE SESSÃO:
        // Se a máquina/navegador já possui um usuário explicitamente selecionado e o token Supabase for de outro,
        // NÃO sobrepõe a identidade. Desconecta o resíduo do Supabase para manter o isolamento estrito.
        if (savedId && matched && matched.id !== savedId) {
          console.warn(
            `[Auth Isolation] Sessão Supabase residual (${u.email}) diferente do perfil ativo (${savedId}). Desconectando resíduo.`
          );
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          return;
        }

        const canonicalId = matched?.id || (u.email?.toLowerCase().includes('flavio') ? 'u1' : u.id);
        const resolvedUser = {
          ...(matched || {}),
          id: canonicalId,
          authId: u.id,
          name: matched?.name || u.user_metadata?.name || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Colaborador',
          email: u.email || matched?.email || '',
          role: matched?.role || u.user_metadata?.role || 'Colaborador',
          roleType: matched?.roleType || u.user_metadata?.role_type || 'colaborador',
          department: matched?.department || u.user_metadata?.department || 'Comercial',
          avatar: matched?.avatar || u.user_metadata?.avatar || '👤',
        };
        setCurrentUser(resolvedUser);
        currentUserRef.current = resolvedUser;
        setIsolatedUserSession(resolvedUser);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        syncAuthSession(data.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        syncAuthSession(session);
      } else if (event === 'SIGNED_OUT') {
        if (handleLogoutRef.current) {
          handleLogoutRef.current(false);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const assignmentsCacheRef = useRef({});
  useEffect(() => {
    try {
      assignmentsCacheRef.current = JSON.parse(localStorage.getItem('educhat_chat_assignments') || '{}');
    } catch {
      assignmentsCacheRef.current = {};
    }
  }, []);

  // Histórico de Atribuição Round-Robin (para distribuir para o usuário há mais tempo sem receber atendimento)
  const lastAssignmentMapRef = useRef({});
  useEffect(() => {
    try {
      lastAssignmentMapRef.current = JSON.parse(localStorage.getItem('educhat_round_robin_history') || '{}');
    } catch {
      lastAssignmentMapRef.current = {};
    }
  }, []);

  // 2. BLINDAGEM DE VISIBILIDADE DE CANAIS (FRONTEND):
  // Se o usuário for comum e estiver em um canal fora do seu departamento e que não seja 'c-geral',
  // redireciona imediatamente para o canal 'c-geral'
  useEffect(() => {
    if (activeChat?.type === 'channel' && !hasFullPortfolioAccess(currentUser)) {
      const userDept = (currentUser?.department || '').trim().toLowerCase();
      const currentChannel = (channels || []).find((c) => c?.id === activeChat.id || c?.name === activeChat.id);
      if (currentChannel) {
        const chName = (currentChannel.name || '').trim().toLowerCase();
        const chDept = (currentChannel.department || '').trim().toLowerCase();
        const isGeral = chName === 'geral' || currentChannel.id === 'c-geral' || chDept === 'todos';
        const isMyDept = userDept && (chDept === userDept || chName === userDept);
        if (!isGeral && !isMyDept) {
          setActiveChat({ type: 'channel', id: 'c-geral' });
        }
      }
    }
  }, [currentUser, activeChat, channels]);

  // Persiste a conversa ativa para que o refresh (F5) não a perca
  useEffect(() => {
    try {
      if (activeChat && activeChat.type && activeChat.id) {
        localStorage.setItem('educhat_active_chat', JSON.stringify(activeChat));
      }
    } catch {}
  }, [activeChat]);

  // Controle de Recibos de Leitura Persistidos (Canais e DMs)
  const [channelReadReceipts, setChannelReadReceipts] = useState(() => {
    try {
      const saved = localStorage.getItem(`educhat_channel_reads_${currentUser?.id || 'u1'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    const defaults = {};
    const now = new Date().toISOString();
    INITIAL_CHANNELS.forEach((c) => {
      defaults[c.id] = now;
      defaults[c.name] = now;
    });
    return defaults;
  });

  const [dmReadReceipts, setDmReadReceipts] = useState(() => {
    try {
      const saved = localStorage.getItem(`educhat_dm_reads_${currentUser?.id || 'u1'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    const now = new Date().toISOString();
    return { u2: now, u3: now };
  });

  const [whatsappReadReceipts, setWhatsappReadReceipts] = useState(() => {
    try {
      const saved = localStorage.getItem(`educhat_wa_reads_${currentUser?.id || 'u1'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const channelReadReceiptsRef = useRef(channelReadReceipts);
  channelReadReceiptsRef.current = channelReadReceipts;

  const dmReadReceiptsRef = useRef(dmReadReceipts);
  dmReadReceiptsRef.current = dmReadReceipts;

  const whatsappReadReceiptsRef = useRef(whatsappReadReceipts);
  whatsappReadReceiptsRef.current = whatsappReadReceipts;

  const saveWhatsAppReadReceipt = (contactId, timestampIso = new Date().toISOString()) => {
    if (!contactId) return;
    const userId = currentUserRef.current?.id || 'u1';
    setWhatsappReadReceipts((prev) => {
      const next = { ...prev };
      next[contactId] = timestampIso;
      const cleanDigits = String(contactId).replace(/\D/g, '');
      if (cleanDigits) {
        next[`wa-${cleanDigits}`] = timestampIso;
        next[cleanDigits] = timestampIso;
      }
      try {
        localStorage.setItem(`educhat_wa_reads_${userId}`, JSON.stringify(next));
      } catch {}
      whatsappReadReceiptsRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const userId = currentUser?.id || 'u1';
    try {
      const defaults = {};
      const baselineNow = new Date().toISOString();
      INITIAL_CHANNELS.forEach((c) => {
        defaults[c.id] = baselineNow;
        defaults[c.name] = baselineNow;
        defaults[c.id.replace(/^c-/, '')] = baselineNow;
        defaults[`c-${c.name}`] = baselineNow;
      });

      const savedC = localStorage.getItem(`educhat_channel_reads_${userId}`);
      let nextC = defaults;
      if (savedC) {
        try {
          const parsed = JSON.parse(savedC);
          nextC = { ...defaults, ...parsed };
        } catch {}
      }
      setChannelReadReceipts(nextC);
      channelReadReceiptsRef.current = nextC;

      const savedDm = localStorage.getItem(`educhat_dm_reads_${userId}`);
      if (savedDm) {
        setDmReadReceipts(JSON.parse(savedDm));
      } else {
        const now = new Date().toISOString();
        setDmReadReceipts({ u2: now, u3: now });
      }

      const savedWa = localStorage.getItem(`educhat_wa_reads_${userId}`);
      if (savedWa) {
        try {
          const parsedWa = JSON.parse(savedWa);
          setWhatsappReadReceipts(parsedWa);
          whatsappReadReceiptsRef.current = parsedWa;
        } catch {}
      }
    } catch {}
  }, [currentUser?.id]);

  // Modo da IA Autônoma (Se ativo, cria o card sozinho ao detectar intenção de tarefa)
  const [aiAutonomous, setAiAutonomous] = useState(true);

  // Modais de Criação
  const [modalItem, setModalItem] = useState({ isOpen: false, type: 'channel' });
  const [isNewWhatsAppChatOpen, setIsNewWhatsAppChatOpen] = useState(false);

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
        data: (() => {
          const matched = matchStudentByPhone(activeChat?.id, eduControlStudents);
          const found = (whatsAppContacts || []).find((w) => w?.id === activeChat?.id) ||
            INITIAL_WHATSAPP_CONTACTS.find((w) => w?.id === activeChat?.id);

          if (found) {
            return matched
              ? {
                  ...found,
                  name: matched.name,
                  course: matched.course,
                  polo: matched.polo,
                  matricula: matched.matricula,
                  academicStatus: matched.academicStatus,
                  statusLabel: `${matched.academicStatus} • ${matched.course}`,
                  assignee: found.assignee ?? null,
                  assigned_to: found.assigned_to ?? null,
                  department: found.department || matched.department || 'Triagem URA'
                }
              : found;
          }

          if (matched) {
            return {
              id: activeChat?.id || matched.waId,
              name: matched.name,
              phone: matched.phone,
              avatar: '🎓',
              department: matched.department || 'Triagem URA',
              assignee: null,
              assigned_to: null,
              status: 'ura_inedito',
              statusLabel: `${matched.academicStatus} • ${matched.course}`,
              course: matched.course,
              polo: matched.polo,
              matricula: matched.matricula,
              academicStatus: matched.academicStatus,
              triageContext: `Aluno ${matched.academicStatus} (${matched.course} • ${matched.polo}) • Matrícula ${matched.matricula}`
            };
          }

          return {
            id: activeChat?.id || 'wa-lead',
            name: activeChat?.id ? `WhatsApp (${activeChat.id.replace('wa-', '')})` : 'Lead WhatsApp',
            phone: activeChat?.id ? `+${activeChat.id.replace('wa-', '')}` : '',
            avatar: '👤',
            department: 'Triagem URA',
            assignee: null,
            assigned_to: null,
            status: 'ura_inedito',
            statusLabel: 'Fila • Triagem Geral'
          };
        })(),
      }
    : {
        type: 'dm',
        data: (resolvedCollaborators || []).find((u) => u?.id === activeChat?.id) || (resolvedCollaborators || [])[1] || INITIAL_COLLABORATORS[1],
      };

  const getMessagesForChat = (chat, userId, allMessages) => {
    if (!chat?.id || !allMessages) return [];
    const uid = userId || 'u1';
    const primaryKey = getChatKey(chat, uid);
    if (Array.isArray(allMessages[primaryKey]) && allMessages[primaryKey].length > 0) {
      return allMessages[primaryKey];
    }
    if (chat.type === 'dm') {
      const pId = chat.id;
      const candidates = [
        `dm-${uid}-${pId}`,
        `dm-${pId}-${uid}`,
        `dm-u1-${pId}`,
        `dm-${pId}-u1`,
        pId
      ];
      for (const k of candidates) {
        if (Array.isArray(allMessages[k]) && allMessages[k].length > 0) {
          return allMessages[k];
        }
      }
    }
    if (chat.type === 'channel') {
      const stripped = chat.id.replace(/^c-/, '');
      const candidates = [chat.id, stripped, `c-${stripped}`, `#${stripped}`];
      for (const k of candidates) {
        if (Array.isArray(allMessages[k]) && allMessages[k].length > 0) {
          return allMessages[k];
        }
      }
    }
    if (chat.type === 'whatsapp') {
      const cleanPhone = chat.id.replace(/^wa-/, '');
      const candidates = [chat.id, `wa-${cleanPhone}`, cleanPhone];
      for (const k of candidates) {
        if (Array.isArray(allMessages[k]) && allMessages[k].length > 0) {
          return allMessages[k];
        }
      }
    }
    return allMessages[primaryKey] || [];
  };

  const currentChatKey = activeChat?.id ? getChatKey(activeChat, currentUser?.id || 'u1') : null;
  const currentMessages = React.useMemo(() => {
    return getMessagesForChat(activeChat, currentUser?.id, messages);
  }, [activeChat?.id, activeChat?.type, currentUser?.id, messages]);

  const customAIPromptRef = useRef(customAIPrompt);
  customAIPromptRef.current = customAIPrompt;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Parser leve de linha do banco de dados (com opção de omitir Base64 pesados na listagem lateral)
  const parseDatabaseMessage = (m, { stripHeavyAttachments = false } = {}) => {
    let cleanText = m.text || '';
    let parsedAttachment = null;
    let linkedTaskId = null;
    let parsedReplyTo = null;
    let parsedStatus = 'sent';
    let isAudio = false;
    let audioUrl = null;
    let audioTranscription = null;
    let duration = '0:14';

    if (cleanText.includes('[ARQUIVO_ANEXO:')) {
      if (stripHeavyAttachments && cleanText.length > 1500) {
        // Evita carregar strings gigantes de Base64 de conversas inativas na memória inicial
        const nameMatch = cleanText.match(/"name"\s*:\s*"([^"]+)"/);
        const typeMatch = cleanText.match(/"type"\s*:\s*"([^"]+)"/);
        const sizeMatch = cleanText.match(/"size"\s*:\s*"?([^",}]+)"?/);
        parsedAttachment = {
          name: nameMatch ? nameMatch[1] : 'Anexo',
          type: typeMatch ? typeMatch[1] : 'application/octet-stream',
          size: sizeMatch ? sizeMatch[1] : '',
          hasLazyPayload: true
        };
        cleanText = cleanText
          .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
          .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
          .trim();
      } else {
        const { attachment: extracted, cleanText: sanitized } = extractAttachmentFromText(cleanText);
        if (extracted) {
          if (stripHeavyAttachments && extracted.dataUrl && extracted.dataUrl.length > 1024) {
            parsedAttachment = { ...extracted, dataUrl: null, hasLazyPayload: true };
          } else {
            parsedAttachment = extracted;
          }
        }
        cleanText = sanitized;
      }
    }

    if (cleanText.includes('<!-- AUDIO_URL:')) {
      const match = cleanText.match(/<!-- AUDIO_URL:([\s\S]+?) -->/);
      if (match) {
        const rawAudio = match[1].trim();
        audioUrl = stripHeavyAttachments && rawAudio.startsWith('data:') && rawAudio.length > 1024 ? null : rawAudio;
        isAudio = true;
        cleanText = cleanText.replace(/<!-- AUDIO_URL:[\s\S]+? -->/, '').trim();
      }
    }

    if (cleanText.includes('<!-- IS_AUDIO:true -->')) {
      isAudio = true;
      cleanText = cleanText.replace(/<!-- IS_AUDIO:true -->/, '').trim();
    }

    if (cleanText.includes('[ÁUDIO_TRANSCRIÇÃO:')) {
      const match = cleanText.match(/\[ÁUDIO_TRANSCRIÇÃO:\s*"([\s\S]+?)"\]/) || cleanText.match(/\[ÁUDIO_TRANSCRIÇÃO:\s*([\s\S]+?)\]/);
      if (match) {
        audioTranscription = match[1].replace(/^["']|["']$/g, '').trim();
      }
      isAudio = true;
    }

    if (cleanText.includes('🎙️') || cleanText.includes('🎵') || cleanText.includes('Áudio recebido') || cleanText.includes('Mensagem de voz')) {
      isAudio = true;
      const durMatch = cleanText.match(/\((\d{1,2}:\d{2})\)/);
      if (durMatch) duration = durMatch[1];
    }

    if (parsedAttachment) {
      if (
        parsedAttachment.type?.startsWith('audio/') ||
        parsedAttachment.isAudio ||
        parsedAttachment.name?.toLowerCase().includes('audio') ||
        /\.(ogg|opus|mp3|wav|webm|m4a|mp4|aac)$/i.test(parsedAttachment.name || '')
      ) {
        isAudio = true;
        if (!audioUrl) {
          audioUrl = parsedAttachment.url || parsedAttachment.storagePath || (!stripHeavyAttachments ? parsedAttachment.dataUrl : null);
        }
        if (parsedAttachment.duration) duration = parsedAttachment.duration;
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

    let readBy = [];
    if (Array.isArray(m?.read_by)) {
      readBy = [...m.read_by];
    } else if (typeof m?.read_by === 'string') {
      try {
        const parsed = JSON.parse(m.read_by);
        if (Array.isArray(parsed)) readBy = parsed;
        else readBy = m.read_by.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
      } catch {
        readBy = m.read_by.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
      }
    }
    if (!Array.isArray(readBy)) readBy = [];

    if (typeof cleanText === 'string' && cleanText.includes('<!-- READ_BY:')) {
      const match = cleanText.match(/<!-- READ_BY:([\s\S]+?) -->/);
      if (match) {
        try {
          const list = JSON.parse(match[1]);
          if (Array.isArray(list)) {
            readBy = Array.from(new Set([...readBy, ...list]));
          }
        } catch {}
        cleanText = cleanText.replace(/<!-- READ_BY:[\s\S]+? -->/, '').trim();
      }
    }

    let isForwarded = false;
    let forwardedFrom = null;
    if (cleanText.includes('<!-- FORWARDED:')) {
      isForwarded = true;
      cleanText = cleanText.replace(/<!-- FORWARDED:[\s\S]+? -->/, '').trim();
    }
    if (cleanText.includes('<!-- FORWARDED_FROM:')) {
      const match = cleanText.match(/<!-- FORWARDED_FROM:([\s\S]+?) -->/);
      if (match) {
        try {
          forwardedFrom = JSON.parse(match[1]);
        } catch {
          forwardedFrom = match[1];
        }
      }
      cleanText = cleanText.replace(/<!-- FORWARDED_FROM:[\s\S]+? -->/, '').trim();
    }

    const rawDate = m.created_at || m.timestamp || new Date().toISOString();
    return {
      id: m.id,
      chat_id: m.chat_id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      sender_id: m.sender_id,
      senderName: m.sender_name,
      recipientId: m.recipient_id,
      recipient_id: m.recipient_id,
      text: cleanText,
      timestamp: getSaoPauloTime(rawDate),
      created_at: rawDate,
      timestampRaw: rawDate,
      attachment: parsedAttachment,
      replyTo: parsedReplyTo,
      isForwarded,
      forwardedFrom,
      status: parsedStatus,
      is_read: parsedStatus === 'read' || m.is_read === true,
      read_by: readBy,
      readBy: readBy,
      taskId: linkedTaskId,
      actionExtracted: false,
      isAudio: isAudio || !!parsedAttachment?.type?.startsWith('audio/') || !!audioUrl,
      audioUrl: audioUrl || (!stripHeavyAttachments ? (parsedAttachment?.dataUrl || parsedAttachment?.url || null) : null),
      audioTranscription: audioTranscription || null,
      duration: duration || parsedAttachment?.duration || '0:14'
    };
  };

  // Solicitar permissão nativa de notificação do Windows ao carregar
  useEffect(() => {
    requestDesktopNotificationPermission();
  }, []);

  // Helper para limpar contador de mensagens não lidas instantaneamente
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
      Object.keys(next).forEach((k) => {
        if (k === targetId || k.includes(`-${targetId}`) || k.includes(`${targetId}-`)) {
          delete next[k];
        }
      });
      const totalUnread = Math.max(0, Object.values(next).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0));
      document.title = totalUnread > 0 ? `(${totalUnread}) EduChat` : 'EduChat';
      return next;
    });

    if (String(targetId).startsWith('wa-') || /^\+?\d+$/.test(String(targetId))) {
      saveWhatsAppReadReceipt(targetId);
    }

    setCollaborators((prev) =>
      prev.map((u) => (u.id === targetId || u.name === targetId ? { ...u, unread: 0, unread_count: 0 } : u))
    );

    setWhatsAppContacts((prev) =>
      prev.map((c) => {
        const cPhoneDigits = (c.phone || '').replace(/\D/g, '');
        const targetDigits = (targetId || '').replace(/\D/g, '');
        const isMatch = c.id === targetId || (cPhoneDigits && targetDigits && cPhoneDigits === targetDigits);
        return isMatch ? { ...c, unread_count: 0, unread: 0 } : c;
      })
    );

    setChannels((prev) =>
      prev.map((c) => (c.id === targetId || c.name === targetId ? { ...c, unread: 0, unread_count: 0 } : c))
    );

    stopTaskbarBlink();
  };

  // 2. AÇÃO DE LIMPEZA E PERSISTÊNCIA REAL (MARK AS READ):
  // Garante que a função acionada ao clicar em um canal, DM ou WhatsApp marque as mensagens como lidas
  // no estado, execute o UPDATE real no banco Supabase e persista os recibos de leitura.
  const markMessagesAsRead = (chat) => {
    if (!chat) return;
    const currentUserId = currentUserRef.current?.id || 'u1';
    const cKey = getChatKey(chat, currentUserId);
    const nowIso = new Date().toISOString();
    clearUnread(chat.id);

    // 1. Controle de Leitura em Canais (Grupos)
    if (chat.type === 'channel') {
      const channelId = chat.id;
      const strippedId = channelId.replace(/^c-/, '');
      const prefixedId = `c-${strippedId}`;

      setChannelReadReceipts((prev) => {
        const next = {
          ...prev,
          [channelId]: nowIso,
          [strippedId]: nowIso,
          [prefixedId]: nowIso
        };
        try {
          localStorage.setItem(`educhat_channel_reads_${currentUserId}`, JSON.stringify(next));
        } catch {}
        channelReadReceiptsRef.current = next;
        return next;
      });

      // 1A. Dispara UPDATE imediato no Supabase na tabela messages para todas as mensagens não lidas deste grupo
      const updateChannelMessagesInDb = async () => {
        try {
          let { data: channelMsgs, error } = await supabase
            .from('messages')
            .select('id, text, sender_id, read_by')
            .or(`chat_id.eq.${channelId},chat_id.eq.${strippedId},chat_id.eq.${prefixedId}`)
            .neq('sender_id', currentUserId);

          if (error) {
            // Fallback se a coluna read_by ainda não existir na tabela
            const fallbackRes = await supabase
              .from('messages')
              .select('id, text, sender_id')
              .or(`chat_id.eq.${channelId},chat_id.eq.${strippedId},chat_id.eq.${prefixedId}`)
              .neq('sender_id', currentUserId);
            channelMsgs = fallbackRes.data;
          }

          if (Array.isArray(channelMsgs) && channelMsgs.length > 0) {
            channelMsgs.forEach((row) => {
              let currentReadBy = [];
              if (Array.isArray(row?.read_by)) {
                currentReadBy = [...row.read_by];
              } else if (typeof row?.read_by === 'string') {
                try {
                  const parsed = JSON.parse(row.read_by);
                  if (Array.isArray(parsed)) currentReadBy = parsed;
                  else currentReadBy = row.read_by.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
                } catch {
                  currentReadBy = row.read_by.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
                }
              }
              if (!Array.isArray(currentReadBy)) currentReadBy = [];

              if (typeof row?.text === 'string' && row.text.includes('<!-- READ_BY:')) {
                const match = row.text.match(/<!-- READ_BY:([\s\S]+?) -->/);
                if (match) {
                  try {
                    const parsed = JSON.parse(match[1]);
                    if (Array.isArray(parsed)) {
                      currentReadBy = Array.from(new Set([...currentReadBy, ...parsed]));
                    }
                  } catch {}
                }
              }

              if (currentUserId && !currentReadBy.includes(currentUserId)) {
                currentReadBy.push(currentUserId);
                let updatedText = row.text || '';
                const readByTag = `<!-- READ_BY:${JSON.stringify(currentReadBy)} -->`;
                if (updatedText.includes('<!-- READ_BY:')) {
                  updatedText = updatedText.replace(/<!-- READ_BY:[\s\S]+? -->/g, readByTag);
                } else {
                  updatedText = `${updatedText}\n${readByTag}`;
                }

                // Tenta atualizar read_by e text no Supabase
                supabase
                  .from('messages')
                  .update({
                    read_by: currentReadBy,
                    text: updatedText
                  })
                  .eq('id', row.id)
                  .then(({ error: upErr }) => {
                    if (upErr) {
                      supabase
                        .from('messages')
                        .update({ text: updatedText })
                        .eq('id', row.id)
                        .catch(() => {});
                    }
                  })
                  .catch(() => {});
              }
            });
          }
        } catch (err) {
          console.warn('[markMessagesAsRead] Erro ao atualizar mensagens do canal no Supabase:', err);
        }
      };
      updateChannelMessagesInDb();

      // Persiste no Supabase (chat_id: 'sys_channel_reads')
      supabase
        .from('messages')
        .upsert([{
          id: `sys_cread_${currentUserId}_${prefixedId}`,
          chat_id: 'sys_channel_reads',
          sender_id: currentUserId,
          sender_name: currentUserRef.current?.name || 'User',
          recipient_id: prefixedId,
          text: nowIso,
          timestamp: getSaoPauloTime(new Date())
        }], { onConflict: 'id' })
        .then(() => {}, () => {});

      // Persiste também na tabela dedicada channel_read_receipts se ela existir
      supabase
        .from('channel_read_receipts')
        .upsert([{
          user_id: currentUserId,
          channel_id: prefixedId,
          last_read_at: nowIso
        }], { onConflict: 'user_id,channel_id' })
        .then(() => {}, () => {});
    }

    // 2. Controle de Leitura e UPDATE em Conversas 1-a-1 (DMs)
    if (chat.type === 'dm') {
      const contactId = chat.id;
      const dmKey = getChatKey({ type: 'dm', id: contactId }, currentUserId);
      const reverseDmKey = `dm-${contactId}-${currentUserId}`;

      setDmReadReceipts((prev) => {
        const next = {
          ...prev,
          [contactId]: nowIso,
          [dmKey]: nowIso,
          [reverseDmKey]: nowIso
        };
        try {
          localStorage.setItem(`educhat_dm_reads_${currentUserId}`, JSON.stringify(next));
        } catch {}
        dmReadReceiptsRef.current = next;
        return next;
      });

      // UPDATE no Supabase para todas as mensagens não lidas onde sender_id é o contato e recipient_id é o currentUser.id
      const updateDmMessagesInDb = async () => {
        try {
          const { data, error } = await supabase
            .from('messages')
            .select('id, text, sender_id, recipient_id')
            .or(`chat_id.eq.${dmKey},chat_id.eq.${reverseDmKey},and(sender_id.eq.${contactId},recipient_id.eq.${currentUserId})`)
            .eq('sender_id', contactId);

          if (!error && Array.isArray(data) && data.length > 0) {
            data.forEach((row) => {
              const isAlreadyRead = (row.text && row.text.includes('<!-- STATUS:read -->')) || row.is_read === true;
              if (!isAlreadyRead) {
                const newText = row.text?.includes('<!-- STATUS:')
                  ? row.text.replace(/<!-- STATUS:[^\s>]+ -->/g, '<!-- STATUS:read -->')
                  : `${row.text || ''}\n<!-- STATUS:read -->`;

                supabase
                  .from('messages')
                  .update({
                    text: newText,
                    recipient_id: currentUserId,
                    is_read: true,
                    read_by: [currentUserId]
                  })
                  .eq('id', row.id)
                  .then(({ error: upErr }) => {
                    if (upErr) {
                      // Fallback se is_read ou read_by não existirem como colunas na tabela
                      supabase
                        .from('messages')
                        .update({
                          text: newText,
                          recipient_id: currentUserId
                        })
                        .eq('id', row.id)
                        .catch(() => {});
                    }
                  })
                  .catch(() => {});
              }
            });
          }
        } catch (err) {
          console.warn('[markMessagesAsRead] Erro ao atualizar mensagens 1-a-1 no Supabase:', err);
        }
      };
      updateDmMessagesInDb();

      // Persiste recibo de leitura de DM no Supabase (chat_id: 'sys_dm_reads')
      supabase
        .from('messages')
        .upsert([{
          id: `sys_dmread_${currentUserId}_${contactId}`,
          chat_id: 'sys_dm_reads',
          sender_id: currentUserId,
          sender_name: currentUserRef.current?.name || 'User',
          recipient_id: contactId,
          text: nowIso,
          timestamp: getSaoPauloTime(new Date())
        }], { onConflict: 'id' })
        .then(() => {})
        .catch(() => {});
    }

    // 3. Conversas de WhatsApp
    if (chat.type === 'whatsapp') {
      saveWhatsAppReadReceipt(chat.id, nowIso);
      supabase
        .from('messages')
        .select('id, text')
        .or(`chat_id.eq.${cKey},chat_id.eq.${chat.id}`)
        .neq('sender_id', currentUserId)
        .not('text', 'like', '%<!-- STATUS:read -->%')
        .then(({ data }) => {
          if (data && data.length > 0) {
            data.forEach((row) => {
              const newText = row.text.includes('<!-- STATUS:')
                ? row.text.replace(/<!-- STATUS:[^\s>]+ -->/, '<!-- STATUS:read -->')
                : `${row.text}\n<!-- STATUS:read -->`;
              supabase.from('messages').update({ text: newText }).eq('id', row.id).then(() => {}).catch(() => {});
            });
          }
        })
        .catch(() => {});
    }

    // 4. Atualiza estado em memória imediatamente para todas as chaves equivalentes da conversa
    setMessages((prev) => {
      const keysToUpdate = [];
      if (chat.type === 'channel') {
        const strippedId = chat.id.replace(/^c-/, '');
        keysToUpdate.push(chat.id, strippedId, `c-${strippedId}`);
      } else if (chat.type === 'dm') {
        const contactId = chat.id;
        const dmKey = getChatKey({ type: 'dm', id: contactId }, currentUserId);
        const reverseDmKey = `dm-${contactId}-${currentUserId}`;
        keysToUpdate.push(contactId, dmKey, reverseDmKey);
      } else if (chat.type === 'whatsapp') {
        keysToUpdate.push(chat.id, cKey);
      }

      let hasAnyChange = false;
      const next = { ...prev };

      keysToUpdate.forEach((k) => {
        const list = next[k];
        if (Array.isArray(list) && list.length > 0) {
          const updated = list.map((m) => {
            const senderId = m.senderId || m.sender_id;
            const isFromContact = senderId ? senderId !== currentUserId : !m.fromMe;
            if (!isFromContact) return m;

            // Para canal ou DM, garante que o currentUser.id conste em read_by / readBy
            let readByList = Array.isArray(m?.read_by) ? [...m.read_by] : (Array.isArray(m?.readBy) ? [...m.readBy] : []);
            if (currentUserId && !readByList.includes(currentUserId)) {
              readByList.push(currentUserId);
            }

            const isRead =
              m.is_read === true ||
              m.status === 'read' ||
              (typeof m.text === 'string' && m.text.includes('<!-- STATUS:read -->'));

            if (!isRead || !readByList.includes(currentUserId)) {
              hasAnyChange = true;
            }

            let newText = m.text || '';
            if (typeof newText === 'string') {
              if (newText.includes('<!-- STATUS:')) {
                newText = newText.replace(/<!-- STATUS:[^\s>]+ -->/g, '<!-- STATUS:read -->');
              } else {
                newText = `${newText}\n<!-- STATUS:read -->`;
              }
            }

            return {
              ...m,
              status: 'read',
              is_read: true,
              text: newText,
              recipient_id: currentUserId,
              read_by: readByList,
              readBy: readByList
            };
          });
          next[k] = updated;
        }
      });

      return hasAnyChange ? next : prev;
    });
  };

  // Ao trocar de conversa ativa: limpa não lidas e carrega o histórico.
  // ARQUITETURA (sem race condition):
  //  - EFFECT A (histórico): faz o SELECT e SÓ escreve em `messages` depois que a Promise resolve com sucesso.
  //    NUNCA executa setMessages([]) — o que já estiver em memória permanece visível até o banco responder.
  //    Controla `chatHistoryStatus` ('loading' | 'ok' | 'error') para a UI distinguir "carregando" de "vazio real".
  //  - EFFECT B (realtime): subscrição isolada. Só faz merge incremental (por id) e jamais substitui a lista.
  const getChatAliasKeys = (chat, userId) => {
    const rawId = chat.id;
    const primary = getChatKey(chat, userId);
    const keys = new Set([primary]);
    if (chat.type === 'dm') {
      keys.add(`dm-u1-${rawId}`);
      keys.add(`dm-${rawId}-u1`);
      keys.add(`dm-${userId}-${rawId}`);
      keys.add(`dm-${rawId}-${userId}`);
      keys.add(rawId);
    } else if (chat.type === 'channel') {
      const stripped = rawId.replace(/^c-/, '');
      keys.add(rawId);
      keys.add(stripped);
      keys.add(`c-${stripped}`);
    } else if (chat.type === 'whatsapp') {
      const cleanPhone = rawId.replace(/^wa-/, '');
      keys.add(rawId);
      keys.add(`wa-${cleanPhone}`);
      keys.add(cleanPhone);
    }
    return Array.from(keys);
  };

  const mergeMessageLists = (a = [], b = []) => {
    const byId = new Map();
    [...a, ...b].forEach((m) => {
      if (!m || !m.id) return;
      const prevM = byId.get(m.id);
      byId.set(m.id, prevM ? { ...prevM, ...m } : m);
    });
    return Array.from(byId.values()).sort(
      (x, y) =>
        new Date(x.created_at || x.timestampRaw || 0).getTime() -
        new Date(y.created_at || y.timestampRaw || 0).getTime()
    );
  };

  // EFFECT A — HISTÓRICO
  useEffect(() => {
    // Se após o F5 nenhum chat estiver em foco, o estado deve permanecer vazio
    if (!activeChat?.id) return;

    clearUnread(activeChat.id);
    markMessagesAsRead(activeChat);

    const chat = activeChat;
    const activeUserId = currentUserRef.current?.id || 'u1';
    const targetChatKey = getChatKey(chat, activeUserId);
    const rawId = chat.id;
    let isStale = false;
    const abortCtl = new AbortController();

    console.log('[ChatTrace] Abrindo conversa', {
      type: chat.type,
      id: rawId,
      chatKey: targetChatKey,
      mensagensEmMemoria: (messagesRef.current?.[targetChatKey] || []).length
    });

    setChatHistoryStatus({ key: targetChatKey, status: 'loading', count: null });

    const queryActiveChatMessages = async () => {
      try {
        let query = supabase.from('messages_light').select('*');

        if (chat.type === 'channel') {
          const stripped = rawId.replace(/^c-/, '');
          query = query
            .or(`chat_id.eq.${rawId},chat_id.eq.${stripped},chat_id.eq.c-${stripped},chat_id.eq.#${stripped}`)
            .not('chat_id', 'like', 'sys_%');
        } else if (chat.type === 'dm') {
          const partnerId = rawId;
          const reverseDmKey = `dm-${partnerId}-${activeUserId}`;
          query = query
            .or(`chat_id.eq.${targetChatKey},chat_id.eq.${reverseDmKey},chat_id.eq.dm-u1-${partnerId},chat_id.eq.dm-${partnerId}-u1,and(sender_id.eq.${activeUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${activeUserId}),and(sender_id.eq.u1,recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.u1)`)
            .not('chat_id', 'like', 'sys_%');
        } else if (chat.type === 'whatsapp') {
          const cleanPhone = rawId.replace(/^wa-/, '');
          query = query
            .or(`chat_id.eq.${rawId},chat_id.eq.wa-${cleanPhone},chat_id.eq.${cleanPhone}`)
            .not('chat_id', 'like', 'sys_%');
        } else {
          query = query.eq('chat_id', rawId).not('chat_id', 'like', 'sys_%');
        }

        // As 300 mensagens MAIS RECENTES (desc + reverse). Antes era asc+limit => pegava as 300 mais ANTIGAS.
        const { data: fetched, error } = await query
          .order('created_at', { ascending: false })
          .limit(300)
          .abortSignal(abortCtl.signal);

        // Resposta de uma conversa que não está mais em foco: descarta sem tocar no estado
        if (isStale || activeChatRef.current?.id !== rawId) {
          console.log('[ChatTrace] Resposta descartada (usuário trocou de conversa)', rawId);
          return;
        }

        if (error) {
          console.warn('[ChatTrace] Erro no SELECT do histórico — estado NÃO foi alterado', error);
          setChatHistoryStatus({ key: targetChatKey, status: 'error', count: null, error: error.message });
          return;
        }

        const parsedList = (fetched || [])
          .reverse()
          .map((m) => parseDatabaseMessage(m, { stripHeavyAttachments: false }));

        console.log('[ChatTrace] Histórico carregado do banco', {
          chatKey: targetChatKey,
          totalNoBanco: parsedList.length
        });

        setMessages((prev) => {
          const aliasKeys = getChatAliasKeys(chat, activeUserId);
          const existing = prev[targetChatKey] || [];
          // Merge por id: preserva mensagens otimistas ('sending') e eventos realtime que chegaram durante o SELECT
          const merged = mergeMessageLists(parsedList, existing);
          const next = { ...prev };
          aliasKeys.forEach((k) => {
            next[k] = merged;
          });
          return next;
        });
        setChatHistoryStatus({ key: targetChatKey, status: 'ok', count: parsedList.length });

        // FASE 2 (background): mensagens com anexos base64 pesados vêm truncadas da view leve.
        // Busca o corpo completo uma a uma e faz merge por id — nunca bloqueia nem zera a lista.
        const heavyIds = (fetched || []).filter((m) => m.is_heavy).map((m) => m.id);
        for (const hid of heavyIds) {
          if (isStale || activeChatRef.current?.id !== rawId) break;
          try {
            const { data: full } = await supabase.from('messages').select('*').eq('id', hid).abortSignal(abortCtl.signal).maybeSingle();
            if (!full || isStale || activeChatRef.current?.id !== rawId) continue;
            const parsedFull = parseDatabaseMessage(full, { stripHeavyAttachments: false });
            setMessages((prev) => {
              const next = { ...prev };
              getChatAliasKeys(chat, activeUserId).forEach((k) => {
                if (Array.isArray(next[k])) {
                  next[k] = next[k].map((m) => (m.id === hid ? { ...m, ...parsedFull } : m));
                }
              });
              return next;
            });
          } catch (heavyErr) {
            console.warn('[ChatTrace] Falha ao carregar anexo pesado', hid, heavyErr);
          }
        }
      } catch (err) {
        if (!isStale && activeChatRef.current?.id === rawId) {
          console.warn('[ChatTrace] Exceção ao carregar histórico — estado NÃO foi alterado', err);
          setChatHistoryStatus({ key: targetChatKey, status: 'error', count: null, error: String(err?.message || err) });
        }
      }
    };

    queryActiveChatMessages();

    return () => {
      isStale = true;
      try { abortCtl.abort(); } catch {}
    };
  }, [activeChat?.id, activeChat?.type, currentUser?.id, historyRetryTick]);

  // EFFECT B — REALTIME UNIFICADO:
  // A escuta de mensagens ativas e background é realizada exclusivamente pelo canal global contínuo (educhat_user_realtime_*),
  // eliminando quedas de conexão, subscrições efêmeras e canais zumbis ao trocar de conversa.

  // Limpa notificações quando a janela/aba do navegador ganha foco
  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeChatRef.current?.id) {
        clearUnread(activeChatRef.current.id);
        markMessagesAsRead(activeChatRef.current);
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  // Helper para processar mensagem recebida, separar estritamente Canal vs DM vs WhatsApp e atualizar contadores
  const handleIncomingNotification = (msg, cKey) => {
    const activeUser = currentUserRef.current || currentUser;
    const currentUserId = activeUser?.id || 'u1';
    if (!msg || msg.senderId === currentUserId || msg.senderId === 'system') return;

    const rawKey = String(cKey || msg.chat_id || msg.channel_id || '').trim();
    const cleanRaw = rawKey.replace(/^#/, '').toLowerCase();

    // 1. Identificação Estrita de Tipo: Canal (Grupo), DM (Chat Direto 1 a 1) ou WhatsApp
    const isChannel = Boolean(
      msg.channel_id ||
      msg.channelId ||
      rawKey.startsWith('c-') ||
      rawKey.startsWith('#') ||
      ['geral', 'comercial', 'tutoria', 'secretaria', 'marketing', 'pedagogico', 'expansao'].includes(cleanRaw)
    );

    const isWhatsApp = Boolean(
      !isChannel &&
      (rawKey.startsWith('wa-') ||
        rawKey.includes('@s.whatsapp.net') ||
        rawKey.includes('@c.us') ||
        rawKey.includes('@lid') ||
        /^\+?\d{10,15}$/.test(rawKey))
    );

    const isDm = !isChannel && !isWhatsApp;

    // 2. Trava de Visibilidade e Permissão em Canais de Grupo:
    // Se o usuário não tem permissão para visualizar o canal (ex: Gislaine em #comercial),
    // NUNCA incrementa badge e NUNCA dispara notificação!
    if (isChannel) {
      const canonicalChannelId = rawKey.startsWith('c-') ? rawKey : `c-${cleanRaw}`;
      if (!canUserViewChannel(canonicalChannelId, activeUser, channelsRef.current)) {
        return;
      }
    }

    // 3. Trava Estrita de Privacidade e Destinatário em DMs (1 a 1) - Prevenção de Receiver Leakage:
    // Mensagem direta SÓ pode ser notificada se o usuário ativo for EXATAMENTE um dos dois participantes
    // E especificamente o destinatário da mensagem (não o remetente).
    if (isDm) {
      let isRecipient = false;
      let partnerId = null;

      if (rawKey.startsWith('dm-')) {
        const parts = rawKey.replace('dm-', '').split('-').filter(Boolean);
        if (parts.length >= 2) {
          if (parts.includes(currentUserId) && msg.senderId !== currentUserId) {
            isRecipient = true;
            partnerId = parts[0] === currentUserId ? parts[1] : parts[0];
          }
        }
      } else if (msg.recipientId || msg.recipient_id) {
        const rId = msg.recipientId || msg.recipient_id;
        if (rId === currentUserId && msg.senderId !== currentUserId) {
          isRecipient = true;
          partnerId = msg.senderId;
        }
      }

      if (!isRecipient) {
        // Mensagem direta não é endereçada a este usuário: ignora 100%!
        return;
      }
    }

    // 4. Trava de Visibilidade WhatsApp por Departamento e Atribuição:
    if (isWhatsApp) {
      if (!hasFullPortfolioAccess(activeUser)) {
        const existing = (whatsAppContactsRef.current || []).find((c) => c.id === rawKey);
        const cachedAsgn = assignmentsCacheRef.current[rawKey];
        const contactToCheck = existing || {
          id: rawKey,
          assignee: cachedAsgn?.assignee,
          assignees: cachedAsgn?.assignees,
          department: cachedAsgn?.department,
          status: cachedAsgn?.status
        };
        if (!canUserViewChat(contactToCheck, activeUser)) {
          return;
        }
      }
    }

    const currentKey = getChatKey(activeChatRef.current, currentUserId);
    const isCurrentActive =
      (rawKey === currentKey || activeChatRef.current?.id === rawKey) && !document.hidden;

    if (isCurrentActive) {
      markMessagesAsRead(activeChatRef.current);
      return;
    }

    // =========================================================================
    // ROTEAMENTO E ATUALIZAÇÃO SEGREGADA DE BADGES (SEM CONTAMINAÇÃO):
    // =========================================================================
    if (isChannel) {
      const canonicalChannelId = rawKey.startsWith('c-') ? rawKey : `c-${cleanRaw}`;
      const channelName = canonicalChannelId.replace(/^c-/, '');

      // Atualiza funcionalmente o estado do canal
      setChannels((prevChannels) =>
        prevChannels.map((c) => {
          if (c.id === canonicalChannelId || c.name === channelName) {
            const currentUnread = Number(c.unread_count ?? c.unread ?? 0);
            return { ...c, unread: currentUnread + 1, unread_count: currentUnread + 1 };
          }
          return c;
        })
      );

      // Incrementa badge de não lido estritamente para o canal (NUNCA para o remetente nem para DMs!)
      setUnreadCounts((prev) => {
        const currentCount = Math.max(0, Number(prev[canonicalChannelId] || 0));
        const next = {
          ...prev,
          [canonicalChannelId]: currentCount + 1
        };
        const totalUnread = Math.max(0, Object.values(next).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0));
        document.title = totalUnread > 0 ? `(${totalUnread}) EduChat` : 'EduChat';
        return next;
      });

      // Notificação nativa e piscar da barra indicando CLARAMENTE o canal
      notifyIncomingMessage(`#${channelName} • ${msg.senderName}`, msg.text || 'Novo anexo/áudio recebido', {
        isChannel: true,
        channelName,
        senderName: msg.senderName
      });
    } else if (isDm) {
      let partnerId = msg.senderId;
      if (rawKey.startsWith('dm-')) {
        const parts = rawKey.replace('dm-', '').split('-').filter(Boolean);
        partnerId = parts[0] === currentUserId ? parts[1] : parts[0];
      }
      const dmKey = `dm-${[currentUserId, partnerId].sort().join('-')}`;

      // Atualiza funcionalmente o colaborador do chat direto
      setCollaborators((prev) =>
        prev.map((u) => {
          if (u.id === partnerId) {
            const cur = Number(u.unread_count ?? u.unread ?? 0);
            return { ...u, unread: cur + 1, unread_count: cur + 1 };
          }
          return u;
        })
      );

      // Incrementa badge de DM apenas para o parceiro
      setUnreadCounts((prev) => {
        const cur = Math.max(0, Number(prev[partnerId] || 0));
        const next = {
          ...prev,
          [partnerId]: cur + 1
        };
        const totalUnread = Math.max(0, Object.values(next).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0));
        document.title = totalUnread > 0 ? `(${totalUnread}) EduChat` : 'EduChat';
        return next;
      });

      notifyIncomingMessage(`Mensagem Direta de ${msg.senderName}`, msg.text || 'Novo anexo/áudio recebido', {
        isDm: true,
        senderName: msg.senderName
      });
    } else if (isWhatsApp) {
      // Atualiza unreadCounts e contatos do WhatsApp
      setWhatsAppContacts((prevContacts) =>
        prevContacts.map((c) => {
          if (c.id === rawKey) {
            const cur = Number(c.unread_count ?? c.unread ?? 0);
            return { ...c, unread: cur + 1, unread_count: cur + 1 };
          }
          return c;
        })
      );

      setUnreadCounts((prev) => {
        const cur = Math.max(0, Number(prev[rawKey] || 0));
        const next = {
          ...prev,
          [rawKey]: cur + 1
        };
        const totalUnread = Math.max(0, Object.values(next).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0));
        document.title = totalUnread > 0 ? `(${totalUnread}) EduChat` : 'EduChat';
        return next;
      });

      notifyIncomingMessage(msg.senderName || 'WhatsApp Aluno', msg.text || 'Nova mensagem recebida', {
        isWhatsApp: true,
        senderName: msg.senderName
      });
    }
  };

  // =========================================================================
  // RELAY DE COMUNICAÇÃO INTERNA E PRESENÇA (MULTI-DISPOSITIVO E MULTI-ABA)
  // Conecta via SSE (EventSource) e BroadcastChannel para envio/recebimento instantâneo
  // =========================================================================
  useEffect(() => {
    const unsubscribe = subscribeToInternalRelay({
      onMessage: (chatKey, incomingMsg) => {
        if (!incomingMsg || !incomingMsg.id) return;

        const activeUser = currentUserRef.current;
        const currentUserId = activeUser?.id || 'u1';

        // 1. BLINDAGEM DE PRIVACIDADE E SEGURANÇA EM DMs (1 a 1):
        // Se a mensagem for privada, APENAS processa se o usuário ativo for participante!
        const isDm = chatKey.startsWith('dm-') || Boolean(incomingMsg.recipientId || incomingMsg.recipient_id);
        if (isDm) {
          const isParticipant =
            incomingMsg.senderId === currentUserId ||
            incomingMsg.recipientId === currentUserId ||
            incomingMsg.recipient_id === currentUserId ||
            (chatKey.startsWith('dm-') && chatKey.replace('dm-', '').split('-').includes(currentUserId));
          if (!isParticipant) {
            // Descarta imediatamente sem emitir notificação nem salvar no estado
            return;
          }
        }

        // 2. BLINDAGEM DE ACESSO A CANAIS:
        const isChannel = Boolean(
          chatKey.startsWith('c-') ||
          chatKey.startsWith('#') ||
          ['geral', 'comercial', 'tutoria', 'secretaria', 'marketing', 'pedagogico', 'expansao', 'diretoria'].includes(
            chatKey.replace(/^[c#]-?/, '').toLowerCase()
          )
        );
        if (isChannel) {
          const chId = chatKey.startsWith('c-') ? chatKey : `c-${chatKey.replace(/^[c#]-?/, '')}`;
          if (!canUserViewChannel(chId, activeUser, channelsRef.current)) {
            return;
          }
        }

        // Se a mensagem partiu do próprio usuário local, ignora (o remetente adiciona SOMENTE após confirmação no Supabase)
        if (incomingMsg.senderId && activeUser?.id && incomingMsg.senderId === activeUser.id) {
          return;
        }

        const currentActiveChat = activeChatRef.current;
        let belongsToActiveScreen = false;

        if (currentActiveChat && !document.hidden) {
          if (currentActiveChat.type === 'dm') {
            const selectedUserId = currentActiveChat.id;
            belongsToActiveScreen =
              incomingMsg.senderId === selectedUserId ||
              incomingMsg.recipientId === selectedUserId ||
              incomingMsg.recipient_id === selectedUserId ||
              (chatKey && chatKey.includes(selectedUserId));
          } else if (currentActiveChat.type === 'channel') {
            const activeChannelId = currentActiveChat.id;
            belongsToActiveScreen =
              chatKey === activeChannelId ||
              chatKey === activeChannelId.replace(/^c-/, '');
          } else if (currentActiveChat.type === 'whatsapp') {
            belongsToActiveScreen = chatKey === currentActiveChat.id;
          }
        }

        // Se NÃO pertencer à tela ativa atual, apenas atualiza Sidebar e notificação de background de forma estritamente isolada
        if (!belongsToActiveScreen) {
          if (incomingMsg.senderId && incomingMsg.senderId !== currentUserId && incomingMsg.senderId !== 'system') {
            handleIncomingNotification(incomingMsg, chatKey);
          }
          return;
        }

        const currentActiveKey = getChatKey(currentActiveChat, currentUserId);
        setMessages((prev) => {
          const list = prev[currentActiveKey] || [];
          if (list.some((m) => m.id === incomingMsg.id)) return prev;
          return {
            ...prev,
            [currentActiveKey]: [...list, incomingMsg]
          };
        });
      },
      onPresence: (remoteUser) => {
        if (!remoteUser || !remoteUser.id) return;
        const nowIso = remoteUser.lastSeen || new Date().toISOString();

        setHeartbeats((prev) => ({ ...prev, [remoteUser.id]: nowIso }));
        setOnlineUserIds((prev) => new Set([...prev, remoteUser.id, remoteUser.email].filter(Boolean)));
        setCollaborators((prev) =>
          prev.map((c) =>
            c.id === remoteUser.id || (c.email && remoteUser.email && c.email.toLowerCase() === remoteUser.email.toLowerCase())
              ? { ...c, online: true, lastSeen: nowIso }
              : c
          )
        );
      },
      onStatusChange: (status) => {
        if (status === 'connected') {
          setRealtimeStatus('connected');
        }
      }
    });

    // Anuncia a presença do usuário atual na rede a cada 30 segundos
    const announcePresence = () => {
      const u = currentUserRef.current;
      if (u && u.id) {
        publishPresencePing(u);
      }
    };

    announcePresence();
    const presenceTimer = setInterval(announcePresence, 30000);

    return () => {
      unsubscribe();
      clearInterval(presenceTimer);
    };
  }, []);

  // =========================================================================
  // CARREGAMENTO INICIAL LEVE E PERSISTENTE (SEM APAGAR CONVERSAS EXISTENTES)
  // =========================================================================
  const fetchSupabaseData = async () => {
    try {
      const activeUser = currentUserRef.current || currentUser;
      const timeStr = getSaoPauloTime();
      setLastSyncTime(timeStr);

      const storedAssignments = {};
      try {
        const cached = JSON.parse(localStorage.getItem('educhat_chat_assignments') || '{}');
        Object.assign(storedAssignments, cached);
      } catch {}

      // 1A. Busca registros de sistema (alunos e colaboradores) separadamente para não consumir o limite de mensagens de chat
      const { data: sysRows } = await withTimeout(
        supabase
          .from('messages')
          .select('id, chat_id, text')
          .in('chat_id', ['sys_educontrol_students', 'sys_collaborators'])
          .limit(500)
      );

      if (sysRows && sysRows.length > 0) {
        const dbStudents = [];
        const dbCollaborators = [];

        sysRows.forEach((m) => {
          if (m.chat_id === 'sys_educontrol_students' && m.text?.includes('<!-- STUDENT_RECORD:')) {
            const match = m.text.match(/<!-- STUDENT_RECORD:([\s\S]*?) -->/);
            if (match) {
              try {
                dbStudents.push(JSON.parse(match[1]));
              } catch {}
            }
          } else if (m.chat_id === 'sys_collaborators' && m.text?.includes('<!-- COLLABORATOR_RECORD:')) {
            const match = m.text.match(/<!-- COLLABORATOR_RECORD:([\s\S]*?) -->/);
            if (match) {
              try {
                dbCollaborators.push(JSON.parse(match[1]));
              } catch {}
            }
          }
        });

        if (dbStudents.length > 0) {
          setEduControlStudents((prev) => {
            const studentList = [...prev];
            dbStudents.forEach((incoming) => {
              const existingIdx = studentList.findIndex((s) => {
                if (incoming.cleanCPF && s.cleanCPF && incoming.cleanCPF === s.cleanCPF) return true;
                if (incoming.cleanDigits && s.cleanDigits && incoming.cleanDigits === s.cleanDigits) return true;
                return false;
              });
              if (existingIdx !== -1) {
                const existing = studentList[existingIdx];
                studentList[existingIdx] = {
                  ...existing,
                  ...incoming,
                  assignee: existing.assignee || incoming.assignee || 'Gabriel Carvalho',
                  department: existing.department || incoming.department || 'Secretaria Acadêmica'
                };
              } else {
                studentList.push(incoming);
              }
            });
            try {
              localStorage.setItem('educhat_educontrol_students', JSON.stringify(studentList));
            } catch {}
            return studentList;
          });
        }

        if (dbCollaborators.length > 0) {
          setCollaborators((prev) => {
            const list = [...prev];
            dbCollaborators.forEach((incoming) => {
              const existingIdx = list.findIndex(
                (c) => c.id === incoming.id || (c.name && incoming.name && c.name.toLowerCase() === incoming.name.toLowerCase())
              );
              if (existingIdx !== -1) {
                list[existingIdx] = { ...list[existingIdx], ...incoming };
              } else {
                list.push(incoming);
              }
            });
            try {
              localStorage.setItem('educhat_collaborators', JSON.stringify(list));
            } catch {}
            return list;
          });
        }
      }

      // 1A-2. Hidratação da base de alunos a partir da view public.alunos do Supabase
      try {
        const { data: directAlunos } = await supabase
          .from('alunos')
          .select('id, nome_completo, cpf, email, telefone, hub_id, created_date')
          .order('created_date', { ascending: false })
          .limit(200);

        if (Array.isArray(directAlunos) && directAlunos.length > 0) {
          setEduControlStudents((prev) => {
            const list = [...prev];
            directAlunos.forEach((a) => {
              const cleanCpf = (a.cpf || '').replace(/\D/g, '');
              const cleanPhone = (a.telefone || '').replace(/\D/g, '');
              const existingIdx = list.findIndex(
                (s) => (cleanCpf && s.cleanCPF === cleanCpf) || (cleanPhone && s.cleanDigits === cleanPhone) || s.id === a.id
              );
              const mapped = {
                id: a.id,
                name: a.nome_completo,
                cpf: a.cpf || '',
                cleanCPF: cleanCpf,
                phone: a.telefone || '',
                cleanDigits: cleanPhone,
                email: a.email || '',
                hubId: a.hub_id || null,
                assignee: 'Secretaria Acadêmica',
                department: 'Secretaria Acadêmica'
              };
              if (existingIdx !== -1) {
                list[existingIdx] = { ...list[existingIdx], ...mapped };
              } else {
                list.push(mapped);
              }
            });
            try {
              localStorage.setItem('educhat_educontrol_students', JSON.stringify(list));
            } catch {}
            return list;
          });
        }
      } catch (alErr) {
        console.warn('Aviso ao carregar alunos recentes da view alunos:', alErr);
      }

      // 1A-3. Busca os recibos de leitura persistidos no Supabase para o usuário atual
      try {
        const { data: readReceipts } = await supabase
          .from('messages')
          .select('id, chat_id, text, recipient_id')
          .in('chat_id', ['sys_channel_reads', 'sys_dm_reads'])
          .eq('sender_id', activeUser.id);

        if (Array.isArray(readReceipts) && readReceipts.length > 0) {
          setChannelReadReceipts((prev) => {
            const next = { ...prev };
            readReceipts.forEach((row) => {
              if (row.chat_id === 'sys_channel_reads' && row.text) {
                const chId = row.recipient_id || row.id.replace(`sys_cread_${activeUser.id}_`, '');
                if (chId) {
                  const stripped = chId.replace(/^c-/, '');
                  const prefixed = `c-${stripped}`;
                  next[chId] = row.text;
                  next[stripped] = row.text;
                  next[prefixed] = row.text;
                }
              }
            });
            try {
              localStorage.setItem(`educhat_channel_reads_${activeUser.id}`, JSON.stringify(next));
            } catch {}
            channelReadReceiptsRef.current = next;
            return next;
          });

          setDmReadReceipts((prev) => {
            const next = { ...prev };
            readReceipts.forEach((row) => {
              if (row.chat_id === 'sys_dm_reads' && row.text) {
                const uId = row.id.replace(`sys_dmread_${activeUser.id}_`, '');
                if (uId) next[uId] = row.text;
              }
            });
            try {
              localStorage.setItem(`educhat_dm_reads_${activeUser.id}`, JSON.stringify(next));
            } catch {}
            dmReadReceiptsRef.current = next;
            return next;
          });
        }

        // Tenta também buscar na tabela dedicada channel_read_receipts (se existir)
        try {
          const { data: dedicatedReceipts } = await supabase
            .from('channel_read_receipts')
            .select('channel_id, last_read_at')
            .eq('user_id', activeUser.id);
          if (Array.isArray(dedicatedReceipts) && dedicatedReceipts.length > 0) {
            setChannelReadReceipts((prev) => {
              const next = { ...prev };
              dedicatedReceipts.forEach((r) => {
                if (r.channel_id && r.last_read_at) {
                  const stripped = r.channel_id.replace(/^c-/, '');
                  const prefixed = `c-${stripped}`;
                  next[r.channel_id] = r.last_read_at;
                  next[stripped] = r.last_read_at;
                  next[prefixed] = r.last_read_at;
                }
              });
              try {
                localStorage.setItem(`educhat_channel_reads_${activeUser.id}`, JSON.stringify(next));
              } catch {}
              channelReadReceiptsRef.current = next;
              return next;
            });
          }
        } catch {}
      } catch (err) {
        console.warn('Aviso ao carregar recibos de leitura do Supabase:', err);
      }

      // 1B. Busca as mensagens reais de conversas mais recentes em ordem cronológica (excluindo registros sys_*)
      // Purga em background qualquer mensagem de dossiê residual acidentalmente gravada em canais públicos da equipe
      try {
        supabase
          .from('messages')
          .delete()
          .or('chat_id.like.c-%,chat_id.in.(c-geral,c-comercial,c-tutoria,c-secretaria,c-marketing,c-pedagogico,c-expansao,c-diretoria)')
          .like('text', '%DOSSIÊ EXECUTIVO%')
          .then(() => {}, () => {});
      } catch {}

      let recentDbMessages = null;
      try {
        // IMPORTANTE: busca as mensagens MAIS RECENTES (desc) e reordena depois. Antes era asc+limit(1000),
        // o que retornava apenas as 1000 mais ANTIGAS (banco tem 6.7k+) e ignorava reatribuições/leituras recentes.
        let { data, error } = await supabase
          .from('messages_light')
          .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at, recipient_id')
          .not('chat_id', 'like', 'sys_%')
          .order('created_at', { ascending: false })
          .limit(1000);

        // Fallback defensivo se a coluna read_by ainda não existir no schema cache do PostgREST
        if (error) {
          const fbWithoutChannel = await supabase
            .from('messages_light')
            .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at, recipient_id')
            .not('chat_id', 'like', 'sys_%')
            .order('created_at', { ascending: false })
            .limit(1000);

          if (!fbWithoutChannel.error && Array.isArray(fbWithoutChannel.data)) {
            data = fbWithoutChannel.data;
            error = null;
          } else {
            // Fallback básico mais conservador
            const fbBasic = await supabase
              .from('messages_light')
              .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at')
              .not('chat_id', 'like', 'sys_%')
              .order('created_at', { ascending: false })
              .limit(1000);
            data = fbBasic.data;
            error = fbBasic.error;
          }
        }

        // Eventos de atribuição de fila (asgn_*) são a fonte da verdade de "Meus/Geral":
        // buscados à parte para nunca ficarem fora da janela das últimas 1000 mensagens.
        if (!error && Array.isArray(data)) {
          try {
            const { data: asgnRows } = await supabase
              .from('messages_light')
              .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at')
              .like('id', 'asgn_%')
              .order('created_at', { ascending: false })
              .limit(400);
            if (Array.isArray(asgnRows) && asgnRows.length > 0) {
              const known = new Set(data.map((r) => r.id));
              asgnRows.forEach((r) => {
                if (!known.has(r.id)) data.push(r);
              });
            }
          } catch {}
        }

        if (!error && Array.isArray(data)) {
          recentDbMessages = data;
        } else if (error) {
          console.error('[Supabase] Erro na consulta de mensagens, tentando fallback de segurança:', error);
          const { data: fallbackData } = await supabase
            .from('messages_light')
            .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at')
            .not('chat_id', 'like', 'sys_%')
            .order('created_at', { ascending: false })
            .limit(500);

          if (Array.isArray(fallbackData)) {
            recentDbMessages = fallbackData;
          }
        }
      } catch (err) {
        console.error('[Supabase] Falha ao consultar histórico de mensagens:', err);
      }

      const dbMessages = Array.isArray(recentDbMessages)
        ? [...recentDbMessages].sort((a, b) => new Date(a.created_at || a.timestamp || 0) - new Date(b.created_at || b.timestamp || 0))
        : [];

      if (dbMessages.length > 0) {
        dbMessages.forEach((m) => {
          if (m.chat_id?.startsWith('wa-') && m.text?.includes('<!-- ASSIGNMENT:')) {
            const match = m.text.match(/<!-- ASSIGNMENT:([\s\S]*?) -->/);
            if (match) {
              try {
                storedAssignments[m.chat_id] = JSON.parse(match[1]);
              } catch {}
            }
          }
        });

        const currentActiveKey = getChatKey(activeChatRef.current, activeUser.id);
        const grouped = {};
        const unreadMap = {};

        dbMessages.forEach((m) => {
          if (!m.chat_id || m.chat_id.startsWith('sys_')) return;
          // Ignora mensagens fantasmas vazias geradas por acks indevidos
          const rawText = (m.text || '').replace(/<!--[\s\S]*?-->/g, '').trim();
          if (rawText === 'Mensagem recebida' || rawText === '💬 Mensagem recebida' || rawText === '') {
            return;
          }

          // 1. BLINDAGEM DE PRIVACIDADE EM DMs (1 a 1):
          // Apenas inclui a mensagem se o activeUser for remetente, destinatário ou participante do ID
          const isDm = m.chat_id.startsWith('dm-') || Boolean(m.recipient_id);
          if (isDm) {
            let isUserInvolved = false;
            if (m.chat_id.startsWith('dm-')) {
              const parts = m.chat_id.replace('dm-', '').split('-').filter(Boolean);
              isUserInvolved = parts.includes(activeUser.id);
            } else if (m.recipient_id) {
              isUserInvolved = m.recipient_id === activeUser.id || m.sender_id === activeUser.id;
            }
            if (!isUserInvolved) {
              return; // Bloqueia e descarta DMs de terceiros da memória do usuário
            }
          }

          // Blindagem de Destinatário Estrito: se a mensagem tem recipient_id e não envolve o usuário ativo, descarta
          if (m.recipient_id && m.recipient_id !== activeUser.id && m.sender_id !== activeUser.id) {
            return;
          }

          // 2. BLINDAGEM DE CANAIS POR PERFIL/DEPARTAMENTO:
          const key = normalizeChatKey(m.chat_id, activeUser.id);
          const isChannel = Boolean(
            m.channel_id ||
            m.chat_id.startsWith('c-') ||
            m.chat_id.startsWith('#') ||
            ['geral', 'comercial', 'tutoria', 'secretaria', 'marketing', 'pedagogico', 'expansao', 'diretoria'].includes(
              String(m.chat_id).replace(/^[c#]-?/, '').toLowerCase()
            )
          );
          if (isChannel) {
            // BLOQUEIO TOTAL: Dossiê Executivo NUNCA deve ser renderizado em canais públicos de equipe
            if (typeof m.text === 'string' && (m.text.includes('DOSSIÊ EXECUTIVO') || m.text.includes('<!-- DOSSIER_RECORD:'))) {
              return;
            }
            const chId = key.startsWith('c-') ? key : `c-${key.replace(/^c-/, '')}`;
            if (!canUserViewChannel(chId, activeUser, channelsRef.current)) {
              return; // Bloqueia canais aos quais o colaborador não tem permissão
            }
          }

          if (!grouped[key]) grouped[key] = [];

          // REGRA 4: Não carrega Base64 pesados nas conversas inativas da barra lateral
          const isInactiveChat = key !== currentActiveKey;
          const parsedMsg = parseDatabaseMessage(m, { stripHeavyAttachments: isInactiveChat });
          grouped[key].push(parsedMsg);

          const isFromMe = m.sender_id === activeUser.id;

          // Verifica se o usuário ativo já consta no array read_by / readBy
          const readByList = Array.isArray(parsedMsg?.readBy) ? parsedMsg.readBy : (Array.isArray(m?.read_by) ? m.read_by : []);
          const hasReadBy = Boolean(activeUser?.id && (readByList || []).includes(activeUser.id));

          const isExplicitRead =
            m.is_read === true ||
            parsedMsg.is_read === true ||
            parsedMsg.status === 'read' ||
            (typeof m.text === 'string' && m.text.includes('<!-- STATUS:read -->'));

          const isRead = isExplicitRead || hasReadBy;

          if (!isFromMe && !isRead && key !== currentActiveKey) {
            // Se for canal, valida permissão de departamento e verifica contra o lastReadAt do canal
            if (key.startsWith('c-')) {
              if (!canUserViewChannel(key, activeUser, channelsRef.current)) {
                return;
              }
              const stripped = key.replace(/^c-/, '');
              const chReadAt =
                channelReadReceiptsRef.current?.[key] ||
                channelReadReceiptsRef.current?.[stripped] ||
                channelReadReceiptsRef.current?.[`c-${stripped}`];
              if (chReadAt) {
                const rawTime = m.created_at || m.timestampRaw;
                let msgTime = rawTime ? new Date(rawTime).getTime() : 0;
                if (!msgTime || isNaN(msgTime)) return;
                if (msgTime <= new Date(chReadAt).getTime()) return;
              } else {
                return;
              }
            }

            // Se for DM, valida estritamente se o usuário logado é participante e verifica contra o dmReadAt
            if (key.startsWith('dm-')) {
              const parts = key.replace('dm-', '').split('-');
              if (!parts.includes(activeUser.id)) {
                // DM entre outros usuários: ignora completamente
                return;
              }
              const partnerId = parts[0] === activeUser.id ? parts[1] : parts[0];
              const dmReadAt = dmReadReceiptsRef.current?.[partnerId] || dmReadReceiptsRef.current?.[key];
              if (dmReadAt) {
                const rawTime = m.created_at || m.timestampRaw;
                let msgTime = rawTime ? new Date(rawTime).getTime() : 0;
                if (!msgTime || isNaN(msgTime)) return;
                if (msgTime <= new Date(dmReadAt).getTime()) return;
              } else {
                return;
              }
            }

            // Se for WhatsApp: verifica se o usuário tem recibo de leitura recente ou se o contato foi atendido
            if (key.startsWith('wa-')) {
              const cleanDigits = key.replace(/\D/g, '');
              const waReadAt =
                whatsappReadReceiptsRef.current?.[key] ||
                whatsappReadReceiptsRef.current?.[cleanDigits] ||
                whatsappReadReceiptsRef.current?.[`wa-${cleanDigits}`];
              if (waReadAt) {
                const rawTime = m.created_at || m.timestampRaw;
                let msgTime = rawTime ? new Date(rawTime).getTime() : 0;
                if (msgTime && msgTime <= new Date(waReadAt).getTime()) {
                  return;
                }
              }
            }

            let canonicalBadgeKey = key;
            if (key.startsWith('dm-')) {
              const parts = key.replace('dm-', '').split('-');
              canonicalBadgeKey = parts[0] === activeUser.id ? parts[1] : parts[0];
            } else if (key.startsWith('c-')) {
              canonicalBadgeKey = key;
            }
            unreadMap[canonicalBadgeKey] = Math.max(0, (unreadMap[canonicalBadgeKey] || 0) + 1);
          }
        });

        // ASSEPSIA DEFINITIVA: fetchSupabaseData atualiza apenas metadados e contadores de não lidas.
        // O histórico de mensagens nunca é injetado globalmente para evitar State Leakage entre chats.

        setUnreadCounts(() => {
          const freshCounts = {};
          Object.keys(unreadMap).forEach((k) => {
            const count = Math.max(0, Math.floor(Number(unreadMap[k]) || 0));
            if (count > 0) {
              freshCounts[k] = count;
            }
          });
          if (activeChatRef.current?.id) {
            delete freshCounts[activeChatRef.current.id];
            if (activeChatRef.current.id.startsWith('c-')) {
              delete freshCounts[activeChatRef.current.id.replace(/^c-/, '')];
            }
          }
          const totalUnread = Math.max(0, Object.values(freshCounts).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0));
          document.title = totalUnread > 0 ? `(${totalUnread}) EduChat` : 'EduChat';
          return freshCounts;
        });

        setChannels((prev) =>
          prev.map((c) => {
            const count = Math.max(0, Math.floor(Number(unreadMap[c.id] || unreadMap[c.name] || 0)));
            return {
              ...c,
              unread: count,
              unread_count: count
            };
          })
        );

        setCollaborators((prev) =>
          prev.map((u) => {
            const count = Math.max(0, Math.floor(Number(unreadMap[u.id] || 0)));
            return {
              ...u,
              unread: count,
              unread_count: count
            };
          })
        );

        const waKeys = Object.keys(grouped).filter((k) => k.startsWith('wa-'));

        setWhatsAppContacts((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const existingCanonicalKeys = new Set(prev.map((c) => getCanonicalPhoneKey(c)).filter(Boolean));
          const newContacts = [];

          const updatedExisting = prev.map((c) => {
            const asgn = storedAssignments[c.id];
            const canonKey = getCanonicalPhoneKey(c);

            // Busca mensagens reais associadas ao contato (por ID ou chave canônica)
            const chatMessages = grouped[c.id] || (canonKey ? grouped[`wa-${canonKey}`] : null) || [];
            const realMessages = (Array.isArray(chatMessages) ? chatMessages : []).filter((m) => {
              if (!m || !m.text) return false;
              if (m.chat_id?.startsWith('sys_') || m.id?.startsWith('sys_')) return false;
              if (m.text.includes('<!-- ASSIGNMENT:') && m.text.includes('[Reset Geral')) return false;
              const clean = m.text.replace(/<!--[\s\S]*?-->/g, '').trim();
              return clean.length > 0 && clean !== 'Mensagem recebida' && clean !== '💬 Mensagem recebida';
            });
            const latestRealMsg = realMessages.length > 0 ? realMessages[realMessages.length - 1] : null;

            // REGRA: Se tem mensagem real, lastMessageAt é exatamente o created_at dela.
            // Se NÃO tem mensagem real, usa o created_at original do contato (NUNCA new Date())!
            const computedLastTime = latestRealMsg
              ? (latestRealMsg.created_at || latestRealMsg.timestampRaw || latestRealMsg.timestamp)
              : (c.created_at || c.createdAt || c.lastMessageAt || '2026-10-17T08:00:00.000Z');

            const unreadCount = Math.max(0, Math.floor(Number(unreadMap[c.id] || 0)));
            const primaryAssignee = asgn?.assignee !== undefined ? asgn.assignee : c.assignee;
            const allAssignees = asgn?.assignees || (asgn?.assignee ? [asgn.assignee] : c.assignees || [c.assignee]);

            return {
              ...c,
              department: asgn?.department || c.department,
              assignee: primaryAssignee,
              assignees: allAssignees,
              assigned_to: asgn?.assigned_to !== undefined ? asgn.assigned_to : c.assigned_to,
              status: asgn?.status || c.status,
              statusLabel: asgn?.statusLabel || c.statusLabel,
              triageContext: asgn?.updatedBy
                ? `Atribuído a ${primaryAssignee} (${asgn.department}) por ${asgn.updatedBy}`
                : c.triageContext,
              lastInteraction: formatRelativeChatTime(computedLastTime),
              lastMessageAt: computedLastTime,
              created_at: c.created_at || c.createdAt || computedLastTime,
              unread_count: unreadCount,
              unread: unreadCount
            };
          });

          for (const waKey of waKeys) {
            const canonicalWaKey = getCanonicalPhoneKey(waKey);
            if (!existingIds.has(waKey) && (!canonicalWaKey || !existingCanonicalKeys.has(canonicalWaKey))) {
              if (canonicalWaKey) existingCanonicalKeys.add(canonicalWaKey);
              existingIds.add(waKey);
              const asgn = storedAssignments[waKey];
              const initialContact = INITIAL_WHATSAPP_CONTACTS.find((c) => c.id === waKey || (canonicalWaKey && getCanonicalPhoneKey(c) === canonicalWaKey));
              const assignee = asgn?.assignee || initialContact?.assignee || null;
              const assignees = asgn?.assignees || (assignee ? [assignee] : []);
              const assigned_to = asgn?.assigned_to || (collaboratorsRef.current.find((c) => c.name === assignee)?.id) || null;
              const department = asgn?.department || initialContact?.department || 'Triagem URA';
              const status = asgn?.status || initialContact?.status || (assignee ? 'carteira_ativa' : 'ura_inedito');
              const statusLabel = asgn?.statusLabel || initialContact?.statusLabel || (assignee ? `Carteira • ${assignee}` : 'Fila • Triagem URA');

              const chatMessages = grouped[waKey] || [];
              const realMessages = (Array.isArray(chatMessages) ? chatMessages : []).filter((m) => {
                if (!m || !m.text) return false;
                if (m.chat_id?.startsWith('sys_') || m.id?.startsWith('sys_')) return false;
                if (m.text.includes('<!-- ASSIGNMENT:') && m.text.includes('[Reset Geral')) return false;
                const clean = m.text.replace(/<!--[\s\S]*?-->/g, '').trim();
                return clean.length > 0 && clean !== 'Mensagem recebida' && clean !== '💬 Mensagem recebida';
              });
              const latestRealMsg = realMessages.length > 0 ? realMessages[realMessages.length - 1] : null;

              const rawDigits = waKey.replace('wa-', '');
              const formattedPhone = rawDigits.length >= 10 ? `+${rawDigits}` : rawDigits;
              const unreadCount = Math.max(0, Math.floor(Number(unreadMap[waKey] || 0)));

              // Se há mensagem real, usa created_at da última mensagem. Se não, usa data original de criação (nunca new Date())!
              const rawLastTime = latestRealMsg
                ? (latestRealMsg.created_at || latestRealMsg.timestampRaw || latestRealMsg.timestamp)
                : (initialContact?.created_at || initialContact?.createdAt || '2026-10-17T08:00:00.000Z');

              newContacts.push({
                id: waKey,
                name: latestRealMsg?.senderName || initialContact?.name || `WhatsApp (${formattedPhone})`,
                phone: formattedPhone,
                avatar: '👤',
                department,
                assignee,
                assignees,
                assigned_to,
                status,
                statusLabel,
                aiActive: false,
                lastInteraction: formatRelativeChatTime(rawLastTime),
                lastMessageAt: rawLastTime,
                created_at: initialContact?.created_at || initialContact?.createdAt || rawLastTime,
                triageContext: asgn
                  ? (assignee ? `Atribuído a ${asgn.assignee} (${asgn.department}) por ${asgn.updatedBy || 'Gestão'}` : `Fila de ${department}: Aguardando atendente disponível.`)
                  : 'Histórico sincronizado do WhatsApp.',
                unread_count: unreadCount,
                unread: unreadCount
              });
            }
          }

          const combined = newContacts.length > 0 ? [...newContacts, ...updatedExisting] : updatedExisting;
          const filteredCombined = hasFullPortfolioAccess(activeUser)
            ? combined
            : combined.filter((c) => canUserViewChat(c, activeUser));

          filteredCombined.sort((a, b) => {
            const unreadA = (a.unread_count || 0) > 0 ? 1 : 0;
            const unreadB = (b.unread_count || 0) > 0 ? 1 : 0;
            if (unreadB !== unreadA) return unreadB - unreadA;
            return 0;
          });
          return filteredCombined;
        });
      }

      // =========================================================================
      // 2. TAREFAS DO KANBAN (CONSULTA INDEPENDENTE, RETRY E BLINDAGEM POR CARTEIRA)
      // =========================================================================
      try {
        let dbTasks = null;
        const activeUser = currentUserRef.current || currentUser;
        const isMgr = hasFullPortfolioAccess(activeUser);
        const myUserId = activeUser?.id || '';
        const myUserName = activeUser?.name || '';

        let taskQuery = supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isMgr && myUserId) {
          // VISÃO USUÁRIO COMUM: busca estritamente cards onde é responsável ou criador/solicitante
          taskQuery = taskQuery.or(
            `assigned_to.eq.${myUserId},assignee_id.eq.${myUserId},created_by.eq.${myUserId},requester_id.eq.${myUserId},assignee.ilike.%${myUserName}%,requester.ilike.%${myUserName}%`
          );
        }

        const { data: taskData, error: taskErr } = await withTimeout(taskQuery, 6000);

        if (!taskErr && Array.isArray(taskData)) {
          dbTasks = isMgr ? taskData : taskData.filter((t) => canUserViewTask(t, activeUser));
        } else {
          // Fallback de consulta direta caso o timeout tenha expirado ou caso a cláusula .or falhe por coluna ausente
          try {
            let directQuery = supabase
              .from('tasks')
              .select('*')
              .order('created_at', { ascending: false });
            if (!isMgr && myUserId) {
              directQuery = directQuery.or(
                `assigned_to.eq.${myUserId},assignee_id.eq.${myUserId},created_by.eq.${myUserId},requester_id.eq.${myUserId},assignee.ilike.%${myUserName}%,requester.ilike.%${myUserName}%`
              );
            }
            const { data: directData, error: directErr } = await directQuery;
            if (!directErr && Array.isArray(directData)) {
              dbTasks = isMgr ? directData : directData.filter((t) => canUserViewTask(t, activeUser));
            }
          } catch {}

          if (!dbTasks) {
            const { data: fallbackData } = await supabase
              .from('tasks')
              .select('*')
              .order('created_at', { ascending: false });
            if (Array.isArray(fallbackData)) {
              dbTasks = isMgr ? fallbackData : fallbackData.filter((t) => canUserViewTask(t, activeUser));
            }
          }
        }

        if (Array.isArray(dbTasks) && dbTasks.length > 0) {
          const parsedTasks = dbTasks.map((t) => {
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
            let assigneeId = t.assignee_id || null;
            let assigneeEmail = '';
            if (cleanDesc.includes('<!-- TASK_META:')) {
              const match = cleanDesc.match(/<!-- TASK_META:([\s\S]+?) -->/);
              if (match) {
                try {
                  const meta = JSON.parse(match[1]);
                  comments = meta.comments || [];
                  attachments = meta.attachments || [];
                  assigneeId = meta.assigneeId || assigneeId;
                  assigneeEmail = meta.assigneeEmail || '';
                  cleanDesc = cleanDesc.replace(/<!-- TASK_META:[\s\S]+? -->/, '').trim();
                } catch {}
              }
            }

            // CORREÇÃO DE ATRIBUIÇÃO (ORPHAN CARDS):
            // Cartões órfãos, sem responsável ou de utilizadores simulados são atribuídos ao Administrador atual (Flávio Motta - u1)
            let finalAssignee = t.assignee || '';
            let finalAssigneeAvatar = t.assignee_avatar || '👨‍💼';
            let finalDept = t.department || 'Diretoria';

            const normA = (finalAssignee || '').trim().toLowerCase();
            const isOrphan =
              !finalAssignee ||
              normA === 'administrador' ||
              normA === 'admin' ||
              normA === 'simulado' ||
              normA === 'usuario simulado' ||
              normA === 'undefined' ||
              normA === 'null' ||
              normA === 'u1' ||
              assigneeId === 'u1';

            if (isOrphan || normA.includes('flavio') || normA.includes('motta')) {
              finalAssignee = 'Flávio Motta';
              finalAssigneeAvatar = '👨‍💼';
              assigneeId = 'u1';
              if (!finalDept || finalDept === 'Geral') finalDept = 'Diretoria';
            }

            return {
              id: t.id,
              title: t.title,
              desc: cleanDesc,
              status: t.status || 'backlog',
              priority: t.priority || 'media',
              isVip: Boolean(t.is_vip),
              assignee: finalAssignee,
              assigneeId,
              assigneeEmail,
              assigneeAvatar: finalAssigneeAvatar,
              assigned_to: t.assigned_to || assigneeId || null,
              created_by: t.created_by || null,
              requester_id: t.requester_id || null,
              department: finalDept,
              dueDate: t.due_date || 'A definir',
              channel: t.channel || '#geral',
              sourceMessage: t.source_message,
              requester: reqName || 'Gestão',
              requesterDept: reqDept || 'Diretoria',
              comments,
              attachments,
              created_at: t.created_at || t.createdAt || new Date().toISOString(),
              createdAt: t.created_at || t.createdAt || new Date().toISOString()
            };
          });

          const safeTasks = isMgr ? parsedTasks : parsedTasks.filter((t) => canUserViewTask(t, activeUser));

          setTasks((prev) => {
            const incomingIds = new Set(safeTasks.map((t) => t.id));
            const localOnly = isMgr
              ? prev.filter((t) => !incomingIds.has(t.id))
              : prev.filter((t) => !incomingIds.has(t.id) && canUserViewTask(t, activeUser));
            const merged = [...safeTasks, ...localOnly];
            try {
              localStorage.setItem('educhat_tasks_cache', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        } else {
          // Fallback para cache local caso a consulta ao banco venha vazia ou em falha temporária
          try {
            const cached = localStorage.getItem('educhat_tasks_cache');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setTasks(parsed);
              }
            }
          } catch {}
        }
      } catch (errTasks) {
        console.warn('[Supabase] Falha ao consultar tarefas do Kanban:', errTasks);
        try {
          const cached = localStorage.getItem('educhat_tasks_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTasks(parsed);
            }
          }
        } catch {}
      }

      syncGeminiApiKeyFromCloud().catch(() => {});

      // 3. Colaboradores / Perfis
      try {
        const { data: dbProfiles, error: profErr } = await withTimeout(
          supabase.from('profiles').select('*'),
          2500
        );
        if (!profErr && dbProfiles && Array.isArray(dbProfiles) && dbProfiles.length > 0) {
          setCollaborators((prev) => {
            const list = [...prev];
            dbProfiles.forEach((p) => {
              const item = {
                id: p.id,
                name: p.name || p.full_name || 'Colaborador',
                email: p.email || '',
                role: p.role || 'Colaborador',
                roleType: p.role_type || (p.role === 'admin' || p.role === 'diretor' ? 'diretor' : 'colaborador'),
                avatar: p.avatar || '👤',
                online: p.is_bot ? true : p.online === true,
                lastSeen: p.last_seen || null,
                department: p.department || 'Comercial',
                is_available: p.is_available !== false,
                isBot: p.is_bot || false
              };
              const existingIdx = list.findIndex(
                (c) => c.id === item.id || (c.name && item.name && c.name.trim().toLowerCase() === item.name.trim().toLowerCase())
              );
              if (existingIdx !== -1) {
                list[existingIdx] = { ...list[existingIdx], ...item };
              } else {
                list.push(item);
              }
            });
            try {
              localStorage.setItem('educhat_collaborators', JSON.stringify(list));
            } catch {}
            return list;
          });
        }

        // 3B. Sincronização de Disponibilidade dos Usuários (Pausa / Almoço)
        try {
          const { data: availList } = await supabase
            .from('messages')
            .select('text')
            .eq('chat_id', 'sys_user_availability');

          if (Array.isArray(availList) && availList.length > 0) {
            const availMap = {};
            availList.forEach((row) => {
              try {
                const parsed = JSON.parse(row.text);
                if (parsed.userId) availMap[parsed.userId] = parsed.is_available;
              } catch {}
            });

            setCollaborators((prev) =>
              prev.map((c) => ({
                ...c,
                is_available: availMap[c.id] !== undefined ? availMap[c.id] : (c.is_available !== false)
              }))
            );

            setCurrentUser((prev) => {
              if (prev?.id && availMap[prev.id] !== undefined) {
                return { ...prev, is_available: availMap[prev.id] };
              }
              return prev;
            });
          }
        } catch {}
      } catch {}
    } catch (err) {
      console.warn('Erro ao sincronizar dados com Supabase:', err);
    }
  };

  // =========================================================================
  // REGRA 1 & 2: CONEXÃO ÚNICA E ESTÁVEL DO SUPABASE REALTIME (SEM STALE CLOSURES)
  // =========================================================================
  useEffect(() => {
    let cancelled = false;
    fetchSupabaseData();

    const initialUser = currentUserRef.current;
    if (initialUser?.id) {
      const initialHb = saveLocalHeartbeat(initialUser.id);
      setHeartbeats(initialHb);
    }

    const activeUserId = initialUser?.id || 'u1';
    const channelTopic = `educhat_user_realtime_${activeUserId}`;

    const existingChannels = supabase.getChannels();
    existingChannels.forEach((c) => {
      if (c.topic && (c.topic.includes('educhat_user_') || c.topic.includes('educhat_global_'))) {
        supabase.removeChannel(c);
      }
    });

    const channel = supabase.channel(channelTopic, {
      config: {
        presence: {
          key: activeUserId
        }
      }
    });

    const addPresenceKeys = (set, p) => {
      if (!p) return;
      if (p.userId) set.add(p.userId);
      if (p.email) {
        set.add(p.email);
        set.add(normalizePresenceKey(p.email));
      }
      if (p.userName) set.add('name:' + normalizePresenceKey(p.userName));
    };

    const trackMyPresence = async () => {
      const u = currentUserRef.current;
      if (!u?.id) return;
      try {
        await channel.track({
          userId: u.id,
          userName: u.name,
          email: u.email || '',
          department: u.department,
          onlineAt: new Date().toISOString()
        });
      } catch {}
    };

    // Grava a atividade real do usuário logado na tabela profiles (fonte única para toda a equipe)
    const persistMyHeartbeat = async () => {
      const u = currentUserRef.current;
      if (!u?.id) return;
      const nowIso = new Date().toISOString();
      setHeartbeats({ ...saveLocalHeartbeat(u.id, nowIso) });
      try {
        let { data, error } = await supabase
          .from('profiles')
          .update({ last_seen: nowIso })
          .eq('id', u.id)
          .select('id');
        if ((error || !data || data.length === 0) && u.email) {
          await supabase.from('profiles').update({ last_seen: nowIso }).eq('email', u.email);
        }
      } catch {}
    };

    const markMyselfOffline = () => {
      const u = currentUserRef.current;
      if (!u?.id) return;
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', u.id).then(() => {}, () => {});
    };
    window.addEventListener('pagehide', markMyselfOffline);
    const onVisible = () => {
      if (!document.hidden) {
        persistMyHeartbeat();
        trackMyPresence();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const syncPresence = () => {
      try {
        const state = channel.presenceState();
        const activeIds = new Set();
        Object.keys(state).forEach((key) => {
          activeIds.add(key);
          (state[key] || []).forEach((p) => addPresenceKeys(activeIds, p));
        });
        if (currentUserRef.current?.id) {
          activeIds.add(currentUserRef.current.id);
        }
        setOnlineUserIds(activeIds);
      } catch {}
    };

    // Processador unificado com blindagem tripla de privacidade para novas mensagens
    const handleIncomingMessageRow = (row) => {
      if (!row) return;

          // Registros de sistema (Alunos EduControl)
          if (row.chat_id === 'sys_educontrol_students') {
            const match = (row.text || '').match(/<!-- STUDENT_RECORD:([\s\S]*?) -->/);
            if (match) {
              try {
                const sRecord = JSON.parse(match[1]);
                setEduControlStudents((prev) => {
                  const studentList = [...prev];
                  const existingIdx = studentList.findIndex((s) => {
                    if (sRecord.cleanCPF && s.cleanCPF && sRecord.cleanCPF === s.cleanCPF) return true;
                    if (sRecord.cleanDigits && s.cleanDigits && sRecord.cleanDigits === s.cleanDigits) return true;
                    return false;
                  });
                  if (existingIdx !== -1) {
                    const existing = studentList[existingIdx];
                    studentList[existingIdx] = {
                      ...existing,
                      ...sRecord,
                      assignee: existing.assignee || sRecord.assignee || 'Gabriel Carvalho',
                      department: existing.department || sRecord.department || 'Secretaria Acadêmica'
                    };
                  } else {
                    studentList.push(sRecord);
                  }
                  try {
                    localStorage.setItem('educhat_educontrol_students', JSON.stringify(studentList));
                  } catch {}
                  return studentList;
                });
              } catch {}
            }
            return;
          }

          // Registros de sistema (Colaboradores)
          if (row.chat_id === 'sys_collaborators') {
            const match = (row.text || '').match(/<!-- COLLABORATOR_RECORD:([\s\S]*?) -->/);
            if (match) {
              try {
                const incomingCollab = JSON.parse(match[1]);
                setCollaborators((prev) => {
                  const list = [...prev];
                  const existingIdx = list.findIndex(
                    (c) => c.id === incomingCollab.id || (c.name && incomingCollab.name && c.name.toLowerCase() === incomingCollab.name.toLowerCase())
                  );
                  if (existingIdx !== -1) {
                    list[existingIdx] = { ...list[existingIdx], ...incomingCollab };
                  } else {
                    list.push(incomingCollab);
                  }
                  try {
                    localStorage.setItem('educhat_collaborators', JSON.stringify(list));
                  } catch {}
                  return list;
                });
              } catch {}
            }
            return;
          }

          const activeUser = currentUserRef.current || { id: 'u1', roleType: 'colaborador' };
          const currentUserId = activeUser.id || 'u1';
          const currentActiveChat = activeChatRef.current;
          const cKey = normalizeChatKey(row.chat_id, currentUserId);

          // Ignora mensagens fantasmas vazias geradas por acks indevidos
          const rawRowText = (row.text || '').replace(/<!--[\s\S]*?-->/g, '').trim();
          if (rawRowText === 'Mensagem recebida' || rawRowText === '💬 Mensagem recebida' || rawRowText === '') {
            return;
          }

          // 1. Identificação Estrita de Tipo de Conversa e Blindagem de Permissão / Privacidade
          const isChannelRow = Boolean(
            row.channel_id ||
            cKey.startsWith('c-') ||
            cKey.startsWith('#') ||
            ['geral', 'comercial', 'tutoria', 'secretaria', 'marketing', 'pedagogico', 'expansao'].includes(
              String(row.chat_id || cKey).replace(/^[c#]-?/, '').toLowerCase()
            )
          );

          // Trava de Visibilidade de Canais: se o usuário não tem permissão para o canal (ex: Gislaine em #comercial), descarta
          if (isChannelRow) {
            // Bloqueia qualquer vazamento de Dossiê Executivo em canais públicos de equipe
            if (typeof row.text === 'string' && (row.text.includes('DOSSIÊ EXECUTIVO') || row.text.includes('<!-- DOSSIER_RECORD:'))) {
              return;
            }
            const channelId = cKey.startsWith('c-') ? cKey : `c-${String(row.chat_id || cKey).replace(/^[c#]-?/, '')}`;
            if (!canUserViewChannel(channelId, activeUser, channelsRef.current)) {
              return;
            }
          }

          // Blindagem de Destinatário Estrito: se a mensagem possui recipient_id e não envolve o usuário logado, descarta
          if (row.recipient_id && row.recipient_id !== currentUserId && row.sender_id !== currentUserId) {
            return;
          }

          // Trava de Privacidade e Destinatário em DMs 1-a-1: se o usuário logado não for participante, descarta
          const isDmRow = !isChannelRow && !cKey.startsWith('wa-') && (cKey.startsWith('dm-') || Boolean(row.recipient_id));
          if (isDmRow) {
            let isUserInvolved = false;
            if (cKey.startsWith('dm-')) {
              const parts = cKey.replace('dm-', '').split('-').filter(Boolean);
              isUserInvolved = parts.includes(currentUserId);
            } else if (row.recipient_id) {
              isUserInvolved = row.recipient_id === currentUserId || row.sender_id === currentUserId;
            }
            if (!isUserInvolved) {
              return;
            }
          }

          const incoming = parseDatabaseMessage(row, { stripHeavyAttachments: false });

          // 2. FILTRO ESTRITO NO LISTENER DE REALTIME:
          // Verifica se o payload.new pertence exatamente à conversa que está aberta na tela
          let isCurrentActive = false;
          if (currentActiveChat) {
            if (currentActiveChat.type === 'dm') {
              // Se for um chat 1 a 1: A mensagem só entra na tela atual se o sender_id ou recipient_id for o selectedUser.id
              const selectedUserId = currentActiveChat.id;
              isCurrentActive =
                row.sender_id === selectedUserId ||
                row.recipient_id === selectedUserId ||
                incoming.senderId === selectedUserId ||
                incoming.recipientId === selectedUserId ||
                (row.chat_id && (row.chat_id === `dm-${currentUserId}-${selectedUserId}` || row.chat_id === `dm-${selectedUserId}-${currentUserId}`));
            } else if (currentActiveChat.type === 'channel') {
              // Se for grupo: A mensagem só entra se o channel_id for igual ao activeChannel.id
              const activeChannelId = currentActiveChat.id;
              const chId = row.channel_id || row.chat_id || '';
              isCurrentActive =
                chId === activeChannelId ||
                chId === activeChannelId.replace(/^c-/, '') ||
                `c-${chId.replace(/^c-/, '')}` === activeChannelId ||
                cKey === activeChannelId;
            } else if (currentActiveChat.type === 'whatsapp') {
              const currentActiveKey = getChatKey(currentActiveChat, currentUserId);
              const canonActive = getCanonicalPhoneKey(currentActiveChat?.id || currentActiveChat?.phone);
              const canonRow = getCanonicalPhoneKey(row.chat_id);
              isCurrentActive = (
                cKey === currentActiveKey ||
                activeChatRef.current?.id === cKey ||
                activeChatRef.current?.id === row.chat_id ||
                Boolean(canonActive && canonRow && canonActive === canonRow)
              );
            }
          }

          // 3. ATUALIZAÇÃO EXCLUSIVA DE SIDEBAR (BACKGROUND):
          // Se a mensagem nova for de um contato diferente do que está aberto,
          // ela NÃO deve ir para o estado messages. O sistema atualiza o estado via handleIncomingNotification de forma isolada.
          if (!isCurrentActive) {
            if (row.sender_id !== currentUserId && row.sender_id !== 'system') {
              handleIncomingNotification(incoming, row.chat_id || cKey);
            }

            // Encerra imediatamente sem contaminar o estado de mensagens da conversa ativa
            return;
          }

          // Pertence à conversa ativa: se a aba do navegador estiver oculta/minimizada, emite alerta/notificação nativa
          if (document.hidden && row.sender_id !== currentUserId && row.sender_id !== 'system') {
            handleIncomingNotification(incoming, row.chat_id || cKey);
          }

          // AQUI: Pertence exatamente à conversa aberta na tela!
          const activeKey = getChatKey(currentActiveChat, currentUserId);
          const aliasKeys = getChatAliasKeys(currentActiveChat, currentUserId);
          setMessages((prevMessages) => {
            const prevList = prevMessages[activeKey] || prevMessages[cKey] || [];

            // 1. Se já existe mensagem com esse id exato, atualiza in-place
            const exactIdx = prevList.findIndex((m) => m.id === incoming.id);
            if (exactIdx !== -1) {
              const next = [...prevList];
              next[exactIdx] = {
                ...next[exactIdx],
                ...incoming,
                status: incoming.status || next[exactIdx].status
              };
              const nextState = { ...prevMessages };
              aliasKeys.forEach((k) => {
                nextState[k] = next;
              });
              return nextState;
            }

            // 2. Se for mensagem enviada por nós (outgoing / echo do webhook), funde com a mensagem otimista
            const incomingCleanText = (incoming.text || '')
              .replace(/<!--[\s\S]*?-->/g, '')
              .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
              .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
              .trim();

            const isIncomingMe = incoming.senderId === currentUserId || incoming.senderId === 'u_matriz' || incoming.fromMe;

            if (isIncomingMe && incomingCleanText) {
              const optIdx = prevList.findIndex((m) => {
                const isMMe = m.senderId === currentUserId || m.senderId === 'u_matriz' || m.fromMe;
                if (!isMMe) return false;
                const mCleanText = (m.text || '')
                  .replace(/<!--[\s\S]*?-->/g, '')
                  .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
                  .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
                  .trim();
                return mCleanText === incomingCleanText;
              });

              if (optIdx !== -1) {
                const next = [...prevList];
                next[optIdx] = {
                  ...next[optIdx],
                  ...incoming,
                  id: incoming.id,
                  status: incoming.status || 'delivered'
                };
                const nextState = { ...prevMessages };
                aliasKeys.forEach((k) => {
                  nextState[k] = next;
                });
                return nextState;
              }
            }

            const updatedList = [...prevList, incoming];
            const nextState = { ...prevMessages };
            aliasKeys.forEach((k) => {
              nextState[k] = updatedList;
            });
            return nextState;
          });

          // Broadcast de disponibilidade de usuários em tempo real
          if (row.chat_id === 'sys_user_availability') {
            try {
              const payload = JSON.parse(row.text);
              if (payload.userId) {
                setCollaborators((prev) =>
                  prev.map((c) => (c.id === payload.userId ? { ...c, is_available: payload.is_available } : c))
                );
                if (currentUserRef.current?.id === payload.userId) {
                  setCurrentUser((prev) => ({ ...prev, is_available: payload.is_available }));
                }
              }
            } catch {}
            return;
          }

          // Se for contato WhatsApp: sobe para o topo da lista e soma +1 em unread_count se não estiver aberta
          if (cKey.startsWith('wa-')) {
            const asgnMatch = (row.text || '').match(/<!-- ASSIGNMENT:([\s\S]*?) -->/);
            let asgnData = null;
            if (asgnMatch) {
              try {
                asgnData = JSON.parse(asgnMatch[1]);
                assignmentsCacheRef.current[cKey] = asgnData;
                const stored = JSON.parse(localStorage.getItem('educhat_chat_assignments') || '{}');
                stored[cKey] = asgnData;
                localStorage.setItem('educhat_chat_assignments', JSON.stringify(stored));
              } catch {}
            }

            const activeUser = currentUserRef.current || currentUser;
            const isMgr = hasFullPortfolioAccess(activeUser);

            setWhatsAppContacts((prevContacts) => {
              const incomingKey = getCanonicalPhoneKey(cKey);
              const existingIdx = prevContacts.findIndex((c) => {
                if (c.id === cKey) return true;
                if (incomingKey && getCanonicalPhoneKey(c) === incomingKey) return true;
                const cDigits = (c.phone || '').replace(/\D/g, '');
                const kDigits = cKey.replace(/\D/g, '');
                return cDigits.length >= 10 && cDigits === kDigits;
              });

              let updatedContact;

              if (existingIdx !== -1) {
                const existing = prevContacts[existingIdx];
                const isOpenContact =
                  (isCurrentActive || activeChatRef.current?.id === existing.id) && !document.hidden;
                const currentUnread = Number(existing.unread_count ?? existing.unread ?? 0);
                const nextUnread = isOpenContact ? 0 : currentUnread + 1;

                // Se o contato usa um ID de slug (ex: wa-lucas-mendes) diferente de cKey, espelha a mensagem em 0ms
                if (existing.id !== cKey) {
                  setMessages((prevMessages) => {
                    const aliasList = prevMessages[existing.id] || [];
                    if (aliasList.some((m) => m.id === incoming.id)) return prevMessages;
                    return {
                      ...prevMessages,
                      [existing.id]: [...aliasList, incoming]
                    };
                  });
                }

                updatedContact = {
                  ...existing,
                  department: asgnData?.department || existing.department,
                  assignee: asgnData ? asgnData.assignee : existing.assignee,
                  assignees: asgnData?.assignees || (asgnData ? (asgnData.assignee ? [asgnData.assignee] : []) : existing.assignees),
                  assigned_to: asgnData?.assigned_to !== undefined ? asgnData.assigned_to : existing.assigned_to,
                  status: asgnData?.status || existing.status,
                  statusLabel: asgnData?.statusLabel || existing.statusLabel,
                  triageContext: asgnData?.updatedBy
                    ? (asgnData.assignee ? `Atribuído a ${asgnData.assignee} (${asgnData.department}) por ${asgnData.updatedBy}` : `Fila de ${asgnData.department}: Aguardando disponibilidade`)
                    : existing.triageContext,
                  lastInteraction: formatRelativeChatTime(incoming.created_at || incoming.timestampRaw || new Date().toISOString()),
                  lastMessageAt: incoming.created_at || incoming.timestampRaw || new Date().toISOString(),
                  unread_count: nextUnread,
                  unread: nextUnread
                };

                // Regra de Visibilidade por Perfil e Departamento:
                // Se o colaborador não tem permissão para ver este chat, remove da visão do colaborador
                if (!isMgr && !canUserViewChat(updatedContact, activeUser)) {
                  return prevContacts.filter((_, idx) => idx !== existingIdx);
                }

                const remaining = prevContacts.filter((_, idx) => idx !== existingIdx);
                return [updatedContact, ...remaining];
              } else {
                const rawDigits = cKey.replace('wa-', '');
                const formattedPhone = rawDigits.length >= 10 ? `+${rawDigits}` : rawDigits;
                const cachedAsgn = assignmentsCacheRef.current[cKey] || null;
                const matchedStudent = matchStudentByPhone(cKey, eduControlStudentsRef.current);

                const finalName = matchedStudent?.name || incoming.senderName || `WhatsApp (${formattedPhone})`;
                const finalAvatar = matchedStudent ? '🎓' : '👤';
                const finalDept = asgnData?.department || cachedAsgn?.department || 'Triagem URA';
                const finalAssignee = asgnData?.assignee || cachedAsgn?.assignee || null;
                const finalAssignedTo = asgnData?.assigned_to !== undefined ? asgnData.assigned_to : (cachedAsgn?.assigned_to || null);
                const finalStatus = asgnData?.status || cachedAsgn?.status || (finalAssignee ? 'carteira_ativa' : 'ura_inedito');
                const finalStatusLabel = asgnData?.statusLabel || cachedAsgn?.statusLabel || (finalAssignee ? `Carteira • ${finalAssignee}` : 'Fila • Triagem URA');

                updatedContact = {
                  id: cKey,
                  name: finalName,
                  phone: formattedPhone,
                  avatar: finalAvatar,
                  department: finalDept,
                  assignee: finalAssignee,
                  assignees: finalAssignee ? [finalAssignee] : [],
                  assigned_to: finalAssignedTo,
                  status: finalStatus,
                  statusLabel: finalStatusLabel,
                  aiActive: false,
                  lastInteraction: formatRelativeChatTime(incoming.created_at || incoming.timestampRaw || new Date().toISOString()),
                  lastMessageAt: incoming.created_at || incoming.timestampRaw || new Date().toISOString(),
                  triageContext: finalAssignee ? `Atendimento atribuído a ${finalAssignee}` : 'Aguardando seleção de departamento na URA.',
                  unread_count: isCurrentActive ? 0 : 1,
                  unread: isCurrentActive ? 0 : 1
                };

                // Regra de Visibilidade por Perfil e Departamento:
                // Se for um novo chat não atribuído ao atendente e fora do seu departamento de triagem,
                // ignora e não adiciona na visão do colaborador
                if (!isMgr && !canUserViewChat(updatedContact, activeUser)) {
                  return prevContacts;
                }

                return [updatedContact, ...prevContacts];
              }
            });
          }

          // Se for canal interno, atualiza o contador de não lidas funcionalmente
          if (cKey.startsWith('c-')) {
            setChannels((prevChannels) =>
              prevChannels.map((c) => {
                if (c.id === cKey || c.name === cKey.replace('c-', '')) {
                  const currentUnread = Number(c.unread_count ?? c.unread ?? 0);
                  const nextUnread = isCurrentActive ? 0 : currentUnread + 1;
                  return { ...c, unread: nextUnread, unread_count: nextUnread };
                }
                return c;
              })
            );
          }

          // Dispara alerta sonoro (880Hz/1046Hz) e badge se não foi enviada pelo próprio usuário
          handleIncomingNotification(incoming, cKey);

          // Resposta automática URA / Gemini AI quando aplicável
          if (
            cKey.startsWith('wa-') &&
            row.sender_id !== currentUserId &&
            row.sender_id !== 'system' &&
            !String(row.sender_id || '').startsWith('bot') &&
            row.sender_id !== 'u_ia_copilot' &&
            !document.hidden
          ) {
            const activeUser = currentUserRef.current || currentUser;
            const targetContact = (whatsAppContactsRef.current || []).find((c) => c.id === cKey);
            if (!hasFullPortfolioAccess(activeUser) && !canUserViewChat(targetContact, activeUser)) {
              return;
            }
            setWhatsAppContacts((prevContacts) => {
              const contact = prevContacts.find((c) => c.id === cKey);
              if (!contact) return prevContacts;

              if (contact.status === 'ura_inedito' || contact.status === 'veterano_retencao' || !contact.assignee) {
                const triageResult = processTriageResponse(
                  incoming.text,
                  contact.status,
                  channelsRef.current,
                  collaboratorsRef.current,
                  lastAssignmentMapRef.current
                );
                if (triageResult) {
                  if (triageResult.assigned_to) {
                    lastAssignmentMapRef.current[triageResult.assigned_to] = Date.now();
                    try {
                      localStorage.setItem('educhat_round_robin_history', JSON.stringify(lastAssignmentMapRef.current));
                    } catch {}
                  }

                  handleUpdateChatAssignment(cKey, {
                    department: triageResult.department,
                    assignee: triageResult.assignee,
                    assigned_to: triageResult.assigned_to,
                    status: triageResult.assigned_to ? 'carteira_ativa' : 'fila_departamento',
                    statusLabel: triageResult.assigned_to ? `Atendimento • ${triageResult.assignee}` : `Fila • ${triageResult.department}`
                  });

                  setTimeout(() => {
                    const botReply = {
                      id: 'bot_triage_' + Date.now(),
                      senderId: 'u_matriz',
                      senderName: 'EduChat Matriz (URA)',
                      text: `✅ ${triageResult.handOffMessage}\n<!-- STATUS:delivered -->`,
                      timestamp: getSaoPauloTime(),
                      isWhatsApp: true,
                      fromStudent: false
                    };

                    setMessages((prev) => ({
                      ...prev,
                      [cKey]: [...(prev[cKey] || []), botReply]
                    }));

                    supabase.from('messages').insert([{
                      id: botReply.id,
                      chat_id: cKey,
                      sender_id: botReply.senderId,
                      sender_name: botReply.senderName,
                      text: botReply.text,
                      timestamp: botReply.timestamp
                    }]).catch(() => {});
                  }, 500);

                  return prevContacts;
                }
              }

              const timeInfo = getBrasiliaTime();
              if (!timeInfo.isAfterHours) {
                console.log(`⏸️ [Decisão Webhook] Horário Comercial: IA pausada (Hora Brasília: ${timeInfo.timeStr})`);
              } else {
                console.log(`🤖 [Decisão Webhook] Fora de Expediente: IA assumindo (Hora Brasília: ${timeInfo.timeStr})`);
              }

              if (contact.aiActive || timeInfo.isAfterHours) {
                setTimeout(async () => {
                  try {
                    const matchedStudent = matchStudentByPhone(cKey, eduControlStudentsRef.current);
                    const history = (messagesRef.current[cKey] || []).slice(-10);
                    const reply = await generateGeminiChatReply({
                      message: incoming.text,
                      history,
                      student: matchedStudent,
                      learnedDocuments: learnedDocumentsRef.current,
                      pops: [],
                      slas: INITIAL_SLAS,
                      customPrompt: customAIPromptRef.current,
                      department: contact.department || 'Geral',
                      userName: incoming.senderName || contact.name
                    });

                    const geminiMsg = {
                      id: 'gemini_' + Date.now(),
                      senderId: 'u_ia_copilot',
                      senderName: '🤖 Assistente IA (Gemini)',
                      text: reply,
                      timestamp: getSaoPauloTime(),
                      isWhatsApp: true,
                      fromStudent: false
                    };

                    setMessages((prev) => ({
                      ...prev,
                      [cKey]: [...(prev[cKey] || []), geminiMsg]
                    }));

                    const targetPhone = contact.preferredTarget || contact.phone || cKey.replace(/^wa-/, '');
                    if (targetPhone) {
                      sendWhatsAppText(targetPhone, reply).catch((err) => {
                        console.warn('Erro ao disparar WhatsApp da IA:', err);
                      });
                    }

                    supabase.from('messages').insert([{
                      id: geminiMsg.id,
                      chat_id: cKey,
                      sender_id: geminiMsg.senderId,
                      sender_name: geminiMsg.senderName,
                      text: geminiMsg.text,
                      timestamp: geminiMsg.timestamp
                    }]);
                  } catch (e) {
                    console.warn('Erro ao gerar resposta Gemini Realtime:', e);
                  }
                }, 800);
              }

              return prevContacts;
            });
          }
        };

    // CANAL GLOBAL UNIFICADO DE MENSAGENS EM TEMPO REAL:
    // Escuta todos os INSERTs na tabela 'messages' e despacha com verificação de autorização e escopo local
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      },
      (payload) => {
        const row = payload.new;
        if (!row || !row.chat_id) return;

        // A. Mensagens de sistema (Alunos EduControl, Colaboradores, Presença)
        if (row.chat_id.startsWith('sys_')) {
          handleIncomingMessageRow(row);
          return;
        }

        const activeUser = currentUserRef.current || initialUser;
        const myId = activeUser?.id || activeUserId;
        const isMgr = hasFullPortfolioAccess(activeUser);

        // B. Atendimentos de WhatsApp
        if (row.chat_id.startsWith('wa-')) {
          if (isMgr || activeUser?.department === 'Comercial' || canUserViewChat(row, activeUser)) {
            handleIncomingMessageRow(row);
          }
          return;
        }

        // C. Mensagens Diretas (DMs)
        if (row.chat_id.startsWith('dm-')) {
          const isSender = row.sender_id === myId;
          const isRecipient = row.recipient_id === myId;
          const isInChatId = row.chat_id.includes(myId);

          if (isSender || isRecipient || isInChatId || isMgr) {
            handleIncomingMessageRow(row);
          }
          return;
        }

        // D. Canais Internos (c-geral, c-secretaria, etc.)
        if (row.chat_id.startsWith('c-') || row.chat_id.startsWith('#') || row.chat_id === 'geral') {
          if (canUserViewChannel(row.chat_id, activeUser, channelsRef.current)) {
            handleIncomingMessageRow(row);
          }
          return;
        }

        // E. Fallback genérico para qualquer outra mensagem
        handleIncomingMessageRow(row);
      }
    );

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          if (!row) return;

          if (row.chat_id === 'sys_collaborators') {
            const match = (row.text || '').match(/<!-- COLLABORATOR_RECORD:([\s\S]*?) -->/);
            if (match) {
              try {
                const incomingCollab = JSON.parse(match[1]);
                setCollaborators((prev) => {
                  const list = [...prev];
                  const existingIdx = list.findIndex(
                    (c) => c.id === incomingCollab.id || (c.name && incomingCollab.name && c.name.toLowerCase() === incomingCollab.name.toLowerCase())
                  );
                  if (existingIdx !== -1) {
                    list[existingIdx] = { ...list[existingIdx], ...incomingCollab };
                  } else {
                    list.push(incomingCollab);
                  }
                  try {
                    localStorage.setItem('educhat_collaborators', JSON.stringify(list));
                  } catch {}
                  return list;
                });
              } catch {}
            }
            return;
          }

          if (row.chat_id === 'sys_educontrol_students') {
            const match = (row.text || '').match(/<!-- STUDENT_RECORD:([\s\S]*?) -->/);
            if (match) {
              try {
                const sRecord = JSON.parse(match[1]);
                setEduControlStudents((prev) => {
                  const studentList = [...prev];
                  const existingIdx = studentList.findIndex((s) => {
                    if (sRecord.cleanCPF && s.cleanCPF && sRecord.cleanCPF === s.cleanCPF) return true;
                    if (sRecord.cleanDigits && s.cleanDigits && sRecord.cleanDigits === s.cleanDigits) return true;
                    return false;
                  });
                  if (existingIdx !== -1) {
                    studentList[existingIdx] = { ...studentList[existingIdx], ...sRecord };
                  } else {
                    studentList.push(sRecord);
                  }
                  try {
                    localStorage.setItem('educhat_educontrol_students', JSON.stringify(studentList));
                  } catch {}
                  return studentList;
                });
              } catch {}
            }
            return;
          }

          const currentUserId = currentUserRef.current?.id || 'u1';
          const cKey = normalizeChatKey(row.chat_id, currentUserId);

          let cleanText = row.text || '';
          let parsedStatus = 'sent';
          if (cleanText.includes('<!-- STATUS:')) {
            const match = cleanText.match(/<!-- STATUS:([^\s>]+) -->/);
            if (match) parsedStatus = match[1];
          }

          let incomingReadBy = [];
          if (Array.isArray(row?.read_by)) {
            incomingReadBy = [...row.read_by];
          } else if (typeof row?.read_by === 'string') {
            try {
              const parsed = JSON.parse(row.read_by);
              if (Array.isArray(parsed)) incomingReadBy = parsed;
              else incomingReadBy = row.read_by.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
            } catch {
              incomingReadBy = row.read_by.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
            }
          }
          if (!Array.isArray(incomingReadBy)) incomingReadBy = [];

          if (typeof cleanText === 'string' && cleanText.includes('<!-- READ_BY:')) {
            const match = cleanText.match(/<!-- READ_BY:([\s\S]+?) -->/);
            if (match) {
              try {
                const list = JSON.parse(match[1]);
                if (Array.isArray(list)) {
                  incomingReadBy = Array.from(new Set([...incomingReadBy, ...list]));
                }
              } catch {}
            }
          }

          setMessages((prevMessages) => {
            const list = prevMessages[cKey];
            if (!list) return prevMessages;
            return {
              ...prevMessages,
              [cKey]: list.map((m) => {
                if (m.id === row.id) {
                  const prevReadBy = Array.isArray(m?.read_by) ? m.read_by : (Array.isArray(m?.readBy) ? m.readBy : []);
                  const combinedReadBy = Array.from(
                    new Set([...prevReadBy, ...incomingReadBy])
                  );
                  return {
                    ...m,
                    status: parsedStatus || m.status,
                    read_by: combinedReadBy,
                    readBy: combinedReadBy
                  };
                }
                return m;
              })
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;

          setMessages((prevMessages) => {
            const next = { ...prevMessages };
            let changed = false;
            Object.keys(next).forEach((key) => {
              if (next[key]?.some((m) => m.id === deletedId)) {
                next[key] = next[key].filter((m) => m.id !== deletedId);
                changed = true;
              }
            });
            return changed ? next : prevMessages;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          const incomingCollab = {
            id: row.id,
            name: row.name || row.full_name || 'Colaborador',
            email: row.email || '',
            role: row.role || 'Colaborador',
            roleType: row.role_type || (row.role === 'admin' || row.role === 'diretor' ? 'diretor' : 'colaborador'),
            avatar: row.avatar || '👤',
            online: row.is_bot ? true : row.online === true,
            lastSeen: row.last_seen || null,
            department: row.department || 'Comercial',
            isBot: row.is_bot || false
          };
          setCollaborators((prev) => {
            const list = [...prev];
            const existingIdx = list.findIndex(
              (c) => c.id === incomingCollab.id || (c.name && incomingCollab.name && c.name.trim().toLowerCase() === incomingCollab.name.trim().toLowerCase())
            );
            if (existingIdx !== -1) {
              list[existingIdx] = { ...list[existingIdx], ...incomingCollab };
            } else {
              list.push(incomingCollab);
            }
            try {
              localStorage.setItem('educhat_collaborators', JSON.stringify(list));
            } catch {}
            return list;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            if (!row) return;
            let reqName = row.requester || '';
            let reqDept = row.requester_dept || '';
            if (!reqName && row.source_message && row.source_message.includes('Solicitado por:')) {
              const match = row.source_message.match(/Solicitado por:\s*([^(•]+)\s*(?:\(([^)]+)\))?/);
              if (match) {
                reqName = match[1].trim();
                reqDept = match[2]?.trim() || '';
              }
            }
            let cleanDesc = row.description || '';
            let comments = [];
            let attachments = [];
            const metaMatch = cleanDesc.match(/<!-- TASK_META:([\s\S]*?) -->/);
            if (metaMatch) {
              try {
                const meta = JSON.parse(metaMatch[1]);
                if (Array.isArray(meta.comments)) comments = meta.comments;
                if (Array.isArray(meta.attachments)) attachments = meta.attachments;
              } catch (e) {}
              cleanDesc = cleanDesc.replace(/<!-- TASK_META:[\s\S]*? -->/, '').trim();
            }
            const newTask = {
              id: String(row.id),
              title: row.title,
              desc: cleanDesc,
              status: row.status || 'backlog',
              priority: row.priority || 'media',
              isVip: Boolean(row.is_vip),
              assignee: row.assignee,
              assigneeAvatar: row.assignee_avatar || '👤',
              department: row.department || 'Geral',
              dueDate: row.due_date || 'A definir',
              channel: row.channel || '#geral',
              sourceMessage: row.source_message,
              requester: reqName || 'Gestão',
              requesterDept: reqDept || 'Diretoria',
              comments,
              attachments,
              created_at: row.created_at || new Date().toISOString(),
              createdAt: row.created_at || new Date().toISOString()
            };
            setTasks((prev) => {
              if (prev.some((t) => String(t.id) === String(newTask.id))) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (!row) return;
            let cleanDesc = row.description;
            let comments = null;
            let attachments = null;
            if (cleanDesc && cleanDesc.includes('<!-- TASK_META:')) {
              const metaMatch = cleanDesc.match(/<!-- TASK_META:([\s\S]*?) -->/);
              if (metaMatch) {
                try {
                  const meta = JSON.parse(metaMatch[1]);
                  if (Array.isArray(meta.comments)) comments = meta.comments;
                  if (Array.isArray(meta.attachments)) attachments = meta.attachments;
                } catch (e) {}
                cleanDesc = cleanDesc.replace(/<!-- TASK_META:[\s\S]*? -->/, '').trim();
              }
            }
            setTasks((prev) =>
              prev.map((t) => {
                if (String(t.id) !== String(row.id)) return t;
                return {
                  ...t,
                  status: row.status !== undefined && row.status !== null ? row.status : t.status,
                  title: row.title !== undefined && row.title !== null ? row.title : t.title,
                  desc: cleanDesc !== undefined && cleanDesc !== null ? cleanDesc : t.desc,
                  priority: row.priority !== undefined && row.priority !== null ? row.priority : t.priority,
                  isVip: row.is_vip !== undefined && row.is_vip !== null ? Boolean(row.is_vip) : t.isVip,
                  assignee: row.assignee !== undefined && row.assignee !== null ? row.assignee : t.assignee,
                  assigneeAvatar: row.assignee_avatar || t.assigneeAvatar,
                  department: row.department !== undefined && row.department !== null ? row.department : t.department,
                  dueDate: row.due_date !== undefined && row.due_date !== null ? row.due_date : t.dueDate,
                  channel: row.channel !== undefined && row.channel !== null ? row.channel : t.channel,
                  created_at: row.created_at || t.created_at,
                  createdAt: row.created_at || t.createdAt,
                  comments: comments !== null ? comments : t.comments,
                  attachments: attachments !== null ? attachments : t.attachments
                };
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setTasks((prev) => prev.filter((t) => String(t.id) !== String(oldId)));
            }
          }
        }
      )
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.add(key);
          (newPresences || []).forEach((p) => addPresenceKeys(next, p));
          return next;
        });
      })
      .on('presence', { event: 'leave' }, () => {
        // Recalcula a partir do estado real do canal (evita remover quem ainda tem outra aba aberta)
        syncPresence();
      })
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          presenceChannelRef.current = channel;
          await trackMyPresence();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[Realtime Supabase] Status do canal:', status, err);
          if (!cancelled) {
            setTimeout(() => {
              if (!cancelled) {
                try {
                  channel.subscribe();
                } catch {}
              }
            }, 3000);
          }
        }
      });

    const handleOnline = () => {
      if (!cancelled) {
        try {
          channel.subscribe();
          trackMyPresence();
          pollLatestMessages();
        } catch {}
      }
    };
    window.addEventListener('online', handleOnline);

    // Sincronização periódica ativa (Fallback Realtime): garante que novas mensagens internas e de WhatsApp
    // apareçam imediatamente na tela sem precisar recarregar a página, mesmo sob instabilidade do WebSocket
    let lastPolledTimestamp = new Date(Date.now() - 60000).toISOString();
    const pollLatestMessages = async () => {
      try {
        let { data: latestRows, error } = await withTimeout(
          supabase
            .from('messages')
            .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at, recipient_id, read_by')
            .not('chat_id', 'like', 'sys_%')
            .gt('created_at', lastPolledTimestamp)
            .order('created_at', { ascending: true })
            .limit(40),
          2500
        );

        if (error) {
          // Fallback caso a coluna channel_id ainda não exista no schema cache
          const retryRes = await withTimeout(
            supabase
              .from('messages')
              .select('id, chat_id, sender_id, sender_name, text, timestamp, created_at')
              .not('chat_id', 'like', 'sys_%')
              .gt('created_at', lastPolledTimestamp)
              .order('created_at', { ascending: true })
              .limit(40),
            2500
          );
          latestRows = retryRes.data;
          error = retryRes.error;
        }

        if (!error && Array.isArray(latestRows) && latestRows.length > 0) {
          lastPolledTimestamp = latestRows[latestRows.length - 1].created_at || new Date().toISOString();
          const activeUser = currentUserRef.current || { id: 'u1', roleType: 'diretor' };
          const currentUserId = activeUser.id || 'u1';
          const currentActiveKey = getChatKey(activeChatRef.current, currentUserId);

          latestRows.forEach((row) => {
            if (!row || !row.chat_id) return;
            const cKey = normalizeChatKey(row.chat_id, currentUserId);

            // Validação de privacidade e visibilidade:
            // 1. Se for canal de grupo: valida permissão de departamento (ex: bloqueia #comercial para Gislaine)
            const isChannel = Boolean(
              cKey.startsWith('c-') ||
              row.channel_id ||
              cKey.startsWith('#') ||
              ['geral', 'comercial', 'tutoria', 'secretaria', 'marketing', 'pedagogico', 'expansao'].includes(
                String(row.chat_id || cKey).replace(/^[c#]-?/, '').toLowerCase()
              )
            );
            if (isChannel) {
              // BLOQUEIO TOTAL: Dossiê Executivo NUNCA deve ser renderizado em canais públicos de equipe
              if (typeof row.text === 'string' && (row.text.includes('DOSSIÊ EXECUTIVO') || row.text.includes('<!-- DOSSIER_RECORD:'))) {
                return;
              }
              const chId = cKey.startsWith('c-') ? cKey : `c-${String(row.chat_id || cKey).replace(/^[c#]-?/, '')}`;
              if (!canUserViewChannel(chId, activeUser, channelsRef.current)) {
                return;
              }
            }

            // Blindagem de Destinatário Estrito: se a mensagem tem recipient_id e não envolve o usuário ativo, descarta
            if (row.recipient_id && row.recipient_id !== currentUserId && row.sender_id !== currentUserId) {
              return;
            }

            // 2. Se for DM (1 a 1): valida se o usuário ativo é participante
            const isDm = !isChannel && !cKey.startsWith('wa-') && (cKey.startsWith('dm-') || Boolean(row.recipient_id));
            if (isDm) {
              let isUserInvolved = false;
              if (cKey.startsWith('dm-')) {
                const parts = cKey.replace('dm-', '').split('-').filter(Boolean);
                isUserInvolved = parts.includes(currentUserId);
              } else if (row.recipient_id) {
                isUserInvolved = row.recipient_id === currentUserId || row.sender_id === currentUserId;
              }
              if (!isUserInvolved) {
                return;
              }
            }

            const incoming = parseDatabaseMessage(row, { stripHeavyAttachments: false });

            // ASSEPSIA DEFINITIVA: Apenas a conversa ativa na tela recebe novas mensagens no estado `messages`.
            // Conversas inativas recebem apenas notificação/atualização de badge na sidebar.
            if (cKey === currentActiveKey) {
              setMessages((prev) => {
                const prevList = prev[cKey] || [];
                if (prevList.some((m) => m.id === incoming.id)) return prev;
                return {
                  ...prev,
                  [cKey]: [...prevList, incoming]
                };
              });
            }

            if (row.sender_id !== currentUserId && row.sender_id !== 'system') {
              if (cKey !== currentActiveKey || document.hidden) {
                handleIncomingNotification(incoming, cKey);
              }
            }
          });
        }
      } catch {}
    };

    const pollInterval = setInterval(pollLatestMessages, 4000);

    // Heartbeat: renova presença no Realtime e grava last_seen em profiles (visível para toda a equipe)
    const hbInterval = setInterval(() => {
      persistMyHeartbeat();
      trackMyPresence();
    }, 30000);
    persistMyHeartbeat();

    return () => {
      cancelled = true;
      clearInterval(hbInterval);
      clearInterval(pollInterval);
      window.removeEventListener('pagehide', markMyselfOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', onVisible);
      presenceChannelRef.current = null;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [currentUser?.id]);

  // Enviar nova mensagem no chat ativo com suporte a anexo, resposta/citação e áudio (Item 1 e 2)
  // REGRA ESTRITA: A mensagem SÓ DEVE ser renderizada na lista do chat após a promessa do INSERT retornar sucesso no Supabase.
  const handleSendMessage = async (text, attachment = null, options = {}) => {
    const timeStr = getSaoPauloTime();

    // Limpa a notificação pendente do chat atual imediatamente
    clearUnread(activeChat.id);

    let initialStatus = 'delivered';
    if (activeChat.type === 'dm' && activeChat.id === 'u_ia_copilot') {
      initialStatus = 'read';
    } else if (activeChat.type === 'whatsapp' || currentChatKey.startsWith('wa-')) {
      initialStatus = 'sent';
    }

    // 1. DESATIVAÇÃO DE INTERCEPTAÇÃO DE TEXTO:
    // O texto deve ser estritamente bruto (raw), sem tradução, corte ou modificação de middleware.
    const rawText = String(text ?? '').trimEnd();

    const attMime = (attachment?.type || attachment?.mimetype || '').toLowerCase().trim();
    const isImageMsg = Boolean(
      attMime.startsWith('image/') ||
      (!attMime && attachment?.isImage) ||
      (!attMime && /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment?.name || ''))
    );

    const isAudioMsg = !isImageMsg && Boolean(
      attMime.startsWith('audio/') ||
      (options.isAudio && !attachment) ||
      (!attMime && attachment?.isAudio) ||
      (!attMime && /\.(webm|ogg|mp3|wav|m4a|opus)$/i.test(attachment?.name || ''))
    );

    // 0. BLINDAGEM DO SENDER_ID NA INSERÇÃO:
    // Validação estrita da sessão isolada por perfil ativo
    const activeUser = currentUserRef.current || currentUser;
    let verifiedSenderId = activeUser?.id || 'u1';
    let verifiedSenderName = activeUser?.name || 'Colaborador';

    try {
      const validSessionUser = await validateAndEvictMismatchedAuth(supabase, activeUser);
      if (validSessionUser?.id) {
        verifiedSenderId = validSessionUser.id;
      }
    } catch (authErr) {
      console.warn('[handleSendMessage] Falha ao verificar integridade da sessão:', authErr);
    }

    const messageId = 'm_' + Date.now();
    const newMsg = {
      id: messageId,
      chat_id: currentChatKey,
      chatId: currentChatKey,
      senderId: verifiedSenderId,
      sender_id: verifiedSenderId,
      senderName: verifiedSenderName,
      recipientId: activeChat.type === 'dm' ? activeChat.id : null,
      recipient_id: activeChat.type === 'dm' ? activeChat.id : null,
      created_at: new Date().toISOString(),
      text: rawText,
      timestamp: timeStr,
      attachment: attachment ? {
        ...attachment,
        isImage: isImageMsg,
        isAudio: isAudioMsg
      } : null,
      replyTo: options.replyTo || null,
      isAudio: isAudioMsg,
      isImage: isImageMsg,
      audioUrl: isAudioMsg ? (attachment?.url || attachment?.dataUrl || options.audioUrl || null) : null,
      duration: isAudioMsg ? (options.duration || attachment?.duration || '0:14') : null,
      status: 'sending', // Provisório imediato: animação de envio rápido
      actionExtracted: false,
    };

    // Monta o payload preservando o texto bruto e anexos sem qualquer formatação ou tradução prévia
    let payloadText = rawText;
    if (attachment) {
      payloadText = `${payloadText ? payloadText + '\n' : ''}[ARQUIVO_ANEXO:${JSON.stringify(newMsg.attachment)}]`;
    }
    if (options.replyTo) {
      payloadText = `${payloadText}\n<!-- REPLY_TO:${JSON.stringify(options.replyTo)} -->`;
    }

    const isWhatsAppChat = activeChat.type === 'whatsapp' || currentChatKey.startsWith('wa-');

    // =========================================================================
    // ATUALIZAÇÃO OTIMISTA (Optimistic UI - Zero-Freeze):
    // Insere a mensagem IMEDIATAMENTE no estado da tela com status provisório 'sending'.
    // O processamento de rede (Supabase / Evolution API) ocorre em background assincronamente.
    // =========================================================================
    setMessages((prev) => ({
      ...prev,
      [currentChatKey]: [...(prev[currentChatKey] || []), newMsg],
    }));

    if (isWhatsAppChat) {
      // Atualiza ordenação e última interação do contato de WhatsApp instantaneamente
      setWhatsAppContacts((prev) => {
        const existing = prev.find((c) => c.id === currentChatKey);
        if (!existing) return prev;
        const nowIso = new Date().toISOString();
        const updatedContact = {
          ...existing,
          lastInteraction: formatRelativeChatTime(nowIso),
          lastMessageAt: nowIso
        };
        const remaining = prev.filter((c) => c.id !== currentChatKey);
        return [updatedContact, ...remaining];
      });
    }

    // Processamento de rede em segundo plano (não bloqueia UI nem digitação)
    (async () => {
      // Blindagem adicional de integridade da sessão
      try {
        const validSessionUser = await validateAndEvictMismatchedAuth(supabase, activeUser);
        if (validSessionUser?.id) {
          verifiedSenderId = validSessionUser.id;
          verifiedSenderName = validSessionUser.name || verifiedSenderName;
        }
      } catch (authErr) {
        console.warn('[handleSendMessage] Falha ao verificar integridade da sessão:', authErr);
      }

      if (isWhatsAppChat) {
        const waContact = whatsAppContacts.find((c) => c.id === currentChatKey);
        const primaryTarget =
          waContact?.preferredTarget ||
          waContact?.remoteJidAlt ||
          waContact?.remoteJid ||
          waContact?.phone ||
          toWhatsAppTarget(currentChatKey.replace(/^wa-/, ''));
        const fallbackTarget =
          waContact?.remoteJid && waContact?.remoteJid !== primaryTarget
            ? waContact.remoteJid
            : (waContact?.remoteJidAlt && waContact?.remoteJidAlt !== primaryTarget ? waContact.remoteJidAlt : null);

        if (!primaryTarget) {
          const errorMsg = 'Destinatário do WhatsApp não encontrado ou número inválido.';
          console.error('[WhatsApp Send]', errorMsg);
          toast.error(errorMsg);
          setMessages((prev) => ({
            ...prev,
            [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
              m.id === messageId ? { ...m, status: 'error' } : m
            ),
          }));
          return;
        }

        if (!attachment && !!text) {
          try {
            const result = await sendWhatsAppText(primaryTarget, text, fallbackTarget);
            if (!result.ok || !result.messageId) {
              console.error('Falha ao enviar WhatsApp via Evolution API:', result.error);
              toast.error(`Falha ao enviar WhatsApp: ${result.error || 'Erro no envio'}`);
              setMessages((prev) => ({
                ...prev,
                [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                  m.id === messageId ? { ...m, status: 'error' } : m
                ),
              }));
              return;
            }

            const rawId = String(result.messageId);
            const realId = rawId.startsWith('wa_') ? rawId : 'wa_' + rawId;
            const updatedMsg = { ...newMsg, id: realId, senderId: verifiedSenderId, senderName: verifiedSenderName, status: 'sent' };

            setMessages((prev) => ({
              ...prev,
              [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                m.id === messageId ? updatedMsg : m
              ),
            }));

            const { error: waInsertError } = await supabase.from('messages').insert([{
              id: realId,
              chat_id: currentChatKey,
              sender_id: verifiedSenderId,
              sender_name: verifiedSenderName,
              text: payloadText,
              timestamp: updatedMsg.timestamp
            }]).select();

            if (waInsertError) {
              console.error("Erro no Insert WhatsApp:", waInsertError);
            }
          } catch (waErr) {
            console.error("Erro no envio WhatsApp:", waErr);
            toast.error(waErr.message || 'Erro de comunicação com o WhatsApp');
            setMessages((prev) => ({
              ...prev,
              [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                m.id === messageId ? { ...m, status: 'error' } : m
              ),
            }));
          }
        } else {
          try {
            const dmRecipientId = activeChat.type === 'dm' ? activeChat.id : null;
            const { error: insertError } = await supabase.from('messages').insert([{
              id: newMsg.id,
              chat_id: currentChatKey,
              sender_id: verifiedSenderId,
              sender_name: verifiedSenderName,
              recipient_id: dmRecipientId,
              text: payloadText,
              timestamp: newMsg.timestamp
            }]);

            if (insertError) {
              console.error("Erro no Insert:", insertError);
              toast.error(insertError.message || 'Erro no banco de dados');
              setMessages((prev) => ({
                ...prev,
                [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                  m.id === messageId ? { ...m, status: 'error' } : m
                ),
              }));
            } else {
              setMessages((prev) => ({
                ...prev,
                [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                  m.id === messageId ? { ...m, status: 'sent' } : m
                ),
              }));
            }
          } catch (dbErr) {
            console.error("Erro no Insert:", dbErr);
            toast.error(dbErr.message || 'Servidor indisponível');
            setMessages((prev) => ({
              ...prev,
              [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                m.id === messageId ? { ...m, status: 'error' } : m
              ),
            }));
          }
        }
      } else {
        // Chat Interno (Canais e DMs)
        try {
          const insertPayload = {
            id: newMsg.id,
            chat_id: currentChatKey,
            sender_id: verifiedSenderId,
            sender_name: verifiedSenderName,
            text: payloadText,
            timestamp: newMsg.timestamp
          };

          const isDmChat = activeChat.type === 'dm' || options.isDM;
          if (isDmChat) {
            const recId = activeChat.id || options.recipientId;
            if (recId) {
              insertPayload.recipient_id = recId;
            }
          }

          let { error: insertError } = await supabase.from('messages').insert([insertPayload]).select();

          if (
            insertError &&
            (insertError.message?.includes('recipient_id') ||
              insertError.code === 'PGRST204' ||
              insertError.message?.includes('schema cache'))
          ) {
            console.warn('[handleSendMessage] Retentando insert sem recipient_id devido ao schema cache:', insertError.message);
            delete insertPayload.recipient_id;
            const retryRes = await supabase.from('messages').insert([insertPayload]).select();
            insertError = retryRes.error;
          }

          if (insertError) {
            console.error("Erro no Insert:", insertError);
            toast.error(insertError.message || 'Erro no banco de dados');
            setMessages((prev) => ({
              ...prev,
              [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
                m.id === messageId ? { ...m, status: 'error' } : m
              ),
            }));
            return;
          }

          const confirmedMsg = {
            ...newMsg,
            senderId: verifiedSenderId,
            senderName: verifiedSenderName,
            status: initialStatus
          };

          setMessages((prev) => ({
            ...prev,
            [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
              m.id === messageId ? confirmedMsg : m
            ),
          }));

          publishInternalMessage(currentChatKey, confirmedMsg);
        } catch (error) {
          console.error("Erro no Insert:", error);
          toast.error(error?.message || 'Servidor indisponível');
          setMessages((prev) => ({
            ...prev,
            [currentChatKey]: (prev[currentChatKey] || []).map((m) =>
              m.id === messageId ? { ...m, status: 'error' } : m
            ),
          }));
        }
      }
    })();

    // GATILHO IA: Se for conversa com o Assistente IA ou menção @ia / @copilot
    const isIAChat = (activeChat?.type === 'dm' && activeChat?.id === 'u_ia_copilot');
    const isIAMention = text.toLowerCase().includes('@ia') || text.toLowerCase().includes('@copilot');

    if (isIAChat || isIAMention) {
      setTimeout(async () => {
        const cleanQuery = text.replace(/@(ia|copilot)\b/gi, '').trim();
        const queryText = cleanQuery || text;
        const isAdmin = isUserAdmin(currentUser);
        const isKanban = isKanbanIntent(queryText);
        const isBug = !isKanban && isBugReportIntent(queryText);

        // LOGS DE DEPURAÇÃO NO CONSOLE (F12)
        console.group('🤖 [EduChat AI Message Interceptor]');
        console.log('📝 Mensagem original:', text);
        console.log('🧹 Query limpa:', queryText);
        console.log('👤 Usuário ativo:', {
          id: currentUser?.id,
          name: currentUser?.name,
          role: currentUser?.role,
          roleType: currentUser?.roleType,
          isAdmin
        });
        console.log('🔍 Análise de Intenção:', {
          isKanbanIntent: isKanban,
          isBugReportIntent: isBug,
          isAdminUser: isAdmin,
          deveAcionarBugTracker: isAdmin && isBug,
          deveAcionarKanbanTool: isKanban
        });

        let replyText = '';

        // =========================================================================
        // 1. DESVIO CONDICIONAL: AI BUG TRACKER (Bypass de suporte apenas se NÃO for Kanban)
        // =========================================================================
        if (isAdmin && isBug) {
          console.log('🚨 [AI Bug Tracker] INTERCEPTAÇÃO ATIVADA: Desviando para Edge Function "ai-bug-tracker"...');
          replyText = '🛠️ Chamado técnico registrado com sucesso no banco de dados.';

          const bugEdgePayload = {
            message: queryText,
            user: {
              id: currentUser?.id || 'u1',
              name: currentUser?.name || 'Administrador',
              role: currentUser?.role || 'admin',
              roleType: currentUser?.roleType || 'diretor'
            }
          };

          try {
            console.log('📡 [AI Bug Tracker] Executando supabase.functions.invoke("ai-bug-tracker", { body })...', bugEdgePayload);
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-bug-tracker', {
              body: bugEdgePayload
            });

            console.log('📥 [AI Bug Tracker] Resposta recebida da Edge Function:', { edgeData, edgeError });

            if (!edgeError && edgeData) {
              if (edgeData.reply) replyText = edgeData.reply;
              console.log('✅ [AI Bug Tracker] Chamado gravado no banco pela Edge Function com sucesso:', edgeData.bug_report);
            } else {
              throw edgeError || new Error('Edge Function retornou sem dados');
            }
          } catch (fnErr) {
            console.warn('⚠️ [AI Bug Tracker] Edge Function falhou ou indisponível (' + fnErr.message + '). Executando fallback direto no banco de dados Supabase...');

            // Fallback imediato: insere diretamente na tabela bug_reports do Supabase
            const parsed = parseBugReport(queryText, currentUser);
            const fallbackRecord = {
              titulo: parsed.titulo_do_bug,
              problema: parsed.problema_relatado,
              solucao_esperada: parsed.solucao_esperada,
              prioridade: parsed.prioridade,
              status: 'aberto',
              reporter_name: currentUser?.name || 'Administrador',
              reporter_id: currentUser?.id || 'u1',
              raw_payload: parsed
            };

            const { data: dbData, error: dbErr } = await supabase.from('bug_reports').insert([fallbackRecord]).select();
            if (dbErr) {
              console.error('❌ [AI Bug Tracker] Erro ao gravar fallback na tabela bug_reports:', dbErr);
            } else {
              console.log('✅ [AI Bug Tracker] Chamado gravado com sucesso no Supabase via fallback direto:', dbData);
            }
          }

          // Backup persistente em localStorage
          try {
            const storedBugs = JSON.parse(localStorage.getItem('educhat_bug_reports') || '[]');
            storedBugs.unshift({
              id: 'bug_' + Date.now(),
              created_at: new Date().toISOString(),
              titulo: queryText.slice(0, 50),
              problema: queryText,
              reporter_name: currentUser?.name || 'Administrador'
            });
            localStorage.setItem('educhat_bug_reports', JSON.stringify(storedBugs));
          } catch (e) {
            console.error('Erro ao armazenar bug_report em localStorage:', e);
          }
        } else {
          // =========================================================================
          // 2. FLUXO REGULAR E TOOL CALLING: Google Gemini com Ferramenta 'create_kanban_cards'
          // =========================================================================
          console.log('💬 [AI Chat] Acionando API Oficial do Google Gemini com Function Calling (create_kanban_cards)...');
          let geminiResult = null;
          try {
            geminiResult = await generateGeminiChatReply({
              message: queryText,
              attachment,
              history: (messages[currentChatKey] || []).slice(-6),
              student: null,
              vipClients,
              learnedDocuments,
              pops,
              slas,
              customPrompt: customAIPrompt,
              department: currentUser?.department || 'Geral',
              userName: currentUser?.name || 'Consultor'
            });
          } catch (geminiErr) {
            console.warn('Aviso na chamada do Gemini:', geminiErr);
            geminiResult = '⚠️ Desculpe, os meus sistemas estão sobrecarregados no momento. Tente novamente em instantes.';
          }

          let createdCount = 0;

          // A. Processamento Direto de Chamada de Função (Tool Calling)
          if (geminiResult && typeof geminiResult === 'object' && geminiResult.isFunctionCall) {
            const fnName = geminiResult.functionCall?.name;
            const fnArgs = geminiResult.functionCall?.args || {};

            if (fnName === 'create_kanban_cards' && Array.isArray(fnArgs.cards) && fnArgs.cards.length > 0) {
              const liveCollabs = collaboratorsRef.current || collaborators || [];
              const rawCards = fnArgs.cards;
              const newCards = rawCards.map((c, idx) => {
                const matched = matchCollaboratorToTask(c.assignee || '', c.department || '', liveCollabs);
                const fullSource = `Solicitado via IA (${currentUser?.name || 'Gestão'}): "${queryText.slice(0, 100)}"`;
                const cDate = new Date().toISOString();
                return {
                  id: `t_ia_${Date.now()}_${idx}`,
                  title: (c.title || 'Demanda Kanban').slice(0, 70),
                  desc: c.description || c.title || '',
                  status: 'backlog',
                  priority: ['alta', 'media', 'baixa', 'vip'].includes(String(c.priority || '').toLowerCase())
                    ? String(c.priority).toLowerCase()
                    : 'media',
                  isVip: Boolean(c.isVip || c.priority === 'vip'),
                  assignee: matched.assignee,
                  assigneeId: matched.assigneeId,
                  assigneeEmail: matched.assigneeEmail,
                  assigneeAvatar: matched.assigneeAvatar || '👤',
                  department: matched.department || 'Geral',
                  dueDate: c.dueDate || 'Em até 48h',
                  channel: '📌 Assistente IA',
                  sourceMessage: fullSource,
                  requester: currentUser?.name || 'Diretoria',
                  requesterDept: currentUser?.department || 'Diretoria',
                  created_at: cDate,
                  createdAt: cDate,
                  comments: [],
                  attachments: []
                };
              });

              // Atualiza o estado do Kanban e persiste no Supabase (tabela tasks / view kanban_cards)
              setTasks((prev) => [...newCards, ...prev]);
              createdCount = newCards.length;

              const dbRows = newCards.map((c) => {
                const metaPayload = JSON.stringify({
                  comments: [],
                  attachments: [],
                  assigneeId: c.assigneeId || null,
                  assigneeEmail: c.assigneeEmail || ''
                });
                return {
                  id: c.id,
                  title: c.title,
                  description: `${c.desc || ''}\n<!-- TASK_META:${metaPayload} -->`,
                  status: c.status,
                  priority: c.priority,
                  is_vip: c.isVip,
                  assignee: c.assignee,
                  assignee_avatar: c.assigneeAvatar,
                  department: c.department,
                  due_date: c.dueDate,
                  channel: c.channel,
                  source_message: c.sourceMessage,
                  created_at: c.created_at
                };
              });

              supabase.from('tasks').insert(dbRows).then(({ error }) => {
                if (error) console.warn('Erro ao inserir cards do Kanban gerados pela IA no Supabase:', error);
              });

              replyText = `✨ [Kanban] ${newCards.length} cartão(ões) criado(s) com sucesso no seu quadro Kanban:\n\n` +
                newCards.map((t) => `• 📌 **${t.title}** (Setor: ${t.department} | Responsável: ${t.assignee} | Prazo: ${t.dueDate})`).join('\n') +
                `\n\nTodos os cards foram inseridos na tabela **kanban_cards** e já aparecem na coluna **Pendente / A Fazer**!`;
            } else if (fnName === 'create_technical_ticket') {
              replyText = '🛠️ Chamado técnico registrado com sucesso no banco de dados.';
              const fallbackRecord = {
                titulo: (fnArgs.title || queryText).slice(0, 60),
                problema: fnArgs.problem || queryText,
                solucao_esperada: fnArgs.expectedSolution || 'Investigar e corrigir falha técnica.',
                prioridade: fnArgs.priority || 'media',
                status: 'aberto',
                reporter_name: currentUser?.name || 'Administrador',
                reporter_id: currentUser?.id || 'u1'
              };
              supabase.from('bug_reports').insert([fallbackRecord]).select();
            } else if (fnName === 'consultar_operacao_educontrol') {
              const rawTermo = (fnArgs.termo_busca || queryText || '').trim();
              const cleanTermo = rawTermo.replace(/^(?:alun[oa]|estudante|polo|consultor|curso|status)\s*[:\-]?\s*(?:d[eoa]\s+)?/i, '').trim();
              const termo = cleanTermo || rawTermo;
              const cleanDigits = termo.replace(/\D/g, '');
              const isCpf = cleanDigits.length >= 9 && cleanDigits.length <= 11;

              try {
                // 1. Busca aluno com suporte a nomes parciais, nomes do meio, unaccent e ILIKE
                let alData = [];
                if (isCpf) {
                  const fmtDots = cleanDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3.$4');
                  const fmtDash = cleanDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                  const { data } = await supabase
                    .from('alunos')
                    .select('*')
                    .or(`cpf.ilike.%${cleanDigits}%,cpf.ilike.%${fmtDots}%,cpf.ilike.%${fmtDash}%`)
                    .limit(3);
                  if (Array.isArray(data) && data.length > 0) alData = data;

                  if (alData.length === 0) {
                    try {
                      const { data: rpcData } = await supabase.rpc('buscar_alunos_flexivel', { termo: cleanDigits });
                      if (Array.isArray(rpcData) && rpcData.length > 0) alData = rpcData;
                    } catch (e) {
                      console.warn('[EduControl] Erro na RPC buscar_alunos_flexivel (CPF):', e);
                    }
                  }
                }

                if (alData.length === 0) {
                  try {
                    const { data: rpcData } = await supabase.rpc('buscar_alunos_flexivel', { termo: isCpf ? cleanDigits : termo });
                    if (Array.isArray(rpcData) && rpcData.length > 0) alData = rpcData;
                  } catch (e) {
                    console.warn('[EduControl] Erro na RPC buscar_alunos_flexivel:', e);
                  }
                }

                if (alData.length === 0) {
                  const { data: directData } = await supabase.from('alunos').select('*').or(`nome_completo.ilike.%${termo}%,email.ilike.%${termo}%,telefone.ilike.%${termo}%`).limit(3);
                  if (Array.isArray(directData) && directData.length > 0) alData = directData;
                }

                if (alData.length === 0) {
                  const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'aluno', 'aluna', 'consultar', 'verificar', 'status', 'dados']);
                  const tokens = termo.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w.toLowerCase()));
                  if (tokens.length >= 1) {
                    let q = supabase.from('alunos').select('*');
                    for (const t of tokens) {
                      q = q.ilike('nome_completo', `%${t}%`);
                    }
                    const { data: tokenData } = await q.limit(3);
                    if (Array.isArray(tokenData) && tokenData.length > 0) alData = tokenData;
                  }
                }

                if (alData && alData.length > 0) {
                  alData.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
                  const al = alData[0];
                  const allStudentIds = Array.from(new Set(alData.map((a) => a.id)));
                  const { data: mats } = await supabase
                    .from('matriculas')
                    .select('*')
                    .in('student_id', allStudentIds)
                    .order('created_date', { ascending: false });
                  const { data: polo } = al.hub_id ? await supabase.from('polos').select('*').eq('id', al.hub_id).maybeSingle() : { data: null };

                  replyText = `🎓 **Aluno Localizado:** ${al.nome_completo}\n` +
                    `• **CPF:** ${al.cpf || 'Não informado'} | **E-mail:** ${al.email || 'Não informado'}\n` +
                    `• **Telefone:** ${al.telefone || 'Não informado'}\n` +
                    (polo ? `• **Polo:** ${polo.nome_exibicao || polo.razao_social} (${polo.polo_uf || '-'})\n` : '') +
                    (mats && mats.length > 0
                      ? `\n📚 **Matrículas / Processos (${mats.length}):**\n` + mats.map((m) => `  - **${m.nome_curso}** — Status: **${m.status}**${m.codigo_verificacao ? ` (Cód: \`${m.codigo_verificacao}\`)` : ''}`).join('\n')
                      : '\nℹ️ Aluno com cadastro preliminar (nenhuma matrícula registrada ainda).');
                } else {
                  // 2. Busca polo
                  const { data: poloData } = await supabase.from('polos').select('*').or(`razao_social.ilike.%${termo}%,nome_exibicao.ilike.%${termo}%,cnpj.ilike.%${termo}%`).limit(1);
                  if (poloData && poloData.length > 0) {
                    const p = poloData[0];
                    replyText = `🏛️ **Polo Localizado:** ${p.nome_exibicao || p.razao_social}\n` +
                      `• **Cidade/UF:** ${p.polo_nome_municipio || '-'} / ${p.polo_uf || '-'}\n` +
                      `• **CNPJ:** ${p.cnpj || 'Não informado'} | **Contato:** ${p.nome_contato || '-'}\n` +
                      `• **Regime:** ${p.regime_cobranca || 'fatura_vaga'} | **Saldo:** R$ ${Number(p.saldo_disponivel || 0).toFixed(2)}`;
                  } else {
                    replyText = `🔍 Não localizei nenhum registro de aluno, polo ou matrícula com o termo **"${termo}"** nas vistas do Supabase.`;
                  }
                }
              } catch (opErr) {
                console.warn('Erro ao consultar operação via Tool:', opErr);
                replyText = `⚠️ Ocorreu um erro ao consultar o Supabase: ${opErr.message}`;
              }
            }
          }

          // B. Fallback Inteligente: Se o usuário expressou intenção de Kanban mas a resposta foi texto
          if (!createdCount) {
            const rawTextResult = typeof geminiResult === 'string' ? geminiResult : (geminiResult?.text || '');
            if (isKanban) {
              const fallbackCards = parseKanbanCardsFromText(`${queryText}\n${rawTextResult}`, collaboratorsRef.current || collaborators);
              if (fallbackCards.length > 0) {
                const liveCollabs = collaboratorsRef.current || collaborators || [];
                const newCards = fallbackCards.map((c, idx) => {
                  const matched = matchCollaboratorToTask(c.assignee || '', c.department || '', liveCollabs);
                  const fullSource = `Solicitado via IA (${currentUser?.name || 'Gestão'}): "${queryText.slice(0, 100)}"`;
                  const cDate = new Date().toISOString();
                  return {
                    id: `t_ia_${Date.now()}_${idx}`,
                    title: (c.title || 'Demanda Kanban').slice(0, 70),
                    desc: c.description || c.title || '',
                    status: 'backlog',
                    priority: c.priority || 'media',
                    isVip: Boolean(c.isVip || c.priority === 'vip'),
                    assignee: matched.assignee,
                    assigneeId: matched.assigneeId,
                    assigneeEmail: matched.assigneeEmail,
                    assigneeAvatar: matched.assigneeAvatar || '👤',
                    department: matched.department || 'Geral',
                    dueDate: c.dueDate || 'Em até 48h',
                    channel: '📌 Assistente IA',
                    sourceMessage: fullSource,
                    requester: currentUser?.name || 'Diretoria',
                    requesterDept: currentUser?.department || 'Diretoria',
                    created_at: cDate,
                    createdAt: cDate,
                    comments: [],
                    attachments: []
                  };
                });

                setTasks((prev) => [...newCards, ...prev]);

                const dbRows = newCards.map((c) => ({
                  id: c.id,
                  title: c.title,
                  description: c.desc,
                  status: c.status,
                  priority: c.priority,
                  is_vip: c.isVip,
                  assignee: c.assignee,
                  assignee_avatar: c.assigneeAvatar,
                  department: c.department,
                  due_date: c.dueDate,
                  channel: c.channel,
                  source_message: c.sourceMessage,
                  created_at: c.created_at
                }));
                supabase.from('tasks').insert(dbRows).then(({ error }) => {
                  if (error) console.warn('Erro ao inserir cards no Supabase:', error);
                });

                replyText = `✨ [Kanban] ${newCards.length} cartão(ões) criado(s) com sucesso no seu quadro Kanban:\n\n` +
                  newCards.map((t) => `• 📌 **${t.title}** (Setor: ${t.department} | Responsável: ${t.assignee} | Prazo: ${t.dueDate})`).join('\n') +
                  `\n\nTodos os cards foram adicionados à tabela **kanban_cards** no quadro operacional!`;
              } else {
                replyText = rawTextResult;
              }
            } else {
              replyText = rawTextResult;
            }
          }

          // C. Tratamento Visual de Erros Globais
          if (
            !replyText ||
            replyText.includes('models/') ||
            replyText.includes('is not found') ||
            replyText.includes('404') ||
            replyText.includes('429') ||
            replyText.includes('500') ||
            replyText.includes('GEMINI_ERROR') ||
            replyText.includes('FetchError') ||
            replyText.includes('Failed to fetch') ||
            replyText.includes('Cannot read')
          ) {
            replyText = '⚠️ Desculpe, os meus sistemas estão sobrecarregados no momento. Tente novamente em instantes.';
          }
          console.log('🤖 [AI Chat] Resposta final da IA:', replyText.slice(0, 100) + '...');
        }
        console.groupEnd();

        const aiReply = {
          id: 'ia_' + Date.now(),
          senderId: 'u_ia_copilot',
          senderName: 'Assistente IA (MEC & Processos)',
          text: replyText,
          timestamp: getSaoPauloTime(),
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
      }, 500);
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
      if (contact && (contact.status === 'ura_inedito' || contact.status === 'veterano_retencao' || !contact.assignee)) {
        const triageResult = processTriageResponse(text, contact.status, channels, collaborators, lastAssignmentMapRef.current);
        if (triageResult) {
          if (triageResult.assigned_to) {
            lastAssignmentMapRef.current[triageResult.assigned_to] = Date.now();
            try {
              localStorage.setItem('educhat_round_robin_history', JSON.stringify(lastAssignmentMapRef.current));
            } catch {}
          }

          handleUpdateChatAssignment(contact.id, {
            department: triageResult.department,
            assignee: triageResult.assignee,
            assigned_to: triageResult.assigned_to,
            status: triageResult.assigned_to ? 'carteira_ativa' : 'fila_departamento',
            statusLabel: triageResult.assigned_to ? `Atendimento • ${triageResult.assignee}` : `Fila • ${triageResult.department}`
          });

          setTimeout(() => {

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
              timestamp: getSaoPauloTime(),
              isWhatsApp: true,
              fromStudent: false,
              taskId: newTask.id
            };

            setMessages((prev) => ({
              ...prev,
              [currentChatKey]: [...(prev[currentChatKey] || []), botReply]
            }));

            // Notifica EXCLUSIVAMENTE o consultor do setor designado para a carteira
            const isMyAssignment =
              (triageResult.assigned_to && String(triageResult.assigned_to).toLowerCase() === String(currentUser.id).toLowerCase()) ||
              (currentUser.name && normalizeName(currentUser.name) === normalizeName(triageResult.assignee));
            if (isMyAssignment) {
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

    return { success: true, message: newMsg };
  };

  // 3. ENCAMINHAMENTO DE MENSAGENS NO CHAT INTERNO (Estilo WhatsApp)
  const handleForwardMessage = async (originalMessage, target) => {
    if (!originalMessage || !target) return { success: false, error: 'Dados inválidos' };

    const timeStr = getSaoPauloTime();
    const rawText = originalMessage.text || '';
    const cleanText = rawText
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
      .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
      .replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '')
      .trim();

    const originalSender = originalMessage.senderName || 'Colega';

    let attachment = originalMessage.attachment || null;
    if (!attachment && rawText.includes('[ARQUIVO_ANEXO:')) {
      const extracted = extractAttachmentFromText(rawText);
      if (extracted?.attachment) {
        attachment = extracted.attachment;
      }
    }

    const isImage = Boolean(
      originalMessage.isImage ||
      attachment?.isImage ||
      attachment?.type?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment?.name || '')
    );

    const isAudio = !isImage && Boolean(
      originalMessage.isAudio ||
      attachment?.isAudio ||
      attachment?.type?.startsWith('audio/') ||
      /\.(ogg|opus|mp3|wav|webm|m4a)$/i.test(attachment?.name || '') ||
      rawText.includes('<!-- AUDIO_URL:')
    );

    let audioUrl = null;
    if (isAudio) {
      audioUrl = originalMessage.audioUrl || attachment?.url || attachment?.dataUrl || null;
      if (!audioUrl && rawText.includes('<!-- AUDIO_URL:')) {
        const match = rawText.match(/<!-- AUDIO_URL:([\s\S]+?) -->/);
        if (match) audioUrl = match[1].trim();
      }
    }

    let duration = originalMessage.duration || attachment?.duration || '0:14';

    let baseText = cleanText;
    if (isAudio && !baseText) {
      baseText = '🎙️ Mensagem de voz';
    }

    let payloadText = baseText || '';
    if (attachment) {
      payloadText = `${payloadText ? payloadText + '\n' : ''}[ARQUIVO_ANEXO:${JSON.stringify(attachment)}]`;
    }
    if (isAudio && audioUrl) {
      payloadText = `${payloadText}\n<!-- AUDIO_URL:${audioUrl} -->\n<!-- IS_AUDIO:true -->`;
      if (duration) {
        payloadText = `${payloadText}\n<!-- DURATION:${duration} -->`;
      }
    }

    // Metadados explícitos de encaminhamento
    payloadText = `${payloadText}\n<!-- FORWARDED:true -->\n<!-- FORWARDED_FROM:${JSON.stringify(originalSender)} -->`;

    // BLINDAGEM DO SENDER_ID NO ENCAMINHAMENTO:
    // Validação estrita da sessão isolada por perfil ativo
    const activeUser = currentUserRef.current || currentUser;
    let verifiedSenderId = activeUser?.id || 'u1';
    let verifiedSenderName = activeUser?.name || 'Colaborador';

    try {
      const validSessionUser = await validateAndEvictMismatchedAuth(supabase, activeUser);
      if (validSessionUser?.id) {
        verifiedSenderId = validSessionUser.id;
      }
    } catch (authErr) {
      console.warn('[handleForwardMessage] Falha ao verificar integridade da sessão:', authErr);
    }

    const targetType = target.type; // 'channel' | 'dm'
    const targetId = target.id;
    let targetChatKey = '';
    let recipientId = null;

    if (targetType === 'channel') {
      targetChatKey = targetId.startsWith('c-') ? targetId : `c-${targetId}`;
      recipientId = null;
    } else {
      targetChatKey = getChatKey({ type: 'dm', id: targetId }, verifiedSenderId);
      recipientId = targetId;
    }

    const newId = 'fwd_' + Date.now();
    const dbRecord = {
      id: newId,
      chat_id: targetChatKey,
      sender_id: verifiedSenderId,
      sender_name: verifiedSenderName,
      text: payloadText,
      timestamp: timeStr
    };

    if (targetType === 'channel') {
      dbRecord.channel_id = targetChatKey;
    } else if (recipientId) {
      dbRecord.recipient_id = recipientId;
      // Para DMs, omite channel_id
    }

    // SÓ ADICIONA NO ESTADO APÓS CONFIRMAÇÃO DE SUCESSO NO BANCO (Fim da inserção otimista)
    try {
      let { error: insertError } = await supabase
        .from('messages')
        .insert([dbRecord])
        .select();

      // Fallback se channel_id ou recipient_id não existirem no schema cache
      if (
        insertError &&
        (insertError.message?.includes('channel_id') ||
          insertError.code === 'PGRST204' ||
          insertError.message?.includes('schema cache'))
      ) {
        console.warn('[handleForwardMessage] Retentando sem channel_id devido ao schema cache:', insertError.message);
        delete dbRecord.channel_id;
        const retryRes = await supabase.from('messages').insert([dbRecord]).select();
        insertError = retryRes.error;
      }

      if (
        insertError &&
        (insertError.message?.includes('recipient_id') ||
          insertError.code === 'PGRST204' ||
          insertError.message?.includes('schema cache'))
      ) {
        console.warn('[handleForwardMessage] Retentando sem recipient_id devido ao schema cache:', insertError.message);
        delete dbRecord.recipient_id;
        const retryRes = await supabase.from('messages').insert([dbRecord]).select();
        insertError = retryRes.error;
      }

      if (insertError) {
        console.error('[Encaminhar] Erro no Supabase:', insertError);
        toast.error(`Falha ao encaminhar: ${insertError.message || 'Erro no banco'}`);
        return { success: false, error: insertError };
      }
    } catch (err) {
      console.error('[Encaminhar] Exceção de rede:', err);
      toast.error('Erro de conexão ao encaminhar mensagem');
      return { success: false, error: err };
    }

    const forwardedMsg = {
      id: newId,
      senderId: verifiedSenderId,
      senderName: verifiedSenderName,
      recipientId: recipientId,
      text: baseText,
      timestamp: timeStr,
      created_at: new Date().toISOString(),
      attachment,
      isAudio,
      audioUrl,
      duration,
      isImage,
      isForwarded: true,
      forwardedFrom: originalSender,
      status: 'delivered',
      actionExtracted: false
    };

    // Sincroniza no cache de mensagens da conversa de destino
    setMessages((prev) => ({
      ...prev,
      [targetChatKey]: [...(prev[targetChatKey] || []), forwardedMsg]
    }));

    // Dispara relay em tempo real para os outros colaboradores
    publishInternalMessage(targetChatKey, forwardedMsg);

    toast.success(`Mensagem encaminhada para ${target.name || 'o destino'}!`);
    return { success: true };
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

  // Exclusão em Massa de Cards no Kanban
  const handleDeleteTasksBatch = async (taskIds = []) => {
    if (!taskIds || taskIds.length === 0) return;
    const ids = taskIds.map(String);
    setTasks((prev) => prev.filter((t) => !ids.includes(String(t.id))));
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', ids);
    if (error) {
      console.warn('Erro ao excluir tarefas em lote no Supabase:', error);
    }
  };

  // Excluir mensagem do chat e do Supabase (Item 2)
  const handleDeleteMessage = async (messageId) => {
    if (!messageId) return;

    const confirmDelete = window.confirm('Deseja realmente excluir esta mensagem permanentemente da conversa?');
    if (!confirmDelete) return;

    // 1. Atualização Otimista local instantânea na UI
    setMessages((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (next[key]?.some((m) => m.id === messageId)) {
          next[key] = next[key].filter((m) => m.id !== messageId);
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    // 2. Remoção na tabela 'messages' do Supabase (dispara Realtime DELETE)
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.warn('Erro ao excluir mensagem no Supabase:', error);
      }
    } catch (err) {
      console.error('Falha na requisição de exclusão de mensagem:', err);
    }
  };

  // Excluir conversa inteira / limpar histórico do chat no Supabase e na UI (Item 3)
  const handleDeleteChat = async (chatId) => {
    if (!chatId) return;

    const confirmDelete = window.confirm('Deseja realmente excluir todo o histórico desta conversa permanentemente?');
    if (!confirmDelete) return;

    const cKey = normalizeChatKey(chatId, currentUser?.id || 'u1');

    // 1. Atualização Otimista local instantânea na UI
    setMessages((prev) => {
      const next = { ...prev };
      delete next[chatId];
      delete next[cKey];
      return next;
    });

    if (chatId.startsWith('wa-')) {
      setWhatsAppContacts((prev) => prev.filter((c) => c.id !== chatId && c.id !== cKey));
    }

    // 2. Remoção na tabela 'messages' do Supabase
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`chat_id.eq.${chatId},chat_id.eq.${cKey}`);

      if (error) {
        console.warn('Erro ao excluir histórico de mensagens no Supabase:', error);
      }
    } catch (err) {
      console.error('Falha na requisição de exclusão de conversa:', err);
    }
  };

  // Iniciar ativamente nova conversa WhatsApp com número inédito (Novo Atendimento)
  const handleStartNewWhatsAppChat = async ({
    rawPhone,
    canonicalPhone,
    chatId,
    contactName,
    department,
    firstMessage
  }) => {
    const timeStr = getSaoPauloTime();

    // 1. Dispara o envio inicial pela Evolution API
    const result = await sendWhatsAppText(canonicalPhone, firstMessage);
    if (!result.ok) {
      throw new Error(result.error || 'Falha ao disparar mensagem pela Evolution API.');
    }

    const rawId = String(result.messageId || Date.now());
    const realMessageId = rawId.startsWith('wa_') ? rawId : 'wa_' + rawId;

    // 2. Cria o novo contato na carteira ativa
    const newContact = {
      id: chatId,
      name: contactName || `WhatsApp (+${canonicalPhone})`,
      phone: `+${canonicalPhone}`,
      avatar: '👤',
      department: department || 'Comercial',
      assignee: currentUser?.name || 'Gabriel Carvalho',
      assignees: [currentUser?.name || 'Gabriel Carvalho'],
      status: 'carteira_ativa',
      statusLabel: 'Em Atendimento',
      aiActive: false,
      lastInteraction: formatRelativeChatTime(new Date()),
      lastMessageAt: new Date().toISOString(),
      triageContext: `Atendimento ativo iniciado por ${currentUser?.name || 'Operador'}`,
      unread_count: 0,
      unread: 0,
      remoteJid: `${canonicalPhone}@s.whatsapp.net`,
      preferredTarget: `${canonicalPhone}@s.whatsapp.net`
    };

    // 3. Cria a primeira mensagem enviada
    const initialMsg = {
      id: realMessageId,
      senderId: currentUser?.id || 'u1',
      senderName: currentUser?.name || 'Você',
      text: firstMessage,
      timestamp: timeStr,
      status: 'sent',
      actionExtracted: false
    };

    // 4. Grava no Supabase via upsert idempotente
    const payloadText = `${firstMessage}\n<!-- STATUS:sent -->`;
    try {
      const { error: upsertErr } = await supabase.from('messages').upsert([{
        id: realMessageId,
        chat_id: chatId,
        sender_id: currentUser?.id || 'u1',
        sender_name: currentUser?.name || 'Você',
        text: payloadText,
        timestamp: timeStr
      }], { onConflict: 'id' });

      if (upsertErr) {
        console.error('Falha ao sincronizar mensagem no Supabase:', upsertErr);
        toast.error(`Falha ao registrar mensagem no banco: ${upsertErr.message || 'Erro no Supabase'}`);
        throw upsertErr;
      }

      try {
        await supabase.from('chats').upsert([{
          id: chatId,
          phone: canonicalPhone,
          last_message: firstMessage,
          updated_at: new Date().toISOString()
        }], { onConflict: 'id' });
      } catch {}
    } catch (dbErr) {
      console.error('Erro ao sincronizar novo contato no Supabase:', dbErr);
      throw dbErr;
    }

    // 5. Atualiza o estado da interface imediatamente
    setWhatsAppContacts((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId && getCanonicalPhoneKey(c) !== canonicalPhone);
      return [newContact, ...filtered];
    });

    setMessages((prev) => {
      const existingList = prev[chatId] || [];
      const filtered = existingList.filter((m) => m.id !== realMessageId);
      return {
        ...prev,
        [chatId]: [...filtered, initialMsg]
      };
    });

    // 6. Seleciona o novo contato e abre o chat
    setActiveChat({ type: 'whatsapp', id: chatId });
    setActiveView('chat');
  };

  // Alternar atendimento IA vs Humano em contatos WhatsApp
  const handleToggleWhatsAppAI = (contactId) => {
    setWhatsAppContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, aiActive: !c.aiActive } : c))
    );
  };

  // Processador Central do Webhook de WhatsApp (Simulador & Produção)
  const handleWhatsAppWebhookEvent = ({ fromPhone, senderName, messageText, isAudio, audioTranscription, contactId, audioUrl, duration }) => {
    const routingResult = routeIncomingWhatsAppWebhook({
      fromPhone,
      senderName,
      messageText,
      tasks,
      collaborators,
      contacts: whatsAppContacts,
      channels
    });

    const targetChatId = contactId || (whatsAppContacts.find(c => c.phone.replace(/\D/g, '') === fromPhone.replace(/\D/g, ''))?.id) || 'wa-carlos-eduardo';
    const timeStr = getSaoPauloTime();

    let finalAudioUrl = audioUrl || null;
    let finalDuration = duration || '0:14';
    let cleanMessageText = messageText || '';
    let parsedAttachment = null;

    if (cleanMessageText.includes('[ARQUIVO_ANEXO:')) {
      const { attachment: extracted, cleanText: sanitized } = extractAttachmentFromText(cleanMessageText);
      if (extracted) {
        parsedAttachment = extracted;
        if (!finalAudioUrl && (parsedAttachment.dataUrl || parsedAttachment.url)) {
          finalAudioUrl = parsedAttachment.dataUrl || parsedAttachment.url;
        }
        if (parsedAttachment.duration) {
          finalDuration = parsedAttachment.duration;
        }
      }
      cleanMessageText = sanitized;
    }

    if (!finalAudioUrl && cleanMessageText) {
      const match = cleanMessageText.match(/<!-- AUDIO_URL:([\s\S]+?) -->/);
      if (match) finalAudioUrl = match[1].trim();
    }
    const isAudioMsg = !!isAudio || cleanMessageText.includes('🎙️') || !!finalAudioUrl || !!parsedAttachment?.isAudio || !!parsedAttachment?.type?.startsWith('audio/');

    const incomingMsg = {
      id: 'wa_in_' + Date.now(),
      senderId: targetChatId,
      senderName: senderName || 'Lead WhatsApp',
      text: cleanMessageText,
      timestamp: timeStr,
      attachment: parsedAttachment,
      isWhatsApp: true,
      fromStudent: true,
      isAudio: isAudioMsg,
      audioUrl: finalAudioUrl,
      duration: finalDuration,
      audioTranscription: audioTranscription || null
    };

    setMessages((prev) => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), incomingMsg]
    }));

    // Trava de Carteira Ativa: Apenas o consultor responsável é notificado!
    const isMyLead =
      (routingResult.targetAssignee && normalizeName(routingResult.targetAssignee) === normalizeName(currentUser.name)) ||
      (routingResult.assigned_to && String(routingResult.assigned_to).toLowerCase() === String(currentUser.id).toLowerCase());
    if (isMyLead) {
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
          timestamp: getSaoPauloTime(),
          isWhatsApp: true,
          fromStudent: false,
          isTriageMenu: true
        };
        setMessages((prev) => ({
          ...prev,
          [targetChatId]: [...(prev[targetChatId] || []), replyMsg]
        }));
      }, 700);
    } else {
      // Se não gerou menu fixo de URA e a IA deve assumir (fora de expediente ou aiActive ativo)
      const targetContact = whatsAppContacts.find((c) => c.id === targetChatId);
      const timeInfo = getBrasiliaTime();
      const shouldAIAssume = routingResult.aiActive || routingResult.routeType === 'AFTER_HOURS_AI' || timeInfo.isAfterHours || targetContact?.aiActive;

      if (shouldAIAssume) {
        setTimeout(async () => {
          try {
            const matchedStudent = matchStudentByPhone(targetChatId, eduControlStudents);
            const chatHistory = (messages[targetChatId] || []).slice(-10);
            const geminiReply = await generateGeminiChatReply({
              message: cleanMessageText,
              history: chatHistory,
              student: matchedStudent,
              vipClients,
              learnedDocuments,
              pops,
              slas,
              customPrompt: customAIPrompt,
              department: targetContact?.department || 'Geral',
              userName: senderName || targetContact?.name
            });

            const botMsg = {
              id: 'gemini_' + Date.now(),
              senderId: 'u_ia_copilot',
              senderName: '🤖 Assistente IA (Gemini)',
              text: geminiReply,
              timestamp: getSaoPauloTime(),
              isWhatsApp: true,
              fromStudent: false
            };

            setMessages((prev) => ({
              ...prev,
              [targetChatId]: [...(prev[targetChatId] || []), botMsg]
            }));

            // Envia a resposta de volta para o WhatsApp do aluno
            const waPhone = targetContact?.preferredTarget || targetContact?.phone || fromPhone || targetChatId.replace(/^wa-/, '');
            if (waPhone) {
              sendWhatsAppText(waPhone, geminiReply).then((res) => {
                if (res.ok) {
                  console.log('✅ [WhatsApp] Resposta da IA enviada via Evolution API para:', waPhone);
                } else {
                  console.warn('⚠️ [WhatsApp] Falha ao enviar resposta da IA para:', waPhone, res.error);
                }
              }).catch(() => {});
            }

            supabase.from('messages').insert([{
              id: botMsg.id,
              chat_id: targetChatId,
              sender_id: botMsg.senderId,
              sender_name: botMsg.senderName,
              text: botMsg.text,
              timestamp: botMsg.timestamp
            }]).then(({ error }) => {
              if (error) console.warn('Erro ao persistir resposta Gemini:', error);
            });
          } catch (err) {
            console.warn('Erro ao responder com Gemini no Webhook:', err);
          }
        }, 800);
      }
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

    const timeStr = getSaoPauloTime();
    const commentObj = {
      id: 'c_' + Date.now(),
      author: currentUser.name,
      avatar: currentUser.avatar,
      dept: currentUser.department,
      text: `🔄 Demanda delegada para ${newCollab.name} (${newCollab.department}) por ${currentUser.name}.`,
      timestamp: `${timeStr} - ${new Date().toLocaleDateString('pt-BR')}`
    };

    handleUpdateTaskDetails(taskId, {
      assignee: newCollab.name,
      assigneeId: newCollab.id,
      assigneeEmail: newCollab.email || '',
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
    const timeStr = getSaoPauloTime();
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
    const normId = String(taskId);
    setTasks((prev) =>
      prev.map((t) => (String(t.id) === normId ? { ...t, status: newStatus } : t))
    );
    supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', normId)
      .then(({ error }) => {
        if (error) console.warn('Erro ao atualizar status da tarefa no Supabase:', error);
      });
  };

  // Atualizar dados completos da tarefa (comentários, anexos, transferência de departamento, etc.)
  const handleUpdateTaskDetails = (taskId, partial) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = { ...t, ...partial };
        const metaPayload = JSON.stringify({
          comments: updated.comments || [],
          attachments: updated.attachments || [],
          assigneeId: updated.assigneeId || null,
          assigneeEmail: updated.assigneeEmail || ''
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
            assignee_avatar: updated.assigneeAvatar || '👤',
            department: updated.department || 'Geral',
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

    const createdAtIso = newTask.created_at || newTask.createdAt || new Date().toISOString();
    const completeTask = {
      ...newTask,
      requester: taskRequester,
      requesterDept: taskRequesterDept,
      sourceMessage: fullSourceMessage,
      created_at: createdAtIso,
      createdAt: createdAtIso,
      comments: [],
      attachments: []
    };

    setTasks((prev) => [completeTask, ...prev]);

    const metaPayload = JSON.stringify({
      comments: [],
      attachments: [],
      assigneeId: completeTask.assigneeId || null,
      assigneeEmail: completeTask.assigneeEmail || ''
    });
    const serializedDesc = `${completeTask.desc || ''}\n<!-- TASK_META:${metaPayload} -->`;

    supabase.from('tasks').insert([{
      id: completeTask.id,
      title: completeTask.title,
      description: serializedDesc,
      status: completeTask.status || 'backlog',
      priority: completeTask.priority || 'media',
      is_vip: completeTask.isVip || false,
      assignee: completeTask.assignee,
      assignee_avatar: completeTask.assigneeAvatar || '👤',
      department: completeTask.department || 'Geral',
      due_date: completeTask.dueDate,
      channel: completeTask.channel,
      source_message: fullSourceMessage,
      created_at: createdAtIso
    }]).then(({ error }) => {
      if (error) console.warn('Erro ao salvar nova tarefa no Supabase:', error);
    });
  };

  // Criação em Lote de Tarefas Extraídas de Atas do Google Meet (gemini-notes@google.com)
  const handleCreateMeetTasksBatch = async (cardsToCreate = []) => {
    if (!cardsToCreate || cardsToCreate.length === 0) return;
    const taskRequester = currentUser?.name || 'Diretoria (Google Meet)';
    const taskRequesterDept = currentUser?.department || 'Diretoria';

    const completeCards = cardsToCreate.map((card) => {
      const fullSourceMessage = `Solicitado por: ${taskRequester} (${taskRequesterDept}) • ${card.sourceMessage || 'Ata Google Meet'}`;
      const cDate = card.created_at || card.createdAt || new Date().toISOString();
      return {
        ...card,
        status: 'backlog',
        requester: taskRequester,
        requesterDept: taskRequesterDept,
        sourceMessage: fullSourceMessage,
        created_at: cDate,
        createdAt: cDate,
        comments: [],
        attachments: []
      };
    });

    setTasks((prev) => [...completeCards, ...prev]);

    const dbRows = completeCards.map((c) => {
      const metaPayload = JSON.stringify({
        comments: [],
        attachments: [],
        assigneeId: c.assigneeId || null,
        assigneeEmail: c.assigneeEmail || ''
      });
      return {
        id: c.id,
        title: c.title,
        description: `${c.desc || ''}\n<!-- TASK_META:${metaPayload} -->`,
        status: 'backlog',
        priority: c.priority || 'alta',
        is_vip: c.isVip || false,
        assignee: c.assignee,
        assignee_avatar: c.assigneeAvatar || '👤',
        department: c.department || 'Geral',
        due_date: c.dueDate || 'Próxima Reunião',
        channel: c.channel || '📅 Ata Google Meet',
        source_message: c.sourceMessage,
        created_at: c.created_at || new Date().toISOString()
      };
    });

    try {
      const { error } = await supabase.from('tasks').insert(dbRows);
      if (error) {
        console.warn('Erro ao salvar lote de tarefas do Meet no Supabase:', error);
      }
    } catch (err) {
      console.warn('Falha ao gravar tarefas do Meet no banco:', err);
    }
  };

  const handleSaveChannel = (newChannel) => {
    setChannels((prev) => [...prev, newChannel]);
    setActiveChat({ type: 'channel', id: newChannel.id });
    setActiveView('chat');
  };

  const handleSaveCollaborator = async (newCollaborator) => {
    const isNew = !(collaborators || []).some(
      (c) => c.id === newCollaborator.id || (c.name && newCollaborator.name && c.name.trim().toLowerCase() === newCollaborator.name.trim().toLowerCase())
    );

    // 1. Atualização Instantânea no Estado Local e LocalStorage
    setCollaborators((prev) => {
      const idx = prev.findIndex(
        (c) => c.id === newCollaborator.id || (c.name && newCollaborator.name && c.name.trim().toLowerCase() === newCollaborator.name.trim().toLowerCase())
      );
      let updated;
      if (idx !== -1) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], ...newCollaborator };
      } else {
        updated = [...prev, newCollaborator];
      }
      try {
        localStorage.setItem('educhat_collaborators', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setActiveChat({ type: 'dm', id: newCollaborator.id });
    setActiveView('chat');

    // Se for novo perfil cadastrado, sincroniza o usuário ativo imediatamente para evitar contaminação
    if (isNew) {
      handleSwitchUser(newCollaborator);
    }

    // 2. Persistência na tabela 'profiles' do Supabase (se tabela estiver disponível)
    try {
      await supabase.from('profiles').upsert([{
        id: newCollaborator.id,
        name: newCollaborator.name,
        email: newCollaborator.email || '',
        role: newCollaborator.role || 'Colaborador',
        role_type: newCollaborator.roleType || 'colaborador',
        department: newCollaborator.department,
        avatar: newCollaborator.avatar || '👨‍💼',
        online: false,
        last_seen: null,
        is_bot: false,
        created_at: new Date().toISOString()
      }], { onConflict: 'id' });
    } catch {}

    // 3. Persistência Garantida e Replicada em Tempo Real via Tabela 'messages' (chat_id: 'sys_collaborators')
    const timeStr = getSaoPauloTime();
    const collabSystemRecord = {
      id: `sys_collab_${newCollaborator.id}`,
      chat_id: 'sys_collaborators',
      sender_id: currentUser?.id || 'system',
      sender_name: currentUser?.name || 'Gestão',
      text: `<!-- COLLABORATOR_RECORD:${JSON.stringify(newCollaborator)} -->\nColaborador cadastrado no sistema: ${newCollaborator.name} (${newCollaborator.department} • ${newCollaborator.role})`,
      timestamp: timeStr,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('messages').upsert([collabSystemRecord], { onConflict: 'id' });
      if (error) {
        await supabase.from('messages').insert([collabSystemRecord]);
      }
    } catch (err) {
      console.warn('Aviso ao persistir colaborador no Supabase:', err);
    }
  };

  const handleSwitchUser = async (newUser) => {
    setCurrentUser(newUser);
    currentUserRef.current = newUser;
    setIsolatedUserSession(newUser);
    try {
      const hb = saveLocalHeartbeat(newUser.id);
      setHeartbeats({ ...hb });
    } catch {}

    // Valida e expurga qualquer sessão residual do Supabase que pertença a outro perfil
    await validateAndEvictMismatchedAuth(supabase, newUser);

    if (activeChat.type === 'dm' && activeChat.id === newUser.id) {
      setActiveChat({ type: 'dm', id: newUser.id === 'u1' ? 'u2' : 'u1' });
    }

    // Recarrega dados com as regras do novo usuário ativo de forma isolada
    fetchSupabaseData();
  };

  // Limpeza Completa de Cache e Estado no Logout (Prevenção de Cruzamento de Identidades)
  const handleLogout = async (triggerSignOut = true) => {
    await clearAllAuthCaches(supabase);

    const fallbackUser = (collaborators || INITIAL_COLLABORATORS)[0] || null;
    setCurrentUser(fallbackUser);
    currentUserRef.current = fallbackUser;
    if (fallbackUser) {
      setIsolatedUserSession(fallbackUser);
    }
    toast.success('Sessão desconectada e cache de usuário limpo.');
    setIsUserSelectOpen(true);
  };
  handleLogoutRef.current = handleLogout;

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

  // Injeção de Dossiê do WhatsApp com Suporte a Modo "Apenas Chat" ou "Chat + Kanban"
  // BLINDAGEM DE PRIVACIDADE E TARGETING ESTRITO:
  // - Se estiver no WhatsApp ou contato especificado: injeta exclusivamente no histórico daquele WhatsApp
  // - Se estiver em um canal público (c-*): NUNCA injeta no canal da equipe! Redireciona para o chat privado do Copilot com o solicitante
  // - Remetente é explicitamente 'u_ia_copilot' e recipient_id é 'activeUserId' para blindar contra broadcast no Realtime/RLS
  const handleInjectDossierToChat = async (dossierData, shouldCreateKanban = false, selectedTasksList = []) => {
    const currentTargetChat = activeChatRef.current || activeChat;
    const activeUserId = currentUserRef.current?.id || currentUser?.id || 'u1';
    const timeStr = getSaoPauloTime();

    // 1. DIRECIONAMENTO ESTRITO (TARGETING):
    const isChannel = currentTargetChat?.type === 'channel' || 
      String(currentTargetChat?.id || '').startsWith('c-') || 
      String(currentTargetChat?.id || '').startsWith('#') ||
      ['geral', 'comercial', 'tutoria', 'secretaria', 'marketing', 'pedagogico', 'expansao', 'diretoria'].includes(
        String(currentTargetChat?.id || '').replace(/^[c#]-?/, '').toLowerCase()
      );

    let targetChatKey;
    if (currentTargetChat?.type === 'whatsapp' || String(currentTargetChat?.id || '').startsWith('wa-')) {
      targetChatKey = currentTargetChat.id;
    } else if (dossierData?.contactId && String(dossierData.contactId).startsWith('wa-')) {
      targetChatKey = dossierData.contactId;
    } else if (!isChannel && currentTargetChat?.type === 'dm') {
      targetChatKey = getChatKey(currentTargetChat, activeUserId);
    } else {
      // Bloqueio de broadcast em canais públicos da equipe (ex: c-geral, c-comercial).
      // Redireciona para o atendimento privado da IA Copilot com o solicitante.
      targetChatKey = getChatKey({ type: 'dm', id: 'u_ia_copilot' }, activeUserId);
      try {
        setActiveChat({ type: 'dm', id: 'u_ia_copilot' });
      } catch {}
    }

    // 2. Monta o texto executivo do Dossiê para registro no fluxo do chat
    let dossierText = `📋 **DOSSIÊ EXECUTIVO WHATSAPP • NOTA INTERNA DA EQUIPE**\n\n`;
    dossierText += `🏛️ **Cliente/Contato:** ${dossierData.clientName || 'Contato WhatsApp'}\n`;
    if (dossierData.plan) dossierText += `👑 **Plano/Modalidade:** ${dossierData.plan}\n`;
    if (dossierData.relationshipTone) dossierText += `🤝 **Tom do Relacionamento:** ${dossierData.relationshipTone}\n\n`;

    dossierText += `📝 **Resumo Executivo 360º:**\n${dossierData.summary}\n\n`;

    if (Array.isArray(dossierData.timeline) && dossierData.timeline.length > 0) {
      dossierText += `📅 **Linha do Tempo & Acordos Firmados:**\n`;
      dossierData.timeline.forEach((item) => {
        dossierText += `• **${item.date}:** ${item.event}\n`;
      });
      dossierText += `\n`;
    }

    if (Array.isArray(dossierData.pendingTasks) && dossierData.pendingTasks.length > 0) {
      dossierText += `📌 **Pendências Identificadas:**\n`;
      dossierData.pendingTasks.forEach((task) => {
        dossierText += `• ${task.title} (Resp: ${task.assignee} • Prazo: ${task.dueDate})\n`;
      });
      dossierText += `\n`;
    }

    if (shouldCreateKanban) {
      dossierText += `✅ *Pendências operacionais cadastradas como cards no Kanban da equipe.*\n`;
    } else {
      dossierText += `ℹ️ *Registro salvo exclusivamente no histórico do chat (Kanban não acionado para evitar poluição).*\n`;
    }

    dossierText += `\n<!-- DOSSIER_RECORD:${JSON.stringify({
      clientName: dossierData.clientName,
      plan: dossierData.plan,
      hasKanban: shouldCreateKanban,
      createdAt: new Date().toISOString()
    })} -->`;

    const dossierMsgId = `dossier_msg_${Date.now()}`;
    const newMsg = {
      id: dossierMsgId,
      chat_id: targetChatKey,
      sender_id: 'u_ia_copilot',
      sender_name: 'IA Dossiê WhatsApp',
      senderId: 'u_ia_copilot',
      senderName: 'IA Dossiê WhatsApp',
      recipient_id: activeUserId,
      recipientId: activeUserId,
      text: dossierText,
      timestamp: timeStr,
      created_at: new Date().toISOString(),
      isDossier: true,
      hasKanban: shouldCreateKanban
    };

    // 3. Persistência no Supabase com isolamento de sessão e RLS (sender_id: 'u_ia_copilot', recipient_id: activeUserId)
    const dbPayload = {
      id: newMsg.id,
      chat_id: targetChatKey,
      sender_id: 'u_ia_copilot',
      sender_name: 'IA Dossiê WhatsApp',
      recipient_id: activeUserId,
      text: newMsg.text,
      timestamp: newMsg.timestamp
    };
    // Garante ausência de channel_id para não ativar broadcast em canais
    delete dbPayload.channel_id;

    try {
      const { error: insError } = await supabase.from('messages').insert([dbPayload]);
      if (insError) {
        if (
          insError.code === 'PGRST204' ||
          insError.message?.includes('recipient_id') ||
          insError.message?.includes('schema cache')
        ) {
          const fallbackPayload = { ...dbPayload };
          delete fallbackPayload.recipient_id;
          await supabase.from('messages').insert([fallbackPayload]);
        } else {
          console.warn('[handleInjectDossierToChat] Erro ao persistir dossiê no Supabase:', insError);
        }
      }
    } catch (err) {
      console.warn('[handleInjectDossierToChat] Exceção ao persistir mensagem de dossiê:', err);
    }

    setMessages((prev) => ({
      ...prev,
      [targetChatKey]: [...(prev[targetChatKey] || []), newMsg]
    }));

    // 4. Se a opção de Kanban foi selecionada, cria os cards no Kanban
    if (shouldCreateKanban) {
      const tasksToCreate = Array.isArray(selectedTasksList) && selectedTasksList.length > 0
        ? selectedTasksList
        : (dossierData.pendingTasks || []);
      handleCreateTasksFromDossier(tasksToCreate);
      toast.success(`Dossiê registrado no chat e ${tasksToCreate.length} cards criados no Kanban!`);
    } else {
      toast.success('Dossiê registrado no histórico da conversa (sem cards no Kanban).');
    }
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

  // Sincronização em Lote de Clientes VIP com Supabase e LocalStorage
  const handleBatchUpsertVips = async (updatedList, fileName = '', summary = {}) => {
    setVipClients(updatedList);
    try {
      localStorage.setItem('educhat_vip_clients', JSON.stringify(updatedList));
      const timeStr = getSaoPauloTime();
      const rows = updatedList.map((item, idx) => ({
        id: `vip_${normalizeKey(item.name) || idx}`,
        chat_id: 'sys_vip_clients',
        sender_id: 'batch_upload',
        sender_name: 'Gestão VIP',
        text: `<!-- VIP_RECORD:${JSON.stringify(item)} -->`,
        timestamp: timeStr
      }));
      const chunkSize = 20;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await supabase.from('messages').upsert(rows.slice(i, i + chunkSize), { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar VIPs no Supabase:', err);
    }
  };

  // Sincronização em Lote de SLAs com Supabase e LocalStorage
  const handleBatchUpsertSlas = async (updatedList, fileName = '', summary = {}) => {
    setSlas(updatedList);
    try {
      localStorage.setItem('educhat_slas', JSON.stringify(updatedList));
      const timeStr = getSaoPauloTime();
      const rows = updatedList.map((item, idx) => ({
        id: `sla_${normalizeKey(item.demand) || idx}`,
        chat_id: 'sys_slas',
        sender_id: 'batch_upload',
        sender_name: 'Gestão SLA',
        text: `<!-- SLA_RECORD:${JSON.stringify(item)} -->`,
        timestamp: timeStr
      }));
      const chunkSize = 20;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await supabase.from('messages').upsert(rows.slice(i, i + chunkSize), { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar SLAs no Supabase:', err);
    }
  };

  // Sincronização em Lote de Procedimentos Padrão (POPs) com Supabase e LocalStorage
  const handleBatchUpsertPops = async (updatedList, fileName = '', summary = {}) => {
    setPops(updatedList);
    try {
      localStorage.setItem('educhat_pops', JSON.stringify(updatedList));
      const timeStr = getSaoPauloTime();
      const rows = updatedList.map((item, idx) => ({
        id: `pop_${normalizeKey(item.title) || idx}`,
        chat_id: 'sys_pops',
        sender_id: 'batch_upload',
        sender_name: 'Gestão POP',
        text: `<!-- POP_RECORD:${JSON.stringify(item)} -->`,
        timestamp: timeStr
      }));
      const chunkSize = 20;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await supabase.from('messages').upsert(rows.slice(i, i + chunkSize), { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar POPs no Supabase:', err);
    }
  };

  // Importação e Roteamento Exclusivo de Leads do Instagram Ads para a Expansão
  const handleImportInstagramLeads = async (newLeads) => {
    if (!newLeads || newLeads.length === 0) return;

    const timeStr = getSaoPauloTime();

    // 1. Atualizar contatos do WhatsApp no estado local (com tags e dados completos)
    setWhatsAppContacts((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const filteredNew = newLeads.filter((l) => !existingIds.has(l.id));
      return [...filteredNew, ...prev];
    });

    // 2. Preparar mensagens de entrada para cada lead e inserir no Supabase
    const messagesToInsert = [];
    const newMessagesMap = {};

    newLeads.forEach((lead, idx) => {
      const intakeText = `📥 [Lead Instagram Ads - Expansão]\n👤 Nome: ${lead.name}\n📞 WhatsApp: ${lead.phone}\n📧 Email: ${lead.email || 'Não informado'}\n📍 Cidade/Polo: ${lead.city || 'Não informada'}\n🎯 Campanha: ${lead.campaign || 'Instagram Ads - Expansão'}\n🏢 Fila: Departamento de Expansão\n👨‍💼 Responsável: Luiz Augusto`;

      const msgObj = {
        id: `wa_lead_${Date.now()}_${idx}`,
        chat_id: lead.id,
        sender_id: lead.id,
        sender_name: lead.name,
        text: intakeText,
        timestamp: timeStr,
        isWhatsApp: true,
        fromStudent: true
      };

      messagesToInsert.push({
        id: msgObj.id,
        chat_id: msgObj.chat_id,
        sender_id: msgObj.sender_id,
        sender_name: msgObj.sender_name,
        text: msgObj.text,
        timestamp: msgObj.timestamp
      });

      newMessagesMap[lead.id] = [msgObj];
    });

    // 3. Gerar mensagem de notificação/resumo no canal #expansao
    const samplePreview = newLeads
      .slice(0, 5)
      .map((l, i) => `${i + 1}. **${l.name}** - ${l.phone} (${l.city || 'Brasil'})`)
      .join('\n');

    const expansaoNoticeText = `🚀 **Novos Leads do Instagram Ads Recebidos (${newLeads.length})**\n\nTodos os ${newLeads.length} leads importados foram direcionados exclusivamente para a fila da **Expansão** sob responsabilidade de **Luiz Augusto**.\n\n${samplePreview}${newLeads.length > 5 ? `\n... e mais ${newLeads.length - 5} leads adicionados à carteira.` : ''}\n\n💬 Inicie o contato com os novos interessados e parceiros de polos!`;

    const expansaoMsgObj = {
      id: `exp_import_${Date.now()}`,
      senderId: 'u_ia_copilot',
      senderName: 'Assistente EduChat (Expansão)',
      text: expansaoNoticeText,
      timestamp: timeStr,
      actionExtracted: false
    };

    messagesToInsert.push({
      id: expansaoMsgObj.id,
      chat_id: 'c-expansao',
      sender_id: expansaoMsgObj.senderId,
      sender_name: expansaoMsgObj.senderName,
      text: expansaoMsgObj.text,
      timestamp: expansaoMsgObj.timestamp
    });

    // 4. Atualizar o estado local de mensagens
    setMessages((prev) => {
      const updated = { ...prev };
      Object.keys(newMessagesMap).forEach((chatId) => {
        updated[chatId] = [...(updated[chatId] || []), ...newMessagesMap[chatId]];
      });
      updated['c-expansao'] = [...(updated['c-expansao'] || []), expansaoMsgObj];
      return updated;
    });

    // 5. Gravar mensagens no Supabase
    try {
      const { error } = await supabase.from('messages').insert(messagesToInsert);
      if (error) {
        console.warn('Aviso ao gravar mensagens de leads importados no Supabase:', error);
      }
    } catch (dbErr) {
      console.warn('Erro ao inserir leads no Supabase:', dbErr);
    }

    // 6. Atualizar contador não lido em #expansao (notificação visual)
    if (activeChat.id !== 'c-expansao') {
      setUnreadCounts((prev) => ({
        ...prev,
        'c-expansao': (prev['c-expansao'] || 0) + 1
      }));
    }
  };

  // Sincronização em Massa de Alunos e Clientes da Base EduControl (Padrão Base44)
  // Utiliza o CPF como chave primária de unicidade e aplica a regra de Sticky Assignment (permanência de consultor)
  const handleSyncEduControlStudents = async (newStudents, overrideOptions = {}) => {
    if (!newStudents || newStudents.length === 0) return;
    const timeStr = getSaoPauloTime();

    // 1. Atualizar base de alunos local com Upsert baseado em CPF (e fallback em Telefone)
    setEduControlStudents((prev) => {
      const studentList = [...prev];
      newStudents.forEach((incoming) => {
        // Encontra registro existente por CPF (chave primária) ou Telefone (fallback)
        const existingIdx = studentList.findIndex((s) => {
          if (incoming.cleanCPF && s.cleanCPF && incoming.cleanCPF === s.cleanCPF) return true;
          if (incoming.cleanDigits && s.cleanDigits && incoming.cleanDigits === s.cleanDigits) return true;
          return false;
        });

        if (existingIdx !== -1) {
          // REGRA DE UPSERT: Atualiza dados cadastrais (telefone, e-mail, nome, curso, etc.)
          // PRESERVA o consultor responsável atual (Sticky Assignment) e departamento
          const existing = studentList[existingIdx];
          studentList[existingIdx] = {
            ...existing,
            ...incoming,
            // Sticky Assignment: Preserva consultor e departamento se já existirem (a menos que haja override explícito)
            assignee: overrideOptions.forceAssignee || existing.assignee || incoming.assignee || 'Gabriel Carvalho',
            department: overrideOptions.forceDepartment || existing.department || incoming.department || 'Secretaria Acadêmica',
            lastSync: timeStr
          };
        } else {
          // Novo cadastro
          studentList.push({
            ...incoming,
            assignee: overrideOptions.forceAssignee || incoming.assignee || 'Gabriel Carvalho',
            department: overrideOptions.forceDepartment || incoming.department || 'Secretaria Acadêmica',
            lastSync: timeStr
          });
        }
      });

      try {
        localStorage.setItem('educhat_educontrol_students', JSON.stringify(studentList));
      } catch {}
      return studentList;
    });

    // 2. Atualizar ou incluir contatos correspondentes no WhatsApp (Sticky Assignment)
    setWhatsAppContacts((prev) => {
      const contactList = [...prev];
      newStudents.forEach((s) => {
        const contactId = s.waId || `wa-${s.cleanDigits}`;
        // Procura contato por contactId, CPF ou Telefone
        const existingIdx = contactList.findIndex((c) => {
          if (c.id === contactId) return true;
          if (s.cleanCPF && c.cleanCPF && s.cleanCPF === c.cleanCPF) return true;
          if (s.cleanCPF && c.cpf && String(c.cpf).replace(/\D/g, '') === s.cleanCPF) return true;
          if (s.cleanDigits && c.phone && String(c.phone).replace(/\D/g, '').endsWith(s.cleanDigits.slice(-8))) return true;
          return false;
        });

        if (existingIdx !== -1) {
          // Atualiza dados cadastrais mantendo consultor responsável (Sticky Assignment)
          const existing = contactList[existingIdx];
          contactList[existingIdx] = {
            ...existing,
            name: s.name || existing.name,
            phone: s.phone || existing.phone,
            email: s.email || existing.email,
            cpf: s.cpf || existing.cpf,
            cleanCPF: s.cleanCPF || existing.cleanCPF,
            // Preserva Sticky Assignment:
            assignee: overrideOptions.forceAssignee || existing.assignee || s.assignee || 'Gabriel Carvalho',
            department: overrideOptions.forceDepartment || existing.department || s.department || 'Secretaria Acadêmica',
            status: s.academicStatus === 'Certificado' || s.academicStatus === 'Veterano'
              ? 'veterano_retencao'
              : 'carteira_ativa',
            statusLabel: `${s.academicStatus} • ${s.course}`,
            lastInteraction: existing.lastInteraction || 'Sincronizado via Arquivo / Base',
            triageContext: `Aluno ${s.academicStatus} (${s.course} • ${s.polo}) • CPF ${s.cpf || '-'} • Matrícula ${s.matricula}`
          };
        } else {
          // Novo contato criado
          contactList.push({
            id: contactId,
            name: s.name,
            phone: s.phone,
            email: s.email,
            cpf: s.cpf,
            cleanCPF: s.cleanCPF,
            avatar: '🎓',
            department: overrideOptions.forceDepartment || s.department || 'Secretaria Acadêmica',
            assignee: overrideOptions.forceAssignee || s.assignee || 'Gabriel Carvalho',
            status: s.academicStatus === 'Certificado' || s.academicStatus === 'Veterano'
              ? 'veterano_retencao'
              : 'carteira_ativa',
            statusLabel: `${s.academicStatus} • ${s.course}`,
            aiActive: false,
            lastInteraction: 'Sincronizado via Arquivo / Base',
            triageContext: `Aluno ${s.academicStatus} (${s.course} • ${s.polo}) • CPF ${s.cpf || '-'} • Matrícula ${s.matricula}`
          });
        }
      });
      return contactList;
    });

    // 3. Persistência no Supabase com CPF como Chave Primária de Unicidade
    try {
      const rowsToInsert = newStudents.map((s, idx) => {
        // Chave de unicidade no banco: prioriza ec_cpf_{CPF}
        const recordKey = s.cleanCPF
          ? `ec_cpf_${s.cleanCPF}`
          : (s.cleanDigits ? `ec_wa_${s.cleanDigits}` : `ec_idx_${Date.now()}_${idx}`);

        return {
          id: recordKey,
          chat_id: 'sys_educontrol_students',
          sender_id: 'educontrol_sync',
          sender_name: 'Upload de Bases',
          text: `<!-- STUDENT_RECORD:${JSON.stringify(s)} -->`,
          timestamp: timeStr
        };
      });

      const chunkSize = 20;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        await supabase.from('messages').upsert(chunk, { onConflict: 'id' });
      }

      // Notificação de sistema no canal #geral
      const noticeText = `🎓 **Base de Alunos Sincronizada!**\n\nForam processados e atualizados **${newStudents.length} alunos** via CPF e Telefone (Anti-duplicidade e Sticky Assignment ativos).\nO reconhecimento em tempo real e os dossiês 360º já estão atualizados no EduChat.`;
      await supabase.from('messages').insert([{
        id: `ec_sync_notif_${Date.now()}`,
        chat_id: 'c-geral',
        sender_id: 'system',
        sender_name: 'Upload de Bases',
        text: noticeText,
        timestamp: timeStr
      }]);
    } catch (err) {
      console.warn('Aviso ao sincronizar alunos no Supabase:', err);
    }
  };

  // Reatribuição Manual / Automática de Fila e Consultor Responsável com Suporte a Desatribuição (Fila Geral) e Co-atribuição
  const handleUpdateChatAssignment = async (chatId, { department, assignee, assignees = [], assigned_to, status, statusLabel }) => {
    if (!chatId) return;
    const timeStr = getSaoPauloTime();

    const isUnassigning = !assignee || assignee === '' || assignee === 'Fila Geral' || assignee === 'sem_responsavel';
    const allAssignees = isUnassigning
      ? []
      : (Array.isArray(assignees) && assignees.length > 0
          ? Array.from(new Set(assignees.filter(Boolean)))
          : (assignee ? [assignee] : []));
    const primaryAssignee = isUnassigning ? null : (allAssignees[0] || assignee || null);
    const assignedToId = isUnassigning ? null : (assigned_to || (collaboratorsRef.current.find((c) => c.name === primaryAssignee)?.id) || null);
    const finalDepartment = department || 'Triagem URA';
    const finalStatus = isUnassigning ? 'ura_inedito' : (status || 'carteira_ativa');
    const finalStatusLabel = isUnassigning
      ? (department ? `Fila • ${department}` : 'Fila • Triagem Geral')
      : (statusLabel || `Carteira • ${primaryAssignee}`);

    // 1. Atualizar contatos locais imediatamente (Optimistic Update)
    setWhatsAppContacts((prev) => {
      const exists = prev.some((c) => c.id === chatId);
      const triageContextText = primaryAssignee
        ? (allAssignees.length > 1
            ? `Co-atribuído a ${allAssignees.join(' e ')} (${finalDepartment}) por ${currentUser?.name || 'Gestão'}.`
            : `Atribuído a ${primaryAssignee} (${finalDepartment}) por ${currentUser?.name || 'Gestão'}.`)
        : `Fila de ${finalDepartment}: Aguardando atendente disponível na Fila Geral.`;

      if (exists) {
        return prev.map((c) => {
          if (c.id !== chatId) return c;
          return {
            ...c,
            department: finalDepartment,
            assignee: primaryAssignee,
            assignees: allAssignees,
            assigned_to: assignedToId,
            status: finalStatus,
            statusLabel: finalStatusLabel,
            triageContext: triageContextText
          };
        });
      }
      const rawDigits = chatId.replace('wa-', '');
      const formattedPhone = rawDigits.length >= 10 ? `+${rawDigits}` : rawDigits;
      return [
        ...prev,
        {
          id: chatId,
          name: `WhatsApp (${formattedPhone})`,
          phone: formattedPhone,
          avatar: '👤',
          department: finalDepartment,
          assignee: primaryAssignee,
          assignees: allAssignees,
          assigned_to: assignedToId,
          status: finalStatus,
          statusLabel: finalStatusLabel,
          aiActive: false,
          lastInteraction: 'Agora',
          triageContext: triageContextText
        }
      ];
    });

    // 2. Atualizar também a base de alunos reconhecidos (se este contato for aluno EduControl)
    setEduControlStudents((prev) => {
      let matched = false;
      const updated = prev.map((s) => {
        const sWaId = s.waId || `wa-${s.cleanDigits}`;
        if (s.id === chatId || sWaId === chatId || (s.cleanDigits && chatId.includes(s.cleanDigits))) {
          matched = true;
          return {
            ...s,
            assignee: primaryAssignee,
            assignees: allAssignees,
            assigned_to: assignedToId,
            department: finalDepartment
          };
        }
        return s;
      });
      if (matched) {
        try {
          localStorage.setItem('educhat_educontrol_students', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    // 3. Persistir no localStorage para retenção offline e recarregamento instantâneo
    try {
      const stored = JSON.parse(localStorage.getItem('educhat_chat_assignments') || '{}');
      const asgnObj = {
        department: finalDepartment,
        assignee: primaryAssignee,
        assignees: allAssignees,
        assigned_to: assignedToId,
        status: finalStatus,
        statusLabel: finalStatusLabel,
        updatedBy: currentUser?.name || 'Gestão',
        updatedAt: new Date().toISOString()
      };
      stored[chatId] = asgnObj;
      assignmentsCacheRef.current[chatId] = asgnObj;
      localStorage.setItem('educhat_chat_assignments', JSON.stringify(stored));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }

    // 4. Montar payload de auditoria e evento de sistema no Supabase
    const assignmentPayload = {
      department: finalDepartment,
      assignee: primaryAssignee,
      assignees: allAssignees,
      assigned_to: assignedToId,
      status: finalStatus,
      statusLabel: finalStatusLabel,
      updatedBy: currentUser?.name || 'Gestão',
      timestamp: timeStr
    };

    const auditNotice = primaryAssignee
      ? (allAssignees.length > 1
          ? `📌 [Co-atribuição de Fila & Responsáveis] Atendimento compartilhado entre ${allAssignees.join(' e ')} (Fila: ${finalDepartment}) por ${currentUser?.name || 'Gestão'}.\n<!-- ASSIGNMENT:${JSON.stringify(assignmentPayload)} -->`
          : `📌 [Reatribuição de Fila & Responsável] Atendimento transferido para a fila "${finalDepartment}" com o consultor "${primaryAssignee}" por ${currentUser?.name || 'Gestão'}.\n<!-- ASSIGNMENT:${JSON.stringify(assignmentPayload)} -->`)
      : `📌 [Fila Geral / Triagem] Atendimento retornado para Fila Geral (${finalDepartment}).\n<!-- ASSIGNMENT:${JSON.stringify(assignmentPayload)} -->`;

    const systemMsg = {
      id: 'asgn_' + Date.now(),
      senderId: 'system',
      senderName: 'EduChat (Sistema)',
      text: auditNotice,
      timestamp: timeStr,
      actionExtracted: false
    };

    // Atualiza estado de mensagens local instantaneamente
    setMessages((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), systemMsg]
    }));

    // Grava no Supabase (dispara broadcast Realtime para todas as outras telas conectadas)
    try {
      const { error } = await supabase.from('messages').insert([{
        id: systemMsg.id,
        chat_id: chatId,
        sender_id: systemMsg.senderId,
        sender_name: systemMsg.senderName,
        text: systemMsg.text,
        timestamp: systemMsg.timestamp
      }]);
      if (error) {
        console.warn('Aviso ao gravar reatribuição no Supabase:', error);
        toast.error('Não foi possível salvar a reatribuição no servidor. Tente novamente.');
      } else {
        console.log('[Fila] Reatribuição persistida', { chatId, assigned_to: assignedToId, assignee: primaryAssignee });
      }
    } catch (err) {
      console.warn('Erro ao inserir reatribuição no Supabase:', err);
      toast.error('Falha de rede ao salvar a reatribuição.');
    }

    // 5. Se houver um card no Kanban associado a este chat, atualiza o responsável e departamento no Kanban também
    const contactObj = whatsAppContacts.find((c) => c.id === chatId);
    const cleanPhone = (contactObj?.phone || '').replace(/\D/g, '');
    const linkedTask = tasks.find((t) => {
      const tPhone = (t.clientPhone || '').replace(/\D/g, '');
      const inDesc = (t.desc || '').includes(cleanPhone) || (t.sourceMessage || '').includes(cleanPhone);
      return (tPhone && tPhone === cleanPhone) || inDesc;
    });

    if (linkedTask) {
      handleUpdateTaskDetails(linkedTask.id, {
        department,
        assignee: primaryAssignee
      });
    }
  };

  // Helper para retirada voluntária de co-responsável ("Sair do Atendimento" - Item 3)
  const handleRemoveCoAssignee = (chatId, userNameToRemove) => {
    const contact = whatsAppContacts.find((c) => c.id === chatId);
    if (!contact) return;

    const currentAssignees = Array.isArray(contact.assignees) && contact.assignees.length > 0
      ? contact.assignees
      : [contact.assignee].filter(Boolean);

    const remaining = currentAssignees.filter(
      (a) => normalizeName(a) !== normalizeName(userNameToRemove)
    );

    const newPrimary = remaining[0] || null;

    handleUpdateChatAssignment(chatId, {
      department: contact.department,
      assignee: newPrimary,
      assignees: remaining,
      status: contact.status,
      statusLabel: contact.statusLabel
    });
  };

  // 2. CONTROLE DE DISPONIBILIDADE: Alternar entre "Disponível" e "Em Pausa" (Almoço/Folga)
  const handleToggleAvailability = async () => {
    if (!currentUser?.id) return;
    const currentVal = currentUser?.is_available !== false;
    const nextVal = !currentVal;

    const updatedUser = { ...currentUser, is_available: nextVal };
    setCurrentUser(updatedUser);
    currentUserRef.current = updatedUser;

    setCollaborators((prev) =>
      prev.map((c) => (c.id === currentUser.id ? { ...c, is_available: nextVal } : c))
    );

    try {
      localStorage.setItem('educhat_user_id', currentUser.id);
      const savedList = JSON.parse(localStorage.getItem('educhat_collaborators') || '[]');
      const nextList = savedList.map((c) =>
        c.id === currentUser.id ? { ...c, is_available: nextVal } : c
      );
      localStorage.setItem('educhat_collaborators', JSON.stringify(nextList));
    } catch {}

    // Atualiza no Supabase imediatamente (profiles, collaborators e broadcast em messages)
    try {
      await supabase.from('profiles').update({ is_available: nextVal }).eq('id', currentUser.id);
    } catch {}
    try {
      await supabase.from('collaborators').update({ is_available: nextVal }).eq('id', currentUser.id);
    } catch {}

    try {
      await supabase.from('messages').upsert([
        {
          id: `sys_avail_${currentUser.id}`,
          chat_id: 'sys_user_availability',
          sender_id: currentUser.id,
          sender_name: currentUser.name,
          text: JSON.stringify({
            userId: currentUser.id,
            userName: currentUser.name,
            department: currentUser.department,
            is_available: nextVal,
            updatedAt: new Date().toISOString()
          }),
          timestamp: getSaoPauloTime()
        }
      ], { onConflict: 'id' });
    } catch (err) {
      console.warn('Aviso ao sincronizar disponibilidade no Supabase:', err);
    }
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-chatBg font-sans text-chatTextBody print:h-auto print:w-full print:overflow-visible print:bg-white ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Barra Lateral estilo WhatsApp */}
      <div className="print:hidden h-full flex shrink-0">
        <ErrorBoundary
        title="Erro ao carregar barra lateral"
        description="Ocorreu uma falha inesperada na listagem de conversas. Clique abaixo para restabelecer a barra lateral."
      >
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          channels={channels}
          collaborators={resolvedCollaborators}
          whatsAppContacts={
            hasFullPortfolioAccess(currentUser)
              ? whatsAppContacts
              : (whatsAppContacts || []).filter((c) => canUserViewChat(c, currentUser, resolvedCollaborators))
          }
          activeChat={activeChat}
          messages={messages}
          channelReadReceipts={channelReadReceipts}
          dmReadReceipts={dmReadReceipts}
          onSelectChannel={(channelId) => {
            setActiveChat({ type: 'channel', id: channelId });
            setActiveView('chat');
            clearUnread(channelId);
            markMessagesAsRead({ type: 'channel', id: channelId });
          }}
          onSelectCollaborator={(userId) => {
            setActiveChat({ type: 'dm', id: userId });
            setActiveView('chat');
            clearUnread(userId);
            markMessagesAsRead({ type: 'dm', id: userId });
          }}
          onSelectWhatsAppContact={(contactId) => {
            setActiveChat({ type: 'whatsapp', id: contactId });
            setActiveView('chat');
            clearUnread(contactId);
            markMessagesAsRead({ type: 'whatsapp', id: contactId });
          }}
          onOpenNewWhatsAppContact={() => setIsNewWhatsAppChatOpen(true)}
          onDeleteChat={handleDeleteChat}
          onOpenWhatsAppConnection={(tab = 'qrcode') => setWhatsAppModal({ isOpen: true, tab })}
          onOpenInstagramImport={() => setIsInstagramImportOpen(true)}
          onOpenEduControlSync={() => setIsEduControlModalOpen(true)}
          eduControlStudents={eduControlStudents}
          aiAutonomous={aiAutonomous}
          setAiAutonomous={setAiAutonomous}
          onOpenAICopilot={() =>
            setAiModal({ isOpen: true, mode: 'bottlenecks', sourceMessage: null })
          }
          onOpenAIMemory={() => setIsAIMemoryOpen(true)}
          onOpenNewChannel={() => setModalItem({ isOpen: true, type: 'channel' })}
          onOpenNewCollaborator={(initialData) => setModalItem({ isOpen: true, type: 'collaborator', initialData: initialData || null })}
          onEditCollaborator={(collab) => setModalItem({ isOpen: true, type: 'collaborator', initialData: collab })}
          theme={theme}
          onToggleTheme={toggleTheme}
          currentUser={currentUser}
          onToggleAvailability={handleToggleAvailability}
          realtimeStatus={realtimeStatus}
          onOpenUserSelectModal={() => setIsUserSelectOpen(true)}
          onLogout={handleLogout}
          unreadCounts={unreadCounts}
          lastSyncTime={lastSyncTime}
          officialWhatsAppNumber="+55 (11) 93059-4591"
          institutionName="Faculdade Olavo Bilac • Grupo EstudeMais"
          portfolioLabel="Matriz Olavo Bilac • Carteira Ativa"
        />
      </ErrorBoundary>
      </div>

      {/* Área Central Baseada na Visualização Ativa */}
      {activeView === 'chat' && (
        <ErrorBoundary
          title="Ocorreu um erro ao carregar este chat."
          description="Detectamos uma inconsistência nos dados desta conversa. Clique abaixo para restabelecer a conversa com segurança."
          onReset={() => {
            setActiveChat({ type: 'channel', id: 'c-geral' });
          }}
        >
          <ChatArea
            activeChat={activeChat}
            activeView={activeView}
            chatMeta={chatMeta}
            messages={currentMessages}
            historyStatus={chatHistoryStatus.key === currentChatKey ? chatHistoryStatus.status : 'loading'}
            historyError={chatHistoryStatus.key === currentChatKey ? chatHistoryStatus.error : null}
            onRetryHistory={() => setHistoryRetryTick((t) => t + 1)}
            onSendMessage={handleSendMessage}
            onCreateTaskFromMessage={handleCreateTaskFromMessage}
            onDeleteTaskFromMessage={handleDeleteTaskFromMessage}
            onDeleteMessage={handleDeleteMessage}
            onDeleteChat={handleDeleteChat}
            onOpenTaskDetail={(taskId) => {
              const found = tasks.find((t) => t.id === taskId);
              if (found) setSelectedTaskDetail(found);
            }}
            onScheduleTask={handleScheduleTask}
            onDelegateTask={handleDelegateTask}
            onSummarizeChat={handleSummarizeChat}
            onOpenWhatsAppDossier={() => setIsDossierOpen(true)}
            onToggleWhatsAppAI={handleToggleWhatsAppAI}
            onUpdateChatAssignment={handleUpdateChatAssignment}
            onRemoveCoAssignee={handleRemoveCoAssignee}
            currentUser={currentUser}
            realtimeStatus={realtimeStatus}
            channels={channels}
            collaborators={resolvedCollaborators}
            eduControlStudents={eduControlStudents}
            onForwardMessage={handleForwardMessage}
          />
        </ErrorBoundary>
      )}

      {activeView === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          currentUser={currentUser}
          collaborators={resolvedCollaborators}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onDeleteTasksBatch={handleDeleteTasksBatch}
          onCreateTasksBatch={handleCreateMeetTasksBatch}
          vipClients={vipClients}
          slas={slas}
          onOpenAIMemory={() => setIsAIMemoryOpen(true)}
          onAddTask={() =>
            setAiModal({ isOpen: true, mode: 'extract_task', sourceMessage: null })
          }
          onCardClick={(task) => setSelectedTaskDetail(task)}
        />
      )}

      {activeView === 'secretaria' && (
        <SecretariaView
          currentUser={currentUser}
          onBackToChat={() => setActiveView('chat')}
        />
      )}

      {(activeView === 'gestao' || activeView === 'dashboard') && (
        hasFullPortfolioAccess(currentUser) ? (
          <GestaoDashboard
            tasks={tasks}
            channels={channels}
            collaborators={resolvedCollaborators}
            whatsAppContacts={whatsAppContacts}
            currentUser={currentUser}
            onOpenInstagramImport={() => setIsInstagramImportOpen(true)}
            onOpenEduControlSync={() => setIsEduControlModalOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-chatBg p-8 text-center transition-colors">
            <div className="bg-white dark:bg-chatCard p-8 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-md shadow-sm space-y-4">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
                <Shield size={28} />
              </div>
              <h3 className="text-lg font-bold text-chatTextTitle">Acesso Restrito ao Gestor / Administrador</h3>
              <p className="text-xs text-chatTextMuted leading-relaxed">
                O Painel de Gestão (BI), métricas da equipe e a emissão de Atas Executivas são exclusivos para a Diretoria Executiva da instituição.
                <br /><br />
                Você está conectado como <strong>{currentUser.name}</strong> ({currentUser.department}).
              </p>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setActiveView('chat')}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                >
                  Voltar para Conversas
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
        collaborators={resolvedCollaborators}
        vipClients={vipClients}
        learnedDocuments={learnedDocuments}
        pops={pops}
        slas={slas}
        recentMessages={currentMessages}
      />

      {/* Modal para Criar Canal ou Colaborador */}
      <NewItemModal
        isOpen={modalItem.isOpen}
        type={modalItem.type}
        channels={channels}
        initialData={modalItem.initialData || null}
        onClose={() => setModalItem({ ...modalItem, isOpen: false, initialData: null })}
        onSave={modalItem.type === 'channel' ? handleSaveChannel : handleSaveCollaborator}
      />

      {/* Modal de Memória e Ingestão de Documentos da IA (Item 3) */}
      <AIMemoryModal
        isOpen={isAIMemoryOpen}
        onClose={() => setIsAIMemoryOpen(false)}
        vipClients={vipClients}
        onAddVipClient={(newVip) => setVipClients((prev) => [...prev, newVip])}
        onRemoveVipClient={(id) => setVipClients((prev) => prev.filter((v) => v.id !== id))}
        onBatchUpsertVips={handleBatchUpsertVips}
        slas={slas}
        onAddSla={(newSla) => setSlas((prev) => [...prev, newSla])}
        onRemoveSla={(id) => setSlas((prev) => prev.filter((s) => s.id !== id))}
        onBatchUpsertSlas={handleBatchUpsertSlas}
        pops={pops}
        onAddPop={(newPop) => setPops((prev) => [...prev, newPop])}
        onRemovePop={(id) => setPops((prev) => prev.filter((p) => p.id !== id))}
        onBatchUpsertPops={handleBatchUpsertPops}
        customPrompt={customAIPrompt}
        onSaveCustomPrompt={(newPrompt) => setCustomAIPrompt(newPrompt)}
        learnedDocuments={learnedDocuments}
        onAddDocument={handleAddDocument}
        onRemoveDocument={handleRemoveDocument}
        eduControlStudents={eduControlStudents}
        onSyncStudents={handleSyncEduControlStudents}
        collaborators={resolvedCollaborators}
      />

      {/* Modal de Dossiê 360º & Auto-Aprendizado do WhatsApp */}
      <WhatsAppDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        activeChat={activeChat}
        targetContact={
          activeChat?.type === 'whatsapp'
            ? whatsAppContacts.find((c) => c.id === activeChat.id)
            : null
        }
        currentMessages={messages[currentChatKey] || []}
        onSaveDossier={handleInjectDossierToChat}
        onCreateTasks={handleCreateTasksFromDossier}
        onFeedAIMemory={handleFeedAIMemory}
      />

      {/* Modal de Seleção de Usuário (Login / Identificação Opção A) */}
      <UserSelectionModal
        isOpen={isUserSelectOpen}
        onClose={() => setIsUserSelectOpen(false)}
        collaborators={resolvedCollaborators}
        onSelectUser={handleSwitchUser}
        onLogout={handleLogout}
        onEditCollaborator={(collab) => {
          setIsUserSelectOpen(false);
          setModalItem({ isOpen: true, type: 'collaborator', initialData: collab });
        }}
        onNewCollaborator={() => {
          setIsUserSelectOpen(false);
          setModalItem({ isOpen: true, type: 'collaborator', initialData: null });
        }}
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
        collaborators={resolvedCollaborators}
      />

      {/* Modal de Conexão WhatsApp & Simulador de Webhooks */}
      <WhatsAppConnectionModal
        isOpen={whatsAppModal.isOpen}
        initialTab={whatsAppModal.tab}
        onClose={() => setWhatsAppModal((prev) => ({ ...prev, isOpen: false }))}
        onSimulateWebhook={handleWhatsAppWebhookEvent}
      />

      {/* Modal de Importação de Leads do Instagram Ads para a Expansão */}
      <InstagramLeadImportModal
        isOpen={isInstagramImportOpen}
        onClose={() => setIsInstagramImportOpen(false)}
        existingContacts={whatsAppContacts}
        onImportLeads={handleImportInstagramLeads}
        onNavigateToChannel={(channelId) => {
          setActiveChat({ type: 'channel', id: channelId });
          setActiveView('chat');
          clearUnread(channelId);
        }}
        onSelectContact={(contactId) => {
          setActiveChat({ type: 'whatsapp', id: contactId });
          setActiveView('chat');
          clearUnread(contactId);
        }}
      />

      {/* Modal de Sincronização e Reconhecimento da Base EduControl (Item 1 & 2) */}
      <EduControlSyncModal
        isOpen={isEduControlModalOpen}
        onClose={() => setIsEduControlModalOpen(false)}
        onSyncStudents={handleSyncEduControlStudents}
        currentStudents={eduControlStudents}
        collaborators={resolvedCollaborators}
      />

      {/* Modal de Início de Conversa Ativa WhatsApp (Novo Atendimento) */}
      <NewWhatsAppChatModal
        isOpen={isNewWhatsAppChatOpen}
        onClose={() => setIsNewWhatsAppChatOpen(false)}
        onSubmit={handleStartNewWhatsAppChat}
        currentUser={currentUser}
      />

      {/* Container de Notificações Toast Flutuantes (Erros de Envio e Alertas) */}
      <ToastContainer />
    </div>
  );
}
