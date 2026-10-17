import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  CheckSquare,
  BarChart3,
  Hash,
  Users,
  Sparkles,
  Circle,
  Plus,
  Bot,
  Lock,
  Brain,
  Sun,
  Moon,
  Search,
  Filter,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Zap,
  QrCode,
  PhoneCall,
  Upload,
  Trash2,
  Database,
  GraduationCap,
  Edit2
} from 'lucide-react';
import { hasFullPortfolioAccess, isChatAssignedToUser, canUserViewChat } from '../lib/portfolioAccess';
import { getCanonicalPhoneKey, getChatKey } from '../data/initialData';
import { matchStudentByPhone } from '../lib/eduControl';
import { formatLastSeen } from '../lib/presence';
import { formatRelativeChatTime, parseDateSafely } from '../lib/timezone';

// 1. FILTRO DE NÃO LIDAS (UNREAD COUNT) COM CONTROLE DE TIMESTAMP:
// A variável que alimenta o badge numérico deve ser um .filter() do array de mensagens daquela sessão.
// A regra de contagem: mensagens onde o remetente é o contato (sender_id !== currentUser.id ou fromMe === false)
// AND o status é não lido (is_read === false ou status !== 'read')
// AND se houver lastReadTimestamp persistido, apenas mensagens posteriores a esse timestamp.
export function countUnreadMessages(messageList, currentUserId, lastReadTimestamp = null) {
  if (!Array.isArray(messageList) || messageList.length === 0) return 0;
  try {
    const lastReadTime = lastReadTimestamp ? new Date(lastReadTimestamp).getTime() : 0;
    return messageList.filter((m) => {
      if (!m || typeof m !== 'object') return false;
      const senderId = m.senderId || m.sender_id;
      const isFromMe = (senderId && currentUserId) ? senderId === currentUserId : Boolean(m.fromMe);
      if (isFromMe) return false;

      // Status explicitamente marcado como lido
      const isExplicitRead =
        m.is_read === true ||
        m.status === 'read' ||
        (typeof m.text === 'string' && m.text.includes('<!-- STATUS:read -->'));

      if (isExplicitRead) return false;

      // Se há um timestamp de última leitura persistido, descarta mensagens anteriores ou iguais
      if (lastReadTime > 0) {
        const rawTime = m.created_at || m.timestampRaw;
        let msgTime = rawTime ? new Date(rawTime).getTime() : 0;

        if (!msgTime || isNaN(msgTime)) {
          // Se não possui data ISO completa e é mensagem de semente/legada:
          if (m.id && (String(m.id).startsWith('msg_') || String(m.id).startsWith('init_'))) {
            return false;
          }
          // Se lastReadTime está registrado e a mensagem é antiga/legada
          return false;
        }

        if (msgTime <= lastReadTime) {
          return false;
        }
      }

      return true;
    }).length;
  } catch (err) {
    console.warn('Erro ao calcular mensagens não lidas:', err);
    return 0;
  }
}

