// =========================================================================
// SUPABASE EDGE FUNCTION: AI BUG TRACKER (Bypass de Suporte)
// Endpoint: /functions/v1/ai-bug-tracker
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BugReportPayload {
  titulo_do_bug: string;
  problema_relatado: string;
  solucao_esperada: string;
  prioridade: "baixa" | "media" | "alta";
}

// Parser Heurístico para Extração Estruturada
function parseBugReport(text: string): BugReportPayload {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  let titulo = "";
  let problema = "";
  let solucao = "";
  let prioridade: "baixa" | "media" | "alta" = "media";

  // 1. Extração para Formato Estruturado (Problema:... Ação esperada:...)
  if (lower.includes("problema:")) {
    const probMatch = trimmed.match(/problema:\s*([\s\S]+?)(?=(causa prov[aá]vel:|a[cç][aã]o esperada:|$))/i);
    if (probMatch) problema = probMatch[1].trim();

    const acaoMatch = trimmed.match(/a[cç][aã]o esperada:\s*([\s\S]+?)$/i);
    if (acaoMatch) solucao = acaoMatch[1].trim();

    if (problema) {
      const firstSentence = problema.split(/[.\n]/)[0].trim();
      titulo = firstSentence.length > 60 ? firstSentence.slice(0, 57) + "..." : firstSentence;
    }
  }

  // 2. Extração para Linguagem Natural Livre
  if (!problema) {
    problema = trimmed;
    const clean = trimmed
      .replace(/^(tem um bug|identifiquei um bug|bug[:\s-]*|erro[:\s-]*|falha[:\s-]*|relato de bug[:\s-]*)/i, "")
      .replace(/^no sistema[:\s-]*/i, "")
      .trim();

    const first = clean.split(/[.\n!?;]/)[0].trim();
    if (first.length > 5) {
      titulo = first.charAt(0).toUpperCase() + first.slice(1);
      if (titulo.length > 60) titulo = titulo.slice(0, 57) + "...";
    } else {
      titulo = "Falha técnica relatada pelo administrador";
    }

    if (lower.includes("deveria") || lower.includes("precisa") || lower.includes("esperado")) {
      const solMatch = trimmed.match(/(?:deveria|precisa|esperado|corrigir)\s+([\s\S]+?)(?=[.]|$)/i);
      solucao = solMatch ? `Ajustar para que ${solMatch[1].trim()}` : "Ajustar o sistema conforme o comportamento esperado.";
    } else {
      solucao = "Analisar causa raiz e aplicar correção no front-end/back-end.";
    }
  }

  // 3. Classificação de Prioridade
  const highKeywords = ["crítico", "critico", "urgente", "travando", "crash", "login", "banco", "perda", "bloqueio", "qr code", "áudio", "audio"];
  const lowKeywords = ["melhoria", "sugestão", "sugestao", "layout", "cor", "ajuste visual", "espaçamento", "cosmético", "cosmetico"];

  if (highKeywords.some((kw) => lower.includes(kw))) {
    prioridade = "alta";
  } else if (lowKeywords.some((kw) => lower.includes(kw))) {
    prioridade = "baixa";
  } else {
    prioridade = "media";
  }

  return {
    titulo_do_bug: titulo || "Correção técnica no sistema",
    problema_relatado: problema || trimmed,
    solucao_esperada: solucao || "Corrigir falha técnica apontada no relato.",
    prioridade,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, user } = await req.json();

    // 1. Verificação de Permissão: Apenas role = admin ou diretor
    const isAdmin =
      user?.role === "admin" ||
      user?.roleType === "diretor" ||
      user?.id === "u1" ||
      (user?.role && user.role.toLowerCase().includes("diretor"));

    if (!isAdmin) {
      return new Response(
        JSON.stringify({
          triggered: false,
          error: "Acesso negado: O AI Bug Tracker é exclusivo para usuários com privilégios de administrador.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // 2. Extração e Parsing das Informações (JSON Estruturado)
    const bugData = parseBugReport(message || "");

    // 3. Ação no Banco de Dados (Supabase)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("bug_reports")
      .insert([
        {
          titulo: bugData.titulo_do_bug,
          problema: bugData.problema_relatado,
          solucao_esperada: bugData.solucao_esperada,
          prioridade: bugData.prioridade,
          status: "aberto",
          reporter_name: user?.name || "Administrador",
          reporter_id: user?.id || "u1",
          raw_payload: bugData,
        },
      ])
      .select();

    if (error) {
      console.error("Erro ao inserir bug_report no Supabase:", error);
      throw error;
    }

    // 4. Feedback Visual Exato (Bypass de Suporte)
    return new Response(
      JSON.stringify({
        triggered: true,
        reply: "🛠️ Chamado técnico registrado com sucesso no banco de dados.",
        bug_report: data?.[0] || bugData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
