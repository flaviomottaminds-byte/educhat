import React, { useState } from 'react';
import { Plus, Clock, User, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Sparkles, Shield, UserCheck, Building2, Lock, Maximize2, Paperclip } from 'lucide-react';
import confetti from 'canvas-confetti';

const COLUMNS = [
  { id: 'backlog', title: 'A Fazer', color: 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  { id: 'in_progress', title: 'Em Andamento', color: 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10' },
  { id: 'waiting', title: 'Aguardando Retorno', color: 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10' },
  { id: 'done', title: 'Concluído', color: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
];

export default function KanbanBoard({
  tasks,
  onUpdateTaskStatus,
  onAddTask,
  onCardClick,
  currentUser,
  collaborators = []
}) {
  const isDirector = currentUser?.roleType === 'diretor';

  // Estados de filtro para o Diretor
  const [filterAssignee, setFilterAssignee] = useState('todos');

  // Estado de aba para o Colaborador ('my_tasks' | 'dept_tasks' | 'my_requests')
  const [collabTab, setCollabTab] = useState('my_tasks');

  // Normalização para comparações seguras de nomes
  const normalize = (val) => (val || '').trim().toLowerCase();
  const currentUserName = normalize(currentUser?.name);
  const currentUserFirst = currentUserName.split(' ')[0];

  // 1. Minhas Demandas: Tarefas que EU tenho que fazer (responsável sou eu)
  const isAssignedToMe = (t) => {
    const a = normalize(t.assignee);
    return a === currentUserName || a.startsWith(currentUserFirst);
  };

  // 2. Minhas Solicitações: Demandas que EU abri para OUTROS colaboradores/setores
  const isRequestedByMe = (t) => {
    const r = normalize(t.requester);
    return r === currentUserName || r.startsWith(currentUserFirst);
  };

  // 3. Demandas do meu departamento
  const isMyDepartment = (t) => {
    const d = normalize(t.department);
    const userDept = normalize(currentUser?.department);
    return d === userDept;
  };

  // Filtragem estrita com base no Perfil (Opção 1 com Rastreamento Intersetorial e correção de filtros)
  const filteredTasks = tasks.filter((t) => {
    if (isDirector) {
      if (filterAssignee !== 'todos') {
        return normalize(t.assignee) === normalize(filterAssignee);
      }
      return true;
    } else {
      if (collabTab === 'my_tasks') {
        return isAssignedToMe(t);
      }
      if (collabTab === 'dept_tasks') {
        return isMyDepartment(t);
      }
      if (collabTab === 'my_requests') {
        // Solicitações abertas por mim para outros
        return isRequestedByMe(t) && !isAssignedToMe(t);
      }
      return false;
    }
  });

  // Métricas para os botões do colaborador
  const myTasksCount = tasks.filter(isAssignedToMe).length;
  const deptTasksCount = tasks.filter(isMyDepartment).length;
  const myRequestsCount = tasks.filter((t) => isRequestedByMe(t) && !isAssignedToMe(t)).length;

  const handleMove = (e, taskId, currentStatus, direction) => {
    e.stopPropagation(); // Evita abrir o modal de detalhes ao clicar na seta
    const statusOrder = ['backlog', 'in_progress', 'waiting', 'done'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < statusOrder.length) {
      const nextStatus = statusOrder[newIndex];
      onUpdateTaskStatus(taskId, nextStatus);

      if (nextStatus === 'done') {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    }
  };

  const getPriorityBadge = (priority, isVip) => {
    if (isVip || priority === 'vip') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/40 flex items-center gap-1 shadow-xs animate-pulse">
          <span>👑</span> VIP (PLANO FIXO)
        </span>
      );
    }
    switch (priority) {
      case 'alta':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30">ALTA</span>;
      case 'media':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-yellow-500/20 text-amber-800 dark:text-yellow-400 border border-amber-200 dark:border-yellow-500/30">MÉDIA</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">BAIXA</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] dark:bg-chatBg p-6 overflow-hidden transition-colors">
      {/* Header do Kanban com Badge de Nível de Acesso */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-chatTextTitle flex items-center gap-2">
              📋 Quadro de Demandas
            </h2>
            {isDirector ? (
              <span className="text-[11px] font-semibold bg-brand-600/15 text-brand-700 dark:text-brand-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-brand-500/30">
                <Shield size={12} /> Visão Geral da Diretoria (Todos os Setores)
              </span>
            ) : (
              <span className="text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-500/30">
                <Lock size={12} /> Acesso Restrito: {currentUser.name} ({currentUser.department})
              </span>
            )}
          </div>
          <p className="text-xs text-chatTextMuted">
            {isDirector
              ? 'Acompanhamento executivo de todos os processos e colaboradores da empresa'
              : 'Demandas atribuídas a você, do seu setor e solicitações abertas por você (clique no card para ampliar)'}
          </p>
        </div>

        {/* Controles de Visibilidade e Filtro baseados no Perfil */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDirector ? (
            /* Filtros do Diretor: pode filtrar por quem quiser dinamicamente */
            <div className="flex items-center gap-2">
              <span className="text-xs text-chatTextMuted font-medium">Filtrar por:</span>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="bg-white dark:bg-chatCard text-chatTextTitle text-xs border border-slate-300 dark:border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 shadow-xs cursor-pointer"
              >
                <option value="todos">🌐 Toda a Equipe ({tasks.length})</option>
                {collaborators.filter(c => !c.isBot).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.department})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Abas de visualização restrita do Colaborador (Corrigidas no Item 3) */
            <div className="flex bg-slate-200/80 dark:bg-chatPanel p-1 rounded-lg border border-slate-300 dark:border-chatBorder text-xs">
              <button
                onClick={() => setCollabTab('my_tasks')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
                  collabTab === 'my_tasks'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <UserCheck size={14} />
                <span>Minhas Demandas ({myTasksCount})</span>
              </button>
              <button
                onClick={() => setCollabTab('dept_tasks')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
                  collabTab === 'dept_tasks'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <Building2 size={14} />
                <span>Meu Setor ({deptTasksCount})</span>
              </button>
              <button
                onClick={() => setCollabTab('my_requests')}
                title="Demandas que você abriu para outros setores acompanharem"
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
                  collabTab === 'my_requests'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <span>📤 Minhas Solicitações ({myRequestsCount})</span>
              </button>
            </div>
          )}

          <button
            onClick={onAddTask}
            className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={15} />
            <span>Nova Demanda</span>
          </button>
        </div>
      </div>

      {/* As 4 Colunas do Kanban */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-slate-200/50 dark:bg-chatSidebar border border-slate-300 dark:border-chatBorder rounded-xl flex flex-col h-full overflow-hidden shadow-xs transition-colors"
            >
              {/* Cabeçalho da Coluna */}
              <div className="p-3 bg-white dark:bg-chatCard border-b border-slate-200 dark:border-chatBorder flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${col.color}`}>
                    {col.title}
                  </span>
                </div>
                <span className="text-xs font-bold text-chatTextMuted bg-slate-100 dark:bg-chatSidebar px-2 py-0.5 rounded-full border border-slate-200 dark:border-chatBorder">
                  {colTasks.length}
                </span>
              </div>

              {/* Lista de Cards da Coluna */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-chatBorder rounded-lg text-xs text-chatTextMuted">
                    Nenhuma tarefa
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onCardClick && onCardClick(t)}
                      className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder hover:border-brand-500 hover:shadow-md rounded-lg p-3.5 shadow-xs space-y-2.5 transition group cursor-pointer"
                      title="Clique para ampliar e ver detalhes, anexos e comentários"
                    >
                      {/* Topo do Card: Prioridade e Canal + Ícone de Ampliar */}
                      <div className="flex items-center justify-between">
                        {getPriorityBadge(t.priority, t.isVip)}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold ${
                            t.channel?.includes('Privado')
                              ? 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-500/30'
                              : 'text-brand-600 dark:text-brand-500'
                          }`}>
                            {t.channel}
                          </span>
                          <Maximize2 size={12} className="text-chatTextMuted group-hover:text-brand-600 transition" />
                        </div>
                      </div>

                      {/* Título e Descrição */}
                      <div>
                        <h4 className="text-sm font-semibold text-chatTextTitle leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400 transition">
                          {t.title}
                        </h4>
                        {t.desc && (
                          <p className="text-xs text-chatTextMuted mt-1 line-clamp-2">
                            {t.desc}
                          </p>
                        )}
                      </div>

                      {/* Anexos e Comentários (badges se houver) */}
                      {((t.attachments && t.attachments.length > 0) || (t.comments && t.comments.length > 0)) && (
                        <div className="flex items-center gap-2 text-[10px] text-chatTextMuted">
                          {t.attachments && t.attachments.length > 0 && (
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-chatSidebar px-1.5 py-0.5 rounded">
                              <Paperclip size={10} /> {t.attachments.length} anexo{t.attachments.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {t.comments && t.comments.length > 0 && (
                            <span className="bg-slate-100 dark:bg-chatSidebar px-1.5 py-0.5 rounded">
                              💬 {t.comments.length} nota{t.comments.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Solicitante da Demanda (Rastreamento Intersetorial) */}
                      {t.requester && (
                        <div className="bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-500/30 px-2 py-1 rounded text-[11px] text-brand-800 dark:text-brand-300 flex items-center justify-between">
                          <span className="truncate">
                            📌 Solicitado por: <strong>{t.requester === currentUser.name ? 'Você' : t.requester}</strong>
                          </span>
                          {t.requesterDept && (
                            <span className="text-[10px] bg-brand-100 dark:bg-brand-900/60 px-1.5 py-0.2 rounded font-semibold text-brand-700 dark:text-brand-300">
                              {t.requesterDept}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Trecho da Mensagem de Origem */}
                      {t.sourceMessage && (
                        <div className="bg-slate-50 dark:bg-[#111b21] border-l-2 border-purple-500 p-2 rounded text-[11px] text-chatTextBody italic">
                          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold block not-italic">
                            ORIGEM NO CHAT:
                          </span>
                          "{t.sourceMessage}"
                        </div>
                      )}

                      {/* Rodapé: Responsável, Prazo e Ações */}
                      <div className="pt-2 border-t border-slate-100 dark:border-chatBorder flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5" title={`Responsável: ${t.assignee}`}>
                          <span className="text-sm">{t.assigneeAvatar || '👤'}</span>
                          <span className="text-[11px] font-medium text-chatTextBody truncate w-24">
                            {t.assignee === currentUser.name ? '👉 Você' : t.assignee}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-chatTextMuted">
                          <Clock size={12} />
                          <span>{t.dueDate}</span>
                        </div>
                      </div>

                      {/* Botões para mover coluna (com stopPropagation para não abrir modal) */}
                      <div className="pt-1 flex justify-between items-center text-xs text-chatTextMuted">
                        <button
                          onClick={(e) => handleMove(e, t.id, t.status, 'prev')}
                          disabled={t.status === 'backlog'}
                          className="p-1 hover:text-chatTextTitle disabled:opacity-20 disabled:hover:text-chatTextMuted transition"
                          title="Mover para coluna anterior"
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <span className="text-[10px] text-chatTextMuted group-hover:text-brand-600 font-medium transition">
                          Ampliar Detalhes
                        </span>
                        <button
                          onClick={(e) => handleMove(e, t.id, t.status, 'next')}
                          disabled={t.status === 'done'}
                          className="p-1 hover:text-chatTextTitle disabled:opacity-20 disabled:hover:text-chatTextMuted transition"
                          title="Avançar coluna"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
