import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Link2,
  Check
} from 'lucide-react';
import {
  generateExecutiveMeetingBriefing,
  normalizeText,
  fetchActiveCollaboratorsFromDB,
  matchCollaboratorToTask
} from '../lib/gemini';

export const AGENDA_BLOCKS = [
  {
    id: 'ALL',
    label: 'VISÃO GERAL DA AGENDA',
    shortLabel: 'VISÃO GERAL',
    department: 'Todos',
    assigneeMatch: '',
    timeSlot: 'Dia Inteiro',
    badgeColor: 'from-slate-700 to-slate-900'
  },
  {
    id: 'MARKETING',
    label: 'BLOCO: MARKETING',
    shortLabel: 'MARKETING',
    department: 'Marketing',
    assigneeMatch: '',
    timeSlot: '09:00 - 10:00',
    badgeColor: 'from-pink-600 to-purple-700'
  },
  {
    id: 'COMERCIAL',
    label: 'BLOCO: COMERCIAL',
    shortLabel: 'COMERCIAL',
    department: 'Comercial',
    assigneeMatch: '',
    timeSlot: '10:00 - 11:00',
    badgeColor: 'from-emerald-600 to-teal-700'
  },
  {
    id: 'TERAPIA_EXPANSAO',
    label: 'BLOCO: TERAPIA E EXPANSÃO',
    shortLabel: 'TERAPIA E EXPANSÃO',
    department: 'Expansão',
    assigneeMatch: '',
    timeSlot: '11:00 - 12:00',
    badgeColor: 'from-indigo-600 to-blue-700'
  },
  {
    id: 'DEMANDA_PAULO',
    label: 'BLOCO: DEMANDA PAULO',
    shortLabel: 'DEMANDA PAULO',
    department: 'Pedagógico',
    assigneeQuery: 'Paulo',
    assigneeMatch: '',
    timeSlot: '14:00 - 15:00',
    badgeColor: 'from-amber-600 to-orange-700'
  },
  {
    id: 'LINDOMAR',
    label: 'BLOCO: LINDOMAR (PEDAGÓGICO)',
    shortLabel: 'LINDOMAR',
    department: 'Pedagógico',
    assigneeQuery: 'Lindomar',
    assigneeMatch: '',
    timeSlot: '15:00 - 16:00',
    badgeColor: 'from-cyan-600 to-sky-700'
  },
  {
    id: 'SECRETARIA',
    label: 'BLOCO: SECRETARIA & MEC',
    shortLabel: 'SECRETARIA',
    department: 'Secretaria',
    assigneeMatch: '',
    timeSlot: '16:00 - 17:00',
    badgeColor: 'from-violet-600 to-purple-800'
  },
  {
    id: 'TUTORIA',
    label: 'BLOCO: TUTORIA ACADÊMICA',
    shortLabel: 'TUTORIA',
    department: 'Tutoria',
    assigneeMatch: '',
    timeSlot: '17:00 - 18:00',
    badgeColor: 'from-teal-600 to-emerald-800'
  }
];

