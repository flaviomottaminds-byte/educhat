import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  Target,
  X,
  Download,
  ArrowRight,
  Sparkles,
  Filter,
  Check,
  RefreshCw,
  MessageSquare,
  Hash
} from 'lucide-react';

// Helper: Limpeza e formatação padronizada de telefones brasileiros
export function cleanAndFormatPhone(rawPhone) {
  if (!rawPhone) return { isValid: false, cleanDigits: '', formatted: '' };

  let digits = String(rawPhone).replace(/\D/g, '');

  // Remove zero à esquerda do DDD (ex: 011999998888 -> 11999998888)
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.slice(1);
  }

  // Se tiver 10 ou 11 dígitos, adiciona o código do país (55)
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  // Validação: Telefone brasileiro precisa ter 12 ou 13 dígitos com DDI 55
  if (!digits.startsWith('55') || (digits.length !== 12 && digits.length !== 13)) {
    return { isValid: false, cleanDigits: digits, formatted: digits };
  }

  // Formatação visual amigável: +55 (11) 99999-9999
  const ddd = digits.slice(2, 4);
  const numberPart = digits.slice(4);
  let formatted = '';
  if (numberPart.length === 9) {
    formatted = `+55 (${ddd}) ${numberPart.slice(0, 5)}-${numberPart.slice(5)}`;
  } else {
    formatted = `+55 (${ddd}) ${numberPart.slice(0, 4)}-${numberPart.slice(4)}`;
  }

  return {
    isValid: true,
    cleanDigits: digits,
    formatted
  };
}

// Parser universal de CSV (compatível com exportações do Meta Ads / Instagram Ads com vírgula ou ponto e vírgula)
export function parseInstagramAdsCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  // Quebra por linhas respeitando CRLF e LF
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detecta delimitador (, ou ;)
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  // Parser de linha CSV com tratamento de aspas
  const parseLine = (line) => {
    const row = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  };

  const headers = parseLine(headerLine).map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
  );

  // Mapeamento heurístico de colunas do Instagram Ads / Meta Ads
  const findColumnIndex = (keywords) => {
    return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const nameIdx = findColumnIndex(['full_name', 'nome', 'name', 'primeiro_nome', 'lead', 'contato']);
  const phoneIdx = findColumnIndex(['phone', 'telefone', 'whatsapp', 'celular', 'mobile', 'tel', 'contato_numero']);
  const emailIdx = findColumnIndex(['email', 'mail']);
  const campaignIdx = findColumnIndex(['campaign', 'campanha', 'ad_name', 'anuncio', 'adset', 'origem']);
  const cityIdx = findColumnIndex(['city', 'cidade', 'municipio', 'polo', 'uf', 'estado']);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || values.every((v) => !v)) continue;

    const rawName = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : '';
    const rawPhone = phoneIdx !== -1 && values[phoneIdx] ? values[phoneIdx] : '';
    const rawEmail = emailIdx !== -1 && values[emailIdx] ? values[emailIdx] : '';
    const rawCampaign = campaignIdx !== -1 && values[campaignIdx] ? values[campaignIdx] : 'Campanha Instagram Expansão';
    const rawCity = cityIdx !== -1 && values[cityIdx] ? values[cityIdx] : '';

    if (rawName || rawPhone) {
      rows.push({
        rawName,
        rawPhone,
        rawEmail,
        rawCampaign,
        rawCity,
        rowIndex: i
      });
    }
  }

  return rows;
}

