import React, { useState } from 'react';
import {
  X,
  FileText,
  Upload,
  Sparkles,
  Brain,
  CheckSquare,
  Clock,
  ArrowRight,
  Check,
  Building2,
  Calendar,
  AlertTriangle,
  Lightbulb,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

const MOCK_CAMPINAS_CHAT = `[12/06/2026, 09:15:20] Diretor Polo Campinas: Olá Flávio, bom dia! Gostaria de verificar a nossa fatura de maio. Identifiquei que veio cobrando R$ 350 a mais no split de comissões.
[12/06/2026, 09:30:10] Flávio Motta: Bom dia Dr. Marcos! Tudo bem? Vou pedir para a Fernanda do financeiro analisar a conciliação do Asaas e te enviar um retorno até amanhã.
[14/06/2026, 14:10:45] Fernanda Silva: Dr. Marcos, localizamos a divergência. Houve um aluno que cancelou a matrícula e o split não havia recalculado.
[14/06/2026, 14:25:00] Diretor Polo Campinas: Obrigado Fernanda. Por favor, envie a 2ª via com o valor retificado de R$ 4.250 para a gente pagar. Ah, lembrem que a nossa mantenedora só processa pagamentos às sextas-feiras!
[28/07/2026, 11:20:15] Diretor Polo Campinas: Pessoal, estamos com 8 alunos da turma de Pós em Gestão Escolar que terminaram as disciplinas e estão aguardando a emissão do certificado. Eles precisam disso com urgência para a pontuação de concurso da prefeitura!
[28/07/2026, 11:45:00] Flávio Motta: Perfeito Dr. Marcos. Vamos acionar a Juliana na secretaria acadêmica. O prazo normal é 48h para colação de grau digital.
[10/08/2026, 16:30:00] Juliana Mendes: Para adiantar a emissão, Marcos, o aluno Carlos Alberto precisa reenviar a cópia legível do RG no eAula, pois a foto enviada ficou cortada.
[12/08/2026, 10:15:10] Diretor Polo Campinas: Já cobrei o aluno Carlos Alberto e ele vai subir hoje. Podem priorizar os outros 7 certificados?`;

export default function WhatsAppDossierModal({
  isOpen,
  onClose,
  onCreateTasks,
  onFeedAIMemory
}) {
  if (!isOpen) return null;

  const [activeStep, setActiveStep] = useState('input'); // 'input' | 'analysis'
  const [chatText, setChatText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Seleção de pendências para enviar ao Kanban
  const [selectedTasks, setSelectedTasks] = useState(['task_1', 'task_2', 'task_3']);
  const [tasksCreatedSuccess, setTasksCreatedSuccess] = useState(false);
  const [aiLearnedSuccess, setAiLearnedSuccess] = useState(false);

  // Dados estruturados analisados pela IA a partir do chat
  const analysisData = {
    clientName: 'Polo Campinas (Educação Continuada)',
    plan: 'Plano Fixo Gold',
    relationshipTone: 'Parceria Comercial Estratégica (Exigente, com alta pontualidade)',
    summary:
      'Histórico de 3 meses de interações cobrindo conciliação de faturas no Asaas e emissão de certificados de Pós-Graduação. O polo possui volume expressivo de matrículas, exige rigor nos fechamentos às sextas-feiras e tem urgência na liberação de diplomas para alunos inscritos em concursos municipais.',
    timeline: [
      { date: '12/06/2026', event: 'Polo questionou divergência de R$ 350 no split da fatura.' },
      { date: '14/06/2026', event: 'Financeiro confirmou estorno e acordou envio de 2ª via corrigida (R$ 4.250).' },
      { date: '28/07/2026', event: 'Solicitação de urgência para 8 certificados de Pós em Gestão Escolar.' },
      { date: '10/08/2026', event: 'Secretaria identificou RG ilegível do aluno Carlos Alberto pendente no eAula.' }
    ],
    pendingTasks: [
      {
        id: 'task_1',
        title: 'Enviar 2ª via de fatura retificada Asaas (R$ 4.250) - Polo Campinas',
        desc: 'Fatura recalculada após cancelamento de matrícula de aluno.',
        assignee: 'Fernanda Silva',
        department: 'Financeiro',
        dueDate: 'Próxima Sexta-feira',
        priority: 'alta',
        isVip: true
      },
      {
        id: 'task_2',
        title: 'Emitir e liberar 7 certificados de Pós-Graduação aprovados',
        desc: 'Alunos precisam para validação de títulos em concurso público.',
        assignee: 'Juliana Mendes',
        department: 'Secretaria',
        dueDate: 'Em 48 horas',
        priority: 'alta',
        isVip: true
      },
      {
        id: 'task_3',
        title: 'Validar reenvio do RG do aluno Carlos Alberto no eAula',
        desc: 'Documento pendente para liberação do 8º certificado.',
        assignee: 'Carlos Eduardo',
        department: 'Atendimento',
        dueDate: 'Hoje, até 18h',
        priority: 'media',
        isVip: true
      }
    ],
    aiLearnings: {
      newFacts: [
        'Regra Financeira: A mantenedora do Polo Campinas só processa pagamentos e faturas às sextas-feiras.',
        'Regra de Cadastro: Polo VIP com alta sensibilidade a prazos de certificação de concurso público.'
      ],
      discoveredPop: {
        title: 'POP Descoberto: Emissão de Certificados com Pendência Documental Parcial',
        steps:
          '1. Quando houver lote de alunos de pós, emitir imediatamente os certificados dos alunos 100% aptos;\n2. Notificar o polo detalhando apenas os nomes com pendência documental (ex: RG ilegível);\n3. Não reter a turma inteira por pendência individual.'
      },
      slaInsight: 'Prazos de certificados de pós exigem SLA prioritário de 48h para polos com alunos concurseiros.'
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setChatText(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadDemo = () => {
    setFileName('Conversa do WhatsApp com Polo Campinas (Dr. Marcos).txt');
    setChatText(MOCK_CAMPINAS_CHAT);
  };

  const handleStartAnalysis = () => {
    if (!chatText.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setActiveStep('analysis');
    }, 1200);
  };

  const toggleTaskSelection = (taskId) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleCreateKanbanCards = () => {
    const tasksToCreate = analysisData.pendingTasks.filter((t) =>
      selectedTasks.includes(t.id)
    );

    onCreateTasks(tasksToCreate);
    setTasksCreatedSuccess(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    setTimeout(() => setTasksCreatedSuccess(false), 2500);
  };

  const handleFeedMemory = () => {
    onFeedAIMemory(analysisData.aiLearnings);
    setAiLearnedSuccess(true);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    setTimeout(() => setAiLearnedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Cabeçalho do Modal */}
        <div className="p-4 bg-[#f0f2f5] dark:bg-chatPanel border-b border-slate-200 dark:border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-bold text-chatTextTitle text-base flex items-center gap-2">
                Dossiê 360º & Auto-Aprendizado WhatsApp
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/30">
                  ✨ IA Operacional
                </span>
              </h3>
              <p className="text-xs text-chatTextMuted">
                Analise conversas complexas, extraia pendências para o Kanban e alimente o cérebro da empresa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-chatTextMuted hover:text-chatTextTitle rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeStep === 'input' && (
            <div className="space-y-5">
              {/* Botão de Exemplo Rápido */}
              <div className="bg-gradient-to-r from-brand-50 to-purple-50 dark:from-chatPanel dark:to-purple-950/20 p-4 rounded-xl border border-brand-200/60 dark:border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-chatTextTitle flex items-center gap-1.5">
                    <Sparkles size={14} className="text-brand-600 dark:text-brand-500" />
                    Quer testar imediatamente com um caso complexo?
                  </h4>
                  <p className="text-[11px] text-chatTextMuted mt-0.5">
                    Carregue um histórico real de 3 meses com o Polo Campinas (faturas, discordância de splits e certificados).
                  </p>
                </div>
                <button
                  onClick={handleLoadDemo}
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
                >
                  Carregar Exemplo do Polo Campinas
                </button>
              </div>

              {/* Opção 1: Upload de Arquivo .txt */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-chatTextTitle">
                  1. Enviar Arquivo exportado do WhatsApp (.txt):
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-chatBorder hover:border-brand-500 rounded-xl p-5 text-center transition cursor-pointer bg-slate-50 dark:bg-chatSidebar relative">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload size={24} className="mx-auto text-brand-600 dark:text-brand-500 mb-2" />
                  <p className="text-xs font-semibold text-chatTextTitle">
                    {fileName || 'Clique para selecionar o arquivo .txt ou arraste aqui'}
                  </p>
                  <p className="text-[10px] text-chatTextMuted mt-1">
                    No WhatsApp do celular: Menu da conversa &gt; Mais &gt; Exportar conversa (sem mídia)
                  </p>
                </div>
              </div>

              {/* Opção 2: Colar Texto Diretamente (Ctrl + V) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-chatTextTitle">
                  2. Ou cole o texto da conversa diretamente (Ctrl + V):
                </label>
                <textarea
                  rows={7}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Cole aqui o texto exportado ou mensagens trocadas no WhatsApp com o cliente..."
                  className="w-full bg-slate-50 dark:bg-chatInputBg text-chatTextTitle text-xs font-mono p-3 rounded-xl border border-slate-300 dark:border-chatBorder focus:outline-none focus:border-brand-500 shadow-xs"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  disabled={!chatText.trim() || isAnalyzing}
                  onClick={handleStartAnalysis}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-2 transition"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles size={16} className="animate-spin text-yellow-300" />
                      <span>Analisando Conversa & Extraindo Dossiê...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Analisar com IA & Gerar Dossiê</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeStep === 'analysis' && (
            <div className="space-y-6">
              {/* Barra de Status do Cliente Identificado */}
              <div className="p-4 bg-slate-50 dark:bg-chatPanel border border-slate-200 dark:border-chatBorder rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-600/15 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xl font-bold">
                    🏛️
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-chatTextTitle flex items-center gap-2">
                      {analysisData.clientName}
                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 font-bold px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-500/30">
                        👑 {analysisData.plan}
                      </span>
                    </h4>
                    <p className="text-xs text-chatTextMuted">{analysisData.relationshipTone}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveStep('input')}
                  className="text-xs text-brand-600 dark:text-brand-500 hover:underline font-semibold"
                >
                  ← Analisar outra conversa
                </button>
              </div>

              {/* 1. Resumo Executivo 360º */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-chatTextMuted flex items-center gap-1.5">
                  <Building2 size={14} className="text-brand-600 dark:text-brand-500" />
                  1. Dossiê Executivo do Relacionamento
                </h5>
                <div className="p-4 bg-white dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder rounded-xl text-xs text-chatTextBody leading-relaxed shadow-xs">
                  {analysisData.summary}
                </div>
              </div>

              {/* 2. Linha do Tempo dos Acordos */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-chatTextMuted flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
                  2. Linha do Tempo & Acordos Firmados no WhatsApp
                </h5>
                <div className="space-y-2">
                  {analysisData.timeline.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 dark:bg-chatPanel border-l-3 border-blue-500 rounded-r-lg text-xs flex items-start gap-2.5"
                    >
                      <span className="font-bold text-blue-700 dark:text-blue-300 text-[11px] shrink-0">
                        {item.date}:
                      </span>
                      <span className="text-chatTextBody">{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Pendências Não Resolvidas -> Transformar em Cards do Kanban */}
              <div className="space-y-3 p-4 bg-amber-50/50 dark:bg-yellow-950/10 border border-amber-200 dark:border-yellow-500/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-amber-900 dark:text-yellow-300 flex items-center gap-1.5">
                    <CheckSquare size={15} />
                    3. Pendências Críticas Identificadas (Gerar no Kanban)
                  </h5>
                  <span className="text-[11px] text-amber-800 dark:text-yellow-400 font-medium">
                    {selectedTasks.length} selecionadas para abertura
                  </span>
                </div>

                <div className="space-y-2">
                  {analysisData.pendingTasks.map((task) => {
                    const isSelected = selectedTasks.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => toggleTaskSelection(task.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-white dark:bg-chatCard border-amber-400 dark:border-yellow-500/50 shadow-xs'
                            : 'bg-slate-100/60 dark:bg-chatSidebar/60 border-slate-200 dark:border-chatBorder opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                          />
                          <div>
                            <p className="font-semibold text-chatTextTitle leading-snug">
                              {task.title}
                            </p>
                            <p className="text-[11px] text-chatTextMuted mt-0.5">{task.desc}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                              <span className="text-brand-600 dark:text-brand-500 font-medium">
                                👤 Responsável: <strong>{task.assignee}</strong> ({task.department})
                              </span>
                              <span className="text-chatTextMuted flex items-center gap-1">
                                <Clock size={11} /> Prazo: <strong>{task.dueDate}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 font-bold px-2 py-0.5 rounded shrink-0">
                          PRIORIDADE ALTA
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleCreateKanbanCards}
                    disabled={selectedTasks.length === 0}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition"
                  >
                    {tasksCreatedSuccess ? (
                      <>
                        <Check size={16} />
                        <span>Demandas Criadas no Kanban!</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare size={16} />
                        <span>Criar {selectedTasks.length} Cards no Kanban da Equipe</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4. AUTO-APRENDIZADO DA IA (A resposta direta ao seu adendo!) */}
              <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Brain size={16} className="text-purple-600 dark:text-purple-400" />
                    4. Auto-Aprendizado & Conhecimento Operacional Extraído
                  </h5>
                  <span className="text-[10px] bg-purple-200/60 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">
                    Auto-Alimentação
                  </span>
                </div>
                <p className="text-[11px] text-purple-800/80 dark:text-[#aebac1]">
                  A IA identificou regras não-documentadas e procedimentos práticos nesta conversa que podem enriquecer permanentemente a inteligência da empresa:
                </p>

                {/* Fatos Descobertos */}
                <div className="space-y-1.5">
                  {analysisData.aiLearnings.newFacts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white dark:bg-chatCard border border-purple-200 dark:border-purple-500/30 rounded-lg text-xs flex items-center gap-2"
                    >
                      <Lightbulb size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
                      <span className="text-chatTextBody font-medium">{fact}</span>
                    </div>
                  ))}
                </div>

                {/* Procedimento Descoberto (POP) */}
                <div className="p-3 bg-white dark:bg-chatCard border border-purple-200 dark:border-purple-500/30 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-chatTextTitle">
                    <BookOpen size={14} className="text-brand-600 dark:text-brand-500" />
                    <span>{analysisData.aiLearnings.discoveredPop.title}</span>
                  </div>
                  <p className="text-[11px] text-chatTextBody font-mono bg-slate-50 dark:bg-[#111b21] p-2 rounded whitespace-pre-wrap">
                    {analysisData.aiLearnings.discoveredPop.steps}
                  </p>
                </div>

                {/* Botão para Auto-Alimentar o Cérebro da IA */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleFeedMemory}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-2 transition"
                  >
                    {aiLearnedSuccess ? (
                      <>
                        <Check size={16} />
                        <span>Cérebro da IA Alimentado com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Brain size={16} />
                        <span>🧠 Incorporar Aprendizados à Memória Permanente da Empresa</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-slate-100 dark:bg-chatPanel border-t border-slate-200 dark:border-chatBorder flex justify-between items-center shrink-0">
          <span className="text-[11px] text-chatTextMuted">
            Protegido pela LGPD: conversas importadas permanecem restritas à inteligência interna.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-chatSidebar hover:bg-slate-300 dark:hover:bg-chatBorder text-chatTextTitle font-semibold text-xs rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
