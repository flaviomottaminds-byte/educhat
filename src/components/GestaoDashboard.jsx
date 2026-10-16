import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, Clock, AlertTriangle, ShieldCheck, Sparkles, MessageCircle, Upload, GraduationCap } from 'lucide-react';

export default function GestaoDashboard({ tasks, channels, collaborators, onOpenInstagramImport, onOpenEduControlSync }) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-chatBg p-8 overflow-y-auto transition-colors">
      {/* Header do Painel */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-chatTextTitle flex items-center gap-3">
            <BarChart3 className="text-brand-600 dark:text-brand-500" />
            Painel de Gestão & Inteligência Operacional
          </h2>
          <p className="text-sm text-chatTextMuted mt-1">
            Métricas de SLA por departamento, mineração de conversas recorrentes e oportunidades de melhoria contínua
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {onOpenEduControlSync && (
            <button
              type="button"
              onClick={onOpenEduControlSync}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
              title="Upload de Base de Alunos (.csv / .txt)"
            >
              <GraduationCap size={16} />
              <span>Upload de Bases</span>
            </button>
          )}
          {onOpenInstagramImport && (
            <button
              type="button"
              onClick={onOpenInstagramImport}
              className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Upload size={16} />
              <span>Importar Leads (Instagram Ads)</span>
            </button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-chatCard border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-semibold uppercase">Total de Demandas</span>
            <CheckCircle className="text-brand-600 dark:text-brand-500" />
          </div>
          <p className="text-3xl font-bold text-chatTextTitle">{totalTasks}</p>
          <p className="text-xs text-brand-600 dark:text-brand-500 mt-2 font-medium">100% registradas via EduChat</p>
        </div>

        <div className="bg-chatCard border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-semibold uppercase">Em Andamento</span>
            <Clock className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressTasks}</p>
          <p className="text-xs text-chatTextMuted mt-2">Monitoradas pela IA</p>
        </div>

        <div className="bg-chatCard border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-semibold uppercase">Concluídas</span>
            <CheckCircle className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{doneTasks}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
            Taxa de resolução: {totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%
          </p>
        </div>

        <div className="bg-chatCard border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-chatTextMuted mb-2">
            <span className="text-xs font-semibold uppercase">Tempo Poupado</span>
            <TrendingUp className="text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-300">~14h / sem</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">Fora do WhatsApp pessoal</p>
        </div>
      </div>

      {/* SEÇÃO: INTELIGÊNCIA OPERACIONAL (CONVERSAS REPETITIVAS & SLAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Mineração de Assuntos mais Repetidos nas Conversas */}
        <div className="bg-chatCard border border-chatBorder rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-chatTextTitle flex items-center gap-2">
              <MessageCircle size={18} className="text-brand-600 dark:text-brand-500" />
              <span>Assuntos & Solicitações Mais Repetidas</span>
            </h3>
            <span className="text-[10px] bg-brand-500/10 text-brand-600 dark:text-brand-500 font-semibold px-2 py-0.5 rounded-full">
              Últimos 30 dias
            </span>
          </div>
          <p className="text-xs text-chatTextMuted">
            A IA agrupa automaticamente as mensagens trocadas para identificar onde sua equipe perde mais tempo:
          </p>

          <div className="space-y-3.5 pt-2">
            <div>
              <div className="flex justify-between text-xs text-chatTextBody mb-1">
                <span className="font-medium">1. Divergências de Faturas & Splits de Polos</span>
                <span className="font-bold text-chatTextTitle">38% (24 conversas)</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-red-500 h-full rounded-full" style={{ width: '38%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-chatTextBody mb-1">
                <span className="font-medium">2. Reposições de Aulas & Notas (Secretaria)</span>
                <span className="font-bold text-chatTextTitle">29% (18 conversas)</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '29%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-chatTextBody mb-1">
                <span className="font-medium">3. Emissão de Certificados de Pós-Graduação</span>
                <span className="font-bold text-chatTextTitle">21% (13 conversas)</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-brand-600 dark:bg-brand-500 h-full rounded-full" style={{ width: '21%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-chatTextBody mb-1">
                <span className="font-medium">4. Dúvidas de Acesso e Login no eAula</span>
                <span className="font-bold text-chatTextTitle">12% (8 conversas)</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '12%' }} />
              </div>
            </div>
          </div>

          {/* Dica de IA para POP */}
          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/30 rounded-lg flex items-start gap-2.5 mt-3">
            <Sparkles size={16} className="text-yellow-600 dark:text-yellow-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-purple-900 dark:text-purple-200 leading-relaxed">
              <strong>Oportunidade de Melhoria detectada pela IA:</strong> 38% das conversas tratam de conferência manual de splits. Criar um POP padronizado ou conectar com a rotina automática pode poupar até 6 horas semanais da equipe financeira!
            </p>
          </div>
        </div>

        {/* Análise de Tempo de Resolução Real vs. SLA Definido */}
        <div className="bg-chatCard border border-chatBorder rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-chatTextTitle flex items-center gap-2">
              <Clock size={18} className="text-yellow-600 dark:text-yellow-400" />
              <span>Tempo de Resolução Real vs. SLA Definido</span>
            </h3>
            <span className="text-[10px] bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-semibold px-2 py-0.5 rounded-full">
              Por Departamento
            </span>
          </div>
          <p className="text-xs text-chatTextMuted">
            Comparação entre o prazo que a gestão combinou e o tempo que o setor realmente leva para concluir:
          </p>

          <div className="space-y-3 pt-2">
            {/* Secretaria */}
            <div className="p-3 bg-slate-50 dark:bg-chatSidebar rounded-lg border border-red-200 dark:border-red-500/30 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-chatTextTitle">Secretaria Acadêmica (Reposições)</span>
                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20 px-2 py-0.5 rounded">
                  ⚠️ SLA Estourado (+1.6 dias)
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-chatTextMuted">
                <span>SLA Acordado: <strong className="text-chatTextTitle">48 horas</strong></span>
                <span>Tempo Médio Real: <strong className="text-red-600 dark:text-red-400 font-bold">3.6 dias</strong></span>
              </div>
            </div>

            {/* Financeiro */}
            <div className="p-3 bg-slate-50 dark:bg-chatSidebar rounded-lg border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-chatTextTitle">Financeiro & Faturas Asaas</span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded">
                  ✅ No Prazo
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-chatTextMuted">
                <span>SLA Acordado: <strong className="text-chatTextTitle">24 horas</strong></span>
                <span>Tempo Médio Real: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">1.1 dias</strong></span>
              </div>
            </div>

            {/* Suporte */}
            <div className="p-3 bg-slate-50 dark:bg-chatSidebar rounded-lg border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-chatTextTitle">Suporte aos Polos</span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded">
                  ⚡ Excelente
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-chatTextMuted">
                <span>SLA Acordado: <strong className="text-chatTextTitle">12 horas</strong></span>
                <span>Tempo Médio Real: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">4.5 horas</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Conformidade e Proteção de Dados */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center gap-4 shadow-sm">
        <ShieldCheck size={28} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
            Ambiente Interno Seguro & Em conformidade com a LGPD
          </h4>
          <p className="text-xs text-emerald-800/80 dark:text-chatTextMuted mt-0.5">
            Dados de alunos, faturas, splits e decisões estratégicas protegidos dentro dos servidores da empresa, sem vazamentos em aparelhos móveis pessoais de funcionários.
          </p>
        </div>
      </div>
    </div>
  );
}
