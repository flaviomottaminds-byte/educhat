import React from 'react';
import { MessageSquare, CheckSquare, BarChart3, Hash, Users, Sparkles, Circle } from 'lucide-react';

export default function Sidebar({
  activeView,
  setActiveView,
  channels,
  activeChannelId,
  setActiveChannelId,
  collaborators,
  onOpenAICopilot
}) {
  return (
    <aside className="w-80 bg-chatSidebar border-r border-chatBorder flex flex-col h-full select-none">
      {/* Top Header */}
      <div className="p-4 bg-chatPanel flex items-center justify-between border-b border-chatBorder">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-xl font-bold text-white shadow-md">
            🎓
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight flex items-center gap-1.5">
              EduChat
              <span className="text-[10px] bg-brand-500/20 text-brand-500 font-semibold px-1.5 py-0.5 rounded">PRO</span>
            </h1>
            <p className="text-xs text-[#8696a0]">Comunicação Interna</p>
          </div>
        </div>

        {/* AI Copilot Quick Button */}
        <button
          onClick={onOpenAICopilot}
          title="Abrir Copiloto de IA"
          className="p-2 rounded-full bg-gradient-to-r from-purple-600/30 to-brand-500/30 text-purple-300 hover:text-white hover:scale-105 transition-all border border-purple-500/30"
        >
          <Sparkles size={18} className="text-purple-400" />
        </button>
      </div>

      {/* Main Navigation Views */}
      <div className="p-2 border-b border-chatBorder flex gap-1 bg-chatSidebar">
        <button
          onClick={() => setActiveView('chat')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
            activeView === 'chat'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-[#8696a0] hover:bg-chatPanel hover:text-white'
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
              : 'text-[#8696a0] hover:bg-chatPanel hover:text-white'
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
              : 'text-[#8696a0] hover:bg-chatPanel hover:text-white'
          }`}
        >
          <BarChart3 size={16} />
          Gestão
        </button>
      </div>

      {/* Channel and User List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Canais por Setor */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#8696a0] mb-2 px-2">
            <span>Canais Operacionais</span>
            <span className="text-[10px] text-[#00a884] font-medium">{channels.length} setores</span>
          </div>
          <div className="space-y-1">
            {channels.map((c) => {
              const isActive = activeView === 'chat' && activeChannelId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveChannelId(c.id);
                    setActiveView('chat');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition ${
                    isActive
                      ? 'bg-chatPanel text-white font-medium shadow-sm'
                      : 'text-[#d1d7db] hover:bg-chatPanel/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Hash size={18} className={isActive ? 'text-brand-500' : 'text-[#8696a0]'} />
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                  {c.unread > 0 && (
                    <span className="bg-brand-500 text-black text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-5 text-center">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Colaboradores / DMs */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#8696a0] mb-2 px-2">
            <span>Equipe Interna</span>
            <Users size={14} className="text-[#8696a0]" />
          </div>
          <div className="space-y-1">
            {collaborators.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-chatPanel/40 cursor-pointer transition group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative text-xl">
                    <span>{user.avatar}</span>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-chatSidebar ${
                        user.online ? 'bg-brand-500' : 'bg-gray-500'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-brand-500 transition-colors">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-[#8696a0] truncate w-40">{user.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 bg-chatPanel border-t border-chatBorder flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-lg">
            👨‍💼
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Flávio Motta</p>
            <p className="text-[11px] text-brand-500 flex items-center gap-1">
              <Circle size={8} fill="currentColor" /> Online (Diretor)
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
