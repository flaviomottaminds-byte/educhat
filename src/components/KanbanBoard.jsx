import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Clock,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Shield,
  Maximize2,
  Paperclip
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { normalizeText, fetchActiveCollaboratorsFromDB } from '../lib/gemini';
import {
  hasFullPortfolioAccess,
  canUserViewTask,
  isTaskAssignedToUser,
  isTaskRequestedByUser
} from '../lib/portfolioAccess';

const COLUMNS = [
  { id: 'backlog', title: 'Pendente / A Fazer', color: 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  { id: 'in_progress', title: 'Em Andamento', color: 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10' },
  { id: 'waiting', title: 'Aguardando Retorno', color: 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10' },
  { id: 'done', title: 'Concluído', color: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
];

const BASE_DEPARTMENTS = [
  'Todos',
  'Marketing',
  'Comercial',
  'Expansão',
  'Secretaria',
  'Pedagógico',
  'Tutoria',
  'Financeiro',
];

export function formatCardDateTime(dateVal) {
  if (!dateVal) return 'Recente';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  } catch {
    return 'Recente';
  }
}

export function normalizeTaskStatus(rawStatus) {
  if (!rawStatus) return 'backlog';
  const s = String(rawStatus).toLowerCase().trim();
  if (s === 'done' || s === 'concluido' || s === 'concluído' || s === 'finalizado') return 'done';
  if (s === 'in_progress' || s === 'andamento' || s === 'em andamento' || s === 'em_andamento') return 'in_progress';
  if (s === 'waiting' || s === 'aguardando' || s === 'aguardando retorno' || s === 'aguardando_retorno') return 'waiting';
  return 'backlog';
}

export default function KanbanBoard({
  tasks = [],
  onUpdateTaskStatus,
  onAddTask,
  onCreateTasksBatch,
  onCardClick,
  currentUser,
  collaborators = [],
  vipClients = [],
  slas = [],
  onOpenAIMemory
}) {
  // Estado local sincronizado com Realtime para movimentação instantânea entre abas e usuários
  const [boardTasks, setBoardTasks] = useState(tasks || []);

  useEffect(() => {
    setBoardTasks(tasks || []);
  }, [tasks]);

  // Subscrição em Tempo Real (Realtime Subscription) na tabela 'tasks'
  // Escuta UPDATE, INSERT e DELETE em tempo real sem exigir F5
  useEffect(() => {
    const channel = supabase
      .channel('kanban_board_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            let cleanDesc = updated.description;
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
            setBoardTasks((prev) =>
              prev.map((t) =>
                String(t.id) === String(updated.id)
                  ? {
                      ...t,
                      status: updated.status || t.status,
                      title: updated.title || t.title,
                      desc: cleanDesc !== undefined && cleanDesc !== null ? cleanDesc : t.desc,
                      priority: updated.priority || t.priority,
                      isVip: updated.is_vip !== undefined ? Boolean(updated.is_vip) : t.isVip,
                      assignee: updated.assignee || t.assignee,
                      assigneeAvatar: updated.assignee_avatar || t.assigneeAvatar,
                      department: updated.department || t.department,
                      dueDate: updated.due_date || t.dueDate,
                      channel: updated.channel || t.channel,
                      created_at: updated.created_at || t.created_at,
                      createdAt: updated.created_at || t.createdAt,
                      comments: comments !== null ? comments : t.comments,
                      attachments: attachments !== null ? attachments : t.attachments
                    }
                  : t
              )
            );
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const row = payload.new;
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
            setBoardTasks((prev) => {
              if (prev.some((t) => String(t.id) === String(newTask.id))) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setBoardTasks((prev) => prev.filter((t) => String(t.id) !== String(payload.old.id)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sincronização em tempo real dos colaboradores cadastrados no banco (profiles / users / sys_collaborators)
  const [dbCollaborators, setDbCollaborators] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetchActiveCollaboratorsFromDB(collaborators)
      .then((liveUsers) => {
        if (mounted && Array.isArray(liveUsers) && liveUsers.length > 0) {
          setDbCollaborators(liveUsers);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [collaborators]);

  const liveCollaborators = useMemo(() => {
    const mergedMap = new Map();
    const put = (u) => {
      if (!u || u.isBot || u.roleType === 'bot') return;
      const key = normalizeText(u.email || u.name || u.id);
      if (!key) return;
      mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...u });
    };
    (collaborators || []).forEach(put);
    (dbCollaborators || []).forEach(put);
    return Array.from(mergedMap.values());
  }, [collaborators, dbCollaborators]);

  // Sincroniza permissões, cargo e departamento do usuário logado com o registro real do banco
  const liveCurrentUser = useMemo(() => {
    if (!currentUser) return null;
    const found = liveCollaborators.find(
      (u) =>
        (currentUser.id && u.id === currentUser.id) ||
        (currentUser.email && u.email && normalizeText(u.email) === normalizeText(currentUser.email)) ||
        (currentUser.name && normalizeText(u.name) === normalizeText(currentUser.name))
    );
    return found ? { ...currentUser, ...found } : currentUser;
  }, [currentUser, liveCollaborators]);

  // Lista dinâmica de setores refletindo todos os departamentos reais cadastrados nos perfis do banco
  const dynamicDepartments = useMemo(() => {
    const set = new Set(BASE_DEPARTMENTS);
    liveCollaborators.forEach((u) => {
      if (u.department && u.department.trim() && u.department !== 'Inteligência Artificial') {
        set.add(u.department.trim());
      }
    });
    return Array.from(set);
  }, [liveCollaborators]);

  // Permissão do usuário logado (Gestor vs Usuário Comum)
  const isManager = hasFullPortfolioAccess(liveCurrentUser);

  // Seletor de Escopo Visual (Minhas Demandas / Minhas Solicitações / Todos os Meus Cards / Global)
  // Usuário Comum: padrão 'all_my' (Todos os Meus Cards)
  // Gestor/Admin: padrão 'global'
  const [scopeFilter, setScopeFilter] = useState(() => (isManager ? 'global' : 'all_my'));

  // Garante que usuário comum nunca permaneça em 'global'
  const effectiveScope = !isManager && scopeFilter === 'global' ? 'all_my' : scopeFilter;

  // Filtros rápidos adicionais (Por Setor e Por Colaborador)
  const [filterDepartment, setFilterDepartment] = useState('Todos');
  const [filterAssignee, setFilterAssignee] = useState('todos');

  // Contadores dinâmicos para exibição nos badges do seletor
  const taskCounts = useMemo(() => {
    let myDemands = 0;
    let myRequests = 0;
    let myAll = 0;
    let totalGlobal = (boardTasks || []).length;

    (boardTasks || []).forEach((t) => {
      if (!t) return;
      const isAssigned = isTaskAssignedToUser(t, liveCurrentUser);
      const isRequested = isTaskRequestedByUser(t, liveCurrentUser);
      if (isAssigned) myDemands += 1;
      if (isRequested) myRequests += 1;
      if (isAssigned || isRequested) myAll += 1;
    });

    return { myDemands, myRequests, myAll, totalGlobal };
  }, [boardTasks, liveCurrentUser]);

  // Lista filtrada com blindagem de dados e controle de abas
  const filteredTasks = useMemo(() => {
    return (boardTasks || []).filter((t) => {
      if (!t) return false;

      // 1. BLINDAGEM DE DADOS: Se não for Gestor/Admin, o usuário comum JAMAIS vê cartões de terceiros
      if (!isManager && !canUserViewTask(t, liveCurrentUser)) {
        return false;
      }

      // 2. CONTROLE DO SELETOR VISUAL
      const isAssigned = isTaskAssignedToUser(t, liveCurrentUser);
      const isRequested = isTaskRequestedByUser(t, liveCurrentUser);

      if (effectiveScope === 'my_demands') {
        if (!isAssigned) return false;
      } else if (effectiveScope === 'my_requests') {
        if (!isRequested) return false;
      } else if (effectiveScope === 'all_my') {
        if (!isAssigned && !isRequested) return false;
      }

      // 3. Filtro de Setor / Departamento
      if (filterDepartment && filterDepartment !== 'Todos') {
        const tDept = normalizeText(t.department || 'Diretoria');
        const fDept = normalizeText(filterDepartment);
        if (tDept !== fDept && !tDept.includes(fDept) && !fDept.includes(tDept)) {
          return false;
        }
      }

      // 4. Filtro de Colaborador Responsável (visão global do admin)
      if (isManager && filterAssignee && filterAssignee !== 'todos') {
        const normFilter = normalizeText(filterAssignee);
        const normAssignee = normalizeText(t.assignee || '');
        const normAssigneeId = normalizeText(t.assigneeId || '');

        const selectedCollab = liveCollaborators.find(
          (u) => u.id === filterAssignee || normalizeText(u.name) === normFilter
        );
        const selectedCollabName = normalizeText(selectedCollab?.name || '');
        const selectedCollabId = normalizeText(selectedCollab?.id || '');

        const isMatch =
          normAssignee === normFilter ||
          normAssignee === selectedCollabName ||
          normAssigneeId === normFilter ||
          normAssigneeId === selectedCollabId ||
          (normFilter.split(' ')[0]?.length >= 3 && normAssignee.includes(normFilter.split(' ')[0])) ||
          (normAssignee.split(' ')[0]?.length >= 3 && normFilter.includes(normAssignee.split(' ')[0])) ||
          (selectedCollabName.split(' ')[0]?.length >= 3 && normAssignee.includes(selectedCollabName.split(' ')[0]));

        if (!isMatch) {
          return false;
        }
      }

      return true;
    });
  }, [boardTasks, effectiveScope, isManager, filterDepartment, filterAssignee, liveCollaborators, liveCurrentUser]);

  const handleMove = (e, taskId, currentStatus, direction) => {
    e.stopPropagation();
    const statusOrder = ['backlog', 'in_progress', 'waiting', 'done'];
    const currentNorm = normalizeTaskStatus(currentStatus);
    const currentIndex = statusOrder.indexOf(currentNorm);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < statusOrder.length) {
      const nextStatus = statusOrder[newIndex];
      // Atualização otimista imediata na visualização local
      setBoardTasks((prev) =>
        prev.map((t) => (String(t.id) === String(taskId) ? { ...t, status: nextStatus } : t))
      );
      if (onUpdateTaskStatus) {
        onUpdateTaskStatus(taskId, nextStatus);
      }

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
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] dark:bg-chatBg p-4 sm:p-6 overflow-y-auto transition-colors">
      {/* Header do Kanban */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-chatTextTitle flex items-center gap-2">
              📋 Quadro de Demandas
            </h2>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                isManager
                  ? 'bg-brand-600/15 text-brand-700 dark:text-brand-400 border-brand-500/30'
                  : 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
              }`}
            >
              <Shield size={12} />{' '}
              {isManager
                ? `Visão Global (${liveCurrentUser?.name || 'Administração'})`
                : `Minha Carteira (${liveCurrentUser?.name || 'Colaborador'})`}
            </span>
          </div>
          <p className="text-xs text-chatTextMuted">
            {isManager
              ? 'Visão Global Administrativa: todos os cartões de todos os setores e colaboradores da instituição.'
              : 'Visão Restrita da Equipe: visualização estrita das suas demandas atribuídas e solicitações intersetoriais.'}
          </p>
        </div>

        {/* Controles de Filtro (Seletor de Escopo + Setor/Colaborador) + Botão Nova Demanda */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Seletor de Escopo (Tabs): "Minhas Demandas", "Minhas Solicitações", "Todos os Meus Cards" */}
          <div className="flex items-center bg-white dark:bg-chatCard p-1 rounded-xl border border-slate-300 dark:border-chatBorder shadow-xs">
            {isManager && (
              <button
                type="button"
                onClick={() => setScopeFilter('global')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  effectiveScope === 'global'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
                title="Visualizar todos os cartões de todos os setores e colaboradores"
              >
                <span>🌐 Todos (Global)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    effectiveScope === 'global'
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 dark:bg-chatSidebar text-chatTextMuted'
                  }`}
                >
                  {taskCounts.totalGlobal}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setScopeFilter('all_my')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                effectiveScope === 'all_my'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-chatTextMuted hover:text-chatTextTitle'
              }`}
              title="Exibe a soma das suas demandas atribuídas e solicitações criadas"
            >
              <span>📋 Todos os Meus Cards</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  effectiveScope === 'all_my'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 dark:bg-chatSidebar text-chatTextMuted'
                }`}
              >
                {taskCounts.myAll}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeFilter('my_demands')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                effectiveScope === 'my_demands'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-chatTextMuted hover:text-chatTextTitle'
              }`}
              title="Exibe apenas os cards onde você é o consultor/responsável direto"
            >
              <span>🎯 Minhas Demandas</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  effectiveScope === 'my_demands'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 dark:bg-chatSidebar text-chatTextMuted'
                }`}
              >
                {taskCounts.myDemands}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeFilter('my_requests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                effectiveScope === 'my_requests'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-chatTextMuted hover:text-chatTextTitle'
              }`}
              title="Exibe os cards que você criou ou solicitou para outros setores"
            >
              <span>📤 Minhas Solicitações</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  effectiveScope === 'my_requests'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 dark:bg-chatSidebar text-chatTextMuted'
                }`}
              >
                {taskCounts.myRequests}
              </span>
            </button>
          </div>

          {/* Filtro Rápido por Setor / Departamento */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-chatTextMuted font-medium">Setor:</span>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="bg-white dark:bg-chatCard text-chatTextTitle text-xs font-semibold border border-slate-300 dark:border-chatBorder rounded-lg px-2.5 py-2 focus:outline-none focus:border-brand-500 shadow-xs cursor-pointer"
            >
              {dynamicDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'Todos' ? '🏢 Todos os Setores' : `🏢 ${dept}`}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Rápido por Colaborador (Disponível para Gestor/Admin) */}
          {isManager && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-chatTextMuted font-medium">Colaborador:</span>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="bg-white dark:bg-chatCard text-chatTextTitle text-xs font-semibold border border-slate-300 dark:border-chatBorder rounded-lg px-2.5 py-2 focus:outline-none focus:border-brand-500 shadow-xs cursor-pointer"
              >
                <option value="todos">
                  🌐 Toda a Equipe ({liveCollaborators.length} usuários • {tasks.length} cards)
                </option>
                {liveCollaborators.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.avatar || '👤'} {c.name} — {c.department || 'Geral'} ({c.role || 'Colaborador'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onAddTask}
            className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus size={15} />
            <span>Nova Demanda</span>
          </button>
        </div>
      </div>

      {/* As 4 Colunas do Kanban (Pendente / A Fazer, Em Andamento, Aguardando Retorno, Concluído) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[420px] pb-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => normalizeTaskStatus(t.status) === col.id);
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
                      title="Clique para ampliar, delegar ou transferir entre departamentos"
                    >
                      {/* Topo do Card: Prioridade, Setor e Canal */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {getPriorityBadge(t.priority, t.isVip)}
                          {t.department && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-chatSidebar text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-chatBorder">
                              🏢 {t.department}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-semibold ${
                              t.channel?.includes('Privado')
                                ? 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-500/30'
                                : 'text-brand-600 dark:text-brand-500'
                            }`}
                          >
                            {t.channel}
                          </span>
                          <Maximize2 size={12} className="text-chatTextMuted group-hover:text-brand-600 transition" />
                        </div>
                      </div>

                      {/* Título da Demanda */}
                      <div>
                        <h4 className="text-sm font-semibold text-chatTextTitle leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400 transition">
                          {t.title}
                        </h4>
                      </div>

                      {/* Anexos e Comentários (Discreto) */}
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
                            📌 Solicitado por: <strong>{isTaskRequestedByUser(t, liveCurrentUser) ? 'Você' : t.requester}</strong>
                          </span>
                          {t.requesterDept && (
                            <span className="text-[10px] bg-brand-100 dark:bg-brand-900/60 px-1.5 py-0.2 rounded font-semibold text-brand-700 dark:text-brand-300">
                              {t.requesterDept}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rodapé: Responsável, Abertura, Prazo e Ações */}
                      <div className="pt-2 border-t border-slate-100 dark:border-chatBorder flex items-center justify-between text-xs flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0" title={`Responsável: ${t.assignee}`}>
                          <span className="text-sm">{t.assigneeAvatar || '👤'}</span>
                          <span className="text-[11px] font-medium text-chatTextBody truncate max-w-[90px]">
                            {isTaskAssignedToUser(t, liveCurrentUser) ? '👉 Você' : t.assignee}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                          {/* Data de Abertura */}
                          <div
                            className="flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-chatSidebar px-1.5 py-0.5 rounded border border-slate-200 dark:border-chatBorder"
                            title={`Aberto em: ${formatCardDateTime(t.created_at || t.createdAt)}`}
                          >
                            <Calendar size={11} className="text-brand-600 dark:text-brand-400 shrink-0" />
                            <span className="font-semibold text-[10px]">
                              {formatCardDateTime(t.created_at || t.createdAt)}
                            </span>
                          </div>

                          {/* Prazo SLA */}
                          <div
                            className="flex items-center gap-1 text-chatTextMuted bg-slate-50 dark:bg-chatSidebar/60 px-1.5 py-0.5 rounded border border-slate-100 dark:border-chatBorder/50"
                            title={`Prazo SLA: ${t.dueDate || 'A definir'}`}
                          >
                            <Clock size={11} className="shrink-0" />
                            <span className="font-medium text-[10px]">{t.dueDate || 'A definir'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botões para mover coluna */}
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
                          Ampliar / Transferir Setor
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
