/**
 * Converte qualquer entrada de data (Date, epoch ms, epoch segundos, string ISO ou timestamp do Supabase)
 * para o horário local oficial de São Paulo, Brasil (America/Sao_Paulo, UTC-3), retornando rigorosamente no formato "HH:mm".
 */
export function getSaoPauloTime(dateOrTimestamp = new Date()) {
  try {
    let ms;
    if (!dateOrTimestamp) {
      ms = Date.now();
    } else if (dateOrTimestamp instanceof Date) {
      ms = dateOrTimestamp.getTime();
    } else if (typeof dateOrTimestamp === 'number') {
      ms = dateOrTimestamp > 1e11 ? dateOrTimestamp : dateOrTimestamp * 1000;
    } else if (typeof dateOrTimestamp === 'string') {
      const trimmed = dateOrTimestamp.trim();
      // Se for string de horário "HH:mm" pura
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
      if (!isNaN(Number(trimmed))) {
        const num = Number(trimmed);
        ms = num > 1e11 ? num : num * 1000;
      } else {
        const parsed = new Date(trimmed).getTime();
        ms = isNaN(parsed) ? Date.now() : parsed;
      }
    } else {
      ms = Date.now();
    }

    // Offset estrito de São Paulo / Brasil: UTC-3 permanente (-3 horas = -10.800.000 ms)
    const spDate = new Date(ms - (3 * 3600 * 1000));
    const hours = String(spDate.getUTCHours()).padStart(2, '0');
    const minutes = String(spDate.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (_e) {
    const d = new Date(Date.now() - (3 * 3600 * 1000));
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
}
