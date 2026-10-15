// =========================================================================
// SUPABASE EDGE FUNCTION: EVOLUTION API WEBHOOK RECEIVER
// Endpoint: /functions/v1/evolution-webhook
// =========================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Contatos pré-cadastrados do EduChat (carteira padrão)
const KNOWN_CONTACTS: Record<string, { id: string; name: string }> = {
  "5511987654321": { id: "wa-lucas-mendes", name: "Lucas Mendes (Lead MBA)" },
  "11987654321": { id: "wa-lucas-mendes", name: "Lucas Mendes (Lead MBA)" },
  "5519971234567": { id: "wa-juliana-rocha", name: "Juliana Rocha (Aluna Pós)" },
  "19971234567": { id: "wa-juliana-rocha", name: "Juliana Rocha (Aluna Pós)" },
  "5521998881122": { id: "wa-carlos-eduardo", name: "Carlos Eduardo (Contato Inédito)" },
  "21998881122": { id: "wa-carlos-eduardo", name: "Carlos Eduardo (Contato Inédito)" },
};

// Extração robusta do número de telefone real, tratando o modo LID (Linked ID) do WhatsApp
function extractCleanPhone(remoteJid: string, remoteJidAlt?: string): string {
  let target = "";
  if (remoteJidAlt && remoteJidAlt.includes("@s.whatsapp.net")) {
    target = remoteJidAlt;
  } else if (remoteJid && remoteJid.includes("@s.whatsapp.net")) {
    target = remoteJid;
  } else if (remoteJidAlt) {
    target = remoteJidAlt;
  } else {
    target = remoteJid || "";
  }

  // Remove domínio (@s.whatsapp.net, @lid, @c.us)
  const withoutDomain = target.split("@")[0] || "";
  // Remove sufixo de dispositivo do Baileys/Multi-Device (:1, :24, etc.)
  const phoneOnly = withoutDomain.split(":")[0] || "";
  // Extrai apenas os dígitos
  return phoneOnly.replace(/\D/g, "");
}

// Formatação amigável de telefone brasileiro
function formatPhone(digits: string): string {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return "+55 (" + d.slice(2, 4) + ") " + d.slice(4, 9) + "-" + d.slice(9);
  }
  if (d.length === 12 && d.startsWith("55")) {
    return "+55 (" + d.slice(2, 4) + ") " + d.slice(4, 8) + "-" + d.slice(8);
  }
  if (d.length === 11) {
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }
  if (d.length >= 10) {
    return "+" + d;
  }
  return digits;
}

