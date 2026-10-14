import React from 'react';
import { MessageSquare, CheckSquare, BarChart3, Hash, Users, Sparkles, Circle, Plus, Bot, Lock, Brain, Sun, Moon } from 'lucide-react';

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
  return (
    <aside className="w-80 bg-chatSidebar border-r border-chatBorder flex flex-col h-full select-none transition-colors">
      {/* Top Header */}
      <div className="p-4 bg-chatPanel flex items-center justify-between border-b border-chatBorder">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-xl font-bold text-white shadow-md">
            🎓
          </div>
          <div>
            <h1 className="font-bold text-chatTextTitle text-base leading-tight flex items-center gap-1.5">
              EduChat
              <span className="text-[10px] bg-brand-500/20 text-brand-600 dark:text-brand-500 font-semibold px-1.5 py-0.5 rounded">
                PRO
              </span>
            </h1>
            <p className="text-xs text-chatTextMuted">Comunicação Interna</p>
          </div>
        </div>

        {/* Action Buttons: Theme Toggle, AI Memory & Copilot */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro'}
            className="p-2 rounded-full border transition-all hover:scale-105 bg-chatCard border-chatBorder text-chatTextBody hover:text-brand-600 dark:hover:text-yellow-400 shadow-sm"
          >
            {theme === 'light' ? <Moon size={18} className="text-slate-700" /> : <Sun size={18} className="text-yellow-400" />}
          </button>

          <button
            onClick={onOpenAIMemory}
            title="Ensinar a IA / Cadastrar Clientes VIP e SLAs"
            className="p-2 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:scale-105 transition-all border border-yellow-500/30"
          >
            <Brain size={18} />
          </button>

          <button
            onClick={onOpenAICopilot}
            title="Abrir Copiloto de IA"
            className="p-2 rounded-full bg-gradient-to-r from-purple-600/20 to-brand-500/20 text-purple-600 dark:text-purple-300 hover:scale-105 transition-all border border-purple-500/30"
          >
            <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
          </button>
        </div>
      </div>

      {/* Main Navigation Views */}
      <div className="p-2 border-b border-chatBorder flex gap-1 bg-chatSidebar">
        <button
          onClick={() => setActiveView('chat')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
            activeView === 'chat'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-chatTextMuted hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <MessageSquare size={16} />
          Chat
        </button>
        <button
          onClick={() => setActiveView('kanban')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
            activeView === 'kanban'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-chatTextMuted hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <CheckSquare size={16} />
          Kanban
        </button>
        <button
          onClick={() => setActiveView('gestao')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
            activeView === 'gestao'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-chatTextMuted hover:bg-chatPanel hover:text-chatTextTitle'
          }`}
        >
          <BarChart3 size={16} />
          Gestão
        </button>
      </div>

      {/* AI Mode Banner Switch */}
      <div className="px-3 pt-3">
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={16} className={aiAutonomous ? 'text-purple-600 dark:text-yellow-400 animate-pulse' : 'text-chatTextMuted'} />
            <div>
              <p className="text-[11px] font-bold text-purple-900 dark:text-purple-200">IA Criar Card Sozinha</p>
              <p className="text-[9px] text-purple-700/80 dark:text-[#8696a0]">
                {aiAutonomous ? 'Automático ao detectar tarefa' : 'Manual / Sob demanda'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAiAutonomous(!aiAutonomous)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
              aiAutonomous ? 'bg-brand-500' : 'bg-slate-300 dark:bg-chatPanel border border-slate-300 dark:border-chatBorder'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                aiAutonomous ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Channel and User List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Canais Departamentais (Múltiplos Colaboradores) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-chatTextMuted mb-2 px-2">
            <span>Departamentos / Canais</span>
            <button
              onClick={onOpenNewChannel}
              title="Criar novo canal operacional"
              className="p-1 hover:bg-chatPanel text-brand-600 dark:text-[#00a884] rounded flex items-center gap-1 text-[11px] normal-case font-semibold transition"
            >
              <Plus size={14} /> Novo
            </button>
          </div>
          <div className="space-y-1">
            {channels.map((c) => {
              const isActive = activeView === 'chat' && activeChat.type === 'channel' && activeChat.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChannel(c.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition ${
                    isActive
                      ? 'bg-slate-200/70 dark:bg-chatPanel text-chatTextTitle font-medium shadow-sm'
                      : 'text-chatTextBody hover:bg-slate-100 dark:hover:bg-chatPanel/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Hash size={18} className={isActive ? 'text-brand-600 dark:text-brand-500' : 'text-chatTextMuted'} />
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                  {c.unread > 0 && (
                    <span className="bg-brand-500 text-white dark:text-black text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-5 text-center shadow-sm">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversas Diretas 1 a 1 (WhatsApp Privado) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-chatTextMuted mb-2 px-2">
            <span>Conversas 1 a 1 (Privadas)</span>
            <button
              onClick={onOpenNewCollaborator}
              title="Cadastrar novo colaborador"
              className="p-1 hover:bg-chatPanel text-brand-600 dark:text-brand-500 rounded flex items-center gap-1 text-[11px] normal-case font-semibold transition"
            >
              <Plus size={14} /> Convidar
            </button>
          </div>
          <div className="space-y-1">
            {collaborators.filter(u => u.id !== 'u1').map((user) => {
              const isActive = activeView === 'chat' && activeChat.type === 'dm' && activeChat.id === user.id;
              return (
                <button
                  key={user.id}
                  onClick={() => onSelectCollaborator(user.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition ${
                    isActive
                      ? 'bg-slate-200/70 dark:bg-chatPanel text-chatTextTitle font-medium shadow-sm border border-brand-500/30'
                      : 'text-chatTextBody hover:bg-slate-100 dark:hover:bg-chatPanel/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative text-xl shrink-0">
                      <span>{user.avatar}</span>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-chatSidebar ${
                          user.online ? 'bg-brand-500' : 'bg-gray-400'
                        }`}
                      />
                    </div>
                    <div className="truncate">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-brand-600 dark:text-brand-500' : 'text-chatTextTitle'}`}>
                        {user.name}
                      </p>
                      <p className="text-[11px] text-chatTextMuted truncate">{user.role}</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-chatTextMuted bg-slate-100 dark:bg-chatBoxSecondary px-1.5 py-0.5 rounded border border-chatBorder">
                    1 a 1
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 bg-chatPanel border-t border-chatBorder flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-lg shadow-sm">
            👨‍💼
          </div>
          <div>
            <p className="text-sm font-semibold text-chatTextTitle">Flávio Motta</p>
            <p className="text-[11px] text-brand-600 dark:text-brand-500 flex items-center gap-1 font-medium">
              <Circle size={8} fill="currentColor" /> Online (Diretor)
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
