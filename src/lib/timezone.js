/**
 * Utilitários de Fuso Horário e Formatação de Data/Hora no padrão oficial de Brasília (America/Sao_Paulo)
 */

export const SP_TIMEZONE = 'America/Sao_Paulo';

const spPartsFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SP_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

/**
 * Converte com segurança múltiplos formatos de entrada em objeto Date
 */
export function parseDateSafely(input) {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const ms = input > 1e11 ? input : input * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Marcadores especiais
    if (/^ontem$/i.test(trimmed)) return 'Ontem';
    if (/^agora$/i.test(trimmed) || /^recente$/i.test(trimmed) || /min atrás$/i.test(trimmed)) {
      return new Date();
    }

    // Formato brasileiro "DD/MM/YYYY" ou "DD/MM/YYYY HH:mm"
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
      const parts = trimmed.split(' ');
      const [d, m, y] = parts[0].split('/').map(Number);
      let h = 12;
      let min = 0;
      if (parts[1] && /^\d{1,2}:\d{2}/.test(parts[1])) {
        const [timeH, timeMin] = parts[1].split(':').map(Number);
        h = timeH;
        min = timeMin;
      }
      const parsed = new Date(Date.UTC(y, m - 1, d, h + 3, min, 0)); // Ajusta para UTC-3
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    // String numérica de epoch
    if (!isNaN(Number(trimmed))) {
      const num = Number(trimmed);
      const ms = num > 1e11 ? num : num * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // Strings ISO (ex: "2026-10-17T13:00:00Z" ou "2026-10-17 10:00:00")
    const parsed = new Date(trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

/**
 * Converte qualquer entrada de data (Date, epoch ms, epoch segundos, string ISO ou timestamp do Supabase)
 * para o horário local oficial de São Paulo, Brasil (America/Sao_Paulo, UTC-3), retornando rigorosamente no formato "HH:mm".
 */
export function getSaoPauloTime(dateOrTimestamp = new Date()) {
  try {
    if (typeof dateOrTimestamp === 'string') {
      const trimmed = dateOrTimestamp.trim();
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
    }

    const d = parseDateSafely(dateOrTimestamp) || new Date();
    if (d === 'Ontem') return 'Ontem';

    const parts = spPartsFormatter.formatToParts(d);
    let hour = '00';
    let minute = '00';
    for (const p of parts) {
      if (p.type === 'hour') hour = p.value.padStart(2, '0');
      if (p.type === 'minute') minute = p.value.padStart(2, '0');
    }
    return `${hour}:${minute}`;
  } catch (_e) {
    const d = new Date(Date.now() - (3 * 3600 * 1000));
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Formata data/hora em tempo relativo estritamente baseado no fuso de Brasília (America/Sao_Paulo):
 * 1. Se for HOJE: Exibe apenas a hora ("HH:mm").
 * 2. Se for ONTEM: Exibe o texto "Ontem".
 * 3. Se for ANTERIOR A ONTEM: Exibe a data curta ("DD/MM/YYYY").
 */
export function formatRelativeChatTime(dateOrTimestamp) {
  try {
    if (!dateOrTimestamp) return '';

    if (typeof dateOrTimestamp === 'string') {
      const trimmed = dateOrTimestamp.trim();
      if (/^ontem$/i.test(trimmed)) return 'Ontem';
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
    }

    const date = parseDateSafely(dateOrTimestamp);
    if (!date) {
      return String(dateOrTimestamp || '');
    }
    if (date === 'Ontem') return 'Ontem';

    const now = new Date();

    const partsTarget = spPartsFormatter.formatToParts(date);
    const partsNow = spPartsFormatter.formatToParts(now);

    const mapTarget = {};
    for (const p of partsTarget) mapTarget[p.type] = p.value;

    const mapNow = {};
    for (const p of partsNow) mapNow[p.type] = p.value;

    const targetYear = parseInt(mapTarget.year, 10);
    const targetMonth = parseInt(mapTarget.month, 10);
    const targetDay = parseInt(mapTarget.day, 10);
    const targetHour = String(mapTarget.hour || '0').padStart(2, '0');
    const targetMinute = String(mapTarget.minute || '0').padStart(2, '0');

    const nowYear = parseInt(mapNow.year, 10);
    const nowMonth = parseInt(mapNow.month, 10);
    const nowDay = parseInt(mapNow.day, 10);

    // Comparação de dias civis no fuso de Brasília
    const todayMidnight = Date.UTC(nowYear, nowMonth - 1, nowDay);
    const targetMidnight = Date.UTC(targetYear, targetMonth - 1, targetDay);

    const diffMs = todayMidnight - targetMidnight;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    // 1. Se a data for HOJE: Apenas a hora (HH:mm)
    if (diffDays <= 0) {
      return `${targetHour}:${targetMinute}`;
    }

    // 2. Se a data for ONTEM: Texto "Ontem"
    if (diffDays === 1) {
      return 'Ontem';
    }

    // 3. Se for ANTERIOR A ONTEM: Data curta (DD/MM/YYYY)
    const dayFormatted = String(targetDay).padStart(2, '0');
    const monthFormatted = String(targetMonth).padStart(2, '0');
    return `${dayFormatted}/${monthFormatted}/${targetYear}`;
  } catch (err) {
    console.warn('Erro ao formatar data relativa no fuso de Brasília:', err);
    return getSaoPauloTime(dateOrTimestamp);
  }
}
