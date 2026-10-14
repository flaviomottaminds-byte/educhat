import React, { useState } from 'react';
import { Plus, Clock, User, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const COLUMNS = [
  { id: 'backlog', title: 'A Fazer', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
  { id: 'in_progress', title: 'Em Andamento', color: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' },
  { id: 'waiting', title: 'Aguardando Retorno', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  { id: 'done', title: 'Concluído', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
];

export default function KanbanBoard({ tasks, onUpdateTaskStatus, onAddTask }) {
  const [filterAssignee, setFilterAssignee] = useState('todos');

  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee !== 'todos' && t.assignee !== filterAssignee) return false;
    return true;
  });

  const handleMove = (taskId, currentStatus, direction) => {
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
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1 shadow-sm animate-pulse">
          <span>👑</span> VIP (PLANO FIXO)
        </span>
      );
    }
    switch (priority) {
      case 'alta':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">ALTA</span>;
      case 'media':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">MÉDIA</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">BAIXA (AVULSO)</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-chatBg p-6 overflow-hidden">
      {/* Header do Kanban */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            📋 Quadro de Demandas Internas
          </h2>
          <p className="text-xs text-[#8696a0]">
            Processos e tarefas gerados a partir das conversas do EduChat
          </p>
        </div>

        {/* Filtros e Nova Demanda */}
        <div className="flex items-center gap-3">
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="bg-chatPanel text-white text-xs border border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="todos">Todos os Responsáveis</option>
            <option value="Flávio Motta">Flávio Motta</option>
            <option value="Fernanda Silva">Fernanda Silva</option>
            <option value="Carlos Eduardo">Carlos Eduardo</option>
            <option value="Juliana Mendes">Juliana Mendes</option>
          </select>

          <button
            onClick={onAddTask}
            className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-md transition"
          >
            <Plus size={16} />
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
              className="bg-chatSidebar border border-chatBorder rounded-xl flex flex-col h-full overflow-hidden"
            >
              {/* Cabeçalho da Coluna */}
              <div className="p-3 bg-chatPanel border-b border-chatBorder flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${col.color}`}>
                    {col.title}
                  </span>
                </div>
                <span className="text-xs font-bold text-[#8696a0] bg-chatSidebar px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Lista de Cards da Coluna */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-chatBorder/50 rounded-lg text-xs text-[#8696a0]">
                    Vazio
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      className="bg-chatPanel border border-chatBorder hover:border-[#374045] rounded-lg p-3.5 shadow-sm space-y-2.5 transition group"
                    >
                      {/* Topo do Card: Prioridade e Canal */}
                      <div className="flex items-center justify-between">
                        {getPriorityBadge(t.priority, t.isVip)}
                        <span className="text-[10px] text-brand-500 font-medium">
                          {t.channel}
                        </span>
                      </div>

                      {/* Título e Descrição */}
                      <div>
                        <h4 className="text-sm font-semibold text-white leading-snug">
                          {t.title}
                        </h4>
                        {t.desc && (
                          <p className="text-xs text-[#8696a0] mt-1 line-clamp-2">
                            {t.desc}
                          </p>
                        )}
                      </div>

                      {/* Trecho da Mensagem de Origem */}
                      {t.sourceMessage && (
                        <div className="bg-[#111b21] border-l-2 border-purple-500 p-2 rounded text-[11px] text-[#aebac1] italic">
                          <span className="text-[9px] text-purple-400 font-bold block not-italic">
                            ORIGEM NO CHAT:
                          </span>
                          "{t.sourceMessage}"
                        </div>
                      )}

                      {/* Rodapé: Responsável, Prazo e Ações */}
                      <div className="pt-2 border-t border-chatBorder flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5" title={`Responsável: ${t.assignee}`}>
                          <span className="text-sm">{t.assigneeAvatar || '👤'}</span>
                          <span className="text-[11px] text-[#d1d7db] truncate w-20">
                            {t.assignee}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-[#8696a0]">
                          <Clock size={12} />
                          <span>{t.dueDate}</span>
                        </div>
                      </div>

                      {/* Botões para mover coluna */}
                      <div className="pt-1 flex justify-between items-center text-xs text-[#8696a0]">
                        <button
                          onClick={() => handleMove(t.id, t.status, 'prev')}
                          disabled={t.status === 'backlog'}
                          className="p-1 hover:text-white disabled:opacity-20 disabled:hover:text-[#8696a0] transition"
                          title="Mover para coluna anterior"
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <span className="text-[10px] text-[#535d64]">Mover</span>
                        <button
                          onClick={() => handleMove(t.id, t.status, 'next')}
                          disabled={t.status === 'done'}
                          className="p-1 hover:text-white disabled:opacity-20 disabled:hover:text-[#8696a0] transition"
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
