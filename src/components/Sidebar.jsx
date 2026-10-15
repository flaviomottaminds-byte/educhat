import React, { useState } from 'react';
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
  Upload
} from 'lucide-react';
import { hasFullPortfolioAccess, isChatAssignedToUser } from '../lib/portfolioAccess';

export default function Sidebar({
  activeView = 'chat',
  setActiveView,
  channels = [],
  collaborators = [],
  whatsAppContacts = [],
  activeChat = { type: 'channel', id: 'c-geral' }, // { type: 'channel' | 'dm' | 'whatsapp', id: string }
  onSelectChannel,
  onSelectCollaborator,
  onSelectWhatsAppContact,
  onOpenAICopilot,
  onOpenAIMemory,
  onOpenNewChannel,
  onOpenNewCollaborator,
  onOpenWhatsAppConnection,
  onOpenInstagramImport,
  aiAutonomous = true,
  setAiAutonomous,
  theme = 'light',
  onToggleTheme,
  currentUser = {},
  onSwitchUser,
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

  // Canais visíveis por perfil (Diretor vê todos; Colaborador vê gerais e do seu setor)
  const accessibleChannels = safeChannels.filter((c) => {
    if (!c) return false;
    if (isDirector) return true;
    if (!c.department || c.department === 'Todos') return true;
    const userDept = (currentUser?.department || '').trim().toLowerCase();
    const channelDept = (c.department || '').trim().toLowerCase();
    return userDept && channelDept === userDept;
  });

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

  // Contatos do WhatsApp (Leads e Alunos)
  // ISOLAMENTO DE CARTEIRA:
  // - Gestores / Diretoria (Flávio Motta, Diretores): visibilidade completa de todas as conversas e filas
  // - Consultores Comerciais / Colaboradores: visibilidade restrita estritamente aos chats atribuídos a eles
  const isManager = hasFullPortfolioAccess(currentUser);

  const accessibleWhatsAppContacts = safeWhatsAppContacts.filter((c) => {
    if (!c) return false;
    if (isManager) return true;
    return isChatAssignedToUser(c, currentUser);
  });

  const filteredWhatsAppContacts = accessibleWhatsAppContacts.filter((c) => {
    if (!c) return false;
    const name = (c.name || '').toLowerCase();
    const phone = (c.phone || '').replace(/\D/g, '');
    const department = (c.department || '').toLowerCase();
    const statusLabel = (c.statusLabel || '').toLowerCase();
    const cleanSearchPhone = cleanSearch.replace(/\D/g, '');
    return (
      name.includes(cleanSearch) ||
      (cleanSearchPhone && phone.includes(cleanSearchPhone)) ||
      department.includes(cleanSearch) ||
      statusLabel.includes(cleanSearch)
    );
  });

  const totalWhatsAppUnread = accessibleWhatsAppContacts.reduce((sum, c) => {
    return sum + (c?.id && safeUnread[c.id] ? Number(safeUnread[c.id]) : 0);
  }, 0);

  const totalInternalUnread = accessibleChannels.reduce((sum, c) => {
    if (!c) return sum;
    const count = (c.id && safeUnread[c.id]) || (c.name && safeUnread[c.name]) || (c.name && safeUnread[`#${c.name}`]) || 0;
    return sum + Number(count || 0);
  }, 0) + filteredCollaborators.reduce((sum, u) => {
    if (!u) return sum;
    return sum + Number((u.id && safeUnread[u.id]) || 0);
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

        {/* Botões de Ação: Conexão WhatsApp, Importar Leads, IA & Base de Conhecimento */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenInstagramImport}
            title="Importar Leads (Instagram Ads) para a Expansão"
            className="p-1.5 rounded-full text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition flex items-center gap-1 cursor-pointer"
          >
            <Upload size={18} />
          </button>

          <button
            onClick={() => onOpenWhatsAppConnection && onOpenWhatsAppConnection('qrcode')}
            title="Conexão WhatsApp & QR Code Oficial"
            className="p-1.5 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex items-center gap-1"
          >
            <Smartphone size={18} />
          </button>

          {isDirector && (
            <button
              onClick={onOpenAIMemory}
              title="Base de Conhecimento da IA (Clientes VIP, SLAs e POPs)"
              className="p-1.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200/80 dark:hover:bg-chatBorder/80 transition"
            >
              <Brain size={18} className="text-yellow-600 dark:text-yellow-400" />
            </button>
          )}

          <button
            onClick={onOpenAICopilot}
            title="Copiloto de IA & Diagnóstico"
            className="p-1.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200/80 dark:hover:bg-chatBorder/80 transition"
          >
            <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
          </button>
        </div>
      </div>

      {/* Navegação Principal das Visões (Chat, Kanban, Gestão) */}
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
        <button
          onClick={() => setActiveView('gestao')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeView === 'gestao'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <BarChart3 size={15} />
          Gestão
          {!isDirector && <Lock size={10} className="text-chatTextMuted ml-0.5" />}
        </button>
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
          WhatsApp Alunos
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

      {/* Painel de Status WhatsApp & Teste Rápido (Exibido na aba WhatsApp) */}
      {sidebarTab === 'whatsapp' && (
        <div className="px-3 pt-2">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="truncate">
                <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 leading-tight truncate">
                  Gateway WhatsApp Ativo
                </p>
                <p
                  className="text-[9px] text-emerald-700 dark:text-emerald-400 truncate"
                  title={`${officialWhatsAppNumber} • ${institutionName} (${portfolioLabel})`}
                >
                  {officialWhatsAppNumber} • {portfolioLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onOpenWhatsAppConnection && onOpenWhatsAppConnection('simulator')}
                title="Abrir Simulador de Webhook & Carteira"
                className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow-2xs transition"
              >
                <Zap size={11} /> Testar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modo IA Autônoma (Exibido na aba Interna) */}
      {sidebarTab === 'internal' && (
        <div className="px-3 pt-2">
          <div className="bg-[#f0f2f5] dark:bg-purple-950/20 border border-slate-200 dark:border-purple-500/20 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={15} className={aiAutonomous ? 'text-brand-600 dark:text-yellow-400 animate-pulse' : 'text-chatTextMuted'} />
              <div>
                <p className="text-[11px] font-bold text-chatTextTitle">IA Criar Card Sozinha</p>
                <p className="text-[9px] text-chatTextMuted">
                  {aiAutonomous ? 'Detecta tarefas automaticamente' : 'Manual / Sob comando'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiAutonomous(!aiAutonomous)}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${
                aiAutonomous ? 'bg-brand-600' : 'bg-slate-300 dark:bg-chatPanel'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  aiAutonomous ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Lista de Conversas: WhatsApp Alunos OU Canais/DMs Internas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {sidebarTab === 'whatsapp' ? (
          /* ABA WHATSAPP ALUNOS */
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
              <span>
                {isManager
                  ? `Atendimento WhatsApp (${filteredWhatsAppContacts.length})`
                  : `Minha Carteira (${filteredWhatsAppContacts.length})`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenInstagramImport}
                  className="text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 text-[10px] normal-case font-bold cursor-pointer"
                  title="Importar leads em CSV do Instagram Ads diretamente para a Expansão"
                >
                  <Upload size={12} /> Importar Leads
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWhatsAppConnection && onOpenWhatsAppConnection('qrcode')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 text-[10px] normal-case font-bold"
                  title="Conexão Railway ativa em background. Clique para ver status da instância."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <QrCode size={12} /> Conectar
                </button>
              </div>
            </div>

            {/* Identificador de Carteira Exclusiva para Consultores */}
            {!isManager && (
              <div className="mx-1 mb-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
                    Consultor: {currentUser.name}
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
                const isActive = activeView === 'chat' && activeChat.type === 'whatsapp' && activeChat.id === contact.id;
                const contactUnread = unreadCounts[contact.id] || 0;
                return (
                  <button
                    key={contact.id}
                    onClick={() => onSelectWhatsAppContact(contact.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition border ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-500/50 shadow-xs'
                        : 'border-transparent hover:bg-[#f5f6f6] dark:hover:bg-chatPanel/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative text-2xl shrink-0 p-1 bg-white dark:bg-chatPanel rounded-lg border border-slate-200 dark:border-chatBorder shadow-2xs">
                        <span>{contact.avatar}</span>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-chatPanel" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs leading-tight truncate ${isActive ? 'font-bold text-chatTextTitle' : 'font-semibold text-chatTextTitle'}`}>
                            {contact.name}
                          </p>
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
                        </div>
                        <p className="text-[10px] text-chatTextMuted truncate mt-0.5 flex items-center gap-1">
                          <span>{contact.phone}</span>
                          <span>•</span>
                          <span className="font-semibold text-brand-700 dark:text-brand-400">{contact.department}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {contact.triageContext}
                        </p>
                      </div>
                    </div>

                    {contactUnread > 0 ? (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-bounce">
                        {contactUnread}
                      </span>
                    ) : (
                      <span className="text-[10px] text-chatTextMuted font-medium">
                        {contact.lastInteraction}
                      </span>
                    )}
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

                  {(safeUnread[botCollaborator.id] || 0) > 0 ? (
                    <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-bounce">
                      {safeUnread[botCollaborator.id]}
                    </span>
                  ) : (
                    <span className="text-[10px] text-purple-600 dark:text-purple-300 font-bold">
                      Perguntar →
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Canais Operacionais */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
                <span>Canais ({accessibleChannels?.length || 0})</span>
                {isDirector && (
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
                    const isActive = activeView === 'chat' && activeChat?.type === 'channel' && activeChat?.id === c.id;
                    const channelUnread = (c.id && safeUnread[c.id]) || (c.name && safeUnread[c.name]) || (c.name && safeUnread[`#${c.name}`]) || c.unread || 0;
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
                {isDirector && (
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
                    const dmUnread = (user.id && safeUnread[user.id]) || 0;
                    return (
                      <button
                        type="button"
                        key={user.id}
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
                                user.online ? 'bg-brand-600' : 'bg-gray-300'
                              }`}
                            />
                          </div>
                          <div className="truncate">
                            <p className={`text-sm leading-tight truncate ${isActive ? 'font-bold text-chatTextTitle' : 'text-chatTextTitle'}`}>
                              {user.name || 'Colaborador'}
                            </p>
                            <p className="text-[11px] text-chatTextMuted truncate mt-0.5">
                              {user.role || user.department || 'Equipe'}
                            </p>
                          </div>
                        </div>

                        {dmUnread > 0 ? (
                          <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-4 text-center shadow-xs animate-bounce">
                            {dmUnread}
                          </span>
                        ) : (
                          <span className="text-[10px] text-chatTextMuted bg-slate-100 dark:bg-chatBoxSecondary px-1.5 py-0.5 rounded border border-slate-200 dark:border-chatBorder">
                            1 a 1
                          </span>
                        )}
                      </button>
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

      {/* Rodapé: Perfil Ativo + Simulador de Usuário (Apenas Humanos) + Alternador Sol/Lua */}
      <div className="p-3 bg-chatPanel border-t border-chatBorder space-y-2">
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

        {/* Simulador de Acesso: Permite ao Diretor testar a visão de qualquer colaborador humano */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-chatCard p-1 rounded-lg border border-slate-300 dark:border-chatBorder shadow-xs">
          <span className="text-[10px] text-chatTextMuted font-medium px-1 shrink-0 flex items-center gap-1">
            <Users size={11} /> Simular:
          </span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => {
              const selected = safeCollaborators.find((u) => u && u.id === e.target.value);
              if (selected && onSwitchUser) onSwitchUser(selected);
            }}
            className="w-full bg-transparent text-[11px] text-chatTextTitle font-semibold focus:outline-none cursor-pointer"
          >
            {safeCollaborators
              .filter((u) => u && !u.isBot)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || 'Colaborador'} ({u.roleType === 'diretor' ? 'Diretor' : (u.department || 'Geral')})
                </option>
              ))}
          </select>
        </div>
      </div>
    </aside>
  );
}
