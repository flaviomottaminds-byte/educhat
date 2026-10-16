import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Shield,
  UserCheck,
  Building2,
  Lock,
  Maximize2,
  Paperclip
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ExecutiveBriefingBanner from './ExecutiveBriefingBanner';
import MeetNotesImportModal from './MeetNotesImportModal';
import { normalizeText, fetchActiveCollaboratorsFromDB } from '../lib/gemini';

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
  'Diretoria'
];

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

  const isDirector = useMemo(() => {
    const u = liveCurrentUser || currentUser;
    if (!u) return false;
    const roleNorm = normalizeText(u.role || '');
    const roleTypeNorm = normalizeText(u.roleType || '');
    return (
      u.id === 'u1' ||
      roleTypeNorm === 'diretor' ||
      roleTypeNorm === 'admin' ||
      roleNorm === 'admin' ||
      roleNorm.includes('diretor') ||
      roleNorm.includes('administrador') ||
      roleNorm.includes('gestor geral')
    );
  }, [liveCurrentUser, currentUser]);

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

  // Filtros rápidos da Visão do Admin (Por Setor e Por Colaborador)
  const [filterDepartment, setFilterDepartment] = useState('Todos');
  const [filterAssignee, setFilterAssignee] = useState('todos');

  // Abas de isolamento do Usuário Comum ('my_and_dept' | 'my_tasks' | 'dept_tasks' | 'my_requests')
  const [collabTab, setCollabTab] = useState('my_and_dept');

  // Modal de Importação de Atas do Google Meet (Gemini)
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false);

  const currentUserName = normalizeText(liveCurrentUser?.name);
  const currentUserFirst = currentUserName.split(' ')[0];
  const currentUserEmail = normalizeText(liveCurrentUser?.email);
  const currentUserId = liveCurrentUser?.id;

  // 1. Verifica se o cartão está vinculado ao user_id, email ou nome do colaborador logado
  const isAssignedToMe = (t) => {
    if (currentUserId && t.assigneeId && t.assigneeId === currentUserId) return true;
    if (currentUserEmail && t.assigneeEmail && normalizeText(t.assigneeEmail) === currentUserEmail) return true;
    const a = normalizeText(t.assignee);
    if (!a || !currentUserName) return false;
    return a === currentUserName || (currentUserFirst.length >= 3 && a.startsWith(currentUserFirst));
  };

  // 2. Verifica se foi solicitado por mim para outro setor (Transferência Cruzada)
  const isRequestedByMe = (t) => {
    const r = normalizeText(t.requester);
    if (!r || !currentUserName) return false;
    return r === currentUserName || (currentUserFirst.length >= 3 && r.startsWith(currentUserFirst));
  };

  // 3. Verifica se pertence ao meu departamento
  const isMyDepartment = (t) => {
    const d = normalizeText(t.department);
    const userDept = normalizeText(liveCurrentUser?.department);
    return Boolean(d && userDept && d === userDept);
  };

  // Isolamento Estrito de Visão por Usuário no Kanban (Requisito 3)
  const filteredTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (isDirector) {
        if (filterDepartment !== 'Todos') {
          if (normalizeText(t.department) !== normalizeText(filterDepartment)) {
            return false;
          }
        }
        if (filterAssignee !== 'todos') {
          const selectedCollab = liveCollaborators.find(
            (u) => u.id === filterAssignee || normalizeText(u.name) === normalizeText(filterAssignee)
          );
          const normFilterName = normalizeText(selectedCollab?.name || filterAssignee);
          const normAssignee = normalizeText(t.assignee);
          const idMatches = selectedCollab?.id && t.assigneeId && t.assigneeId === selectedCollab.id;
          const emailMatches =
            selectedCollab?.email &&
            t.assigneeEmail &&
            normalizeText(t.assigneeEmail) === normalizeText(selectedCollab.email);
          const nameMatches =
            normAssignee === normFilterName ||
            (normFilterName.split(' ')[0]?.length >= 3 && normAssignee.includes(normFilterName.split(' ')[0]));

          if (!idMatches && !emailMatches && !nameMatches) {
            return false;
          }
        }
        return true;
      } else {
        // Usuário Comum: vê estritamente os cartões atribuídos ao seu user_id/nome ou ao seu departamento
        if (collabTab === 'my_and_dept') {
          return isAssignedToMe(t) || isMyDepartment(t);
        }
        if (collabTab === 'my_tasks') {
          return isAssignedToMe(t);
        }
        if (collabTab === 'dept_tasks') {
          return isMyDepartment(t);
        }
        if (collabTab === 'my_requests') {
          return isRequestedByMe(t) && !isAssignedToMe(t);
        }
        return false;
      }
    });
  }, [tasks, isDirector, filterDepartment, filterAssignee, collabTab, liveCurrentUser, liveCollaborators]);

  const myTasksCount = tasks.filter(isAssignedToMe).length;
  const deptTasksCount = tasks.filter(isMyDepartment).length;
  const myAndDeptCount = tasks.filter((t) => isAssignedToMe(t) || isMyDepartment(t)).length;
  const myRequestsCount = tasks.filter((t) => isRequestedByMe(t) && !isAssignedToMe(t)).length;

  const handleSelectAgendaBlock = (block) => {
    if (!isDirector) return;
    if (block.id === 'ALL') {
      setFilterDepartment('Todos');
      setFilterAssignee('todos');
      return;
    }
    if (block.assigneeFilter) {
      setFilterDepartment(block.department || 'Todos');
      setFilterAssignee(block.assigneeFilter);
      return;
    }
    setFilterDepartment(block.department || 'Todos');
    setFilterAssignee('todos');
  };

  const handleMove = (e, taskId, currentStatus, direction) => {
    e.stopPropagation();
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
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] dark:bg-chatBg p-4 sm:p-6 overflow-y-auto transition-colors">
      {/* Header do Kanban com Nível de Acesso e Botão de Importar Ata do Meet */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-chatTextTitle flex items-center gap-2">
              📋 Quadro de Demandas & Automação Executiva
            </h2>
            {isDirector ? (
              <span className="text-[11px] font-semibold bg-brand-600/15 text-brand-700 dark:text-brand-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-brand-500/30">
                <Shield size={12} /> Visão Global Admin ({liveCurrentUser?.role || 'Diretoria'})
              </span>
            ) : (
              <span className="text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-500/30">
                <Lock size={12} /> Visão Isolada: {liveCurrentUser?.name} ({liveCurrentUser?.department} • {liveCurrentUser?.role})
              </span>
            )}
          </div>
          <p className="text-xs text-chatTextMuted">
            {isDirector
              ? 'Controle executivo integrado com Atas do Google Meet (gemini-notes@google.com) e Briefing da Agenda.'
              : 'Exibindo cartões atribuídos a você ou ao seu setor. Você pode transferir tarefas entre departamentos ao clicar em qualquer card.'}
          </p>
        </div>

        {/* Controles de Filtro por Perfil + Botões de Ação */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDirector ? (
            <>
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

              {/* Filtro Rápido por Colaborador (Sincronizado com o Banco em Tempo Real) */}
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
            </>
          ) : (
            /* Abas de Isolamento do Usuário Comum */
            <div className="flex bg-slate-200/80 dark:bg-chatPanel p-1 rounded-lg border border-slate-300 dark:border-chatBorder text-xs flex-wrap">
              <button
                onClick={() => setCollabTab('my_and_dept')}
                className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition ${
                  collabTab === 'my_and_dept'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <span>📋 Meu Painel ({myAndDeptCount})</span>
              </button>
              <button
                onClick={() => setCollabTab('my_tasks')}
                className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition ${
                  collabTab === 'my_tasks'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <UserCheck size={13} />
                <span>Minhas ({myTasksCount})</span>
              </button>
              <button
                onClick={() => setCollabTab('dept_tasks')}
                className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition ${
                  collabTab === 'dept_tasks'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <Building2 size={13} />
                <span>Setor {liveCurrentUser?.department} ({deptTasksCount})</span>
              </button>
              <button
                onClick={() => setCollabTab('my_requests')}
                title="Demandas que você transferiu ou abriu para outros setores"
                className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition ${
                  collabTab === 'my_requests'
                    ? 'bg-white dark:bg-brand-600 text-chatTextTitle dark:text-white shadow-xs'
                    : 'text-chatTextMuted hover:text-chatTextTitle'
                }`}
              >
                <span>📤 Solicitações ({myRequestsCount})</span>
              </button>
            </div>
          )}

          {/* Botão: Importar Ata do Meet (Gemini) */}
          <button
            type="button"
            onClick={() => setIsMeetModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Sparkles size={15} className="text-yellow-300" />
            <span>✨ Importar Ata do Meet (Gemini)</span>
          </button>

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

      {/* REQUISITO 4: Briefing Executivo Automático Sincronizado com a Agenda (Topo do Kanban) */}
      <ExecutiveBriefingBanner
        tasks={isDirector ? tasks : filteredTasks}
        activeDepartment={isDirector ? filterDepartment : liveCurrentUser?.department || 'Todos'}
        activeCollaborator={filterAssignee}
        collaborators={liveCollaborators}
        onSelectAgendaBlock={handleSelectAgendaBlock}
        vipClients={vipClients}
        slas={slas}
      />

      {/* As 4 Colunas do Kanban (Pendente / A Fazer, Em Andamento, Aguardando Retorno, Concluído) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[420px] pb-4">
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

                      {/* Anexos e Comentários */}
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
                            📌 Solicitado por: <strong>{t.requester === liveCurrentUser?.name ? 'Você' : t.requester}</strong>
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
                            ORIGEM:
                          </span>
                          "{t.sourceMessage}"
                        </div>
                      )}

                      {/* Rodapé: Responsável, Prazo e Ações */}
                      <div className="pt-2 border-t border-slate-100 dark:border-chatBorder flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5" title={`Responsável: ${t.assignee}`}>
                          <span className="text-sm">{t.assigneeAvatar || '👤'}</span>
                          <span className="text-[11px] font-medium text-chatTextBody truncate w-28">
                            {t.assignee === liveCurrentUser?.name ? '👉 Você' : t.assignee}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-chatTextMuted">
                          <Clock size={12} />
                          <span>{t.dueDate}</span>
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

      {/* Modal de Importação de Atas do Google Meet via Gemini */}
      <MeetNotesImportModal
        isOpen={isMeetModalOpen}
        onClose={() => setIsMeetModalOpen(false)}
        collaborators={liveCollaborators}
        onCreateTasksBatch={onCreateTasksBatch}
        onOpenAIMemory={onOpenAIMemory}
      />
    </div>
  );
}
