import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  GraduationCap,
  X,
  Download,
  ArrowRight,
  Sparkles,
  Filter,
  Check,
  RefreshCw,
  Search,
  Database,
  Building,
  UserCheck,
  Award,
  BookOpen,
  Mail,
  ShieldCheck,
  Phone,
  FileText
} from 'lucide-react';
import { parseEduControlFile } from '../lib/eduControl';

export default function EduControlSyncModal({
  isOpen,
  onClose,
  onSyncStudents,
  currentStudents = [],
  collaborators = []
}) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste' | 'list'
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedStudents, setParsedStudents] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'idle' | 'syncing' | 'success' | 'error'
  const [syncCount, setSyncCount] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [overrideAssignee, setOverrideAssignee] = useState('');
  const [overrideDept, setOverrideDept] = useState('');

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setFileContent(content);
        const parsed = parseEduControlFile(content);
        setParsedStudents(parsed);
      }
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setIsProcessing(false);
      alert('Erro ao ler o arquivo selecionado.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleTextPaste = (text) => {
    setFileContent(text);
    if (!text.trim()) {
      setParsedStudents([]);
      return;
    }
    const parsed = parseEduControlFile(text);
    setParsedStudents(parsed);
  };

  // Modelo CSV Oficial Padrão Base44 (Nome Completo, CPF, Telefone e E-mail)
  const handleDownloadSample = () => {
    const csvSample = `Nome Completo;CPF;Telefone;E-mail;Curso;Status;Polo;Matrícula;Consultor
Beatriz Oliveira;123.456.789-01;+55 (11) 97766-5544;beatriz@escola.com.br;MBA em Gestão Escolar e Inovação;Ativo;Polo São Paulo Matriz;EC-2024-5501;Gabriel Carvalho
Lucas Fagundes;234.567.890-12;+55 (19) 98877-1122;lucas.fagundes@clinica.com.br;Pós em Neuropsicopedagogia Clínica;Certificado;Polo Campinas;EC-2023-3321;Tatiane
Carla Martins;345.678.901-23;+55 (21) 99112-3344;carla.martins@ensino.br;Formação Pedagógica em Letras;Veterano;Polo Rio de Janeiro;EC-2022-7711;Luiz Augusto
Rodrigo Alencar;456.789.012-34;+55 (31) 99554-2211;rodrigo@faculdade.com.br;MBA em Docência no Ensino Superior;Ativo;Polo Belo Horizonte;EC-2024-9988;Gabriel Carvalho
Vanessa Lima;567.890.123-45;+55 (41) 98443-6677;vanessa@oab.org.br;Pós em Direito Educacional e Legislação MEC;Certificado;Polo Curitiba;EC-2023-1144;Tatiane`;

    const blob = new Blob([csvSample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_alunos_educontrol_base44.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const executeSync = async () => {
    if (parsedStudents.length === 0) return;

    setSyncStatus('syncing');

    // Opções de sobrescrita caso o gestor defina manualmente; caso contrário, vigora o Sticky Assignment
    const options = {
      forceAssignee: overrideAssignee || undefined,
      forceDepartment: overrideDept || undefined
    };

    try {
      if (onSyncStudents) {
        await onSyncStudents(parsedStudents, options);
      }
      setSyncCount(parsedStudents.length);
      setSyncStatus('success');
    } catch (err) {
      console.error('Erro ao sincronizar base:', err);
      setSyncStatus('error');
    }
  };

  // Filtragem da base já sincronizada (por Nome, CPF, Telefone, E-mail, Curso, Polo ou Status)
  const cleanFilter = searchFilter.trim().toLowerCase();
  const cleanFilterDigits = searchFilter.replace(/\D/g, '');

  const filteredExisting = currentStudents.filter((s) => {
    if (!s) return false;
    const name = (s.name || '').toLowerCase();
    const phoneDigits = (s.phone || s.cleanDigits || '').replace(/\D/g, '');
    const cpfDigits = (s.cpf || s.cleanCPF || '').replace(/\D/g, '');
    const email = (s.email || '').toLowerCase();
    const course = (s.course || '').toLowerCase();
    const polo = (s.polo || '').toLowerCase();
    const status = (s.academicStatus || '').toLowerCase();
    const matricula = (s.matricula || '').toLowerCase();

    return (
      name.includes(cleanFilter) ||
      (cleanFilterDigits && phoneDigits.includes(cleanFilterDigits)) ||
      (cleanFilterDigits && cpfDigits.includes(cleanFilterDigits)) ||
      email.includes(cleanFilter) ||
      course.includes(cleanFilter) ||
      polo.includes(cleanFilter) ||
      status.includes(cleanFilter) ||
      matricula.includes(cleanFilter)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-chatPanel w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-chatSidebar border-b border-slate-200 dark:border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shadow-xs">
              <Database size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
                  Sincronização de Alunos EduControl
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                  Padrão Base44
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hidden sm:inline-block">
                  Anti-duplicidade CPF Ativa
                </span>
              </div>
              <p className="text-xs text-chatTextMuted">
                Importação blindada com os 4 campos essenciais: <strong>Nome Completo, CPF, Telefone e E-mail</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-chatCard transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Abas */}
        <div className="px-6 pt-2 bg-slate-50/50 dark:bg-chatSidebar/50 border-b border-slate-200 dark:border-chatBorder flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Upload size={14} />
              Importar Arquivo (.CSV / .TXT)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet size={14} />
              Colar Texto EduControl
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              Alunos Reconhecidos ({currentStudents.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSample}
            className="text-[11px] text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold pb-2"
            title="Baixar modelo com os 4 campos do EduControl (Nome, CPF, Telefone, E-mail)"
          >
            <Download size={13} /> Baixar Modelo Base44
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Card explicativo sobre a Regra de Upsert e Anti-Duplicidade */}
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Regra Anti-Duplicidade & Permanência (Sticky Assignment):</span>
              <p className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5">
                O <strong>CPF</strong> é a chave primária única no Supabase. Se o aluno já existir, seus dados (telefone, e-mail, nome) são atualizados preservando integralmente o <strong>consultor responsável atual</strong>. Se o CPF for inédito, um novo cadastro é adicionado à carteira.
              </p>
            </div>
          </div>

          {/* ABA 1: UPLOAD DE ARQUIVO */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-200 dark:border-purple-800/50 hover:border-purple-500 rounded-2xl p-6 sm:p-8 text-center cursor-pointer bg-purple-50/30 dark:bg-purple-950/10 hover:bg-purple-50/60 transition group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition shadow-xs">
                  <Upload size={22} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Arraste ou clique para selecionar o CSV exportado do EduControl
                </h4>
                <p className="text-xs text-chatTextMuted max-w-md mx-auto">
                  Suporta arquivos .CSV e .TXT codificados em UTF-8 com separadores por vírgula (,) ou ponto e vírgula (;), aspas e quebras de linha.
                </p>
                {fileName && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-chatCard rounded-lg border border-purple-300 dark:border-purple-700 text-xs font-semibold text-purple-700 dark:text-purple-300 shadow-xs">
                    <FileSpreadsheet size={14} />
                    {fileName} ({parsedStudents.length} registros extraídos)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 2: COLAR TEXTO */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Copie e cole a listagem exportada do EduControl (com cabeçalho):
              </label>
              <textarea
                value={fileContent}
                onChange={(e) => handleTextPaste(e.target.value)}
                placeholder="Nome Completo;CPF;Telefone;E-mail;Curso;Status&#10;Mariana Silva;123.456.789-01;11988887777;mariana@exemplo.com.br;MBA Gestão Escolar;Ativo"
                rows={7}
                className="w-full text-xs font-mono p-3 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
              <p className="text-[11px] text-chatTextMuted">
                {parsedStudents.length > 0
                  ? `✅ ${parsedStudents.length} aluno(s) identificado(s) no texto colado.`
                  : 'Cole as colunas de Nome, CPF, Telefone e E-mail diretamente da planilha do EduControl.'}
              </p>
            </div>
          )}

          {/* ABA 3: LISTAGEM DE ALUNOS NA BASE ATUAL */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar por Nome, CPF, Telefone, E-mail, Curso, Polo ou Status..."
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <span className="text-xs font-bold text-chatTextMuted shrink-0">
                  {filteredExisting.length} de {currentStudents.length}
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-chatBorder divide-y divide-slate-100 dark:divide-chatBorder">
                {filteredExisting.length === 0 ? (
                  <div className="p-8 text-center text-xs text-chatTextMuted">
                    Nenhum aluno encontrado para os critérios de busca informados.
                  </div>
                ) : (
                  filteredExisting.map((s, idx) => (
                    <div key={s.id || idx} className="p-3 hover:bg-slate-50 dark:hover:bg-chatCard/50 flex items-center justify-between text-xs transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0">
                          {s.name?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-chatTextTitle">{s.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              s.academicStatus === 'Ativo'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : s.academicStatus === 'Certificado'
                                ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300'
                                : s.academicStatus === 'Veterano'
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            }`}>
                              {s.academicStatus}
                            </span>
                            {s.cpf && (
                              <span className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-chatSidebar px-1.5 py-0.2 rounded">
                                CPF: {s.cpf}
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-chatTextMuted mt-0.5">
                            {s.course} • 📍 {s.polo} • 👨‍💼 {s.assignee}
                          </p>
                          {s.email && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                              ✉️ {s.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{s.phone}</p>
                        <p className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium">Reconhecimento Ativo</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO DA IMPORTAÇÃO (SE HOUVER DADOS EXTRAÍDOS) */}
          {parsedStudents.length > 0 && activeTab !== 'list' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-chatBorder">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-600" />
                  Alunos Prontos para Sincronização ({parsedStudents.length}):
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Validação por CPF & Telefone
                </span>
              </div>

              {/* Controles Opcionais de Sobrescrita de Consultor e Fila */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-chatCard rounded-xl border border-slate-200 dark:border-chatBorder text-xs">
                <div>
                  <label className="block text-[10.5px] font-bold text-chatTextMuted uppercase mb-1">
                    Atribuir Consultor (Opcional):
                  </label>
                  <select
                    value={overrideAssignee}
                    onChange={(e) => setOverrideAssignee(e.target.value)}
                    className="w-full text-xs p-1.5 rounded-lg bg-white dark:bg-chatPanel border border-slate-200 dark:border-chatBorder text-chatTextTitle font-medium"
                  >
                    <option value="">-- Preservar consultor atual (Sticky Assignment) --</option>
                    {(collaborators || []).filter(c => !c.isBot).map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.department})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-chatTextMuted uppercase mb-1">
                    Departamento de Roteamento:
                  </label>
                  <select
                    value={overrideDept}
                    onChange={(e) => setOverrideDept(e.target.value)}
                    className="w-full text-xs p-1.5 rounded-lg bg-white dark:bg-chatPanel border border-slate-200 dark:border-chatBorder text-chatTextTitle font-medium"
                  >
                    <option value="">-- Automático por Status Acadêmico --</option>
                    <option value="Secretaria Acadêmica">Secretaria Acadêmica</option>
                    <option value="Coordenação Pedagógica">Coordenação Pedagógica</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Expansão">Expansão</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Amostra com os 4 Campos Essenciais em Destaque */}
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-chatBorder">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-chatSidebar sticky top-0 text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2 pl-3">Nome Completo</th>
                      <th className="p-2">CPF</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">E-mail</th>
                      <th className="p-2">Curso</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 pr-3">Consultor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-chatBorder bg-white dark:bg-chatPanel">
                    {parsedStudents.slice(0, 10).map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-chatCard/50">
                        <td className="p-2 pl-3 font-semibold text-slate-800 dark:text-slate-200">{s.name}</td>
                        <td className="p-2 font-mono text-[11px] text-purple-700 dark:text-purple-300 font-semibold">{s.cpf || '-'}</td>
                        <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{s.phone}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">{s.email || '-'}</td>
                        <td className="p-2 text-slate-700 dark:text-slate-300 truncate max-w-[130px]">{s.course}</td>
                        <td className="p-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            s.academicStatus === 'Ativo'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : s.academicStatus === 'Certificado'
                              ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300'
                              : s.academicStatus === 'Veterano'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}>
                            {s.academicStatus}
                          </span>
                        </td>
                        <td className="p-2 pr-3 text-slate-700 dark:text-slate-300 font-medium">
                          {overrideAssignee || s.assignee || 'Gabriel Carvalho'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedStudents.length > 10 && (
                <p className="text-[10px] text-center text-chatTextMuted">
                  ... e mais {parsedStudents.length - 10} aluno(s) prontos para sincronização.
                </p>
              )}
            </div>
          )}

          {/* Feedback de Sucesso */}
          {syncStatus === 'success' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Sincronização concluída com sucesso!</strong> {syncCount} alunos processados via CPF e Telefone, com atualização no Supabase e preservação de carteira (Sticky Assignment).
              </span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between">
          <div className="text-xs text-chatTextMuted">
            {currentStudents.length} alunos atualmente reconhecidos na base
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-chatTextMuted hover:text-chatTextTitle transition cursor-pointer"
            >
              Fechar
            </button>
            {parsedStudents.length > 0 && activeTab !== 'list' && (
              <button
                type="button"
                onClick={executeSync}
                disabled={syncStatus === 'syncing'}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Sincronizando com Supabase...
                  </>
                ) : (
                  <>
                    <Database size={14} />
                    Sincronizar {parsedStudents.length} Alunos no Supabase
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
