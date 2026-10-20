// =========================================================================
// SUPABASE EDGE FUNCTION: GERAÇÃO DE ATA EXECUTIVA DE ALINHAMENTO (IA)
// Endpoint: /functions/v1/generate-executive-minute
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      collaborator,
      periodLabel = "Últimos 30 dias",
      kpis = {},
      kanbanCards = [],
      completedTasks = [],
      pendingTasks = [],
      whatsAppChats = [],
      evaluator = "Flávio Motta (Diretoria Executiva)"
    } = body;

    const apiKey = body.apiKey || GEMINI_API_KEY;

    // Constrói a lista consolidada de tarefas recebidas
    let allTasks = Array.isArray(kanbanCards) && kanbanCards.length > 0
      ? kanbanCards
      : [...(completedTasks || []), ...(pendingTasks || [])];

    // Higieniza as tarefas com title, description, status, created_at
    const sanitizedTasks = allTasks.map((t) => {
      let desc = t.description || t.desc || "";
      desc = desc.replace(/<!-- TASK_META:[\s\S]+? -->/g, "").trim();
      return {
        title: t.title || "Tarefa sem título",
        description: desc || "Sem descrição detalhada.",
        status: t.status || "todo",
        created_at: t.created_at || t.createdAt || ""
      };
    });

    const systemInstruction = `Você é um Assistente Executivo. Analise a seguinte lista de tarefas do Kanban deste colaborador. Redija uma Ata de Alinhamento em tópicos listando: 1. Tarefas Concluídas/Entregues, 2. Procedimentos em Andamento e 3. Gargalos ou Pendências críticas. Use as descrições das tarefas para dar contexto real ao gestor.`;

    const userPrompt = `DADOS OPERACIONAIS DO COLABORADOR:
Nome: ${collaborator?.name || 'Colaborador'}
Cargo: ${collaborator?.role || 'Equipe'}
Departamento: ${collaborator?.department || 'Geral'}
Período de Avaliação: ${periodLabel}
Gestor Responsável: ${evaluator}

MÉTRICAS:
- Atendimentos WhatsApp: ${kpis.whatsapp_chats_count || whatsAppChats.length || 0}
- Atendimentos Resolvidos: ${kpis.whatsapp_resolved_count || 0}
- Total de Cartões Kanban: ${sanitizedTasks.length}
- Taxa de Conclusão: ${kpis.completion_rate || 'N/A'}
- Velocidade Média: ${kpis.avg_resolution_time || '1.4 dias'}

LISTA DE TAREFAS DETALHADAS DO KANBAN (${sanitizedTasks.length} cartões):
${sanitizedTasks.length > 0 
  ? sanitizedTasks.map((t, idx) => `${idx + 1}. TÍTULO: ${t.title}
   STATUS / COLUNA: ${t.status}
   CRIADO EM: ${t.created_at}
   DESCRIÇÃO: ${t.description}
`).join('\n')
  : 'Nenhum cartão cadastrado no período.'}
`;

    if (!apiKey) {
      // Fallback estruturado caso não haja chave da API no ambiente
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const doneList = sanitizedTasks.filter(t => t.status === 'done' || t.status === 'concluido' || t.status === 'concluído');
      const inProgressList = sanitizedTasks.filter(t => t.status === 'in_progress' || t.status === 'em_andamento' || t.status === 'doing');
      const pendingList = sanitizedTasks.filter(t => !['done', 'concluido', 'concluído', 'in_progress', 'em_andamento', 'doing'].includes(t.status));

      const fallbackMinute = `# ATA DE ALINHAMENTO EXECUTIVO
**Instituição:** Faculdade Olavo Bilac • Grupo EstudeMais  
**Colaborador(a):** ${collaborator?.name || 'Colaborador'} — ${collaborator?.role || 'Equipe'} (${collaborator?.department || 'Geral'})  
**Gestor Responsável:** ${evaluator}  
**Período Avaliado:** ${periodLabel}  
**Data de Emissão:** ${dateStr}  

---

### 1. TAREFAS CONCLUÍDAS / ENTREGUES
${doneList.length > 0 
  ? doneList.map(t => `- ✅ **${t.title}**\n  *Contexto:* ${t.description}`).join('\n\n')
  : '- Nenhuma tarefa com status concluído registrada no período.'}

### 2. PROCEDIMENTOS EM ANDAMENTO
${inProgressList.length > 0 
  ? inProgressList.map(t => `- ⚙️ **${t.title}**\n  *Contexto:* ${t.description}`).join('\n\n')
  : '- Nenhum procedimento em execução ativa no momento.'}

### 3. GARGALOS OU PENDÊNCIAS CRÍTICAS
${pendingList.length > 0 
  ? pendingList.map(t => `- ⚠️ **${t.title}** (Status: ${t.status})\n  *Contexto:* ${t.description}`).join('\n\n')
  : '- Não foram identificados gargalos impeditivos no fluxo de trabalho.'}

---
**Assinatura da Diretoria:** _____________________________________  
**Ciência do Colaborador:** _____________________________________  
*(Ata executiva gerada via EduChat BI)*`;

      return new Response(JSON.stringify({ minute: fallbackMinute, collaboratorId: collaborator?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Modelos oficiais do Google Gemini
    const primaryEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    let response = await fetch(primaryEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.35, maxOutputTokens: 2500 }
      })
    });

    if (!response.ok) {
      response = await fetch(fallbackEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.35, maxOutputTokens: 2500 }
        })
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "GEMINI_ERROR", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const minuteText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ minute: minuteText, collaboratorId: collaborator?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
