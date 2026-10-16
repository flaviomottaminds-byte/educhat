import React, { useState } from 'react';
import { Search, UserCheck, Shield, Building2, Mail, CheckCircle2, ArrowRight, UserPlus, Edit2 } from 'lucide-react';
import { hasFullPortfolioAccess, matchesDepartment } from '../lib/portfolioAccess';
import { formatLastSeen } from '../lib/presence';

export default function UserSelectionModal({
  isOpen,
  onClose,
  collaborators,
  onSelectUser,
  onEditCollaborator,
  onNewCollaborator,
  currentUserId
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('Todos');

  if (!isOpen) return null;

  const departments = ['Todos', 'Comercial', 'Tutoria', 'Secretaria', 'Marketing', 'Pedagógico', 'Expansão', 'Diretoria'];

  const filtered = (collaborators || []).filter((u) => {
    if (!u) return false;
    const matchesDept = deptFilter === 'Todos' || matchesDepartment(u.department, deptFilter);
    const cleanSearch = (search || '').toLowerCase();
    const name = (u.name || '').toLowerCase();
    const dept = (u.department || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch =
      name.includes(cleanSearch) ||
      dept.includes(cleanSearch) ||
      email.includes(cleanSearch);
    return matchesDept && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-chatPanel w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-6 bg-linear-to-r from-brand-700 to-brand-600 text-white shrink-0 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
              🎓
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight flex items-center gap-2">
                EduChat Pro — Identificação de Acesso
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                Selecione o seu perfil para sincronizar suas mensagens e tarefas neste dispositivo.
              </p>
            </div>
          </div>

          {onNewCollaborator && (
            <button
              type="button"
              onClick={onNewCollaborator}
              className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs flex items-center gap-1.5 transition backdrop-blur-sm shadow-xs cursor-pointer"
            >
              <UserPlus size={14} />
              <span>+ Novo Colaborador</span>
            </button>
          )}
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-b border-chatBorder space-y-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, setor ou e-mail..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-chatInputBg text-chatTextTitle border border-slate-200 dark:border-chatBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  deptFilter === dept
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white dark:bg-chatCard text-chatTextMuted border border-slate-200 dark:border-chatBorder hover:bg-slate-100 dark:hover:bg-chatPanel'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Colaboradores em Grid */}
        <div className="p-4 md:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 flex-1">
          {filtered.map((user) => {
            const isCurrent = user.id === currentUserId;

            return (
              <div
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className={`group p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-500 ring-2 ring-brand-500/20'
                    : 'bg-white dark:bg-chatCard border-slate-200 dark:border-chatBorder hover:border-brand-400 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative w-12 h-12 rounded-full bg-slate-100 dark:bg-chatPanel flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition shadow-2xs">
                    {user.avatar}
                    <span
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-chatPanel ${
                        user.online ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={user.online ? 'Online agora' : user.lastSeen ? `Visto por último ${formatLastSeen(user.lastSeen)}` : 'Offline (nunca acessou)'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-chatTextTitle truncate">
                        {user.name}
                      </h3>
                      {hasFullPortfolioAccess(user) ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-amber-500/30">
                          <Shield size={10} /> Gestão Geral
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-emerald-500/30">
                          <UserCheck size={10} /> Carteira Própria
                        </span>
                      )}
                      {user.online ? (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-300 dark:border-emerald-700/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 dark:bg-chatPanel text-slate-500 dark:text-slate-400 font-medium px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200 dark:border-chatBorder">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {user.lastSeen ? `Visto ${formatLastSeen(user.lastSeen)}` : 'Offline'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-chatTextMuted truncate mt-0.5">
                      {user.role}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 mt-1 truncate">
                      <Mail size={11} />
                      <span className="truncate">{user.email || 'Sem e-mail cadastrado'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-chatBorder/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-chatPanel text-brand-700 dark:text-brand-300 border border-slate-200 dark:border-chatBorder">
                      🎯 {user.department || 'Comercial'}
                    </span>
                    {onEditCollaborator && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCollaborator(user);
                        }}
                        className="p-1 rounded-md text-chatTextMuted hover:text-brand-600 hover:bg-black/5 dark:hover:bg-white/5 transition"
                        title={`Editar departamento e cargo de ${user.name}`}
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    className={`text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1 transition ${
                      isCurrent
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-chatPanel text-brand-700 dark:text-brand-400 group-hover:bg-brand-600 group-hover:text-white'
                    }`}
                  >
                    <span>{isCurrent ? 'Perfil Ativo' : 'Entrar'}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé informativo */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-chatSidebar border-t border-chatBorder flex items-center justify-between text-xs text-chatTextMuted shrink-0">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-500" />
            Sua sessão será salva automaticamente neste navegador.
          </span>
          {currentUserId && (
            <button
              onClick={onClose}
              className="text-xs text-[#54656f] dark:text-[#aebac1] hover:underline font-medium"
            >
              Continuar com perfil atual
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
