import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Check,
  Upload
} from 'lucide-react';
import {
  generateExecutiveMeetingBriefing,
  normalizeText,
  normalizeDepartmentName,
  fetchActiveCollaboratorsFromDB,
  matchCollaboratorToTask
} from '../lib/gemini';

export const AGENDA_BLOCKS = [
  {
    id: 'ALL',
    icon: '🌐',
    label: 'VISÃO GERAL DA AGENDA',
    shortLabel: 'Visão Geral',
    department: 'Todos',
    assigneeMatch: '',
    timeSlot: 'Dia Inteiro',
    badgeColor: 'from-slate-700 to-slate-900'
  },
  {
    id: 'MARKETING',
    icon: '📣',
    label: 'BLOCO: MARKETING',
    shortLabel: 'Marketing',
    department: 'Marketing',
    assigneeMatch: '',
    timeSlot: '09:00 - 10:00',
    badgeColor: 'from-pink-600 to-purple-700'
  },
  {
    id: 'COMERCIAL',
    icon: '💼',
    label: 'BLOCO: COMERCIAL',
    shortLabel: 'Comercial',
    department: 'Comercial',
    assigneeMatch: '',
    timeSlot: '10:00 - 11:00',
    badgeColor: 'from-emerald-600 to-teal-700'
  },
  {
    id: 'TERAPIA_EXPANSAO',
    icon: '🚀',
    label: 'BLOCO: TERAPIA E EXPANSÃO',
    shortLabel: 'Terapia e Expansão',
    department: 'Expansão',
    assigneeMatch: '',
    timeSlot: '11:00 - 12:00',
    badgeColor: 'from-indigo-600 to-blue-700'
  },
  {
    id: 'DEMANDA_PAULO',
    icon: '🎓',
    label: 'BLOCO: DEMANDA PAULO',
    shortLabel: 'Demanda Paulo',
    department: 'Pedagógico',
    assigneeQuery: 'Paulo',
    assigneeMatch: '',
    timeSlot: '14:00 - 15:00',
    badgeColor: 'from-amber-600 to-orange-700'
  },
  {
    id: 'LINDOMAR',
    icon: '📚',
    label: 'BLOCO: LINDOMAR (PEDAGÓGICO)',
    shortLabel: 'Lindomar (Pedagógico)',
    department: 'Pedagógico',
    assigneeQuery: 'Lindomar',
    assigneeMatch: '',
    timeSlot: '15:00 - 16:00',
    badgeColor: 'from-cyan-600 to-sky-700'
  },
  {
    id: 'SECRETARIA',
    icon: '🏛️',
    label: 'BLOCO: SECRETARIA & MEC',
    shortLabel: 'Secretaria & MEC',
    department: 'Secretaria',
    assigneeMatch: '',
    timeSlot: '16:00 - 17:00',
    badgeColor: 'from-violet-600 to-purple-800'
  },
  {
    id: 'TUTORIA',
    icon: '👩‍🏫',
    label: 'BLOCO: TUTORIA ACADÊMICA',
    shortLabel: 'Tutoria',
    department: 'Tutoria',
    assigneeMatch: '',
    timeSlot: '17:00 - 18:00',
    badgeColor: 'from-teal-600 to-emerald-800'
  }
];

/**
 * Converte data/hora iCal (ex: 20261016T120000Z ou 20261016T090000) para horário legível HH:mm
 */
function formatICalTime(rawDt = '') {
  const clean = String(rawDt || '').trim();
  const match = clean.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (!match) return '';

  const [, year, month, day, hour, minute, second, isUtc] = match;
  if (isUtc) {
    const dateObj = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
    return dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  }
  return `${hour}:${minute}`;
}

/**
 * Parser completo de arquivos/links iCal (.ics / basic.ics do Google Agenda):
 * Extrai eventos VEVENT e converte em blocos clicáveis de reunião sincronizados com os setores do Kanban.
 */
