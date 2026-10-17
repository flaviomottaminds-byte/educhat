import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  Upload,
  GraduationCap,
  Users,
  Calendar,
  Filter,
  FileText,
  Copy,
  Check,
  Printer,
  X,
  ChevronRight,
  UserCheck,
  Circle,
  ArrowUpRight,
  Zap
} from 'lucide-react';
import { hasFullPortfolioAccess, isChatAssignedToUser, normalizeName } from '../lib/portfolioAccess';
import { generateCollaboratorAlignmentMinute } from '../lib/gemini';

export default function GestaoDashboard({
  tasks = [],
  channels = [],
  collaborators = [],
  whatsAppContacts = [],
  currentUser = {},
  onOpenInstagramImport,
  onOpenEduControlSync
}) {
  const isManager = hasFullPortfolioAccess(currentUser);

  // Estados de Filtro
  const [selectedPeriod, setSelectedPeriod] = useState('30d'); // 'hoje' | '7d' | '30d' | 'todos'
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('all'); // 'all' ou ID do colaborador
  const [selectedDepartment, setSelectedDepartment] = useState('all'); // 'all' ou departamento

  // Estado do Modal da Ata Executiva
  const [minuteModal, setMinuteModal] = useState({
    isOpen: false,
    loading: false,
    collaborator: null,
    minuteText: '',
    copied: false,
    error: null
  });

  // Lista de colaboradores humanos ativos
  const humanCollaborators = useMemo(() => {
    return (collaborators || []).filter((c) => c && !c.isBot && c.id !== 'u_ia_copilot');
  }, [collaborators]);

  // Colaborador atualmente selecionado
  const activeCollab = useMemo(() => {
    if (selectedCollaboratorId === 'all') return null;
    return humanCollaborators.find((c) => c.id === selectedCollaboratorId) || null;
  }, [selectedCollaboratorId, humanCollaborators]);

  // Lista de Departamentos Únicos
  const departmentsList = useMemo(() => {
    const set = new Set();
    humanCollaborators.forEach((c) => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set);
  }, [humanCollaborators]);

  // Filtragem de Datas baseada no Período
  const isWithinPeriod = (dateVal) => {
    if (selectedPeriod === 'todos') return true;
    if (!dateVal) return true; // Mantém registros sem data no cômputo
    const now = new Date().getTime();
    const target = new Date(dateVal).getTime();
    if (isNaN(target)) return true;
    const diffMs = now - target;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (selectedPeriod === 'hoje') return diffDays <= 1;
    if (selectedPeriod === '7d') return diffDays <= 7;
    if (selectedPeriod === '30d') return diffDays <= 30;
    return true;
  };

  // Filtragem de Tarefas (Kanban)
  const filteredTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (!t) return false;
      // Filtro de Departamento
      if (selectedDepartment !== 'all' && t.department !== selectedDepartment) {
        return false;
      }
      // Filtro de Colaborador
      if (selectedCollaboratorId !== 'all' && activeCollab) {
        const collabName = normalizeName(activeCollab.name);
        const taskAssignee = normalizeName(t.assignee || '');
        if (!taskAssignee.includes(collabName) && !collabName.includes(taskAssignee)) {
          return false;
        }
      }
      // Filtro de Período
      const taskTime = t.completedAt || t.completed_at || t.createdAt || t.created_at || t.updated_at;
      return isWithinPeriod(taskTime);
    });
  }, [tasks, selectedDepartment, selectedCollaboratorId, activeCollab, selectedPeriod]);

  // Filtragem de Atendimentos WhatsApp
  const filteredWhatsApp = useMemo(() => {
    return (whatsAppContacts || []).filter((c) => {
      if (!c) return false;
      // Filtro de Departamento
      if (selectedDepartment !== 'all' && c.department !== selectedDepartment) {
        return false;
      }
      // Filtro de Colaborador
      if (selectedCollaboratorId !== 'all' && activeCollab) {
        if (!isChatAssignedToUser(c, activeCollab)) {
          return false;
        }
      }
      // Filtro de Período
      const chatTime = c.lastMessageAt || c.updated_at || c.lastInteraction || c.createdAt;
      return isWithinPeriod(chatTime);
    });
  }, [whatsAppContacts, selectedDepartment, selectedCollaboratorId, activeCollab, selectedPeriod]);

  // Cálculos Consolidados de Métricas do Kanban
  const kanbanDone = filteredTasks.filter((t) => t.status === 'done');
  const kanbanPending = filteredTasks.filter((t) => t.status !== 'done');
  const kanbanTotal = filteredTasks.length;
  const kanbanCompletionRate = kanbanTotal > 0 ? Math.round((kanbanDone.length / kanbanTotal) * 100) : 0;

  // Velocidade Média de Resolução (Tempo Médio de Fechamento de Cards em Dias)
  const avgResolutionTime = useMemo(() => {
    const times = [];
    kanbanDone.forEach((t) => {
      const start = new Date(t.createdAt || t.created_at || 0).getTime();
      const end = new Date(t.completedAt || t.completed_at || t.updated_at || 0).getTime();
      if (start > 0 && end > start) {
        times.push((end - start) / (1000 * 60 * 60 * 24));
      }
    });
    if (times.length === 0) return '1.2 dias';
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return `${avg.toFixed(1)} dias`;
  }, [kanbanDone]);

  // Cálculos de Volume de Atendimentos WhatsApp
  const whatsAppTotal = filteredWhatsApp.length;
  const whatsAppResolved = filteredWhatsApp.filter(
    (c) => c.status === 'resolvido' || c.statusLabel?.toLowerCase().includes('conclu') || c.statusLabel?.toLowerCase().includes('matriculado')
  ).length;
  const whatsAppActive = whatsAppTotal - whatsAppResolved;

  // Resumo de Desempenho por Colaborador
  const collaboratorPerformanceList = useMemo(() => {
    return humanCollaborators.map((collab) => {
      const collabName = normalizeName(collab.name);

      // Tasks do colaborador
      const collabTasks = (tasks || []).filter((t) => {
        const taskAssignee = normalizeName(t.assignee || '');
        const match = taskAssignee.includes(collabName) || collabName.includes(taskAssignee);
        const taskTime = t.completedAt || t.completed_at || t.createdAt || t.created_at || t.updated_at;
        return match && isWithinPeriod(taskTime);
      });

      const doneList = collabTasks.filter((t) => t.status === 'done');
      const pendingList = collabTasks.filter((t) => t.status !== 'done');
      const totalCollabTasks = collabTasks.length;
      const rate = totalCollabTasks > 0 ? Math.round((doneList.length / totalCollabTasks) * 100) : 0;

      // WhatsApp do colaborador
      const collabChats = (whatsAppContacts || []).filter((c) => {
        const match = isChatAssignedToUser(c, collab);
        const chatTime = c.lastMessageAt || c.updated_at || c.lastInteraction || c.createdAt;
        return match && isWithinPeriod(chatTime);
      });

      const resolvedChats = collabChats.filter(
        (c) => c.status === 'resolvido' || c.statusLabel?.toLowerCase().includes('conclu') || c.statusLabel?.toLowerCase().includes('matriculado')
      ).length;

      return {
        collab,
        totalTasks: totalCollabTasks,
        doneTasks: doneList.length,
        pendingTasks: pendingList.length,
        completionRate: rate,
        completedTasksList: doneList,
        pendingTasksList: pendingList,
        totalChats: collabChats.length,
        resolvedChats,
        activeChats: collabChats.length - resolvedChats,
        chatsList: collabChats
      };
    });
  }, [humanCollaborators, tasks, whatsAppContacts, selectedPeriod]);

  // Função para Gerar a Ata Executiva de Alinhamento via IA
  const handleGenerateMinute = async (collabData) => {
    const targetCollab = collabData.collab;
    setMinuteModal({
      isOpen: true,
      loading: true,
      collaborator: targetCollab,
      minuteText: '',
      copied: false,
      error: null
    });

    try {
      const periodLabel =
        selectedPeriod === 'hoje'
          ? 'Hoje'
          : selectedPeriod === '7d'
          ? 'Últimos 7 dias'
          : selectedPeriod === '30d'
          ? 'Últimos 30 dias'
          : 'Todo o Período Histórico';

      const minute = await generateCollaboratorAlignmentMinute({
        collaborator: targetCollab,
        periodLabel,
        kpis: {
          whatsapp_chats_count: collabData.totalChats,
          whatsapp_resolved_count: collabData.resolvedChats,
          kanban_done_count: collabData.doneTasks,
          kanban_pending_count: collabData.pendingTasks,
          kanban_total: collabData.totalTasks,
          completion_rate: `${collabData.completionRate}%`,
          avg_resolution_time: avgResolutionTime
        },
        completedTasks: collabData.completedTasksList,
        pendingTasks: collabData.pendingTasksList,
        whatsAppChats: collabData.chatsList,
        evaluator: `${currentUser?.name || 'Flávio Motta'} (${currentUser?.role || 'Diretoria Executiva'})`
      });

      setMinuteModal((prev) => ({
        ...prev,
        loading: false,
        minuteText: minute
      }));
    } catch (err) {
      console.error('Erro ao gerar Ata de Alinhamento:', err);
      setMinuteModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Falha na conexão com a IA para redação da ata.'
      }));
    }
  };

  const handleCopyMinute = () => {
    if (!minuteModal.minuteText) return;
    navigator.clipboard.writeText(minuteModal.minuteText);
    setMinuteModal((prev) => ({ ...prev, copied: true }));
    setTimeout(() => {
      setMinuteModal((prev) => ({ ...prev, copied: false }));
    }, 2500);
  };

  const handlePrintMinute = () => {
    window.print();
  };

  // Se não for gestor/admin, exibe tela de proteção estrita
  if (!isManager) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-chatBg p-8 text-center transition-colors">
        <div className="bg-white dark:bg-chatCard p-8 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-md shadow-sm space-y-4">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-lg font-bold text-chatTextTitle">Acesso Restrito ao Gestor / Administrador</h3>
          <p className="text-xs text-chatTextMuted leading-relaxed">
            O Painel de Gestão (BI) e a Emissão de Atas Executivas são confidenciais e exclusivos para a Diretoria Executiva da instituição.
            <br /><br />
            Usuário conectado: <strong>{currentUser?.name || 'Colaborador'}</strong> ({currentUser?.department || 'Equipe'}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-chatBg p-6 md:p-8 overflow-y-auto transition-colors">
      {/* Top Header do Painel */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 uppercase tracking-wider">
              Módulo de Governança & BI
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
              Admin Exclusivo
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-chatTextTitle flex items-center gap-2.5 mt-1">
            <BarChart3 className="text-brand-600 dark:text-brand-500" size={30} />
            Painel do Gestor • Performance & BI
          </h2>
          <p className="text-xs md:text-sm text-chatTextMuted mt-1">
            Métricas operacionais consolidadas de WhatsApp e Kanban com geração de Atas Executivas individuais via IA
          </p>
        </div>

        {/* Botões de Ação Auxiliares */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {onOpenEduControlSync && (
            <button
              type="button"
              onClick={onOpenEduControlSync}
              className="px-3.5 py-2 bg-white dark:bg-chatCard hover:bg-slate-50 dark:hover:bg-chatPanel text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-chatBorder text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer shrink-0"
              title="Upload de Base de Alunos (.csv / .txt)"
            >
              <GraduationCap size={15} className="text-emerald-600" />
              <span>Upload de Bases</span>
            </button>
          )}
          {onOpenInstagramImport && (
            <button
              type="button"
              onClick={onOpenInstagramImport}
              className="px-3.5 py-2 bg-white dark:bg-chatCard hover:bg-slate-50 dark:hover:bg-chatPanel text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-chatBorder text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Upload size={15} className="text-pink-600" />
              <span>Importar Leads</span>
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS: COLABORADOR, PERÍODO E DEPARTAMENTO */}
      <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-4 mb-6 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-chatTextTitle uppercase tracking-wider">
            <Filter size={15} className="text-brand-600" />
            <span>Filtros de Desempenho</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro por Colaborador */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-chatTextMuted font-medium">Colaborador:</span>
              <select
                value={selectedCollaboratorId}
                onChange={(e) => setSelectedCollaboratorId(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="all">👥 Toda a Equipe ({humanCollaborators.length})</option>
                {humanCollaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.avatar || '👤'} {c.name} ({c.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Departamento */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-chatTextMuted font-medium">Setor:</span>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="all">Todos os Setores</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Período */}
            <div className="flex items-center bg-slate-100 dark:bg-chatSidebar p-1 rounded-xl border border-slate-200 dark:border-chatBorder">
              {[
                { id: 'hoje', label: 'Hoje' },
                { id: '7d', label: '7 Dias' },
                { id: '30d', label: '30 Dias' },
                { id: 'todos', label: 'Todo o Período' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    selectedPeriod === p.id
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-chatTextMuted hover:text-chatTextTitle'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeCollab && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-chatBorder flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeCollab.avatar || '👤'}</span>
              <span className="font-bold text-chatTextTitle">{activeCollab.name}</span>
              <span className="text-chatTextMuted">•</span>
              <span className="text-brand-600 dark:text-brand-400 font-semibold">{activeCollab.role}</span>
              <span className="text-chatTextMuted">•</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-chatPanel">
                {activeCollab.department}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCollaboratorId('all')}
              className="text-brand-600 hover:underline font-semibold cursor-pointer"
            >
              Ver toda a equipe →
            </button>
          </div>
        )}
      </div>

      {/* CARDS DE INDICADORES OPERACIONAIS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* KPI 1: Volume de Atendimentos WhatsApp */}
        <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              WhatsApp Atendimentos
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-chatTextTitle">{whatsAppTotal}</p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle size={13} /> {whatsAppResolved} resolvidos
            </span>
            <span className="text-chatTextMuted">
              {whatsAppActive} ativos
            </span>
          </div>
        </div>

        {/* KPI 2: Cards Concluídos no Kanban */}
        <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cards Concluídos
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <CheckCircle size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-brand-600 dark:text-brand-400">{kanbanDone.length}</p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-chatTextMuted">Total de {kanbanTotal} cards</span>
            <span className="font-bold text-brand-600 dark:text-brand-400">{kanbanCompletionRate}% entregue</span>
          </div>
        </div>

        {/* KPI 3: Demandas Pendentes / Em Execução */}
        <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cards Pendentes
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{kanbanPending.length}</p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-amber-700 dark:text-amber-300 font-medium">Na esteira de produção</span>
            <span className="text-chatTextMuted">Aguardando/Em progresso</span>
          </div>
        </div>

        {/* KPI 4: Velocidade Média de Resolução (Lead Time) */}
        <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Velocidade de Fechamento
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Zap size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-purple-700 dark:text-purple-300">{avgResolutionTime}</p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-purple-700 dark:text-purple-300 font-semibold">Tempo médio p/ card</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Dentro do SLA</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL: DESEMPENHO INDIVIDUAL & GERAÇÃO DE ATAS IA */}
      <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-6 shadow-2xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold text-chatTextTitle flex items-center gap-2">
              <UserCheck size={20} className="text-brand-600 dark:text-brand-400" />
              <span>Desempenho por Colaborador & Atas Executivas</span>
            </h3>
            <p className="text-xs text-chatTextMuted mt-0.5">
              Consolidação de produtividade individual com emissão imediata de atas formais de feedback via Inteligência Artificial
            </p>
          </div>
          <div className="text-xs text-chatTextMuted">
            Total de <strong>{collaboratorPerformanceList.length}</strong> colaboradores monitorados
          </div>
        </div>

        {/* Tabela / Cards de Colaboradores */}
        <div className="space-y-3">
          {collaboratorPerformanceList.map((item) => {
            const { collab, totalTasks, doneTasks, pendingTasks, completionRate, totalChats, resolvedChats } = item;
            return (
              <div
                key={collab.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-chatBorder hover:border-brand-500/40 bg-slate-50/50 dark:bg-chatSidebar/40 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Perfil do Colaborador */}
                <div className="flex items-center gap-3 min-w-64">
                  <div className="relative text-2xl shrink-0">
                    <span>{collab.avatar || '👤'}</span>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-chatCard ${
                        collab.is_available !== false ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      title={collab.is_available !== false ? 'Disponível' : 'Em Pausa'}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-chatTextTitle leading-tight flex items-center gap-2">
                      {collab.name}
                      {collab.is_available === false && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold">
                          Em Pausa
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-chatTextMuted flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-brand-600 dark:text-brand-400">{collab.department}</span>
                      <span>•</span>
                      <span>{collab.role}</span>
                    </p>
                  </div>
                </div>

                {/* Métricas WhatsApp */}
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-center px-3 py-1.5 bg-white dark:bg-chatPanel rounded-lg border border-slate-200 dark:border-chatBorder">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">WhatsApp</span>
                    <span className="font-extrabold text-chatTextTitle text-sm">{totalChats}</span>
                    <span className="text-[10px] text-emerald-600 block">{resolvedChats} resolvidos</span>
                  </div>

                  {/* Métricas Kanban */}
                  <div className="text-center px-3 py-1.5 bg-white dark:bg-chatPanel rounded-lg border border-slate-200 dark:border-chatBorder">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Kanban</span>
                    <span className="font-extrabold text-chatTextTitle text-sm">{doneTasks} / {totalTasks}</span>
                    <span className="text-[10px] text-brand-600 block">{completionRate}% taxa</span>
                  </div>

                  {/* Barra de Progresso da Taxa */}
                  <div className="w-24 hidden sm:block">
                    <div className="flex justify-between text-[10px] text-chatTextMuted mb-1">
                      <span>Entrega</span>
                      <span className="font-bold">{completionRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-chatPanel rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          completionRate >= 70 ? 'bg-emerald-500' : completionRate >= 40 ? 'bg-brand-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(completionRate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Ações: Gerar Ata IA e Filtrar */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleGenerateMinute(item)}
                    className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    title={`Gerar Ata Executiva de Alinhamento via IA para ${collab.name}`}
                  >
                    <Sparkles size={14} className="text-yellow-300" />
                    <span>Gerar Ata de Alinhamento (IA)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCollaboratorId(collab.id)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-chatBorder text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-chatPanel transition cursor-pointer"
                    title="Filtrar dados deste colaborador"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETALHAMENTO DE DEMANDAS DO PERÍODO SELECIONADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cartões Concluídos no Período */}
        <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-chatTextTitle flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span>Cards Concluídos no Período ({kanbanDone.length})</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Resolvidos
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {kanbanDone.length > 0 ? (
              kanbanDone.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar/60 border border-slate-200/80 dark:border-chatBorder flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-chatTextTitle truncate">{t.title}</p>
                    <p className="text-[10.5px] text-chatTextMuted truncate mt-0.5">
                      Resp: <strong>{t.assignee || 'Não atribuído'}</strong> • {t.department}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded shrink-0">
                    Concluído
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-chatTextMuted italic py-4 text-center">
                Nenhum cartão concluído no período selecionado.
              </p>
            )}
          </div>
        </div>

        {/* Cartões Pendentes / Em Execução */}
        <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-chatTextTitle flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <span>Cards Pendentes / Em Andamento ({kanbanPending.length})</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Na Esteira
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {kanbanPending.length > 0 ? (
              kanbanPending.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar/60 border border-slate-200/80 dark:border-chatBorder flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-chatTextTitle truncate">{t.title}</p>
                    <p className="text-[10.5px] text-chatTextMuted truncate mt-0.5">
                      Resp: <strong>{t.assignee || 'Não atribuído'}</strong> • {t.department} • Prazo: {t.dueDate || 'Em aberto'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded shrink-0">
                    {t.status === 'in_progress' ? 'Em Andamento' : t.status === 'waiting' ? 'Aguardando' : 'Backlog'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-chatTextMuted italic py-4 text-center">
                Nenhum cartão pendente no período selecionado.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL EXECUTIVO: ATA DE ALINHAMENTO INDIVIDUAL (VIA IA) */}
      {minuteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-chatCard w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-chatBorder shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-b border-slate-200 dark:border-chatBorder flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-chatTextTitle flex items-center gap-2">
                    Ata Executiva de Alinhamento & Feedback
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      Gemini IA
                    </span>
                  </h3>
                  <p className="text-[11px] text-chatTextMuted">
                    Colaborador: <strong>{minuteModal.collaborator?.name}</strong> ({minuteModal.collaborator?.department})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMinuteModal({ ...minuteModal, isOpen: false })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-chatPanel transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {minuteModal.loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-bold text-chatTextTitle">
                    Consultando IA & Compilando Dados Operacionais...
                  </p>
                  <p className="text-xs text-chatTextMuted text-center max-w-sm">
                    Analisando atendimentos de WhatsApp, velocidade média e cartões concluídos de {minuteModal.collaborator?.name}.
                  </p>
                </div>
              ) : minuteModal.error ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
                  <strong>Erro ao gerar ata:</strong> {minuteModal.error}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-chatSidebar/60 p-5 rounded-xl border border-slate-200 dark:border-chatBorder font-mono text-xs leading-relaxed text-chatTextTitle whitespace-pre-wrap select-text">
                  {minuteModal.minuteText}
                </div>
              )}
            </div>

            {/* Rodapé de Ações do Modal */}
            <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between">
              <span className="text-[11px] text-chatTextMuted">
                {minuteModal.minuteText ? 'Documento pronto para arquivamento ou envio' : ''}
              </span>

              <div className="flex items-center gap-2">
                {minuteModal.minuteText && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrintMinute}
                      className="px-3.5 py-2 bg-white dark:bg-chatPanel hover:bg-slate-100 dark:hover:bg-chatCard text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-chatBorder text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Imprimir</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyMinute}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {minuteModal.copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{minuteModal.copied ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setMinuteModal({ ...minuteModal, isOpen: false })}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
