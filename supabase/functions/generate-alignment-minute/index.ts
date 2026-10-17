// =========================================================================
// SUPABASE EDGE FUNCTION: GERAÇÃO DE ATA EXECUTIVA DE ALINHAMENTO (IA)
// Endpoint: /functions/v1/generate-alignment-minute
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
      kpis,
      completedTasks = [],
      pendingTasks = [],
      whatsAppChats = [],
      evaluator = "Flávio Motta (Diretoria Executiva)"
    } = body;

    const apiKey = body.apiKey || GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY_REQUIRED",
          message: "Chave da API do Google Gemini não encontrada nas variáveis da Edge Function."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemInstruction = `Você é o Diretor Executivo e Conselheiro de Gestão de Pessoas da Faculdade Olavo Bilac • Grupo EstudeMais.
Sua missão é redigir uma ATA EXECUTIVA DE ALINHAMENTO INDIVIDUAL E FEEDBACK DE PRODUTIVIDADE, formal, motivadora, rigorosa e profissional, baseada estritamente nos dados operacionais consolidados de WhatsApp e Kanban fornecidos.

A Ata deve ser redigida em Markdown elegante e profissional, contendo:
# ATA EXECUTIVA DE ALINHAMENTO INDIVIDUAL & PERFORMANCE
**Instituição:** Faculdade Olavo Bilac • Grupo EstudeMais
**Colaborador(a):** ${collaborator?.name || 'Colaborador'} — ${collaborator?.role || 'Equipe'} (${collaborator?.department || 'Geral'})
**Gestor(a) Avaliador(a):** ${evaluator}
**Período de Análise:** ${periodLabel}
**Data de Emissão:** ${new Date().toLocaleDateString('pt-BR')}

---

### 1. SÍNTESE DO DESEMPENHO OPERACIONAL
[Resumo conciso de 1 a 2 parágrafos analisando o volume de atendimento no WhatsApp, a entrega de cartões no Kanban e a dedicação do colaborador]

### 2. PRINCIPAIS PONTOS FORTES & ENTREGAS CONCLUÍDAS
[Lista detalhada em tópicos destacando os cards concluídos com sucesso e os atendimentos prestados com qualidade]

### 3. PENDÊNCIAS, PONTOS DE ATENÇÃO & VELOCIDADE DE RESOLUÇÃO
[Análise dos cartões pendentes/em andamento, atenção a SLAs e sugestões de otimização no fluxo de trabalho]

### 4. ACORDOS DE METAS PARA O PRÓXIMO CICLO
[3 a 5 metas claras e acionáveis para o colaborador atingir no próximo período]

---
**Assinatura da Diretoria:** _____________________________________  
**Ciência do Colaborador:** _____________________________________`;

    const userPrompt = `DADOS OPERACIONAIS DO COLABORADOR:
${JSON.stringify({
  colaborador: collaborator,
  periodo: periodLabel,
  kpis,
  cards_concluidos: completedTasks.slice(0, 30),
  cards_pendentes: pendingTasks.slice(0, 30),
  total_chats_whatsapp: whatsAppChats.length
}, null, 2)}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    let response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 2500 }
      })
    });

    if (!response.ok) {
      response = await fetch(fallbackEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 2500 }
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