export function parseICalEventsToBlocks(icsContent = '') {
  if (!icsContent || typeof icsContent !== 'string' || !icsContent.includes('BEGIN:VEVENT')) {
    return [];
  }

  // Desdobra linhas quebradas pelo padrão RFC 5545 (CRLF seguido de espaço ou tab)
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const eventChunks = unfolded.split('BEGIN:VEVENT').slice(1);
  const parsedEvents = [];

  for (const chunk of eventChunks) {
    const body = chunk.split('END:VEVENT')[0] || '';
    const lines = body.split(/\r?\n/);

    let summary = '';
    let description = '';
    let dtStart = '';
    let dtEnd = '';

    for (const line of lines) {
      if (line.startsWith('SUMMARY')) {
        summary = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
      } else if (line.startsWith('DESCRIPTION')) {
        description = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
      } else if (line.startsWith('DTSTART')) {
        dtStart = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('DTEND')) {
        dtEnd = line.split(':').slice(1).join(':').trim();
      }
    }

    if (!summary) continue;

    const startFormatted = formatICalTime(dtStart);
    const endFormatted = formatICalTime(dtEnd);
    const timeSlot =
      startFormatted && endFormatted
        ? `${startFormatted} - ${endFormatted}`
        : startFormatted || 'Agenda Google';

    const normSummary = normalizeText(`${summary} ${description}`);
    let mappedBlockId = null;
    let department = normalizeDepartmentName(summary);
    let assigneeQuery = '';
    let icon = '📅';
    let badgeColor = 'from-indigo-600 to-purple-700';

    if (normSummary.includes('market') || normSummary.includes('midia') || normSummary.includes('campanha')) {
      mappedBlockId = 'MARKETING';
      department = 'Marketing';
      icon = '📣';
      badgeColor = 'from-pink-600 to-purple-700';
    } else if (normSummary.includes('comerc') || normSummary.includes('venda') || normSummary.includes('matricul')) {
      mappedBlockId = 'COMERCIAL';
      department = 'Comercial';
      icon = '💼';
      badgeColor = 'from-emerald-600 to-teal-700';
    } else if (normSummary.includes('terapia') || normSummary.includes('expans') || normSummary.includes('polo')) {
      mappedBlockId = 'TERAPIA_EXPANSAO';
      department = 'Expansão';
      icon = '🚀';
      badgeColor = 'from-indigo-600 to-blue-700';
    } else if (normSummary.includes('paulo')) {
      mappedBlockId = 'DEMANDA_PAULO';
      department = 'Pedagógico';
      assigneeQuery = 'Paulo';
      icon = '🎓';
      badgeColor = 'from-amber-600 to-orange-700';
    } else if (normSummary.includes('lindomar')) {
      mappedBlockId = 'LINDOMAR';
      department = 'Pedagógico';
      assigneeQuery = 'Lindomar';
      icon = '📚';
      badgeColor = 'from-cyan-600 to-sky-700';
    } else if (normSummary.includes('secretar') || normSummary.includes('mec') || normSummary.includes('diploma')) {
      mappedBlockId = 'SECRETARIA';
      department = 'Secretaria';
      icon = '🏛️';
      badgeColor = 'from-violet-600 to-purple-800';
    } else if (normSummary.includes('tutor') || normSummary.includes('ava') || normSummary.includes('suporte')) {
      mappedBlockId = 'TUTORIA';
      department = 'Tutoria';
      icon = '👩‍🏫';
      badgeColor = 'from-teal-600 to-emerald-800';
    } else if (normSummary.includes('pedagog') || normSummary.includes('coordenac')) {
      department = 'Pedagógico';
      icon = '🎓';
      badgeColor = 'from-amber-600 to-orange-700';
    }

    parsedEvents.push({
      mappedBlockId,
      id: mappedBlockId || `ICAL_${normalizeText(summary).replace(/[^a-z0-9]/g, '_').slice(0, 24)}`,
      icon,
      label: `BLOCO: ${summary.toUpperCase()}`,
      shortLabel: summary.length > 26 ? `${summary.slice(0, 24)}...` : summary,
      department: department || 'Geral',
      assigneeQuery,
      assigneeMatch: '',
      timeSlot,
      badgeColor,
      fromIcs: true
    });
  }

  // Deduplica por id mantendo o evento mais recente
  const uniqueMap = new Map();
  parsedEvents.forEach((ev) => {
    uniqueMap.set(ev.id, ev);
  });
  return Array.from(uniqueMap.values()).slice(0, 14);
}

