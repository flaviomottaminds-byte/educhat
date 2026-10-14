import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function GestaoDashboard({ tasks, channels, collaborators }) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const waitingTasks = tasks.filter((t) => t.status === 'waiting' || t.status === 'backlog').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-chatBg p-8 overflow-y-auto">
      {/* Header do Painel */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="text-brand-500" />
          Painel de Gestão & Produtividade
        </h2>
        <p className="text-sm text-[#8696a0] mt-1">
          Visão executiva das operações internas: processos, gargalos e tempo poupado fora do WhatsApp
        </p>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-chatPanel border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#8696a0] mb-2">
            <span className="text-xs font-semibold uppercase">Total de Demandas</span>
            <CheckSquareIcon className="text-brand-500" />
          </div>
          <p className="text-3xl font-bold text-white">{totalTasks}</p>
          <p className="text-xs text-brand-500 mt-2 font-medium">100% rastreadas via EduChat</p>
        </div>

        <div className="bg-chatPanel border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#8696a0] mb-2">
            <span className="text-xs font-semibold uppercase">Em Andamento</span>
            <Clock className="text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">{inProgressTasks}</p>
          <p className="text-xs text-[#8696a0] mt-2">Dentro do prazo acordado</p>
        </div>

        <div className="bg-chatPanel border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#8696a0] mb-2">
            <span className="text-xs font-semibold uppercase">Concluídas</span>
            <CheckCircle className="text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400">{doneTasks}</p>
          <p className="text-xs text-emerald-400 mt-2 font-medium">Taxa de resolução: {totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%</p>
        </div>

        <div className="bg-chatPanel border border-chatBorder rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#8696a0] mb-2">
            <span className="text-xs font-semibold uppercase">Tempo Poupado</span>
            <TrendingUp className="text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-300">~14h / sem</p>
          <p className="text-xs text-purple-400 mt-2 font-medium">Sem ruído no WhatsApp</p>
        </div>
      </div>

      {/* Seção Central: Status por Setor & Carga por Colaborador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Demandas por Setor */}
        <div className="bg-chatPanel border border-chatBorder rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span>Volume de Processos por Setor</span>
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-[#d1d7db] mb-1">
                <span>Financeiro (#financeiro)</span>
                <span className="font-bold text-white">2 demandas ativas</span>
              </div>
              <div className="w-full h-2 bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full rounded-full" style={{ width: '60%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#d1d7db] mb-1">
                <span>Secretaria & Certificados (#secretaria-pedagogica)</span>
                <span className="font-bold text-white">2 demandas ativas</span>
              </div>
              <div className="w-full h-2 bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-yellow-500 h-full rounded-full" style={{ width: '60%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#d1d7db] mb-1">
                <span>Diretoria & Estratégia (#diretoria-estrategica)</span>
                <span className="font-bold text-white">1 concluída</span>
              </div>
              <div className="w-full h-2 bg-chatSidebar rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: '25%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Produtividade da Equipe */}
        <div className="bg-chatPanel border border-chatBorder rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-white mb-4">
            Distribuição de Tarefas na Equipe
          </h3>
          <div className="space-y-3">
            {collaborators.map((c) => {
              const userTasks = tasks.filter((t) => t.assignee === c.name);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-chatSidebar border border-chatBorder/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c.avatar}</span>
                    <div>
                      <p className="text-xs font-semibold text-white">{c.name}</p>
                      <p className="text-[10px] text-[#8696a0]">{c.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full">
                      {userTasks.length} tarefa(s)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Banner de Conformidade e Proteção de Dados */}
      <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center gap-4">
        <ShieldCheck size={28} className="text-emerald-400 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-emerald-200">
            Ambiente Interno Seguro & Em conformidade com a LGPD
          </h4>
          <p className="text-xs text-[#8696a0] mt-0.5">
            Dados de alunos, faturas, splits e decisões estratégicas protegidos dentro dos servidores da empresa, sem vazamentos em aparelhos móveis pessoais de funcionários.
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckSquareIcon(props) {
  return (
    <svg
      {...props}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
