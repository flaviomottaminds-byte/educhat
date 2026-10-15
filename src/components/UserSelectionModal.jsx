import React, { useState } from 'react';
import { Search, UserCheck, Shield, Building2, Mail, CheckCircle2, ArrowRight } from 'lucide-react';

export default function UserSelectionModal({ isOpen, onClose, collaborators, onSelectUser, currentUserId }) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('Todos');

  if (!isOpen) return null;

  const departments = ['Todos', 'Comercial', 'Tutoria', 'Secretaria', 'Marketing', 'Pedagógico', 'Expansão', 'Diretoria'];

  const filtered = collaborators.filter((u) => {
    const matchesDept = deptFilter === 'Todos' || u.department === deptFilter;
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.department.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()));
    return matchesDept && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-chatPanel w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-6 bg-linear-to-r from-brand-700 to-brand-600 text-white shrink-0">
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
            const isDirector = user.roleType === 'diretor';

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
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-chatPanel flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition shadow-2xs">
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-chatTextTitle truncate">
                        {user.name}
                      </h3>
                      {isDirector && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-amber-500/30">
                          <Shield size={10} /> Diretor
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
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-chatPanel text-[#54656f] dark:text-chatTextMuted">
                    {user.department}
                  </span>

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