export default function Sidebar({
  activeView = 'chat',
  setActiveView,
  channels = [],
  collaborators = [],
  whatsAppContacts = [],
  activeChat = { type: 'channel', id: 'c-geral' }, // { type: 'channel' | 'dm' | 'whatsapp', id: string }
  messages = {},
  channelReadReceipts = {},
  dmReadReceipts = {},
  onSelectChannel,
  onSelectCollaborator,
  onSelectWhatsAppContact,
  onOpenNewWhatsAppContact,
  onDeleteChat,
  onOpenAICopilot,
  onOpenAIMemory,
  onOpenNewChannel,
  onOpenNewCollaborator,
  onEditCollaborator,
  onOpenWhatsAppConnection,
  onOpenInstagramImport,
  onOpenEduControlSync,
  eduControlStudents = [],
  aiAutonomous = true,
  setAiAutonomous,
  theme = 'light',
  onToggleTheme,
  currentUser = {},
  onToggleAvailability,
  realtimeStatus = 'connected',
  onOpenUserSelectModal,
  unreadCounts = {},
  lastSyncTime = '',
  officialWhatsAppNumber = import.meta.env.VITE_OFFICIAL_WHATSAPP_NUMBER || '+55 (11) 93059-4591',
  institutionName = import.meta.env.VITE_INSTITUTION_NAME || 'Faculdade Olavo Bilac • Grupo EstudeMais',
  portfolioLabel = import.meta.env.VITE_PORTFOLIO_LABEL || 'Matriz Olavo Bilac • Carteira Ativa'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarTab, setSidebarTab] = useState('whatsapp'); // 'whatsapp' | 'internal'
  const isDirector = currentUser?.roleType === 'diretor';

  const safeChannels = Array.isArray(channels) ? channels : [];
  const safeCollaborators = Array.isArray(collaborators) ? collaborators : [];
  const safeWhatsAppContacts = Array.isArray(whatsAppContacts) ? whatsAppContacts : [];
  const safeUnread = unreadCounts || {};

  const cleanSearch = (searchQuery || '').trim().toLowerCase();

  // Garante que todos os canais ativos permaneçam sempre visíveis e acessíveis
  const accessibleChannels = safeChannels.filter((c) => Boolean(c));

  // Filtragem pela busca estilo WhatsApp
  const filteredChannels = accessibleChannels.filter((c) => {
    if (!c) return false;
    const name = (c.name || '').toLowerCase();
    const desc = (c.desc || '').toLowerCase();
    return name.includes(cleanSearch) || desc.includes(cleanSearch);
  });

  // Usuário Virtual de IA (Item 6)
  const botCollaborator = safeCollaborators.find((u) => u && (u.isBot || u.id === 'u_ia_copilot'));

  // Colaboradores humanos filtrados
  const filteredCollaborators = safeCollaborators.filter((u) => {
    if (!u || u.isBot) return false;
    if (currentUser?.id && u.id === currentUser.id) return false;
    const name = (u.name || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    const department = (u.department || '').toLowerCase();
    return name.includes(cleanSearch) || role.includes(cleanSearch) || department.includes(cleanSearch);
  });

  // Contatos do WhatsApp (Leads e Alunos): mantém todas as conversas ativas permanentemente visíveis e acessíveis
  const isManager = hasFullPortfolioAccess(currentUser);

  // 3. LIMPEZA DE DUPLICATAS VISUAIS:
  // Agrupa e desduplica conversas do mesmo número WhatsApp pelo updated_at / lastMessageAt mais recente
  const accessibleWhatsAppContacts = useMemo(() => {
    const map = new Map();

    (safeWhatsAppContacts || []).forEach((contact) => {
      if (!contact) return;
      // 1. REGRA DE VISIBILIDADE POR PERFIL E DEPARTAMENTO:
      // Gestor/Admin: 100% de visibilidade.
      // Colaborador: apenas se atribuído diretamente ou na fila de triagem do seu departamento.
      if (!canUserViewChat(contact, currentUser, collaborators)) return;

      const canonKey = getCanonicalPhoneKey(contact);
      if (!canonKey) {
        map.set(contact.id, contact);
        return;
      }

      if (!map.has(canonKey)) {
        map.set(canonKey, contact);
      } else {
        const existing = map.get(canonKey);
        const existingTime = new Date(existing.updated_at || existing.lastMessageAt || existing.lastInteraction || 0).getTime();
        const incomingTime = new Date(contact.updated_at || contact.lastMessageAt || contact.lastInteraction || 0).getTime();

        const unreadTotal = Math.max(
          Number(existing.unread_count ?? existing.unread ?? 0),
          Number(contact.unread_count ?? contact.unread ?? 0)
        );

        if (incomingTime >= existingTime) {
          map.set(canonKey, {
            ...existing,
            ...contact,
            unread_count: unreadTotal,
            unread: unreadTotal
          });
        } else {
          map.set(canonKey, {
            ...contact,
            ...existing,
            unread_count: unreadTotal,
            unread: unreadTotal
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const getContactSortTime = (c) => {
        const canonKey = getCanonicalPhoneKey(c);
        const cMessages = messages?.[c.id] || (canonKey ? messages[`wa-${canonKey}`] : null) || (canonKey ? messages[canonKey] : null) || [];
        const realMsgs = (Array.isArray(cMessages) ? cMessages : []).filter((m) => {
          if (!m || !m.text) return false;
          if (m.chat_id?.startsWith('sys_') || m.id?.startsWith('sys_')) return false;
          const clean = (m.text || '').replace(/<!--[\s\S]*?-->/g, '').trim();
          return clean.length > 0 && clean !== 'Mensagem recebida' && clean !== '💬 Mensagem recebida';
        });
        const lastMsg = realMsgs.length > 0 ? realMsgs[realMsgs.length - 1] : null;
        const rawTime = lastMsg?.created_at || lastMsg?.timestampRaw || c.lastMessageAt || c.created_at || c.createdAt || 0;
        const parsed = parseDateSafely(rawTime);
        const timeVal = parsed instanceof Date ? parsed.getTime() : (typeof rawTime === 'number' ? rawTime : 0);
        return isNaN(timeVal) ? 0 : timeVal;
      };
      return getContactSortTime(b) - getContactSortTime(a);
    });
  }, [safeWhatsAppContacts, currentUser, messages]);

  const filteredWhatsAppContacts = accessibleWhatsAppContacts.filter((c) => {
    if (!c) return false;
    const student = matchStudentByPhone(c.id || c.phone, eduControlStudents);
    const studentName = (student?.name || '').toLowerCase();
    const studentCourse = (student?.course || '').toLowerCase();
    const studentPolo = (student?.polo || '').toLowerCase();
    const studentStatus = (student?.academicStatus || '').toLowerCase();
    const studentMatricula = (student?.matricula || '').toLowerCase();
    const studentCPF = (student?.cpf || student?.cleanCPF || '').replace(/\D/g, '');
    const studentEmail = (student?.email || '').toLowerCase();

    const name = (c.name || '').toLowerCase();
    const phone = (c.phone || '').replace(/\D/g, '');
    const contactCPF = (c.cpf || c.cleanCPF || '').replace(/\D/g, '');
    const contactEmail = (c.email || '').toLowerCase();
    const department = (c.department || '').toLowerCase();
    const statusLabel = (c.statusLabel || '').toLowerCase();
    const cleanSearchDigits = cleanSearch.replace(/\D/g, '');

    return (
      name.includes(cleanSearch) ||
      studentName.includes(cleanSearch) ||
      studentCourse.includes(cleanSearch) ||
      studentPolo.includes(cleanSearch) ||
      studentStatus.includes(cleanSearch) ||
      studentMatricula.includes(cleanSearch) ||
      studentEmail.includes(cleanSearch) ||
      contactEmail.includes(cleanSearch) ||
      (cleanSearchDigits && phone.includes(cleanSearchDigits)) ||
      (cleanSearchDigits && studentCPF.includes(cleanSearchDigits)) ||
      (cleanSearchDigits && contactCPF.includes(cleanSearchDigits)) ||
      department.includes(cleanSearch) ||
      statusLabel.includes(cleanSearch)
    );
  });

  const totalWhatsAppUnread = accessibleWhatsAppContacts.reduce((sum, c) => {
    const count = (c?.id && safeUnread[c.id]) || c?.unread_count || c?.unread || 0;
    return sum + Number(count || 0);
  }, 0);

  const currentUserId = currentUser?.id || 'u1';

  const totalInternalUnread = accessibleChannels.reduce((sum, c) => {
    if (!c) return sum;
    const channelMessages = Array.isArray(messages?.[c.id]) ? messages[c.id] : [];
    const isChannelActive = activeView === 'chat' && activeChat?.type === 'channel' && activeChat?.id === c.id;
    const strippedId = (c.id || '').replace(/^c-/, '');
    const lastReadAt =
      channelReadReceipts?.[c.id] ||
      channelReadReceipts?.[c.name] ||
      channelReadReceipts?.[strippedId] ||
      channelReadReceipts?.[`c-${strippedId}`];
    const count = isChannelActive ? 0 : countUnreadMessages(channelMessages, currentUserId, lastReadAt);
    return sum + Number(count || 0);
  }, 0) + filteredCollaborators.reduce((sum, u) => {
    if (!u) return sum;
    const dmKey = getChatKey({ type: 'dm', id: u.id }, currentUserId);
    const sessionMessages = Array.isArray(messages?.[dmKey])
      ? messages[dmKey]
      : (Array.isArray(messages?.[u.id]) ? messages[u.id] : []);
    const isDmActive = activeView === 'chat' && activeChat?.type === 'dm' && activeChat?.id === u.id;
    const lastReadAt = dmReadReceipts?.[u.id] || dmReadReceipts?.[dmKey];
    const count = isDmActive ? 0 : countUnreadMessages(sessionMessages, currentUserId, lastReadAt);
    return sum + Number(count || 0);
  }, 0);

  return (
    <aside className="w-84 bg-chatSidebar border-r border-chatBorder flex flex-col h-full select-none transition-colors">
      {/* Top Header - Estilo WhatsApp Web */}
      <div className="h-16 px-4 bg-chatPanel flex items-center justify-between border-b border-chatBorder">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-xl font-bold text-white shadow-sm shrink-0">
            🎓
          </div>
          <div>
            <h1 className="font-bold text-chatTextTitle text-base leading-tight flex items-center gap-1.5">
              EduChat
              <span className="text-[10px] bg-brand-600/15 text-brand-600 dark:text-brand-500 font-semibold px-1.5 py-0.5 rounded" title="Faculdade Olavo Bilac • Grupo EstudeMais">
                Olavo Bilac
              </span>
            </h1>
            <p className="text-[11px] text-chatTextMuted flex items-center gap-1.5" title="Sincronização em segundo plano a cada 2 minutos">
              <span>Sync 2 min</span>
              {realtimeStatus === 'connected' ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Supabase Realtime Ativo" />
              ) : realtimeStatus === 'connecting' ? (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" title="Conectando..." />
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-500" title="Desconectado" />
              )}
              {lastSyncTime && (
                <span className="text-[10px] text-chatTextMuted">({lastSyncTime})</span>
              )}
            </p>
          </div>
        </div>

        {/* Botões de Ação Centralizados no Topo: Upload de Bases, Importar Leads, Conexão WhatsApp, IA & Base de Conhecimento */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenEduControlSync}
            title="Upload de Bases / Importação de Arquivos (.csv ou .txt)"
            className="p-1.5 rounded-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition flex items-center gap-1 cursor-pointer"
          >
            <Database size={18} />
          </button>

          <button
            onClick={onOpenInstagramImport}
            title="Importar Leads (.csv) para a Expansão"
            className="p-1.5 rounded-full text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition flex items-center gap-1 cursor-pointer"
          >
            <Upload size={18} />
          </button>

          <button
            onClick={() => onOpenWhatsAppConnection && onOpenWhatsAppConnection('qrcode')}
            title="Conexão WhatsApp & QR Code Oficial"
            className="p-1.5 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex items-center gap-1 cursor-pointer"
          >
            <Smartphone size={18} />
          </button>

          <button
            onClick={onOpenAIMemory}
            title="Base de Conhecimento IA (Documentos e Regras)"
            className="p-1.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200/80 dark:hover:bg-chatBorder/80 transition cursor-pointer"
          >
            <Brain size={18} className="text-yellow-600 dark:text-yellow-400" />
          </button>

          <button
            onClick={onOpenAICopilot}
            title="Copiloto de IA & Diagnóstico"
            className="p-1.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200/80 dark:hover:bg-chatBorder/80 transition cursor-pointer"
          >
            <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
          </button>
        </div>
      </div>

      {/* Navegação Principal das Visões (Apenas Gestor/Admin tem acesso à Gestão) */}
      <div className="p-2 border-b border-chatBorder flex gap-1 bg-chatSidebar">
        <button
          onClick={() => setActiveView('chat')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeView === 'chat'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <MessageSquare size={15} />
          Conversas
        </button>
        <button
          onClick={() => setActiveView('kanban')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeView === 'kanban'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <CheckSquare size={15} />
          Kanban
        </button>
        {isManager && (
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeView === 'dashboard' || activeView === 'gestao'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel hover:text-chatTextTitle'
            }`}
            title="Painel do Gestor (BI, Indicadores e Atas Executivas)"
          >
            <BarChart3 size={15} />
            Gestão
          </button>
        )}
      </div>

      {/* Alternador de Abas de Conversas: WhatsApp Alunos vs Equipe Interna */}
      <div className="px-2 pt-2 pb-1 bg-chatSidebar flex gap-1 border-b border-chatBorder">
        <button
          type="button"
          onClick={() => setSidebarTab('whatsapp')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            sidebarTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <Smartphone size={13} />
          {isManager
            ? `WhatsApp Alunos (${accessibleWhatsAppContacts.length})`
            : `Minha Carteira (${accessibleWhatsAppContacts.length})`}
          {totalWhatsAppUnread > 0 && (
            <span className="bg-white text-emerald-700 text-[10px] font-bold px-1.5 rounded-full">
              {totalWhatsAppUnread}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('internal')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            sidebarTab === 'internal'
              ? 'bg-brand-600 text-white shadow-2xs'
              : 'text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <Users size={13} />
          Equipe Interna
          {totalInternalUnread > 0 && (
            <span className="bg-white text-brand-700 text-[10px] font-bold px-1.5 rounded-full">
              {totalInternalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Barra de Pesquisa Clássica do WhatsApp Web */}
      <div className="px-3 py-2 bg-white dark:bg-chatSidebar border-b border-chatBorder flex items-center gap-2">
        <div className="relative flex-1 flex items-center bg-[#f0f2f5] dark:bg-chatPanel rounded-lg px-3 py-1.5">
          <Search size={15} className="text-[#54656f] dark:text-[#8696a0] mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={sidebarTab === 'whatsapp' ? "Buscar aluno, telefone ou setor..." : "Pesquisar canal ou colega..."}
            className="w-full bg-transparent text-xs text-chatTextTitle placeholder:text-[#54656f] dark:placeholder:text-[#8696a0] focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de Conversas: WhatsApp Alunos OU Canais/DMs Internas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {sidebarTab === 'whatsapp' ? (
          /* ABA WHATSAPP ALUNOS */
          <div className="space-y-1">
            {/* Botão de Início de Conversa Ativa */}
            <button
              type="button"
              onClick={onOpenNewWhatsAppContact}
              className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer"
              title="Iniciar conversa ativa com novo número no WhatsApp"
            >
              <Plus size={15} className="stroke-[3]" />
              <span>+ Novo Atendimento WhatsApp</span>
            </button>

            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
              <span>
                {isManager
                  ? `Atendimento WhatsApp (${filteredWhatsAppContacts.length})`
                  : `Minha Carteira (${filteredWhatsAppContacts.length})`}
              </span>
              <button
                type="button"
                onClick={onOpenNewWhatsAppContact}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer uppercase tracking-wider"
                title="Novo Atendimento WhatsApp"
              >
                <span>+ Novo</span>
              </button>
            </div>

            {/* Identificador de Carteira Exclusiva para Consultores */}
            {!isManager && (
              <div className="mx-1 mb-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
                    Consultor: {currentUser?.name || 'Consultor'}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-chatPanel px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                  Carteira Exclusiva
                </span>
              </div>
            )}

            {filteredWhatsAppContacts.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-chatPanel/40 border border-slate-200/80 dark:border-chatBorder/80 mx-1 my-2">
                <p className="text-xs font-semibold text-chatTextTitle mb-1">
                  {isManager ? 'Nenhum atendimento encontrado' : 'Nenhum atendimento na sua carteira'}
                </p>
                <p className="text-[10.5px] text-chatTextMuted leading-relaxed">
                  {isManager
                    ? 'Nenhuma conversa coincide com os filtros da busca.'
                    : 'Você não possui conversas atribuídas à sua carteira no momento. Novos atendimentos distribuídos pela gestão aparecerão aqui automaticamente.'}
                </p>
              </div>
            ) : (
              filteredWhatsAppContacts.map((contact) => {
                if (!contact) return null;
                const isActive = activeView === 'chat' && activeChat?.type === 'whatsapp' && (
                  activeChat?.id === contact.id ||
                  getCanonicalPhoneKey(activeChat?.id) === getCanonicalPhoneKey(contact)
                );
                const contactUnread = unreadCounts?.[contact.id] || contact.unread_count || contact.unread || 0;
                const student = matchStudentByPhone(contact.id || contact.phone, eduControlStudents);
                const displayName = student?.name || contact.name;
                const canonPhone = getCanonicalPhoneKey(contact);
                const contactMessages = messages?.[contact.id] || (canonPhone ? messages[`wa-${canonPhone}`] : null) || (canonPhone ? messages[canonPhone] : null) || [];
                const realContactMsgs = (Array.isArray(contactMessages) ? contactMessages : []).filter((m) => {
                  if (!m || !m.text) return false;
                  if (m.chat_id?.startsWith('sys_') || m.id?.startsWith('sys_')) return false;
                  const clean = (m.text || '').replace(/<!--[\s\S]*?-->/g, '').trim();
                  return clean.length > 0 && clean !== 'Mensagem recebida' && clean !== '💬 Mensagem recebida';
                });
                const lastMsg = realContactMsgs.length > 0 ? realContactMsgs[realContactMsgs.length - 1] : null;
                const contactTime = lastMsg?.created_at || lastMsg?.timestampRaw || contact.lastMessageAt || contact.created_at || contact.createdAt;

                return (
                  <button
                    key={contact.id}
                    onClick={() => onSelectWhatsAppContact(contact.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition border group ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-500/50 shadow-xs'
                        : 'border-transparent hover:bg-[#f5f6f6] dark:hover:bg-chatPanel/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative text-2xl shrink-0 p-1 bg-white dark:bg-chatPanel rounded-lg border border-slate-200 dark:border-chatBorder shadow-2xs">
                        <span>{student ? '🎓' : contact.avatar}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-chatPanel" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-xs leading-tight truncate ${isActive ? 'font-bold text-chatTextTitle' : 'font-semibold text-chatTextTitle'}`}>
                            {displayName}
                          </p>
                          {contactUnread > 0 && (
                            <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center shadow-xs animate-pulse inline-flex items-center justify-center">
                              {contactUnread}
                            </span>
                          )}
                          {student ? (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              student.academicStatus === 'Ativo'
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                : student.academicStatus === 'Certificado'
                                ? 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300'
                                : student.academicStatus === 'Veterano'
                                ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'
                                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                            }`}>
                              {student.academicStatus}
                            </span>
                          ) : (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              contact.status === 'carteira_ativa'
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                                : contact.status === 'veterano_retencao'
                                ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'
                                : contact.status === 'lead_instagram'
                                ? 'bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-950/60 dark:to-rose-950/60 text-pink-800 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40'
                                : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                            }`}>
                              {contact.statusLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-chatTextMuted truncate mt-0.5 flex items-center gap-1">
                          <span>{contact.phone}</span>
                          {student?.cpf && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-purple-700 dark:text-purple-300 font-medium">CPF: {student.cpf}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="font-semibold text-brand-700 dark:text-brand-400">
                            {student ? student.course : contact.department}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {student ? `📍 ${student.polo} • Matrícula ${student.matricula}` : contact.triageContext}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                      <span className={`text-[10px] ${contactUnread > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-chatTextMuted font-medium'}`}>
                        {formatRelativeChatTime(contactTime)}
                      </span>
                      {contactUnread > 0 && (
                        <span className="bg-emerald-600 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-bounce inline-flex items-center justify-center">
                          {contactUnread}
                        </span>
                      )}
                      {onDeleteChat && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(contact.id);
                          }}
                          title="Excluir histórico deste contato"
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 rounded transition cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* ABA EQUIPE INTERNA (CANAIS + DMS) */
          <>
            {/* Assistente IA Institucional Pinned */}
            {botCollaborator && (
              <div className="px-1 mb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles size={11} /> Suporte & Dúvidas IA
                  </span>
                  <span className="text-[9px] bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded font-semibold">
                    Online 24h
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectCollaborator && onSelectCollaborator(botCollaborator.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition border cursor-pointer ${
                    activeView === 'chat' && activeChat?.type === 'dm' && activeChat?.id === botCollaborator.id
                      ? 'bg-purple-100/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-500 shadow-sm'
                      : 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/30 hover:bg-purple-100/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative text-2xl shrink-0 p-1 bg-white dark:bg-chatPanel rounded-lg border border-purple-300 dark:border-purple-500/40 shadow-xs">
                      <span>{botCollaborator.avatar || '🤖'}</span>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-chatPanel animate-pulse" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-chatTextTitle leading-tight truncate flex items-center gap-1">
                        {botCollaborator.name || 'Assistente IA'}
                        <span className="text-[9px] bg-yellow-400/20 text-yellow-800 dark:text-yellow-300 font-bold px-1 rounded">
                          MEC & POP
                        </span>
                      </p>
                      <p className="text-[10px] text-purple-700 dark:text-purple-300 truncate mt-0.5">
                        Tire dúvidas de processos, Asaas e MEC
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const botDmKey = getChatKey({ type: 'dm', id: botCollaborator?.id || 'u_ia_copilot' }, currentUserId);
                    const botMessages = Array.isArray(messages?.[botDmKey]) ? messages[botDmKey] : [];
                    const isBotActive = activeView === 'chat' && activeChat?.type === 'dm' && activeChat?.id === (botCollaborator?.id || 'u_ia_copilot');
                    const botLastRead = dmReadReceipts?.[botCollaborator?.id || 'u_ia_copilot'];
                    const botUnread = isBotActive ? 0 : countUnreadMessages(botMessages, currentUserId, botLastRead);

                    return botUnread > 0 ? (
                      <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-bounce">
                        {botUnread}
                      </span>
                    ) : (
                      <span className="text-[10px] text-purple-600 dark:text-purple-300 font-bold">
                        Perguntar →
                      </span>
                    );
                  })()}
                </button>
              </div>
            )}

            {/* Canais Operacionais */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
                <span>Canais ({accessibleChannels?.length || 0})</span>
                {onOpenNewChannel && (
                  <button
                    type="button"
                    onClick={onOpenNewChannel}
                    title="Criar novo canal operacional"
                    className="text-brand-600 dark:text-brand-500 hover:underline flex items-center gap-0.5 text-[11px] normal-case font-semibold cursor-pointer"
                  >
                    <Plus size={13} /> Novo
                  </button>
                )}
              </div>

              <div className="space-y-0.5">
                {filteredChannels && filteredChannels.length > 0 ? (
                  filteredChannels.map((c) => {
                    if (!c) return null;
                    const isActive = activeView === 'chat' && activeChat?.type === 'channel' && (activeChat?.id === c.id || activeChat?.id === c.name);
                    const channelMessages = Array.isArray(messages?.[c.id]) ? messages[c.id] : [];
                    const strippedId = (c.id || '').replace(/^c-/, '');
                    const lastReadAt =
                      channelReadReceipts?.[c.id] ||
                      channelReadReceipts?.[c.name] ||
                      channelReadReceipts?.[strippedId] ||
                      channelReadReceipts?.[`c-${strippedId}`];
                    const channelUnread = isActive ? 0 : countUnreadMessages(channelMessages, currentUserId, lastReadAt);
                    return (
                      <button
                        type="button"
                        key={c.id || c.name}
                        onClick={() => onSelectChannel && onSelectChannel(c.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition cursor-pointer ${
                          isActive
                            ? 'bg-[#f0f2f5] dark:bg-chatPanel font-medium shadow-xs'
                            : 'hover:bg-[#f5f6f6] dark:hover:bg-chatPanel/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-chatPanel flex items-center justify-center text-brand-600 dark:text-brand-500 shrink-0 border border-slate-200 dark:border-chatBorder">
                            <Hash size={16} />
                          </div>
                          <div className="truncate">
                            <p className={`text-sm truncate leading-tight ${isActive ? 'font-bold text-chatTextTitle' : 'text-chatTextTitle'}`}>
                              {c.name || 'canal'}
                            </p>
                            {c.desc && (
                              <p className="text-[11px] text-chatTextMuted truncate mt-0.5">
                                {c.desc}
                              </p>
                            )}
                          </div>
                        </div>
                        {channelUnread > 0 && (
                          <span className="bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-pulse">
                            {channelUnread}
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-chatTextMuted italic px-3 py-2">
                    Nenhum canal encontrado.
                  </p>
                )}
              </div>
            </div>

            {/* Conversas Diretas (1 a 1) com Badges de Mensagens Não Lidas (Item 2) */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
                <span>Conversas 1 a 1</span>
                {onOpenNewCollaborator && (
                  <button
                    type="button"
                    onClick={onOpenNewCollaborator}
                    title="Cadastrar novo colaborador"
                    className="text-brand-600 dark:text-brand-500 hover:underline flex items-center gap-0.5 text-[11px] normal-case font-semibold cursor-pointer"
                  >
                    <Plus size={13} /> Convidar
                  </button>
                )}
              </div>

              <div className="space-y-0.5">
                {filteredCollaborators && filteredCollaborators.length > 0 ? (
                  filteredCollaborators.map((user) => {
                    if (!user) return null;
                    const isActive = activeView === 'chat' && activeChat?.type === 'dm' && activeChat?.id === user.id;
                    const dmKey = getChatKey({ type: 'dm', id: user.id }, currentUserId);
                    const sessionMessages = Array.isArray(messages?.[dmKey])
                      ? messages[dmKey]
                      : (Array.isArray(messages?.[user.id]) ? messages[user.id] : []);

                    const lastReadAt = dmReadReceipts?.[user.id] || dmReadReceipts?.[dmKey];
                    const dmUnread = isActive ? 0 : countUnreadMessages(sessionMessages, currentUserId, lastReadAt);
                    return (
                       <div
                        key={user.id}
                        className="group/collab relative flex items-center"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectCollaborator && onSelectCollaborator(user.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition cursor-pointer ${
                            isActive
                              ? 'bg-[#f0f2f5] dark:bg-chatPanel shadow-xs font-medium'
                              : 'hover:bg-[#f5f6f6] dark:hover:bg-chatPanel/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="relative text-2xl shrink-0">
                              <span>{user.avatar || '👤'}</span>
                              <span
                                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-chatSidebar ${
                                  user.online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                title={user.online ? 'Online' : user.lastSeen ? `Visto por último ${formatLastSeen(user.lastSeen)}` : 'Offline'}
                              />
                            </div>
                            <div className="truncate pr-5">
                              <p className={`text-sm leading-tight truncate ${isActive ? 'font-bold text-chatTextTitle' : 'text-chatTextTitle'}`}>
                                {user.name || 'Colaborador'}
                              </p>
                              <p className="text-[11px] text-chatTextMuted truncate mt-0.5 flex items-center gap-1">
                                <span className="font-semibold text-brand-600 dark:text-brand-400">{user.department || 'Comercial'}</span>
                                <span>•</span>
                                <span className="truncate">{user.role || 'Equipe'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {dmUnread > 0 ? (
                              <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-bounce">
                                {dmUnread}
                              </span>
                            ) : (
                              <span className="text-[10px] text-chatTextMuted bg-slate-100 dark:bg-chatBoxSecondary px-1.5 py-0.5 rounded border border-slate-200 dark:border-chatBorder">
                                1 a 1
                              </span>
                            )}
                          </div>
                        </button>

                        {onEditCollaborator && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCollaborator(user);
                            }}
                            className="hidden group-hover/collab:flex absolute right-11 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 bg-white dark:bg-chatPanel shadow-xs border border-slate-200 dark:border-chatBorder transition cursor-pointer"
                            title={`Editar departamento e cargo de ${user.name}`}
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-chatTextMuted italic px-3 py-2">
                    Nenhum colega encontrado.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rodapé: Perfil Ativo (Disponibilidade, Foto, Nome, Cargo, Trocar e Alternador de Tema) */}
      <div className="p-3 bg-chatPanel border-t border-chatBorder">
        {/* 2. CONTROLE DE DISPONIBILIDADE: Alternador Visual entre "Disponível" e "Em Pausa" */}
        <button
          type="button"
          onClick={onToggleAvailability}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer mb-2.5 ${
            currentUser?.is_available !== false
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
          title={
            currentUser?.is_available !== false
              ? 'Status atual: Disponível. Clique para entrar Em Pausa (almoço/folga)'
              : 'Status atual: Em Pausa. Clique para ficar Disponível para receber atendimentos'
          }
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                currentUser?.is_available !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium">
              {currentUser?.is_available !== false ? 'Disponível' : 'Em Pausa (Almoço)'}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/40 shadow-xs">
            {currentUser?.is_available !== false ? 'Pausar' : 'Ativar'}
          </span>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-base shadow-xs shrink-0">
              {currentUser?.avatar || '👤'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-chatTextTitle leading-tight truncate">
                {currentUser?.name || 'Usuário'}
              </p>
              <p className="text-[10px] text-brand-600 dark:text-brand-500 font-medium truncate flex items-center gap-1">
                <Circle size={6} fill="currentColor" /> {currentUser?.role || 'Colaborador'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenUserSelectModal}
              title="Trocar Perfil / Identificação de Usuário"
              className="text-[10px] bg-slate-100 dark:bg-chatCard hover:bg-brand-50 dark:hover:bg-brand-950/40 text-[#54656f] dark:text-[#aebac1] hover:text-brand-600 font-semibold px-2 py-1 rounded-md border border-slate-200 dark:border-chatBorder transition cursor-pointer"
            >
              Trocar
            </button>
            {/* Botão Sol/Lua Discreto */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
              className="p-1.5 rounded-full text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-200/70 dark:hover:bg-chatCard transition cursor-pointer"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} className="text-yellow-400" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
