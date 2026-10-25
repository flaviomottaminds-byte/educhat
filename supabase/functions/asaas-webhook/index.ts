// =========================================================================
// SUPABASE EDGE FUNCTION: ASAAS WEBHOOK LISTENER (Sprint 3.4)
// Endpoint: /functions/v1/asaas-webhook
// Recebe notificações de eventos financeiros do Asaas (PAYMENT_RECEIVED / PAYMENT_CONFIRMED)
// Realiza a baixa automática em public.payments, atualiza public.academic_processes
// e dispara notificações de confirmação via Evolution API (WhatsApp) para o Aluno e Polo.
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

const DEFAULT_EVO_URL = "https://evolution-api-production-3fb2.up.railway.app";
const DEFAULT_EVO_KEY = "e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f";
const DEFAULT_EVO_INSTANCE = "EduChat-Matriz-01";

function formatWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits.length >= 12 && digits.length <= 14 ? digits : null;
}

async function sendWhatsAppNotification(number: string, text: string): Promise<boolean> {
  const evoUrl = (Deno.env.get("EVOLUTION_API_URL") || DEFAULT_EVO_URL).replace(/\/+$/, "");
  const evoKey = (Deno.env.get("EVOLUTION_API_KEY") || DEFAULT_EVO_KEY).trim();
  const evoInstance = (Deno.env.get("EVOLUTION_INSTANCE") || DEFAULT_EVO_INSTANCE).trim();

  try {
    const payload = {
      number: number,
      text: text,
      textMessage: {
        text: text
      },
      options: {
        delay: 500,
        presence: "composing",
        linkPreview: false
      }
    };

    const res = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evoKey
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Evolution API] Falha no envio para ${number}:`, errText);
      return false;
    }

    const data = await res.json();
    console.log(`[Evolution API] Mensagem enviada com sucesso para ${number}:`, data?.key?.id || data?.id || "OK");
    return true;
  } catch (err) {
    console.error(`[Evolution API] Erro ao enviar mensagem para ${number}:`, err);
    return false;
  }
}

serve(async (req: Request) => {
  // 1. Trata preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const webhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    }

    // 2. Validação de Token de Segurança do Webhook (se configurado nos secrets)
    if (webhookSecret && webhookSecret.trim().length > 5) {
      const receivedToken = req.headers.get("asaas-access-token");
      if (receivedToken !== webhookSecret.trim()) {
        console.warn("[Asaas Webhook] Token de autenticação inválido ou ausente.");
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid asaas-access-token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Leitura e Parse do Payload
    const body = await req.json();
    console.log("[Asaas Webhook] Evento recebido:", body.event);

    const event = body.event || "UNKNOWN";
    const payment = body.payment || body;

    if (!payment?.id) {
      return new Response(
        JSON.stringify({ message: "Payload recebido sem identificador de cobrança (payment.id)", body }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Localização do Registro Financeiro no Supabase
    const { data: paymentRecord, error: searchError } = await supabase
      .from("payments")
      .select("*")
      .or(`asaas_payment_id.eq.${payment.id},id.eq.${payment.externalReference || payment.id}`)
      .maybeSingle();

    if (searchError) {
      console.error("[Asaas Webhook] Erro ao buscar pagamento no banco:", searchError);
    }

    if (!paymentRecord) {
      console.warn(`[Asaas Webhook] Cobrança ${payment.id} não encontrada em public.payments.`);
      return new Response(
        JSON.stringify({
          message: "Cobrança não localizada no Supabase. Evento registrado.",
          asaasPaymentId: payment.id,
          event
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Determina novo status
    let newStatus = paymentRecord.status;
    let isConfirmedPayment = false;

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED" || payment.status === "RECEIVED" || payment.status === "CONFIRMED") {
      newStatus = "CONFIRMED";
      isConfirmedPayment = true;
    } else if (event === "PAYMENT_OVERDUE" || payment.status === "OVERDUE") {
      newStatus = "OVERDUE";
    } else if (event === "PAYMENT_REFUNDED" || payment.status === "REFUNDED") {
      newStatus = "REFUNDED";
    } else if (event === "PAYMENT_DELETED") {
      newStatus = "CANCELLED";
    }

    const dataPagamento = payment.clientPaymentDate || payment.paymentDate || new Date().toISOString();
    const valorLiquido = payment.netValue ? Number(payment.netValue) : paymentRecord.valor_liquido;

    // 6. Atualização em public.payments
    const { error: updatePayError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        valor_liquido: valorLiquido,
        data_pagamento: isConfirmedPayment ? dataPagamento : paymentRecord.data_pagamento,
        updated_date: new Date().toISOString()
      })
      .eq("id", paymentRecord.id);

    if (updatePayError) {
      console.error("[Asaas Webhook] Erro ao atualizar public.payments:", updatePayError);
    }

    // 7. Atualização do Processo Acadêmico (Matrícula)
    let academicProcess: any = null;
    let student: any = null;
    let hub: any = null;

    if (paymentRecord.academic_process_id) {
      const { data: procData } = await supabase
        .from("academic_processes")
        .select("*")
        .eq("id", paymentRecord.academic_process_id)
        .maybeSingle();

      academicProcess = procData;

      // Se o pagamento foi confirmado, garante que a matrícula está ativa para análise da secretaria
      if (isConfirmedPayment && procData) {
        await supabase
          .from("academic_processes")
          .update({
            status: "Em Analise",
            updated_date: new Date().toISOString()
          })
          .eq("id", procData.id);
      }
    }

    // Busca dados do aluno
    if (paymentRecord.student_id) {
      const { data: stuData } = await supabase
        .from("students")
        .select("*")
        .eq("id", paymentRecord.student_id)
        .maybeSingle();
      student = stuData;
    }

    // Busca dados do polo
    if (paymentRecord.hub_id) {
      const { data: hubData } = await supabase
        .from("hubs")
        .select("*")
        .eq("id", paymentRecord.hub_id)
        .maybeSingle();
      hub = hubData;
    }

    // 8. Disparo de Notificações WhatsApp via Evolution API (Apenas em pagamentos confirmados)
    let studentNotified = false;
    let poloNotified = false;

    if (isConfirmedPayment) {
      const nomeAluno = student?.nome_completo || "Aluno(a)";
      const nomeCurso = academicProcess?.nome_curso || paymentRecord.descricao || "Curso";
      const codMatricula = academicProcess?.codigo_verificacao || paymentRecord.id;
      const nomePolo = hub?.nome_exibicao || hub?.razao_social || "Matriz EduControl";
      const valorTotalFormatado = Number(paymentRecord.valor_total || payment.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const valorSplitFormatado = Number(paymentRecord.valor_split_polo || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

      // A. Notificação ao Aluno
      const studentPhone = formatWhatsAppNumber(student?.telefone);
      if (studentPhone) {
        const studentMessage = `🎓 *Confirmação de Pagamento - EduControl*

Olá, *${nomeAluno}*!
Confirmamos com sucesso o recebimento do seu pagamento referente à matrícula no curso *${nomeCurso}*.

📌 *Código de Matrícula:* \`${codMatricula}\`
💰 *Valor Pago:* R$ ${valorTotalFormatado}
🏛️ *Polo de Atendimento:* ${nomePolo}

Sua documentação já está na esteira de homologação da Secretaria Acadêmica. Em breve você receberá as instruções de acesso ao Ambiente Virtual de Aprendizagem (AVA).

Seja muito bem-vindo(a)! 🚀`;

        studentNotified = await sendWhatsAppNotification(studentPhone, studentMessage);
      }

      // B. Notificação ao Polo Parceiro
      const poloPhone = formatWhatsAppNumber(hub?.telefone);
      if (poloPhone) {
        const poloMessage = `💼 *Nova Matrícula Paga - Comissão Registrada!*

Olá, equipe *${nomePolo}*!
O pagamento da matrícula do aluno *${nomeAluno}* foi confirmado com sucesso no Asaas.

📚 *Curso:* ${nomeCurso}
💰 *Valor Total:* R$ ${valorTotalFormatado}
💸 *Sua Comissão (Split):* R$ ${valorSplitFormatado} (${paymentRecord.percentual_split_polo}%)
📱 *Contato Aluno:* ${student?.telefone || "Não informado"}

O processo foi liberado e já está em análise na Secretaria Acadêmica.`;

        poloNotified = await sendWhatsAppNotification(poloPhone, poloMessage);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event,
        paymentId: payment.id,
        recordId: paymentRecord.id,
        status: newStatus,
        notifications: {
          studentSent: studentNotified,
          poloSent: poloNotified
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Asaas Webhook] Erro interno:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno no servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
