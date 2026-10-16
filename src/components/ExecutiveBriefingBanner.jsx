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

const SP_TZ = 'America/Sao_Paulo';

/** Chave YYYY-MM-DD do dia de hoje no fuso local do Brasil (America/Sao_Paulo). */
export function getTodayKeySP(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function dateKeyInSP(ms) {
  return getTodayKeySP(new Date(ms));
}

function timeInSP(ms) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SP_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(ms));
}

/** Converte "relógio de parede" em um fuso IANA para o instante UTC (ms) correspondente. */
function zonedToInstant(y, mo, d, h, mi, s, tz) {
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  if (!tz || tz === 'UTC') return wallAsUtc;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const offsetAt = (ms) => {
      const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
      const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      return asUtc - ms;
    };
    let guess = wallAsUtc - offsetAt(wallAsUtc);
    guess = wallAsUtc - offsetAt(guess);
    return guess;
  } catch {
    return zonedToInstant(y, mo, d, h, mi, s, SP_TZ);
  }
}

/** Lê uma linha DTSTART/DTEND: { y, mo, d, h, mi, s, tz, allDay } (tz: 'UTC' | IANA | null=flutuante). */
function parseICalDateLine(line = '') {
  if (!line) return null;
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  const params = line.slice(0, idx);
  const value = line.slice(idx + 1).trim();
  const tzMatch = params.match(/TZID=([^;:]+)/i);
  const isDateOnly = /VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(value);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  return {
    y: +m[1],
    mo: +m[2],
    d: +m[3],
    h: +(m[4] || 0),
    mi: +(m[5] || 0),
    s: +(m[6] || 0),
    tz: m[7] ? 'UTC' : tzMatch ? tzMatch[1].replace(/"/g, '') : null,
    allDay: isDateOnly
  };
}

const BYDAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRRule(line = '') {
  const raw = line.slice(line.indexOf(':') + 1);
  const rule = {};
  raw.split(';').forEach((part) => {
    const [k, v] = part.split('=');
    if (k && v) rule[k.toUpperCase()] = v;
  });
  return rule;
}

/** Retorna os instantes (ms) de início das ocorrências do evento que caem em "hoje" (fuso de São Paulo). */
function occurrencesToday(start, rrule, exdates, durationMs, todayKey) {
  const out = [];
  const tz = start.tz === null ? SP_TZ : start.tz; // evento "flutuante" = hora local
  const instantFor = (y, mo, d) =>
    start.allDay ? Date.UTC(y, mo - 1, d, 12, 0, 0) : zonedToInstant(y, mo, d, start.h, start.mi, start.s, tz);

  const matchesToday = (ms, endMs) => {
    if (start.allDay) return null; // tratado fora
    return dateKeyInSP(ms) === todayKey || (endMs && dateKeyInSP(ms) < todayKey && dateKeyInSP(endMs - 1) >= todayKey);
  };

  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayUtcDay = Date.UTC(ty, tm - 1, td);
  const startDay = Date.UTC(start.y, start.mo - 1, start.d);

  if (!rrule) {
    if (start.allDay) {
      const endDay = startDay + Math.max(durationMs, 86400000);
      if (todayUtcDay >= startDay && todayUtcDay < endDay) out.push({ ms: null, allDay: true });
    } else {
      const ms = zonedToInstant(start.y, start.mo, start.d, start.h, start.mi, start.s, tz);
      if (matchesToday(ms, ms + durationMs)) out.push({ ms, allDay: false });
    }
    return out;
  }

  const freq = rrule.FREQ;
  const interval = Math.max(1, parseInt(rrule.INTERVAL || '1', 10));
  const count = rrule.COUNT ? parseInt(rrule.COUNT, 10) : null;
  const until = rrule.UNTIL ? parseICalDateLine(`X:${rrule.UNTIL}`) : null;
  const untilMs = until ? zonedToInstant(until.y, until.mo, until.d, until.tz ? until.h : 23, until.tz ? until.mi : 59, until.tz ? until.s : 59, until.tz || SP_TZ) : null;
  const byDay = rrule.BYDAY
    ? rrule.BYDAY.split(',').map((x) => BYDAY_MAP[x.replace(/[^A-Z]/g, '').slice(-2)]).filter((x) => x !== undefined)
    : null;

  // Varre os dias do calendário do próprio evento, do início até hoje + 1 (margem de fuso)
  const lastDay = todayUtcDay + 86400000;
  let n = 0;
  let steps = 0;
  for (let day = startDay; day <= lastDay && steps < 4000; day += 86400000, steps++) {
    const dt = new Date(day);
    const y = dt.getUTCFullYear();
    const mo = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const dow = dt.getUTCDay();
    const daysSince = Math.round((day - startDay) / 86400000);

    let hit = false;
    if (freq === 'DAILY') {
      hit = daysSince % interval === 0;
    } else if (freq === 'WEEKLY') {
      const weekIdx = Math.floor((daysSince + new Date(startDay).getUTCDay()) / 7);
      const days = byDay && byDay.length ? byDay : [new Date(startDay).getUTCDay()];
      hit = weekIdx % interval === 0 && days.includes(dow);
    } else if (freq === 'MONTHLY') {
      const monthsSince = (y - start.y) * 12 + (mo - start.mo);
      hit = monthsSince >= 0 && monthsSince % interval === 0 && d === start.d;
    } else if (freq === 'YEARLY') {
      hit = (y - start.y) % interval === 0 && mo === start.mo && d === start.d;
    }
    if (!hit) continue;

    const ms = instantFor(y, mo, d);
    if (untilMs && ms > untilMs) break;
    n++;
    if (count && n > count) break;

    if (exdates.some((ex) => ex.y === y && ex.mo === mo && ex.d === d)) continue;
    if (start.allDay) {
      if (day === todayUtcDay) out.push({ ms: null, allDay: true });
    } else if (matchesToday(ms, ms + durationMs)) {
      out.push({ ms, allDay: false });
    }
  }
  return out;
}

/**
 * Parser de arquivos/links iCal (.ics / basic.ics do Google Agenda).
 * Retorna APENAS as reuniões que ocorrem HOJE (fuso America/Sao_Paulo), com horários convertidos
 * para a hora local real (suporta UTC "Z", TZID e eventos recorrentes RRULE/EXDATE).
 */
export function parseICalEventsToBlocks(icsContent = '') {
  if (!icsContent || typeof icsContent !== 'string' || !icsContent.includes('BEGIN:VEVENT')) {
    return [];
  }

  const todayKey = getTodayKeySP();
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const eventChunks = unfolded.split('BEGIN:VEVENT').slice(1);
  const parsedEvents = [];

  for (const chunk of eventChunks) {
    const body = chunk.split('END:VEVENT')[0] || '';
    const lines = body.split(/\r?\n/);

    let summary = '';
    let description = '';
    let dtStartLine = '';
    let dtEndLine = '';
    let rruleLine = '';
    let status = '';
    let recurrenceId = false;
    const exLines = [];

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('SUMMARY')) {
        summary = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
      } else if (upper.startsWith('DESCRIPTION')) {
        description = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
      } else if (upper.startsWith('DTSTART')) {
        dtStartLine = line;
      } else if (upper.startsWith('DTEND')) {
        dtEndLine = line;
      } else if (upper.startsWith('RRULE')) {
        rruleLine = line;
      } else if (upper.startsWith('EXDATE')) {
        exLines.push(line);
      } else if (upper.startsWith('STATUS')) {
        status = line.split(':')[1]?.trim().toUpperCase() || '';
      } else if (upper.startsWith('RECURRENCE-ID')) {
        recurrenceId = true;
      }
    }

    if (!summary || status === 'CANCELLED') continue;
    const start = parseICalDateLine(dtStartLine);
    if (!start) continue;
    const end = parseICalDateLine(dtEndLine);

    const tzOf = (p) => (p.tz === null ? SP_TZ : p.tz);
    const startMsRaw = start.allDay ? Date.UTC(start.y, start.mo - 1, start.d) : zonedToInstant(start.y, start.mo, start.d, start.h, start.mi, start.s, tzOf(start));
    const endMsRaw = end
      ? end.allDay
        ? Date.UTC(end.y, end.mo - 1, end.d)
        : zonedToInstant(end.y, end.mo, end.d, end.h, end.mi, end.s, tzOf(end))
      : startMsRaw + 3600000;
    const durationMs = Math.max(0, endMsRaw - startMsRaw);

    const exdates = [];
    exLines.forEach((l) => {
      l.slice(l.indexOf(':') + 1)
        .split(',')
        .forEach((v) => {
          const p = parseICalDateLine(`X:${v.trim()}`);
          if (p) exdates.push(p);
        });
    });

    const rrule = rruleLine && !recurrenceId ? parseRRule(rruleLine) : null;
    const todays = occurrencesToday(start, rrule, exdates, durationMs, todayKey);
    if (todays.length === 0) continue;

    for (const occ of todays) {
      const startFormatted = occ.allDay ? '' : timeInSP(occ.ms);
      const endFormatted = occ.allDay ? '' : timeInSP(occ.ms + durationMs);
      const timeSlot = occ.allDay
        ? 'Dia Inteiro'
        : durationMs > 0
        ? `${startFormatted} - ${endFormatted}`
        : startFormatted;

      const normSummary = normalizeText(`${summary} ${description}`);
      let mappedBlockId = null;
      let department = normalizeDepartmentName(summary);
      let assigneeQuery = '';
      let icon = '📅';
      let badgeColor = 'from-indigo-600 to-purple-700';

      if (normSummary.includes('market') || normSummary.includes('midia') || normSummary.includes('campanha')) {
        mappedBlockId = 'MARKETING'; department = 'Marketing'; icon = '📣'; badgeColor = 'from-pink-600 to-purple-700';
      } else if (normSummary.includes('comerc') || normSummary.includes('venda') || normSummary.includes('matricul')) {
        mappedBlockId = 'COMERCIAL'; department = 'Comercial'; icon = '💼'; badgeColor = 'from-emerald-600 to-teal-700';
      } else if (normSummary.includes('terapia') || normSummary.includes('expans') || normSummary.includes('polo')) {
        mappedBlockId = 'TERAPIA_EXPANSAO'; department = 'Expansão'; icon = '🚀'; badgeColor = 'from-indigo-600 to-blue-700';
      } else if (normSummary.includes('paulo')) {
        mappedBlockId = 'DEMANDA_PAULO'; department = 'Pedagógico'; assigneeQuery = 'Paulo'; icon = '🎓'; badgeColor = 'from-amber-600 to-orange-700';
      } else if (normSummary.includes('lindomar')) {
        mappedBlockId = 'LINDOMAR'; department = 'Pedagógico'; assigneeQuery = 'Lindomar'; icon = '📚'; badgeColor = 'from-cyan-600 to-sky-700';
      } else if (normSummary.includes('secretar') || normSummary.includes('mec') || normSummary.includes('diploma')) {
        mappedBlockId = 'SECRETARIA'; department = 'Secretaria'; icon = '🏛️'; badgeColor = 'from-violet-600 to-purple-800';
      } else if (normSummary.includes('tutor') || normSummary.includes('ava') || normSummary.includes('suporte')) {
        mappedBlockId = 'TUTORIA'; department = 'Tutoria'; icon = '👩‍🏫'; badgeColor = 'from-teal-600 to-emerald-800';
      } else if (normSummary.includes('pedagog') || normSummary.includes('coordenac')) {
        department = 'Pedagógico'; icon = '🎓'; badgeColor = 'from-amber-600 to-orange-700';
      }

      parsedEvents.push({
        mappedBlockId,
        id: `EV_${normalizeText(summary).replace(/[^a-z0-9]/g, '_').slice(0, 24)}_${occ.allDay ? 'day' : startFormatted.replace(':', '')}`,
        icon,
        label: `BLOCO: ${summary.toUpperCase()}`,
        shortLabel: summary.length > 26 ? `${summary.slice(0, 24)}...` : summary,
        department: department || 'Geral',
        assigneeQuery,
        assigneeMatch: '',
        timeSlot,
        sortKey: occ.allDay ? -1 : occ.ms,
        badgeColor,
        fromIcs: true
      });
    }
  }

  const uniqueMap = new Map();
  parsedEvents.forEach((ev) => uniqueMap.set(ev.id, ev));
  return Array.from(uniqueMap.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 20);
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
  // Blocos vindos do .ics: SOMENTE reuniões de hoje (cache descartado se for de outro dia)
  const [customIcsBlocks, setCustomIcsBlocks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('educhat_parsed_ical_blocks') || 'null');
      if (saved && !Array.isArray(saved) && saved.date === getTodayKeySP() && Array.isArray(saved.blocks)) {
        return saved.blocks;
      }
    } catch {}
    return [];
  });
  const [icsLoadedToday, setIcsLoadedToday] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('educhat_parsed_ical_blocks') || 'null');
      return Boolean(saved && !Array.isArray(saved) && saved.date === getTodayKeySP());
    } catch {
      return false;
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

  // Blocos de reunião: Visão Geral + (se a agenda estiver conectada) somente as reuniões de HOJE.
  // Sem agenda conectada, exibe os blocos operacionais padrão sem horários fictícios.
  const resolvedAgendaBlocks = useMemo(() => {
    const withLead = (b) => {
      if (b.id === 'ALL') return b;
      if (b.assigneeQuery) {
        const matched = matchCollaboratorToTask(b.assigneeQuery, b.department, liveCollaborators);
        return { ...b, assigneeMatch: matched?.assignee || b.assigneeQuery };
      }
      const deptLead = (liveCollaborators || []).find(
        (u) => !u.isBot && normalizeText(u.department) === normalizeText(b.department)
      );
      return { ...b, assigneeMatch: deptLead?.name || '' };
    };

    const all = AGENDA_BLOCKS[0];
    if (icsLoadedToday || (customIcsBlocks || []).length > 0) {
      return [all, ...(customIcsBlocks || []).map(withLead)];
    }
    return [
      all,
      ...AGENDA_BLOCKS.slice(1).map((b) => withLead({ ...b, timeSlot: '' }))
    ];
  }, [liveCollaborators, customIcsBlocks, icsLoadedToday]);

  // Estado inicial SEMPRE em "Visão Geral" (nenhum filtro de bloco ativo por padrão)
  const [selectedBlockId, setSelectedBlockId] = useState('ALL');

  const [aiBriefing, setAiBriefing] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState(
    () => localStorage.getItem('educhat_google_calendar_url') || ''
  );
  const [calendarSaved, setCalendarSaved] = useState(false);

  // Sincroniza o link iCal salvo ao montar e a cada 10 min (mantém "hoje" correto)
  useEffect(() => {
    if (!calendarUrl || !calendarUrl.trim()) return;
    let isMounted = true;
    const sync = () =>
      fetchICalContentWithFallback(calendarUrl).then((icsText) => {
        if (!isMounted || !icsText) return;
        const parsed = parseICalEventsToBlocks(icsText);
        setCustomIcsBlocks(parsed);
        setIcsLoadedToday(true);
        try {
          localStorage.setItem(
            'educhat_parsed_ical_blocks',
            JSON.stringify({ date: getTodayKeySP(), blocks: parsed })
          );
        } catch {}
      });
    sync();
    const id = setInterval(sync, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  // Se o bloco selecionado deixar de existir (ex.: agenda atualizada), volta para a Visão Geral
  useEffect(() => {
    if (!resolvedAgendaBlocks.some((b) => b.id === selectedBlockId)) {
      setSelectedBlockId('ALL');
      if (onSelectAgendaBlock) onSelectAgendaBlock(AGENDA_BLOCKS[0]);
    }
  }, [resolvedAgendaBlocks]);

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

  // Aplica o resultado do .ics (SEMPRE apenas eventos de hoje) e persiste com a data de referência
  const applyIcsBlocks = (parsedToday) => {
    setCustomIcsBlocks(parsedToday);
    setIcsLoadedToday(true);
    try {
      localStorage.setItem(
        'educhat_parsed_ical_blocks',
        JSON.stringify({ date: getTodayKeySP(), blocks: parsedToday })
      );
    } catch {}
  };

  const handleSelectBlock = (block) => {
    // Os blocos são apenas filtro rápido opcional: clicar de novo no bloco ativo volta à Visão Global
    const target =
      block.id !== 'ALL' && block.id === selectedBlockId
        ? resolvedAgendaBlocks.find((b) => b.id === 'ALL') || block
        : block;
    setSelectedBlockId(target.id);
    setAiBriefing(null);
    setAiError('');
    if (onSelectAgendaBlock) {
      onSelectAgendaBlock(target);
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
        applyIcsBlocks(parsed);
        setCalendarStatusMsg(
          parsed.length > 0
            ? `✅ ${parsed.length} reunião(ões) de hoje lidas da agenda e sincronizadas!`
            : '✅ Agenda sincronizada: nenhuma reunião agendada para hoje.'
        );
      } else {
        setCalendarStatusMsg('⚠️ Não foi possível ler o link iCal agora. Verifique o link e tente novamente.');
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
      if (!text.includes('BEGIN:VEVENT')) {
        setCalendarStatusMsg('⚠️ Nenhum evento VEVENT encontrado no arquivo .ics.');
        return;
      }
      const parsed = parseICalEventsToBlocks(text);
      applyIcsBlocks(parsed);
      setCalendarStatusMsg(
        parsed.length > 0
          ? `✅ Arquivo "${file.name}" importado: ${parsed.length} reunião(ões) de hoje.`
          : `✅ Arquivo "${file.name}" importado: nenhuma reunião agendada para hoje.`
      );
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

      {(aiError || aiBriefing?.resumo_executivo) && (
        <div className="p-3.5 sm:px-5 space-y-3">
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
        </div>
      )}
    </div>
  );
}
