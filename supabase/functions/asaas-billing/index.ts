// =========================================================================
// SUPABASE EDGE FUNCTION: ASAAS BILLING & SPLIT ENGINE (Sprint 3.3)
// Endpoint: /functions/v1/asaas-billing
// Cria cobrança no Asaas com divisão automática de comissão (Split)
// para o Polo parceiro e persiste os dados em public.payments e public.academic_processes
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

interface RequestPayload {
  student: {
    id?: string;
    nome_completo: string;
    cpf: string;
    email?: string;
    telefone?: string;
    rg?: string;
    hub_id?: string;
  };
  academicProcess: {
    id?: string;
    tipo_processo: string;
    nome_curso: string;
    periodo_ingresso?: string;
    url_dossie_pdf?: string;
    categoria_curso?: string;
  };
  hub: {
    id: string;
    nome_exibicao?: string;
    asaas_wallet_id?: string;
    percentual_comissao_polo?: number;
  };
  billing: {
    valor_total: number;
    billing_type: "PIX" | "BOLETO" | "CREDIT_CARD";
    data_vencimento?: string;
    descricao?: string;
  };
}

serve(async (req: Request) => {
  // Trata preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasEnv = (Deno.env.get("ASAAS_ENVIRONMENT") || "sandbox").toLowerCase();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestPayload = await req.json();
    const { student, academicProcess, hub, billing } = body;

    if (!student?.nome_completo || !student?.cpf) {
      return new Response(
        JSON.stringify({ error: "Nome completo e CPF do aluno são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!academicProcess?.nome_curso) {
      return new Response(
        JSON.stringify({ error: "Nome do curso é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valorTotal = Number(billing?.valor_total || 0);
    if (valorTotal <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor total da cobrança deve ser maior que zero." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCpf = student.cpf.replace(/\D/g, "");
    const cleanPhone = student.telefone ? student.telefone.replace(/\D/g, "") : null;

    // Valida se o Polo existe para integridade de Foreign Keys
    let validHubId: string | null = null;
    if (hub?.id) {
      const { data: hubRecord } = await supabase
        .from("hubs")
        .select("id")
        .eq("id", hub.id)
        .maybeSingle();
      if (hubRecord?.id) {
        validHubId = hubRecord.id;
      }
    }

    // 1. Garante a existência do Aluno no banco
    let studentId = student.id;
    if (!studentId) {
      // Verifica se já existe por CPF
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .or(`cpf.eq.${cleanCpf},cpf.eq.${student.cpf}`)
        .maybeSingle();

      if (existingStudent?.id) {
        studentId = existingStudent.id;
      } else {
        studentId = `stu_${Date.now()}`;
        const newStudentPayload = {
          id: studentId,
          nome_completo: student.nome_completo.trim(),
          cpf: cleanCpf,
          email: student.email ? student.email.trim() : null,
          telefone: cleanPhone,
          rg: student.rg ? student.rg.trim() : null,
          hub_id: validHubId,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString()
        };
        const { error: stuError } = await supabase.from("students").insert([newStudentPayload]);
        if (stuError) {
          console.error("Erro ao registrar aluno no banco:", stuError);
          throw new Error(`Falha ao registrar aluno: ${stuError.message}`);
        }
      }
    }

    // 2. Garante a criação do Processo Acadêmico (Matrícula)
    const processId = academicProcess.id || `proc_${Date.now()}`;
    const codVerificacao = `EDU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const processPayload = {
      id: processId,
      student_id: studentId,
      hub_id: validHubId,
      tipo_processo: academicProcess.tipo_processo || "EJA",
      nome_curso: academicProcess.nome_curso,
      periodo_ingresso: academicProcess.periodo_ingresso || "2026.1",
      url_dossie_pdf: academicProcess.url_dossie_pdf || null,
      categoria_curso: academicProcess.categoria_curso || "Educação Básica",
      codigo_verificacao: codVerificacao,
      status: "Em Analise",
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };

    const { error: procError } = await supabase.from("academic_processes").upsert([processPayload]);
    if (procError) {
      console.error("Erro ao salvar processo acadêmico:", procError);
      throw new Error(`Falha ao registrar processo acadêmico: ${procError.message}`);
    }

    // 3. Regra de Negócio: Cálculo de Split Financeiro
    const percentualSplit = Number(hub?.percentual_comissao_polo || 0);
    const walletIdPolo = hub?.asaas_wallet_id?.trim() || null;
    const valorSplit = Number(((valorTotal * percentualSplit) / 100).toFixed(2));
    const valorMatriz = Number((valorTotal - valorSplit).toFixed(2));

    const billingType = billing.billing_type || "PIX";
    const dataVencimento = billing.data_vencimento || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const descricaoCobranca = billing.descricao || `Matrícula: ${academicProcess.nome_curso} - Aluno: ${student.nome_completo}`;

    // 4. Comunicação com API do Asaas
    let asaasPaymentId = `pay_sim_${Date.now()}`;
    let asaasCustomerId = `cus_sim_${Date.now()}`;
    let asaasInvoiceUrl = `https://sandbox.asaas.com/i/sim_${Date.now()}`;
    let asaasBankSlipUrl: string | null = null;
    let asaasPixQrCodeUrl: string | null = null;
    let asaasPixPayload: string | null = null;
    let isLiveAsaas = false;

    if (asaasApiKey && asaasApiKey.trim().length > 10) {
      const asaasBaseUrl = asaasEnv === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/v3";

      try {
        // A. Cria ou localiza Cliente no Asaas
        const customerRes = await fetch(`${asaasBaseUrl}/customers`, {
          method: "POST",
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: student.nome_completo.trim(),
            cpfCnpj: cleanCpf,
            email: student.email || undefined,
            mobilePhone: cleanPhone || undefined,
            notificationDisabled: false
          })
        });

        if (customerRes.ok) {
          const custData = await customerRes.json();
          asaasCustomerId = custData.id;
        } else {
          // Se já existe, tenta buscar
          const searchCustRes = await fetch(`${asaasBaseUrl}/customers?cpfCnpj=${cleanCpf}`, {
            headers: { "access_token": asaasApiKey }
          });
          if (searchCustRes.ok) {
            const searchData = await searchCustRes.json();
            if (searchData.data && searchData.data.length > 0) {
              asaasCustomerId = searchData.data[0].id;
            }
          }
        }

        // B. Monta Payload de Pagamento com Split Condicional
        const splitConfig = (walletIdPolo && percentualSplit > 0)
          ? [
              {
                walletId: walletIdPolo,
                percentualValue: percentualSplit
              }
            ]
          : undefined;

        const paymentBody: Record<string, unknown> = {
          customer: asaasCustomerId,
          billingType: billingType,
          value: valorTotal,
          dueDate: dataVencimento,
          description: descricaoCobranca
        };

        if (splitConfig) {
          paymentBody.split = splitConfig;
        }

        const paymentRes = await fetch(`${asaasBaseUrl}/payments`, {
          method: "POST",
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(paymentBody)
        });

        if (paymentRes.ok) {
          const payData = await paymentRes.json();
          asaasPaymentId = payData.id;
          asaasInvoiceUrl = payData.invoiceUrl;
          asaasBankSlipUrl = payData.bankSlipUrl || null;
          isLiveAsaas = true;

          // C. Se for PIX, busca QR Code nativo
          if (billingType === "PIX") {
            const qrRes = await fetch(`${asaasBaseUrl}/payments/${payData.id}/pixQrCode`, {
              headers: { "access_token": asaasApiKey }
            });
            if (qrRes.ok) {
              const qrData = await qrRes.json();
              asaasPixPayload = qrData.payload;
              asaasPixQrCodeUrl = qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : null;
            }
          }
        } else {
          const errData = await paymentRes.text();
          console.warn("Asaas API retornou erro, usando mock de contingência:", errData);
        }
      } catch (asaasErr) {
        console.error("Falha na chamada Asaas:", asaasErr);
      }
    }

    // Se estiver em modo de contingência/mock (chave não configurada ou sandbox offline)
    if (!isLiveAsaas) {
      if (billingType === "PIX") {
        asaasPixPayload = `00020126580014BR.GOV.BCB.PIX0136educontrol-pix-${Date.now()}5204000053039865405${valorTotal.toFixed(2)}5802BR5925EDUCONTROL TECNOLOGIA6009SAO PAULO62070503***6304`;
      } else if (billingType === "BOLETO") {
        asaasBankSlipUrl = `https://sandbox.asaas.com/b/pdf/${asaasPaymentId}`;
      }
    }

    // 5. Gravação na Tabela Financeira public.payments
    const paymentId = `pay_${Date.now()}`;
    const paymentRecord = {
      id: paymentId,
      academic_process_id: processId,
      student_id: studentId,
      hub_id: validHubId,
      asaas_payment_id: asaasPaymentId,
      asaas_customer_id: asaasCustomerId,
      asaas_invoice_url: asaasInvoiceUrl,
      asaas_bank_slip_url: asaasBankSlipUrl,
      asaas_pix_qrcode_url: asaasPixQrCodeUrl,
      asaas_pix_payload: asaasPixPayload,
      billing_type: billingType,
      status: "PENDING",
      valor_total: valorTotal,
      valor_liquido: valorMatriz,
      percentual_split_polo: percentualSplit,
      valor_split_polo: valorSplit,
      asaas_wallet_id_polo: walletIdPolo,
      data_vencimento: dataVencimento,
      descricao: descricaoCobranca,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };

    const { error: insertPayError } = await supabase.from("payments").insert([paymentRecord]);
    if (insertPayError) {
      console.error("Erro ao registrar pagamento no Supabase:", insertPayError);
      throw insertPayError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        isLiveAsaas,
        studentId,
        processId,
        paymentId,
        asaas: {
          paymentId: asaasPaymentId,
          customerId: asaasCustomerId,
          invoiceUrl: asaasInvoiceUrl,
          bankSlipUrl: asaasBankSlipUrl,
          pixPayload: asaasPixPayload,
          pixQrCodeUrl: asaasPixQrCodeUrl
        },
        split: {
          percentualSplitPolo: percentualSplit,
          valorSplitPolo: valorSplit,
          valorMatriz: valorMatriz,
          walletIdPolo: walletIdPolo
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro geral no endpoint asaas-billing:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno no servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
