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
  Filter
} from 'lucide-react';

export default function Sidebar({
  activeView,
  setActiveView,
  channels,
  collaborators,
  activeChat, // { type: 'channel' | 'dm', id: string }
  onSelectChannel,
  onSelectCollaborator,
  onOpenAICopilot,
  onOpenAIMemory,
  onOpenNewChannel,
  onOpenNewCollaborator,
  aiAutonomous,
  setAiAutonomous,
  theme,
  onToggleTheme
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filtragem pela busca estilo WhatsApp
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.desc?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCollaborators = collaborators.filter((u) =>
    u.id !== 'u1' && (
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

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
              <span className="text-[10px] bg-brand-600/15 text-brand-600 dark:text-brand-500 font-semibold px-1.5 py-0.5 rounded">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-chatTextMuted">WhatsApp Interno</p>
          </div>
        </div>

        {/* Botões de Ação: IA & Base de Conhecimento */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAIMemory}
            title="Base de Conhecimento da IA (Clientes VIP, SLAs e POPs)"
            className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200/80 dark:hover:bg-chatBorder/80 transition"
          >
            <Brain size={20} className="text-yellow-600 dark:text-yellow-400" />
          </button>

          <button
            onClick={onOpenAICopilot}
            title="Copiloto de IA & Diagnóstico"
            className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200/80 dark:hover:bg-chatBorder/80 transition"
          >
            <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
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
            placeholder="Pesquisar ou começar uma nova conversa"
            className="w-full bg-transparent text-xs text-chatTextTitle placeholder:text-[#54656f] dark:placeholder:text-[#8696a0] focus:outline-none"
          />
        </div>
      </div>

      {/* Modo IA Autônoma (Badge elegante) */}
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

      {/* Lista de Canais e Conversas 1 a 1 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Canais Operacionais */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
            <span>Canais Operacionais</span>
            <button
              onClick={onOpenNewChannel}
              title="Criar novo canal operacional"
              className="text-brand-600 dark:text-brand-500 hover:underline flex items-center gap-0.5 text-[11px] normal-case font-semibold"
            >
              <Plus size={13} /> Novo
            </button>
          </div>

          <div className="space-y-0.5">
            {filteredChannels.map((c) => {
              const isActive = activeView === 'chat' && activeChat.type === 'channel' && activeChat.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChannel(c.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition ${
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
                        {c.name}
                      </p>
                      <p className="text-[11px] text-chatTextMuted truncate mt-0.5">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                  {c.unread > 0 && (
                    <span className="bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversas Diretas (1 a 1) */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1 px-2">
            <span>Conversas 1 a 1 (WhatsApp)</span>
            <button
              onClick={onOpenNewCollaborator}
              title="Cadastrar novo colaborador"
              className="text-brand-600 dark:text-brand-500 hover:underline flex items-center gap-0.5 text-[11px] normal-case font-semibold"
            >
              <Plus size={13} /> Convidar
            </button>
          </div>

          <div className="space-y-0.5">
            {filteredCollaborators.map((user) => {
              const isActive = activeView === 'chat' && activeChat.type === 'dm' && activeChat.id === user.id;
              return (
                <button
                  key={user.id}
                  onClick={() => onSelectCollaborator(user.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition ${
                    isActive
                      ? 'bg-[#f0f2f5] dark:bg-chatPanel shadow-xs'
                      : 'hover:bg-[#f5f6f6] dark:hover:bg-chatPanel/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative text-2xl shrink-0">
                      <span>{user.avatar}</span>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-chatSidebar ${
                          user.online ? 'bg-brand-600' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div className="truncate">
                      <p className={`text-sm leading-tight truncate ${isActive ? 'font-bold text-chatTextTitle' : 'text-chatTextTitle'}`}>
                        {user.name}
                      </p>
                      <p className="text-[11px] text-chatTextMuted truncate mt-0.5">{user.role}</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-chatTextMuted bg-slate-100 dark:bg-chatBoxSecondary px-1.5 py-0.5 rounded border border-slate-200 dark:border-chatBorder">
                    1 a 1
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rodapé: Perfil de Flávio Motta + Alternador Sol/Lua Discreto */}
      <div className="p-3 bg-chatPanel border-t border-chatBorder flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-lg shadow-xs">
            👨‍💼
          </div>
          <div>
            <p className="text-xs font-semibold text-chatTextTitle">Flávio Motta</p>
            <p className="text-[10px] text-brand-600 dark:text-brand-500 flex items-center gap-1 font-medium">
              <Circle size={7} fill="currentColor" /> Diretor (Online)
            </p>
          </div>
        </div>

        {/* Botão Sol/Lua Discreto no rodapé (Opção A) */}
        <button
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          className="p-1.5 rounded-full text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-200/70 dark:hover:bg-chatCard transition border border-transparent hover:border-chatBorder"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-yellow-400" />}
        </button>
      </div>
    </aside>
  );
}