/**
 * Busca o conteúdo de um link iCal (.ics) da Google Agenda usando proxies CORS de fallback
 * para funcionar diretamente no navegador sem bloqueio de CORS.
 */
async function fetchICalContentWithFallback(rawUrl = '') {
  const cleanUrl = rawUrl.trim().replace(/^webcal:\/\//i, 'https://');
  if (!cleanUrl) return '';

  const candidateUrls = [
    cleanUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`
  ];

  for (const target of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(target, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('BEGIN:VCALENDAR')) {
          return text;
        }
      }
    } catch {
      // Tenta próximo proxy CORS
    }
  }
  return '';
}

export default function ExecutiveBriefingBanner({
  tasks = [],
  activeDepartment = 'Todos',
  activeCollaborator = 'Todos',
  collaborators = [],
  onSelectAgendaBlock,
  vipClients = [],
  slas = []
}) {
  const [liveCollaborators, setLiveCollaborators] = useState(collaborators);
  const [customIcsBlocks, setCustomIcsBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem('educhat_parsed_ical_blocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarStatusMsg, setCalendarStatusMsg] = useState('');
  const icsFileInputRef = useRef(null);

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

  // Mescla os blocos padrão da operação (Visão Geral, Marketing, Comercial, Secretaria, Tutoria, etc.)
  // com quaisquer eventos/horários lidos do link basic.ics da Google Agenda e resolve os responsáveis no banco.
  const resolvedAgendaBlocks = useMemo(() => {
    const icsMap = new Map();
    (customIcsBlocks || []).forEach((b) => {
      icsMap.set(b.mappedBlockId || b.id, b);
    });

    const baseMerged = AGENDA_BLOCKS.map((b) => {
      if (b.id === 'ALL') return b;
      const icsOverride = icsMap.get(b.id);
      const mergedBlock = icsOverride
        ? {
            ...b,
            timeSlot: icsOverride.timeSlot || b.timeSlot,
            fromIcs: true
          }
        : b;

      if (mergedBlock.assigneeQuery) {
        const matched = matchCollaboratorToTask(
          mergedBlock.assigneeQuery,
          mergedBlock.department,
          liveCollaborators
        );
        return {
          ...mergedBlock,
          assigneeMatch: matched?.assignee || mergedBlock.assigneeQuery
        };
      }
      const deptLead = (liveCollaborators || []).find(
        (u) => !u.isBot && normalizeText(u.department) === normalizeText(mergedBlock.department)
      );
      return {
        ...mergedBlock,
        assigneeMatch: deptLead?.name || ''
      };
    });

    // Adiciona blocos extras vindos do basic.ics que não sejam um dos blocos fixos
    const extraIcsBlocks = (customIcsBlocks || [])
      .filter((b) => !b.mappedBlockId && !AGENDA_BLOCKS.some((ab) => ab.id === b.id))
      .map((b) => {
        const deptLead = (liveCollaborators || []).find(
          (u) => !u.isBot && normalizeText(u.department) === normalizeText(b.department)
        );
        return {
          ...b,
          assigneeMatch: deptLead?.name || ''
        };
      });

    return [...baseMerged, ...extraIcsBlocks];
  }, [liveCollaborators, customIcsBlocks]);

  const [selectedBlockId, setSelectedBlockId] = useState(() => {
    if (activeDepartment && activeDepartment !== 'Todos') {
      const found = AGENDA_BLOCKS.find(
        (b) => normalizeText(b.department) === normalizeText(activeDepartment)
      );
      if (found) return found.id;
    }
    return 'ALL';
  });

  // Sempre inicia EXPANDIDO na tela do Kanban para máxima visibilidade dos blocos e métricas
  const [isExpanded, setIsExpanded] = useState(true);
  const [aiBriefing, setAiBriefing] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState(
    () => localStorage.getItem('educhat_google_calendar_url') || ''
  );
  const [calendarSaved, setCalendarSaved] = useState(false);

  // Sincroniza automaticamente o link iCal (.ics) salvo ao montar
  useEffect(() => {
    if (!calendarUrl || !calendarUrl.trim()) return;
    let isMounted = true;
    fetchICalContentWithFallback(calendarUrl).then((icsText) => {
      if (!isMounted || !icsText) return;
      const parsed = parseICalEventsToBlocks(icsText);
      if (parsed.length > 0) {
        setCustomIcsBlocks(parsed);
        try {
          localStorage.setItem('educhat_parsed_ical_blocks', JSON.stringify(parsed));
        } catch {}
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sincroniza apenas quando o seletor de departamento externo do Kanban muda para outro setor
  useEffect(() => {
    if (!activeDepartment) return;
    if (activeDepartment === 'Todos') {
      if (selectedBlockId !== 'ALL') {
        setSelectedBlockId('ALL');
      }
      return;
    }
    const currentObj = resolvedAgendaBlocks.find((b) => b.id === selectedBlockId);
    if (currentObj && normalizeText(currentObj.department) === normalizeText(activeDepartment)) {
      return;
    }
    const found = resolvedAgendaBlocks.find(
      (b) => normalizeText(b.department) === normalizeText(activeDepartment)
    );
    if (found) {
      setSelectedBlockId(found.id);
    }
  }, [activeDepartment]);

  const currentBlock = useMemo(
    () => resolvedAgendaBlocks.find((b) => b.id === selectedBlockId) || resolvedAgendaBlocks[0],
    [selectedBlockId, resolvedAgendaBlocks]
  );

  // Função auxiliar para contar os cartões de qualquer bloco (exibido no badge de cada botão)
  const getTasksForBlock = (block) => {
    if (!block) return [];
    return (tasks || []).filter((t) => {
      if (block.id === 'ALL') return true;

      const taskDept = normalizeText(t.department || '');
      const taskAssignee = normalizeText(t.assignee || '');
      const blockDept = normalizeText(block.department || '');
      const blockAssignee = normalizeText(block.assigneeMatch || '');

      if (block.assigneeQuery) {
        const queryNorm = normalizeText(block.assigneeQuery);
        return (
          (blockAssignee && taskAssignee === blockAssignee) ||
          taskAssignee.includes(queryNorm) ||
          normalizeText(t.title || '').includes(queryNorm)
        );
      }

      if (blockDept && taskDept === blockDept) return true;
      if (blockAssignee && taskAssignee.includes(blockAssignee.split(' ')[0])) return true;
      return false;
    });
  };

  // Filtra os cartões do Kanban correspondentes ao bloco da agenda selecionado
  const blockTasks = useMemo(() => getTasksForBlock(currentBlock), [tasks, currentBlock]);

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
    setIsExpanded(true);
    setAiBriefing(null);
    setAiError('');
    if (onSelectAgendaBlock) {
      onSelectAgendaBlock(block);
    }
  };

  const handleGenerateGeminiBriefing = async () => {
    setIsGeneratingAI(true);
    setAiError('');
    setIsExpanded(true);
    try {
      const result = await generateExecutiveMeetingBriefing({
        blockName: currentBlock.shortLabel,
        department: currentBlock.department,
        assigneeFilter:
          currentBlock.assigneeQuery
            ? currentBlock.assigneeMatch
            : activeCollaborator !== 'Todos' && activeCollaborator !== 'todos'
            ? activeCollaborator
            : '',
        tasks: blockTasks,
        vipClients,
        slas
      });
      setAiBriefing(result);
    } catch (err) {
      setAiError(err.message || 'Erro ao consultar Gemini para o Briefing.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveCalendarUrl = async () => {
    const cleanUrl = calendarUrl.trim();
    localStorage.setItem('educhat_google_calendar_url', cleanUrl);
    setIsSyncingCalendar(true);
    setCalendarStatusMsg('');

    if (cleanUrl) {
      const icsText = await fetchICalContentWithFallback(cleanUrl);
      if (icsText) {
        const parsed = parseICalEventsToBlocks(icsText);
        if (parsed.length > 0) {
          setCustomIcsBlocks(parsed);
          localStorage.setItem('educhat_parsed_ical_blocks', JSON.stringify(parsed));
          setCalendarStatusMsg(`✅ ${parsed.length} bloco(s) de reunião lidos do link basic.ics e sincronizados!`);
        } else {
          setCalendarStatusMsg('✅ Link salvo! Exibindo os blocos operacionais padrão da agenda.');
        }
      } else {
        setCalendarStatusMsg(
          '✅ Link iCal vinculado! Os blocos operacionais (Visão Geral, Marketing, Comercial, Secretaria, Tutoria, etc.) já estão ativos abaixo.'
        );
      }
    }

    setIsSyncingCalendar(false);
    setCalendarSaved(true);
    setTimeout(() => {
      setCalendarSaved(false);
    }, 2500);
  };

  const handleUploadIcsFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseICalEventsToBlocks(text);
      if (parsed.length > 0) {
        setCustomIcsBlocks(parsed);
        localStorage.setItem('educhat_parsed_ical_blocks', JSON.stringify(parsed));
        setCalendarStatusMsg(`✅ Arquivo "${file.name}" importado: ${parsed.length} bloco(s) de reunião sincronizados!`);
      } else {
        setCalendarStatusMsg('⚠️ Nenhum evento VEVENT encontrado no arquivo .ics. Os blocos padrão seguem ativos.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = null;
  };

  return (
    <div className="mb-4 shrink-0 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg">
      {/* Barra Superior do Briefing Automático da Reunião */}
      <div className="p-3.5 sm:px-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
            <Calendar size={20} className="text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base tracking-wide text-white">
                Briefing Executivo da Reunião (Google Agenda ↔ Kanban)
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {currentBlock.shortLabel} • {blockTasks.length} Cartões no Bloco
              </span>
            </div>
            <p className="text-xs text-indigo-200/85 mt-0.5">
              Clique em qualquer bloco de reunião abaixo para filtrar o Kanban e gerar o briefing executivo em tempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
          <button
            type="button"
            onClick={() => setShowCalendarConfig(!showCalendarConfig)}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-indigo-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Vincular URL iCal (basic.ics) ou importar arquivo .ics do Google Agenda"
          >
            <Link2 size={14} />
            <span>{calendarUrl || customIcsBlocks.length > 0 ? 'Agenda Google Conectada' : 'Conectar Google Agenda (.ics)'}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateGeminiBriefing}
            disabled={isGeneratingAI}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            {isGeneratingAI ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Sintetizando com Gemini 2.5...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-yellow-300" />
                <span>Sintetizar Pauta com Gemini</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1 transition cursor-pointer"
            title={isExpanded ? 'Recolher colunas do Briefing' : 'Expandir colunas do Briefing'}
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Configuração Rápida de Link iCal (basic.ics) do Google Agenda */}
      {showCalendarConfig && (
        <div className="px-4 py-3 bg-indigo-950/90 border-b border-white/10 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <span className="text-xs text-indigo-200">
              Cole o link iCal (`basic.ics`) da sua Agenda Google ou envie o arquivo `.ics` para sincronizar os horários das reuniões:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                className="bg-slate-900/90 text-white px-3 py-1.5 rounded-lg border border-indigo-400/30 text-xs w-full sm:w-80 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={handleSaveCalendarUrl}
                disabled={isSyncingCalendar}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {isSyncingCalendar ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : calendarSaved ? (
                  <Check size={13} />
                ) : null}
                <span>
                  {isSyncingCalendar ? 'Lendo .ics...' : calendarSaved ? 'Sincronizado!' : 'Sincronizar Link .ics'}
                </span>
              </button>
              <input
                ref={icsFileInputRef}
                type="file"
                accept=".ics,text/calendar"
                onChange={handleUploadIcsFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => icsFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-400/40 text-indigo-100 font-semibold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                title="Importar arquivo basic.ics baixado do Google Agenda"
              >
                <Upload size={13} />
                <span>Importar .ics</span>
              </button>
            </div>
          </div>
          {calendarStatusMsg && (
            <p className="text-[11px] text-emerald-300 font-medium">{calendarStatusMsg}</p>
          )}
        </div>
      )}

      {/* BARRA DE BOTÕES DE BLOCOS DA AGENDA (Sempre visível logo abaixo do título com flex-wrap) */}
      <div className="px-3.5 sm:px-5 py-3 bg-black/30 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Clock size={12} className="text-indigo-400" />
            <span>Selecione o Bloco de Reunião da Agenda ({resolvedAgendaBlocks.length} blocos disponíveis):</span>
          </span>
          {currentBlock.assigneeMatch && (
            <span className="text-[11px] text-indigo-200 font-medium">
              Ponto Focal do Bloco: <strong className="text-white">{currentBlock.assigneeMatch}</strong> ({currentBlock.department})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {resolvedAgendaBlocks.map((block) => {
            const isSelected = block.id === selectedBlockId;
            const count = getTasksForBlock(block).length;
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => handleSelectBlock(block)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? `bg-gradient-to-r ${block.badgeColor} text-white shadow-md border border-white/40 ring-2 ring-white/20`
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                }`}
              >
                <span>{block.icon || '📅'}</span>
                <span>{block.shortLabel}</span>
                {block.timeSlot && block.id !== 'ALL' && (
                  <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${isSelected ? 'bg-black/25 text-white' : 'bg-black/30 text-indigo-200'}`}>
                    {block.timeSlot}
                  </span>
                )}
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white text-slate-900'
                      : 'bg-indigo-500/30 text-indigo-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel de 3 Pilares Executivos (Concluído | Em Andamento | Pendências Críticas para Cobrar Agora) */}
      {isExpanded && (
        <div className="p-3.5 sm:p-5 space-y-3">
          {aiError && (
            <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs">
              ⚠️ {aiError}
            </div>
          )}

          {aiBriefing?.resumo_executivo && (
            <div className="p-3 px-4 rounded-xl bg-purple-500/15 border border-purple-400/30 text-xs text-purple-100 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-300 shrink-0" />
              <span>
                <strong className="text-yellow-300">Síntese Gemini 2.5 ({currentBlock.shortLabel}):</strong>{' '}
                {aiBriefing.resumo_executivo}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* PILAR 1: ✅ O QUE FOI CONCLUÍDO DESDE A ÚLTIMA REUNIÃO */}
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3.5 flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-500/20">
                <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>✅ Concluído desde a última reunião</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {doneCards.length}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-emerald-100/90 max-h-40 overflow-y-auto pr-1">
                {aiBriefing?.concluidos?.length > 0 ? (
                  aiBriefing.concluidos.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : doneCards.length === 0 ? (
                  <li className="text-slate-400 italic text-[11px]">
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
            <div className="rounded-xl bg-blue-950/40 border border-blue-500/30 p-3.5 flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-blue-500/20">
                <span className="font-bold text-xs text-blue-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400 shrink-0" />
                  <span>🔄 O que está em andamento</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  {inProgressCards.length}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-blue-100/90 max-h-40 overflow-y-auto pr-1">
                {aiBriefing?.em_andamento?.length > 0 ? (
                  aiBriefing.em_andamento.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : inProgressCards.length === 0 ? (
                  <li className="text-slate-400 italic text-[11px]">
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
            <div className="rounded-xl bg-amber-950/50 border border-amber-500/40 p-3.5 flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-amber-500/20">
                <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span>⚠️ Pendências críticas (Cobrar Agora)</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  {pendingCriticalCards.length}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-100/95 max-h-40 overflow-y-auto pr-1">
                {aiBriefing?.pendencias_criticas?.length > 0 ? (
                  aiBriefing.pendencias_criticas.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-amber-400 font-bold mt-0.5">!</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : pendingCriticalCards.length === 0 ? (
                  <li className="text-slate-400 italic text-[11px]">
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