export default function ExecutiveBriefingBanner({
  tasks = [],
  activeDepartment = 'Todos',
  activeCollaborator = 'Todos',
  collaborators = [],
  onSelectAgendaBlock,
  vipClients = [],
  slas = [],
  compact = false
}) {
  const [liveCollaborators, setLiveCollaborators] = useState(collaborators);

  useEffect(() => {
    let isMounted = true;
    fetchActiveCollaboratorsFromDB(collaborators)
      .then((dbUsers) => {
        if (isMounted && Array.isArray(dbUsers) && dbUsers.length > 0) {
          setLiveCollaborators(dbUsers);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [collaborators]);

  // Resolve dinamicamente os responsáveis de cada bloco com base nos usuários ativos do banco
  const resolvedAgendaBlocks = useMemo(() => {
    return AGENDA_BLOCKS.map((b) => {
      if (b.id === 'ALL') return b;
      if (b.assigneeQuery) {
        const matched = matchCollaboratorToTask(b.assigneeQuery, b.department, liveCollaborators);
        return {
          ...b,
          assigneeMatch: matched?.name || b.assigneeQuery
        };
      }
      const deptLead = (liveCollaborators || []).find(
        (u) => !u.isBot && normalizeText(u.department) === normalizeText(b.department)
      );
      return {
        ...b,
        assigneeMatch: deptLead?.name || ''
      };
    });
  }, [liveCollaborators]);

  const [selectedBlockId, setSelectedBlockId] = useState(() => {
    if (activeDepartment && activeDepartment !== 'Todos') {
      const found = AGENDA_BLOCKS.find(
        (b) => normalizeText(b.department) === normalizeText(activeDepartment)
      );
      if (found) return found.id;
    }
    return 'MARKETING';
  });

  const [isExpanded, setIsExpanded] = useState(!compact);
  const [aiBriefing, setAiBriefing] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState(
    () => localStorage.getItem('educhat_google_calendar_url') || ''
  );
  const [calendarSaved, setCalendarSaved] = useState(false);

  // Sincroniza quando o painel de departamento muda externamente
  useEffect(() => {
    if (activeDepartment && activeDepartment !== 'Todos') {
      const found = resolvedAgendaBlocks.find(
        (b) => normalizeText(b.department) === normalizeText(activeDepartment)
      );
      if (found) {
        setSelectedBlockId(found.id);
      }
    }
  }, [activeDepartment, resolvedAgendaBlocks]);

  const currentBlock = useMemo(
    () => resolvedAgendaBlocks.find((b) => b.id === selectedBlockId) || resolvedAgendaBlocks[0],
    [selectedBlockId, resolvedAgendaBlocks]
  );

  // Filtra os cartões do Kanban correspondentes ao bloco da agenda selecionado
  const blockTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      if (currentBlock.id === 'ALL') return true;

      const taskDept = normalizeText(t.department || '');
      const taskAssignee = normalizeText(t.assignee || '');
      const blockDept = normalizeText(currentBlock.department || '');
      const blockAssignee = normalizeText(currentBlock.assigneeMatch || '');

      // Para blocos nominais específicos resolvidos dinamicamente do banco
      if (currentBlock.assigneeQuery) {
        const queryNorm = normalizeText(currentBlock.assigneeQuery);
        return (
          (blockAssignee && taskAssignee === blockAssignee) ||
          taskAssignee.includes(queryNorm) ||
          normalizeText(t.title).includes(queryNorm)
        );
      }

      if (blockDept && taskDept === blockDept) return true;
      if (blockAssignee && taskAssignee.includes(blockAssignee.split(' ')[0])) return true;
      return false;
    });
  }, [tasks, currentBlock]);

  // Separação em tempo real nas 3 colunas executivas da reunião
  const doneCards = useMemo(
    () => blockTasks.filter((t) => t.status === 'done'),
    [blockTasks]
  );
  const inProgressCards = useMemo(
    () => blockTasks.filter((t) => t.status === 'in_progress' || t.status === 'waiting'),
    [blockTasks]
  );
  const pendingCriticalCards = useMemo(
    () =>
      blockTasks
        .filter((t) => t.status === 'backlog')
        .sort((a, b) => {
          const score = (p) => (p === 'vip' ? 4 : p === 'alta' ? 3 : p === 'media' ? 2 : 1);
          return score(b.priority) - score(a.priority);
        }),
    [blockTasks]
  );

  const handleSelectBlock = (block) => {
    setSelectedBlockId(block.id);
    setAiBriefing(null);
    setAiError('');
    if (onSelectAgendaBlock) {
      onSelectAgendaBlock(block);
    }
  };

  const handleGenerateGeminiBriefing = async () => {
    setIsGeneratingAI(true);
    setAiError('');
    try {
      const result = await generateExecutiveMeetingBriefing({
        blockName: currentBlock.shortLabel,
        department: currentBlock.department,
        assigneeFilter:
          currentBlock.id === 'DEMANDA_PAULO' || currentBlock.id === 'LINDOMAR'
            ? currentBlock.assigneeMatch
            : activeCollaborator !== 'Todos'
            ? activeCollaborator
            : '',
        tasks: blockTasks,
        vipClients,
        slas
      });
      setAiBriefing(result);
      setIsExpanded(true);
    } catch (err) {
      setAiError(err.message || 'Erro ao consultar Gemini para o Briefing.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveCalendarUrl = () => {
    localStorage.setItem('educhat_google_calendar_url', calendarUrl.trim());
    setCalendarSaved(true);
    setTimeout(() => {
      setCalendarSaved(false);
      setShowCalendarConfig(false);
    }, 1500);
  };

  return (
    <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 text-white shadow-lg overflow-hidden">
      {/* Barra Superior do Briefing Automático da Reunião */}
      <div className="p-3 sm:px-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
            <Calendar size={18} className="text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
                Briefing Automático da Reunião (Google Agenda ↔ Kanban)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Tempo Real • {blockTasks.length} Cartões no Bloco
              </span>
            </div>
            <p className="text-[11px] text-indigo-200/80">
              Selecione o bloco da sua agenda diária para visualizar instantaneamente o que foi entregue, o que está rodando e o que cobrar agora.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
          <button
            type="button"
            onClick={() => setShowCalendarConfig(!showCalendarConfig)}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-semibold text-indigo-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Vincular URL iCal / Google Calendar da Diretoria"
          >
            <Link2 size={13} />
            <span>{calendarUrl ? 'Agenda Conectada' : 'Conectar Google Agenda'}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateGeminiBriefing}
            disabled={isGeneratingAI}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            {isGeneratingAI ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Sintetizando com Gemini 2.5...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-yellow-300" />
                <span>Sintetizar Pauta com Gemini</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 transition cursor-pointer"
            title={isExpanded ? 'Recolher Briefing' : 'Expandir Briefing'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Configuração Rápida de Link do Google Agenda */}
      {showCalendarConfig && (
        <div className="px-4 py-2.5 bg-indigo-950/80 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-indigo-200">
            Cole o link iCal ou endereço da sua Agenda Google para sincronizar seus blocos diários (MARKETING, COMERCIAL, TERAPIA E EXPANSÃO, DEMANDA PAULO, LINDOMAR):
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={calendarUrl}
              onChange={(e) => setCalendarUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="bg-slate-900/90 text-white px-3 py-1.5 rounded-lg border border-indigo-400/30 text-xs w-full sm:w-72 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={handleSaveCalendarUrl}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {calendarSaved ? <Check size={13} /> : null}
              <span>{calendarSaved ? 'Sincronizado!' : 'Salvar Agenda'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Seletor de Blocos da Agenda Diária */}
      <div className="px-3 sm:px-4 py-2 bg-black/25 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 shrink-0 mr-1">
          Blocos da Agenda:
        </span>
        {resolvedAgendaBlocks.map((block) => {
          const isSelected = block.id === selectedBlockId;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => handleSelectBlock(block)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? `bg-gradient-to-r ${block.badgeColor} text-white shadow-sm border border-white/30`
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-transparent'
              }`}
            >
              <span>{block.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Painel de 3 Pilares Executivos (Concluído | Em Andamento | Pendências Críticas para Cobrar Agora) */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3">
          {aiError && (
            <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs">
              ⚠️ {aiError}
            </div>
          )}

          {aiBriefing?.resumo_executivo && (
            <div className="p-2.5 px-3.5 rounded-xl bg-purple-500/15 border border-purple-400/30 text-xs text-purple-100 flex items-center gap-2">
              <Sparkles size={15} className="text-yellow-300 shrink-0" />
              <span>
                <strong className="text-yellow-300">Síntese Gemini 2.5 ({currentBlock.shortLabel}):</strong>{' '}
                {aiBriefing.resumo_executivo}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* PILAR 1: ✅ O QUE FOI CONCLUÍDO DESDE A ÚLTIMA REUNIÃO */}
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-500/20">
                <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>✅ Concluído desde a última reunião</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {doneCards.length}
                </span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-emerald-100/90 max-h-36 overflow-y-auto pr-1">
                {aiBriefing?.concluidos?.length > 0 ? (
                  aiBriefing.concluidos.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : doneCards.length === 0 ? (
                  <li className="text-slate-400 italic">
                    Nenhuma tarefa marcada como concluída neste bloco ainda.
                  </li>
                ) : (
                  doneCards.map((t) => (
                    <li key={t.id} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>
                        <strong>{t.title}</strong> — <span className="text-emerald-300">{t.assignee}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* PILAR 2: 🔄 O QUE ESTÁ EM ANDAMENTO */}
            <div className="rounded-xl bg-blue-950/40 border border-blue-500/30 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-blue-500/20">
                <span className="font-bold text-xs text-blue-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400 shrink-0" />
                  <span>🔄 O que está em andamento</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  {inProgressCards.length}
                </span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-blue-100/90 max-h-36 overflow-y-auto pr-1">
                {aiBriefing?.em_andamento?.length > 0 ? (
                  aiBriefing.em_andamento.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : inProgressCards.length === 0 ? (
                  <li className="text-slate-400 italic">
                    Nenhuma demanda em execução no momento para este bloco.
                  </li>
                ) : (
                  inProgressCards.map((t) => (
                    <li key={t.id} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-blue-400 font-bold">↻</span>
                      <span>
                        <strong>{t.title}</strong> ({t.assignee} • Prazo: {t.dueDate || 'Em curso'})
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* PILAR 3: ⚠️ PENDÊNCIAS CRÍTICAS QUE PRECISO COBRAR AGORA NA REUNIÃO */}
            <div className="rounded-xl bg-amber-950/50 border border-amber-500/40 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-amber-500/20">
                <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span>⚠️ Pendências críticas (Cobrar Agora)</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  {pendingCriticalCards.length}
                </span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-amber-100/95 max-h-36 overflow-y-auto pr-1">
                {aiBriefing?.pendencias_criticas?.length > 0 ? (
                  aiBriefing.pendencias_criticas.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-amber-400 font-bold mt-0.5">!</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : pendingCriticalCards.length === 0 ? (
                  <li className="text-slate-400 italic">
                    Zero pendências paradas na coluna "Pendente / A Fazer" deste bloco! 🎉
                  </li>
                ) : (
                  pendingCriticalCards.map((t) => (
                    <li key={t.id} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-amber-400 font-bold">⚠️</span>
                      <span>
                        <strong>{t.title}</strong> — Cobrar de{' '}
                        <span className="underline decoration-amber-400/60 font-semibold">
                          {t.assignee}
                        </span>{' '}
                        ({t.priority?.toUpperCase()} • {t.dueDate || 'Imediato'})
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