// Formatação de horário oficial no fuso de São Paulo, Brasil (America/Sao_Paulo, UTC-3)
function formatSaoPauloTime(dateOrTimestamp?: any): string {
  try {
    let ms: number;
    if (!dateOrTimestamp) {
      ms = Date.now();
    } else if (dateOrTimestamp instanceof Date) {
      ms = dateOrTimestamp.getTime();
    } else if (typeof dateOrTimestamp === "number") {
      ms = dateOrTimestamp > 1e11 ? dateOrTimestamp : dateOrTimestamp * 1000;
    } else if (typeof dateOrTimestamp === "string" && !isNaN(Number(dateOrTimestamp))) {
      const num = Number(dateOrTimestamp);
      ms = num > 1e11 ? num : num * 1000;
    } else {
      const parsed = new Date(dateOrTimestamp).getTime();
      ms = isNaN(parsed) ? Date.now() : parsed;
    }

    // Offset estrito de São Paulo, Brasil: UTC-3 permanente (-3 horas = -10.800.000 ms)
    const spDate = new Date(ms - (3 * 3600 * 1000));
    const hours = String(spDate.getUTCHours()).padStart(2, "0");
    const minutes = String(spDate.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch (_e) {
    const d = new Date(Date.now() - (3 * 3600 * 1000));
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  }
}

// Normalizador universal de mensagens recebidas de qualquer formato da Evolution API v2
function extractRawMessages(body: any): any[] {
  if (!body) return [];

  // Shape 1: body.data é um array de mensagens
  if (Array.isArray(body.data)) {
    return body.data;
  }

  // Shape 2: body.data.messages é um array (Baileys notify)
  if (body.data && Array.isArray(body.data.messages)) {
    return body.data.messages;
  }

  // Shape 3: body.messages é um array
  if (Array.isArray(body.messages)) {
    return body.messages;
  }

  // Shape 4: body.data é um objeto com key ou message
  if (body.data && typeof body.data === "object" && (body.data.key || body.data.message || body.data.id)) {
    return [body.data];
  }

  // Shape 5: body diretamente é um objeto de mensagem com key ou message
  if (body.key || body.message) {
    return [body];
  }

  // Shape 6: body.data é um objeto genérico não vazio
  if (body.data && typeof body.data === "object" && Object.keys(body.data).length > 0) {
    return [body.data];
  }

  return [];
}

// Extrator universal de conteúdo textual e mídia do WhatsApp
function extractMessageContent(msg: any): { text: string; isAudio: boolean; isMedia: boolean } {
  if (!msg) return { text: "Mensagem vazia", isAudio: false, isMedia: false };

  // 1. Mensagem de texto simples
  if (typeof msg.conversation === "string" && msg.conversation.trim()) {
    return { text: msg.conversation.trim(), isAudio: false, isMedia: false };
  }

  // 2. Mensagem de texto estendida
  if (typeof msg.extendedTextMessage?.text === "string" && msg.extendedTextMessage.text.trim()) {
    return { text: msg.extendedTextMessage.text.trim(), isAudio: false, isMedia: false };
  }

  // 3. Áudio (Push-to-Talk ou arquivo de áudio)
  if (msg.audioMessage) {
    return {
      text: "🎙️ [Áudio recebido via WhatsApp]",
      isAudio: true,
      isMedia: true,
    };
  }

  // 4. Imagem
  if (msg.imageMessage) {
    const caption = (msg.imageMessage.caption || "").trim();
    return {
      text: caption ? "📷 " + caption : "📷 [Imagem recebida]",
      isAudio: false,
      isMedia: true,
    };
  }

  // 5. Vídeo
  if (msg.videoMessage) {
    const caption = (msg.videoMessage.caption || "").trim();
    return {
      text: caption ? "🎥 " + caption : "🎥 [Vídeo recebido]",
      isAudio: false,
      isMedia: true,
    };
  }

  // 6. Documento
  if (msg.documentMessage) {
    const fileName = msg.documentMessage.fileName || msg.documentMessage.title || "arquivo";
    return {
      text: "📄 [Documento: " + fileName + "]",
      isAudio: false,
      isMedia: true,
    };
  }

  // 7. Contato Compartilhado
  if (msg.contactMessage) {
    const contactName = msg.contactMessage.displayName || "Contato";
    return {
      text: "👤 [Contato compartilhado: " + contactName + "]",
      isAudio: false,
      isMedia: false,
    };
  }

  // 8. Localização
  if (msg.locationMessage) {
    return {
      text: "📍 [Localização compartilhada]",
      isAudio: false,
      isMedia: false,
    };
  }

  // 9. Respostas interativas (Botões / Listas)
  if (msg.buttonsResponseMessage?.selectedDisplayText) {
    return {
      text: msg.buttonsResponseMessage.selectedDisplayText.trim(),
      isAudio: false,
      isMedia: false,
    };
  }
  if (msg.listResponseMessage?.title) {
    return {
      text: msg.listResponseMessage.title.trim(),
      isAudio: false,
      isMedia: false,
    };
  }

  // 10. Fallbacks gerais
  if (typeof msg === "string" && msg.trim()) {
    return { text: msg.trim(), isAudio: false, isMedia: false };
  }

  return { text: "Mensagem recebida", isAudio: false, isMedia: false };
}

Deno.serve(async (req: Request) => {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Healthcheck simples via GET
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "active",
        service: "EduChat Evolution API Webhook Receiver",
        timestamp: new Date().toISOString(),
        version: "2.1",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Payload JSON inválido ou vazio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // LOGS DETALHADOS NO PAINEL DO SUPABASE (Item 2)
    // Permite inspecionar linha a linha na aba "Edge Functions -> Logs"
    // =========================================================================
    console.log("================================================================");
    console.log("📥 [Evolution Webhook] Nova requisição recebida: " + formatSaoPauloTime() + " (SP) | " + new Date().toISOString() + " (UTC)");
    console.log("🏷️ Evento bruto: " + String(body?.event) + " | Instância: " + String(body?.instance));

    const eventName = String(body?.event || "").toUpperCase();

    // Filtra eventos que não envolvam mensagem
    if (eventName.includes("CONNECTION") || eventName.includes("QRCODE")) {
      console.log("ℹ️ Evento de estado de conexão ignorado para inserção de mensagens: " + eventName);
      return new Response(
        JSON.stringify({ success: true, message: "Evento " + eventName + " recebido com sucesso." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicialização do cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://yuhtzkhoxnabrsrhqdni.supabase.co";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Extração robusta da lista de mensagens
    const rawMessages = extractRawMessages(body);
    console.log("📋 [Etapa 1] Mensagens extraídas do payload: " + rawMessages.length + " item(ns)");

    if (rawMessages.length === 0) {
      console.log("⚠️ Nenhuma mensagem identificada no pacote recebido.");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma mensagem a processar." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertedMessages: any[] = [];

    for (const m of rawMessages) {
      const keyObj = m?.key || body?.data?.key || {};
      const remoteJid = String(keyObj.remoteJid || m?.remoteJid || body?.sender || "");
      const remoteJidAlt = String(keyObj.remoteJidAlt || m?.remoteJidAlt || "");

      // Ignora broadcast e stories
      if (remoteJid.includes("broadcast") || remoteJid.includes("@status")) {
        console.log("ℹ️ Ignorando transmissão de status/story: " + remoteJid);
        continue;
      }

      const fromMe = Boolean(keyObj.fromMe ?? m?.fromMe ?? false);
      const cleanPhone = extractCleanPhone(remoteJid, remoteJidAlt);

      // Mapeamento do Chat ID
      const known = cleanPhone ? KNOWN_CONTACTS[cleanPhone] : null;
      let chatId = "";
      if (known) {
        chatId = known.id;
      } else if (cleanPhone) {
        chatId = "wa-" + cleanPhone;
      } else {
        chatId = "wa-desconhecido";
      }

      // Nome do remetente
      let senderId = "";
      let senderName = "";

      if (fromMe) {
        senderId = "u_matriz";
        senderName = "EduChat Matriz (Oficial)";
      } else {
        senderId = chatId;
        const pushName = String(m?.pushName || body?.data?.pushName || body?.pushName || "").trim();
        senderName = pushName || (known ? known.name : (cleanPhone ? "Lead " + formatPhone(cleanPhone) : "Lead WhatsApp"));
      }

      // Conteúdo da mensagem
      const content = extractMessageContent(m?.message || m);
      const messageText = content.text;

      // Horário formatado estritamente no fuso oficial de São Paulo (America/Sao_Paulo)
      const timeStr = formatSaoPauloTime(m?.messageTimestamp || body?.data?.messageTimestamp || Date.now());
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const rawId = keyObj.id || m?.id;
      const messageId = rawId ? "wa_" + String(rawId) : "wa_in_" + Date.now() + "_" + randomSuffix;

      // =========================================================================
      // LOGS DETALHADOS DE CADA ETAPA DA EXTRAÇÃO (Item 2)
      // =========================================================================
      console.log("🔍 [Etapa 2 - Extração de Identificadores]:", {
        remoteJid: remoteJid,
        remoteJidAlt: remoteJidAlt,
        cleanPhone: cleanPhone,
        chatId: chatId,
        fromMe: fromMe,
        senderName: senderName,
      });

      console.log("📝 [Etapa 3 - Conteúdo da Mensagem]:", {
        messageId: messageId,
        messageType: m?.messageType || typeof m?.message,
        messageText: messageText.length > 70 ? messageText.slice(0, 67) + "..." : messageText,
        isAudio: content.isAudio,
        isMedia: content.isMedia,
        timeFormattedSP: timeStr,
      });

      // 4. Inserção direta na tabela 'messages' do EduChat
      const insertPayload = {
        id: messageId,
        chat_id: chatId,
        sender_id: senderId,
        sender_name: senderName,
        text: messageText,
        timestamp: timeStr,
      };

      console.log("💾 [Etapa 4 - Gravando no Supabase (public.messages)]:", insertPayload);

      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert([insertPayload])
        .select();

      if (insertError) {
        console.error("❌ Erro ao gravar mensagem no Supabase:", insertError);
      } else {
        console.log("✅ [Supabase] Mensagem gravada com sucesso! ID: " + messageId + " | Chat: " + chatId);
        insertedMessages.push(inserted && inserted[0] ? inserted[0] : { id: messageId });
      }
    }

    console.log("🎉 [Etapa 5 - Conclusão]: " + insertedMessages.length + " mensagem(ns) persistida(s).");
    console.log("================================================================");

    return new Response(
      JSON.stringify({
        success: true,
        processed: rawMessages.length,
        insertedCount: insertedMessages.length,
        messages: insertedMessages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("🔥 [Evolution Webhook] Falha crítica de processamento:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Erro interno ao processar webhook.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
