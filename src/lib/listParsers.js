// =========================================================================
// PARSERS E PROCESSADORES DE LOTE PARA GESTÃO DO EDUCHAT
// Suporte nativo a .CSV, .TXT e .MD com auto-detecção de delimitadores
// Elimina necessidade de digitação manual para Clientes VIP, SLAs, POPs e Memorandos
// =========================================================================

import { getSaoPauloTime } from './timezone.js';

/**
 * Utilitário universal para tokenizar CSV/TSV respeitando aspas RFC-4180
 */
export function tokenizeDelimitedText(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  // Detecta delimitador na primeira linha não vazia
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headerLine = lines[0];

  const tabCount = (headerLine.match(/\t/g) || []).length;
  const pipeCount = (headerLine.match(/\|/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;

  let delimiter = ',';
  if (tabCount > semicolonCount && tabCount > commaCount && tabCount > pipeCount) {
    delimiter = '\t';
  } else if (pipeCount > semicolonCount && pipeCount > commaCount) {
    delimiter = '|';
  } else if (semicolonCount >= commaCount) {
    delimiter = ';';
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Pula aspas duplas escapadas
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.length > 0 && currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normaliza string para chave de comparação (sem acentos, minúsculo, sem pontuação)
 */
export function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// =========================================================================
// 1. PARSER & UPSERT: CLIENTES VIP (.CSV / .TXT)
// =========================================================================

export function parseVipClientsFile(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return [];
  const clean = rawContent.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const rows = tokenizeDelimitedText(clean);
  const parsedItems = [];
  const seenKeys = new Set();

  if (rows.length === 0) return [];

  // Analisa se a primeira linha é cabeçalho
  const firstRow = rows[0].map(c => normalizeKey(c));
  const isHeader = firstRow.some(c => 
    c.includes('nome') || c.includes('cliente') || c.includes('polo') || 
    c.includes('faculdade') || c.includes('instituicao') || c.includes('plano')
  );

  let nameIdx = -1;
  let planIdx = -1;
  let sinceIdx = -1;

  if (isHeader) {
    nameIdx = firstRow.findIndex(c => c.includes('nome') || c.includes('cliente') || c.includes('polo') || c.includes('faculdade') || c.includes('instituicao'));
    planIdx = firstRow.findIndex(c => c.includes('plano') || c.includes('contrato') || c.includes('categoria') || c.includes('tipo'));
    sinceIdx = firstRow.findIndex(c => c.includes('desde') || c.includes('ano') || c.includes('data') || c.includes('inicio'));
  }

  const startRow = isHeader ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0) continue;

    let name = '';
    let plan = 'Plano Fixo Gold';
    let since = new Date().getFullYear().toString();

    if (nameIdx !== -1 && cols[nameIdx]) {
      name = cols[nameIdx];
      if (planIdx !== -1 && cols[planIdx]) plan = cols[planIdx];
      if (sinceIdx !== -1 && cols[sinceIdx]) since = cols[sinceIdx];
    } else {
      // Linha posicional: [Nome/Polo, Plano, Desde] ou texto simples
      name = cols[0] || '';
      if (cols.length > 1 && cols[1]) plan = cols[1];
      if (cols.length > 2 && cols[2]) since = cols[2];
    }

    // Tratamento de formatos de texto livre como "Polo Salvador - Plano Fixo Ilimitado (2025)"
    if (name.includes(' - ') && (!plan || plan === 'Plano Fixo Gold')) {
      const parts = name.split(' - ');
      name = parts[0].trim();
      const rest = parts.slice(1).join(' - ').trim();
      const matchYear = rest.match(/\((\d{4})\)/);
      if (matchYear) {
        since = matchYear[1];
        plan = rest.replace(/\(\d{4}\)/, '').trim();
      } else {
        plan = rest;
      }
    }

    name = name.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    plan = plan.replace(/^["'\s]+|["'\s]+$/g, '').trim() || 'Plano Fixo Gold';
    since = since.replace(/^["'\s]+|["'\s]+$/g, '').trim() || '2026';

    if (!name || name.length < 2) continue;

    const key = normalizeKey(name);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    parsedItems.push({
      id: `vip_${key}_${Date.now()}`,
      name,
      plan,
      since,
      importedAt: getSaoPauloTime()
    });
  }

  return parsedItems;
}

export function upsertVipList(currentList = [], incomingList = [], mode = 'upsert') {
  if (mode === 'replace') {
    return {
      updatedList: incomingList.map((item, idx) => ({
        ...item,
        id: item.id || `vip_${Date.now()}_${idx}`
      })),
      addedCount: incomingList.length,
      updatedCount: 0
    };
  }

  const result = [...currentList];
  let addedCount = 0;
  let updatedCount = 0;

  incomingList.forEach((incoming) => {
    const key = normalizeKey(incoming.name);
    const existingIdx = result.findIndex(item => normalizeKey(item.name) === key);

    if (existingIdx !== -1) {
      result[existingIdx] = {
        ...result[existingIdx],
        ...incoming,
        id: result[existingIdx].id // Preserva ID existente
      };
      updatedCount++;
    } else {
      result.push({
        ...incoming,
        id: incoming.id || `vip_${Date.now()}_${Math.random().toString(36).substring(7)}`
      });
      addedCount++;
    }
  });

  return { updatedList: result, addedCount, updatedCount };
}

// =========================================================================
// 2. PARSER & UPSERT: PRAZOS & SLAs (.CSV / .TXT)
// =========================================================================

export function parseSlasFile(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return [];
  const clean = rawContent.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const rows = tokenizeDelimitedText(clean);
  const parsedItems = [];
  const seenKeys = new Set();

  if (rows.length === 0) return [];

  const firstRow = rows[0].map(c => normalizeKey(c));
  const isHeader = firstRow.some(c => 
    c.includes('departamento') || c.includes('setor') || c.includes('area') ||
    c.includes('demanda') || c.includes('servico') || c.includes('prazo') || c.includes('sla')
  );

  let deptIdx = -1;
  let demandIdx = -1;
  let timeIdx = -1;

  if (isHeader) {
    deptIdx = firstRow.findIndex(c => c.includes('departamento') || c.includes('setor') || c.includes('area') || c.includes('fila'));
    demandIdx = firstRow.findIndex(c => c.includes('demanda') || c.includes('servico') || c.includes('assunto') || c.includes('solicitacao') || c.includes('tipo'));
    timeIdx = firstRow.findIndex(c => c.includes('prazo') || c.includes('sla') || c.includes('tempo') || c.includes('horas') || c.includes('limite'));
  }

  const startRow = isHeader ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0) continue;

    let department = 'Secretaria Acadêmica';
    let demand = '';
    let slaTime = '48 horas';

    if (demandIdx !== -1 && cols[demandIdx]) {
      demand = cols[demandIdx];
      if (deptIdx !== -1 && cols[deptIdx]) department = cols[deptIdx];
      if (timeIdx !== -1 && cols[timeIdx]) slaTime = cols[timeIdx];
    } else {
      // Posicional: [Departamento, Demanda, Prazo] ou [Demanda, Prazo]
      if (cols.length >= 3) {
        department = cols[0] || 'Secretaria Acadêmica';
        demand = cols[1] || '';
        slaTime = cols[2] || '48 horas';
      } else if (cols.length === 2) {
        demand = cols[0] || '';
        slaTime = cols[1] || '48 horas';
      } else if (cols.length === 1) {
        demand = cols[0] || '';
      }
    }

    // Tratamento de linhas com formato textual: "Financeiro: Retificação de Fatura - 24 horas"
    if (demand.includes(':') && (!cols[1] || cols.length === 1)) {
      const parts = demand.split(':');
      department = parts[0].trim();
      const rest = parts.slice(1).join(':').trim();
      if (rest.includes(' - ')) {
        const sub = rest.split(' - ');
        demand = sub[0].trim();
        slaTime = sub.slice(1).join(' - ').trim();
      } else {
        demand = rest;
      }
    }

    demand = demand.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    department = department.replace(/^["'\s]+|["'\s]+$/g, '').trim() || 'Secretaria Acadêmica';
    slaTime = slaTime.replace(/^["'\s]+|["'\s]+$/g, '').trim() || '48 horas';

    if (!demand || demand.length < 3) continue;

    const key = `${normalizeKey(department)}_${normalizeKey(demand)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    parsedItems.push({
      id: `sla_${key}_${Date.now()}`,
      department,
      demand,
      slaTime,
      importedAt: getSaoPauloTime()
    });
  }

  return parsedItems;
}

export function upsertSlaList(currentList = [], incomingList = [], mode = 'upsert') {
  if (mode === 'replace') {
    return {
      updatedList: incomingList.map((item, idx) => ({
        ...item,
        id: item.id || `sla_${Date.now()}_${idx}`
      })),
      addedCount: incomingList.length,
      updatedCount: 0
    };
  }

  const result = [...currentList];
  let addedCount = 0;
  let updatedCount = 0;

  incomingList.forEach((incoming) => {
    const key = normalizeKey(incoming.demand);
    const existingIdx = result.findIndex(item => 
      normalizeKey(item.demand) === key ||
      (item.department === incoming.department && normalizeKey(item.demand).includes(key))
    );

    if (existingIdx !== -1) {
      result[existingIdx] = {
        ...result[existingIdx],
        ...incoming,
        id: result[existingIdx].id
      };
      updatedCount++;
    } else {
      result.push({
        ...incoming,
        id: incoming.id || `sla_${Date.now()}_${Math.random().toString(36).substring(7)}`
      });
      addedCount++;
    }
  });

  return { updatedList: result, addedCount, updatedCount };
}

// =========================================================================
// 3. PARSER & UPSERT: PROCEDIMENTOS OPERACIONAIS (POPs) (.CSV / .TXT / .MD)
// =========================================================================

export function parsePopsFile(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return [];
  const clean = rawContent.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const parsedItems = [];
  const seenKeys = new Set();

  // Verifica se o arquivo é estruturado em Markdown ou blocos de texto divididos por '---' ou '# '
  if (clean.includes('---') || (clean.startsWith('#') || clean.includes('\n# '))) {
    const blocks = clean.split(/\r?\n---\r?\n|\r?\n(?=# )/);

    blocks.forEach((block, idx) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return;

      const lines = trimmedBlock.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return;

      let title = lines[0].replace(/^#+\s*|^\*\*|\*\*$/g, '').trim();
      let steps = lines.slice(1).join('\n').trim();

      if (!steps && lines.length === 1) {
        steps = title;
        title = `Procedimento Padrão #${idx + 1}`;
      }

      if (!title) return;

      const key = normalizeKey(title);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      parsedItems.push({
        id: `pop_${key}_${Date.now()}`,
        title,
        steps: steps || 'Passos a serem definidos.',
        importedAt: getSaoPauloTime()
      });
    });

    if (parsedItems.length > 0) return parsedItems;
  }

  // Fallback para CSV / TSV
  const rows = tokenizeDelimitedText(clean);
  if (rows.length === 0) return [];

  const firstRow = rows[0].map(c => normalizeKey(c));
  const isHeader = firstRow.some(c => 
    c.includes('titulo') || c.includes('procedimento') || c.includes('pop') ||
    c.includes('passo') || c.includes('etapa') || c.includes('descricao')
  );

  let titleIdx = -1;
  let stepsIdx = -1;

  if (isHeader) {
    titleIdx = firstRow.findIndex(c => c.includes('titulo') || c.includes('procedimento') || c.includes('pop') || c.includes('nome'));
    stepsIdx = firstRow.findIndex(c => c.includes('passo') || c.includes('etapa') || c.includes('descricao') || c.includes('roteiro') || c.includes('conteudo'));
  }

  const startRow = isHeader ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0) continue;

    let title = '';
    let steps = '';

    if (titleIdx !== -1 && cols[titleIdx]) {
      title = cols[titleIdx];
      if (stepsIdx !== -1 && cols[stepsIdx]) steps = cols[stepsIdx];
    } else {
      title = cols[0] || '';
      if (cols.length > 1) steps = cols.slice(1).join('; ');
    }

    title = title.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    steps = steps.replace(/^["'\s]+|["'\s]+$/g, '').trim();

    if (!title || title.length < 3) continue;

    const key = normalizeKey(title);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    parsedItems.push({
      id: `pop_${key}_${Date.now()}`,
      title,
      steps: steps || 'Passo a passo não especificado.',
      importedAt: getSaoPauloTime()
    });
  }

  return parsedItems;
}

export function upsertPopList(currentList = [], incomingList = [], mode = 'upsert') {
  if (mode === 'replace') {
    return {
      updatedList: incomingList.map((item, idx) => ({
        ...item,
        id: item.id || `pop_${Date.now()}_${idx}`
      })),
      addedCount: incomingList.length,
      updatedCount: 0
    };
  }

  const result = [...currentList];
  let addedCount = 0;
  let updatedCount = 0;

  incomingList.forEach((incoming) => {
    const key = normalizeKey(incoming.title);
    const existingIdx = result.findIndex(item => normalizeKey(item.title) === key);

    if (existingIdx !== -1) {
      result[existingIdx] = {
        ...result[existingIdx],
        ...incoming,
        id: result[existingIdx].id
      };
      updatedCount++;
    } else {
      result.push({
        ...incoming,
        id: incoming.id || `pop_${Date.now()}_${Math.random().toString(36).substring(7)}`
      });
      addedCount++;
    }
  });

  return { updatedList: result, addedCount, updatedCount };
}

// =========================================================================
// 4. MODELOS DE ARQUIVO CSV / TXT PARA DOWNLOAD
// =========================================================================

export function getSampleVipCsv() {
  return `Nome do Polo / Instituição;Plano Fixo;Ano Contrato
Polo Campinas;Plano Fixo Gold;2025
Polo Salvador;Plano Fixo Ilimitado;2025
Faculdade Fama;Contrato Corporativo;2026
FM Educacional;Plano Fixo Ilimitado;2026
Polo Curitiba;Plano Fixo Gold;2026
Colégio e Faculdade Bilac Matriz;Contrato Corporativo;2024`;
}

export function getSampleSlaCsv() {
  return `Departamento;Tipo de Demanda;Tempo SLA Limite
Secretaria Acadêmica;Reposições de Aulas e Notas;48 horas
Secretaria Acadêmica;Emissão de Certificado e Diploma;72 horas
Financeiro & Splits;Retificação de Fatura / Nota Fiscal;24 horas
Financeiro & Splits;Estorno e Ajuste de Mensalidade;24 horas
Suporte a Polos;Liberação de Cursos no eAula;12 horas
Comercial;Envio de Proposta de Expansão;4 horas
Expansão;Atendimento a Novos Franqueados;2 horas`;
}

export function getSamplePopCsv() {
  return `Título do Procedimento;Passo a Passo Operacional
POP - Retificação de Fatura Asaas e Envio de 2ª Via;"1. Localizar cobrança no Asaas; 2. Cancelar e emitir nova com desconto/split correto; 3. Gerar link e enviar no chat; 4. Mover card no Kanban para Concluído."
POP - Validação de Documentação de Pós e Certificado;"1. Conferir RG e histórico no eAula; 2. Solicitar assinatura digital da diretoria; 3. Subir PDF e notificar aluno via WhatsApp."
POP - Reativação de Matrícula Trancada;"1. Verificar pendências no Asaas; 2. Solicitar autorização da Secretaria Acadêmica; 3. Liberar turmas no eAula."`;
}

export function getSampleMemorandoTxt() {
  return `MEMORANDO INTERNO Nº 03/2026 - DIRETORIA EXECUTIVA
Faculdade Olavo Bilac / Grupo EstudeMais
Assunto: Prazos Críticos para Matrícula de Pós-Graduação e Prioridade aos Polos VIP

1. Todos os atendimentos provenientes de Polos cadastrados como VIP (Plano Fixo Gold ou Corporativo) devem ser atendidos em no máximo 4 horas.
2. Demandas de emissão de boletos retificados no Asaas têm prazo máximo improrrogável de 24 horas pelo Financeiro.
3. Alunos veteranos com solicitação de aproveitamento de disciplinas devem ter análise pedagógica concluída em 48 horas pela Secretaria Acadêmica.`;
}

/**
 * Dispara o download de um arquivo gerado em memória no navegador
 */
export function triggerFileDownload(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