export default function InstagramLeadImportModal({
  isOpen,
  onClose,
  onImportLeads,
  existingContacts = [],
  onNavigateToChannel,
  onSelectContact
}) {
  if (!isOpen) return null;

  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'processing' | 'success'
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedLeads, setParsedLeads] = useState([]);
  const [stats, setStats] = useState({ totalRows: 0, validCount: 0, duplicateCount: 0, invalidCount: 0 });
  const [importSummary, setImportSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);

  // Download do arquivo CSV modelo de exemplo para campanhas do Instagram
  const handleDownloadSampleCsv = () => {
    const sampleContent =
      'nome_completo,telefone,email,cidade,campanha\n' +
      'Rodrigo Albuquerque,(11) 97123-8844,rodrigo.albuquerque@gmail.com,São Paulo - SP,Instagram Ads - Novos Polos 2026\n' +
      'Mariana Siqueira,(19) 98112-4455,mariana.siqueira@outlook.com,Campinas - SP,Instagram Ads - Parcerias Expansão\n' +
      'Carlos Henrique Viana,(21) 99877-3322,carlos.viana@gmail.com,Rio de Janeiro - RJ,Instagram Ads - Polos Universitários\n' +
      'Beatriz Mendes,(31) 99234-5566,beatriz.mendes@gmail.com,Belo Horizonte - MG,Instagram Ads - Expansão Matriz\n';

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_leads_instagram_expansao.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Processa o conteúdo do arquivo CSV
  const processCsvFile = (file) => {
    if (!file) return;
    setErrorMessage('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rawRows = parseInstagramAdsCsv(text);

        if (rawRows.length === 0) {
          setErrorMessage('O arquivo CSV selecionado está vazio ou não possui linhas de dados válidas.');
          return;
        }

        // Conjunto de telefones já existentes no EduChat para evitar duplicados
        const existingPhonesSet = new Set(
          existingContacts.map((c) => (c.phone || '').replace(/\D/g, '')).filter(Boolean)
        );

        const seenInThisFile = new Set();
        const processed = [];
        let valid = 0;
        let dup = 0;
        let inv = 0;

        rawRows.forEach((row) => {
          const phoneResult = cleanAndFormatPhone(row.rawPhone);

          if (!phoneResult.isValid) {
            inv++;
            return;
          }

          const cleanPhone = phoneResult.cleanDigits;

          // Verificação de duplicados (no mesmo arquivo ou já cadastrado no EduChat)
          if (seenInThisFile.has(cleanPhone) || existingPhonesSet.has(cleanPhone)) {
            dup++;
            return;
          }

          seenInThisFile.add(cleanPhone);
          valid++;

          const name = row.rawName.trim() || `Lead Instagram ${phoneResult.formatted}`;
          const contactId = `wa-${cleanPhone}`;

          processed.push({
            id: contactId,
            name: name,
            phone: phoneResult.formatted,
            cleanPhone: cleanPhone,
            email: row.rawEmail.trim(),
            city: row.rawCity.trim(),
            campaign: row.rawCampaign.trim(),
            avatar: '👤',
            department: 'Expansão',
            assignee: 'Luiz Augusto',
            status: 'lead_instagram',
            statusLabel: 'Lead Instagram - Expansão',
            aiActive: false,
            lastInteraction: 'Recém-importado',
            triageContext: `Lead Instagram Ads • Campanha: ${row.rawCampaign || 'Expansão de Polos'} • Cidade: ${row.rawCity || 'Brasil'}`
          });
        });

        if (valid === 0) {
          setErrorMessage(`Nenhum lead novo pôde ser importado. (${dup} duplicados ignorados, ${inv} telefones inválidos).`);
          return;
        }

        setParsedLeads(processed);
        setStats({
          totalRows: rawRows.length,
          validCount: valid,
          duplicateCount: dup,
          invalidCount: inv
        });
        setStep('preview');
      } catch (err) {
        console.error('Erro ao ler CSV:', err);
        setErrorMessage(`Falha ao ler arquivo: ${err.message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Handlers de Drag and Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processCsvFile(e.target.files[0]);
    }
  };

  // Confirmação final da importação e persistência
  const handleConfirmImport = async () => {
    if (parsedLeads.length === 0) return;

    setStep('processing');
    try {
      if (onImportLeads) {
        await onImportLeads(parsedLeads);
      }
      setImportSummary({
        importedCount: parsedLeads.length,
        duplicatesIgnored: stats.duplicateCount,
        firstLeadId: parsedLeads[0]?.id
      });
      setStep('success');
    } catch (err) {
      console.error('Erro na importação para Expansão:', err);
      setErrorMessage(`Erro ao importar leads: ${err.message}`);
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParsedLeads([]);
    setStats({ totalRows: 0, validCount: 0, duplicateCount: 0, invalidCount: 0 });
    setImportSummary(null);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-chatCard w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header do Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-xs shrink-0">
              <Upload size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">
                  Importar Leads (Instagram Ads)
                </h3>
                <span className="text-[10px] bg-white/25 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Expansão
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Direcionamento exclusivo para a equipe & canal de Expansão
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner de Roteamento para a Expansão */}
        <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-500/20 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Fila de Destino:</strong> Departamento de <strong>Expansão</strong> (Consultor: <strong>Luiz Augusto</strong>)
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
            title="Baixar planilha CSV modelo pronta para preenchimento"
          >
            <Download size={12} /> Modelo CSV
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span className="flex-1 font-medium">{errorMessage}</span>
            </div>
          )}

          {/* PASSO 1: UPLOAD / SELEÇÃO DO CSV */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                  dragActive
                    ? 'border-pink-500 bg-pink-50/50 dark:bg-pink-950/20 scale-[0.99]'
                    : 'border-slate-300 dark:border-chatBorder hover:border-pink-500 dark:hover:border-pink-400 bg-slate-50/60 dark:bg-chatPanel/40'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center shadow-md">
                  <FileSpreadsheet size={28} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-chatTextTitle">
                    Arraste o arquivo CSV de leads do Instagram aqui
                  </h4>
                  <p className="text-xs text-chatTextMuted mt-1">
                    ou clique para procurar no seu computador (relatórios do Meta Ads / Instagram Ads)
                  </p>
                </div>
                <span className="px-3 py-1 bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-lg text-[11px] font-bold text-pink-700 dark:text-pink-300 shadow-2xs">
                  Formatos aceitos: .CSV ou .TXT
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Informações sobre o processamento automático */}
              <div className="bg-slate-50 dark:bg-chatPanel p-4 rounded-xl border border-slate-200 dark:border-chatBorder text-xs text-chatTextMuted space-y-2">
                <span className="font-bold text-chatTextTitle flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Sparkles size={13} className="text-purple-600" /> Regras automáticas aplicadas na importação:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-[11.5px]">
                  <li>
                    <strong>Padronização de Telefones:</strong> Adiciona código do país (+55) e formata DDD com 9 dígitos.
                  </li>
                  <li>
                    <strong>Anti-Duplicidade:</strong> Ignora automaticamente números que já existem no EduChat ou repetidos no arquivo.
                  </li>
                  <li>
                    <strong>Roteamento Exclusivo:</strong> Todos os leads são direcionados para o departamento de <strong>Expansão</strong> e notificados no canal <strong>#expansao</strong>.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* PASSO 2: PRÉVIA E CONFIRMAÇÃO */}
          {step === 'preview' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Cards de Métricas do Arquivo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Prontos para Expansão
                  </span>
                  <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {stats.validCount}
                  </p>
                  <span className="text-[10px] text-emerald-600">Leads válidos</span>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Duplicados Ignorados
                  </span>
                  <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                    {stats.duplicateCount}
                  </p>
                  <span className="text-[10px] text-amber-600">Já existentes</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-chatPanel border border-slate-200 dark:border-chatBorder rounded-xl text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-chatTextMuted">
                    Inválidos / Sem Telefone
                  </span>
                  <p className="text-2xl font-extrabold text-chatTextTitle mt-0.5">
                    {stats.invalidCount}
                  </p>
                  <span className="text-[10px] text-chatTextMuted">Descartados</span>
                </div>
              </div>

              {/* Tabela de Prévia dos Leads */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-chatTextTitle flex items-center gap-1.5">
                    <Users size={14} className="text-pink-600" />
                    Amostra de Leads Identificados ({parsedLeads.length}):
                  </span>
                  <span className="text-[11px] text-chatTextMuted font-mono">
                    {fileName}
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-chatBorder rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-chatPanel text-chatTextMuted text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5">Nome</th>
                        <th className="p-2.5">Telefone (Padronizado)</th>
                        <th className="p-2.5">Cidade / Polo</th>
                        <th className="p-2.5">Destino</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-chatBorder">
                      {parsedLeads.slice(0, 10).map((lead, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-chatPanel/50 transition">
                          <td className="p-2.5 font-semibold text-chatTextTitle truncate max-w-[140px]">
                            {lead.name}
                          </td>
                          <td className="p-2.5 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                            {lead.phone}
                          </td>
                          <td className="p-2.5 text-chatTextMuted truncate max-w-[120px]">
                            {lead.city || 'Geral'}
                          </td>
                          <td className="p-2.5">
                            <span className="text-[10px] font-bold bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-300 px-2 py-0.5 rounded-full">
                              Expansão
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedLeads.length > 10 && (
                  <p className="text-[10px] text-chatTextMuted mt-1 text-center">
                    ... e mais {parsedLeads.length - 10} leads preparados para importação.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PASSO: PROCESSANDO */}
          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in">
              <RefreshCw size={36} className="text-pink-600 animate-spin" />
              <h4 className="text-sm font-bold text-chatTextTitle">
                Importando e Roteando Leads para a Expansão...
              </h4>
              <p className="text-xs text-chatTextMuted max-w-sm">
                Gravando histórico no Supabase, disparando broadcast Realtime e atribuindo consultor responsável.
              </p>
            </div>
          )}

          {/* PASSO 3: FEEDBACK VISUAL DE SUCESSO (Item 3) */}
          {step === 'success' && importSummary && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 rounded-full">
                  Importação Concluída com Sucesso
                </span>
                <h3 className="text-lg font-bold text-chatTextTitle mt-1.5">
                  {importSummary.importedCount} lead(s) importados e direcionados para a Expansão!
                </h3>
                <p className="text-xs text-chatTextMuted max-w-md mt-1">
                  Os contatos foram integrados à carteira do EduChat e já aparecem organizados na aba de WhatsApp com a tag <strong>"Lead Instagram - Expansão"</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder w-full max-w-md text-xs text-left space-y-1.5">
                <p className="flex items-center justify-between text-chatTextTitle">
                  <span>Equipe Responsável:</span>
                  <strong className="text-brand-600 dark:text-brand-400">Expansão & Novos Polos</strong>
                </p>
                <p className="flex items-center justify-between text-chatTextTitle">
                  <span>Consultor Atribuído:</span>
                  <strong>Luiz Augusto</strong>
                </p>
                <p className="flex items-center justify-between text-chatTextTitle">
                  <span>Canal Notificado:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">#expansao</strong>
                </p>
                {importSummary.duplicatesIgnored > 0 && (
                  <p className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-[11px] pt-1 border-t border-slate-200 dark:border-chatBorder">
                    <span>Duplicados prevenidos:</span>
                    <strong>{importSummary.duplicatesIgnored} ignorados</strong>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé / Botões de Ação */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-chatPanel border-t border-chatBorder flex items-center justify-between shrink-0">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-chatTextMuted hover:text-chatTextTitle transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Selecionar Arquivo CSV
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold text-chatTextMuted hover:text-chatTextTitle transition"
              >
                ← Escolher Outro Arquivo
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={15} />
                <span>Confirmar e Direcionar para a Expansão ({parsedLeads.length})</span>
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 text-xs font-semibold text-chatTextMuted hover:text-chatTextTitle transition"
              >
                Importar Outro Arquivo
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateToChannel) onNavigateToChannel('c-expansao');
                  }}
                  className="px-3.5 py-2 bg-slate-200 dark:bg-chatCard hover:bg-slate-300 text-chatTextTitle text-xs font-semibold rounded-xl transition flex items-center gap-1"
                >
                  <Hash size={13} /> Ir para #expansao
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (importSummary?.firstLeadId && onSelectContact) {
                      onSelectContact(importSummary.firstLeadId);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <MessageSquare size={13} /> Ver Atendimentos dos Leads
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
