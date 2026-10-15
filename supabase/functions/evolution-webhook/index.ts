// =========================================================================
// SUPABASE EDGE FUNCTION: EVOLUTION API WEBHOOK RECEIVER
// Endpoint: /functions/v1/evolution-webhook
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Contatos conhecidos para mapeamento com as abas de demonstração do EduChat
const KNOWN_CONTACTS: Record<string, { id: string; name: string }> = {
  "5511987654321": { id: "wa-lucas-mendes", name: "Lucas Mendes (Lead MBA)" },
  "11987654321": { id: "wa-lucas-mendes", name: "Lucas Mendes (Lead MBA)" },
  "5519971234567": { id: "wa-juliana-rocha", name: "Juliana Rocha (Aluna Pós)" },
  "19971234567": { id: "wa-juliana-rocha", name: "Juliana Rocha (Aluna Pós)" },
  "5521998881122": { id: "wa-carlos-eduardo", name: "Carlos Eduardo (Contato Inédito)" },
  "21998881122": { id: "wa-carlos-eduardo", name: "Carlos Eduardo (Contato Inédito)" },
};

// Formatação amigável de telefone brasileiro
function formatPhone(digits: string): string {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length >= 10) {
    return `+${d}`;
  }
  return digits;
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
      text: caption ? `📷 ${caption}` : "📷 [Imagem recebida]",
      isAudio: false,
      isMedia: true,
    };
  }

  // 5. Vídeo
  if (msg.videoMessage) {
    const caption = (msg.videoMessage.caption || "").trim();
    return {
      text: caption ? `🎥 ${caption}` : "🎥 [Vídeo recebido]",
      isAudio: false,
      isMedia: true,
    };
  }

  // 6. Documento
  if (msg.documentMessage) {
    const fileName = msg.documentMessage.fileName || msg.documentMessage.title || "arquivo";
    return {
      text: `📄 [Documento: ${fileName}]`,
      isAudio: false,
      isMedia: true,
    };
  }

  // 7. Contato Compartilhado
  if (msg.contactMessage) {
    return {
      text: `👤 [Contato compartilhado: ${msg.contactMessage.displayName || "Contato"}]`,
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

  return { text: "Mensagem recebida", isAudio: false, isMedia: false };
}

serve(async (req: Request) => {
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();

    // =========================================================================
    // LOGS DETALHADOS NO SUPABASE EDGE LOGS (Item 3)
    // Permite inspecionar diretamente pelo Dashboard do Supabase
    // =========================================================================
    console.log("================================================================");
    console.log(`📥 [Evolution Webhook] Disparo recebido às: ${new Date().toISOString()}`);
    console.log(`🏷️ Evento: "${body?.event}" | Instância: "${body?.instance}"`);
    console.log("📦 Payload completo:", JSON.stringify(body, null, 2));

    const eventName = String(body?.event || "").toUpperCase();

    // Ignora eventos que não sejam de mensagens (ex: connection.update, qrcode.updated)
    if (eventName.includes("CONNECTION") || eventName.includes("QRCODE")) {
      console.log(`ℹ️ Evento de estado de conexão ignorado para inserção de mensagens: ${eventName}`);
      return new Response(
        JSON.stringify({ success: true, message: `Evento ${eventName} registrado com sucesso.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicialização do cliente Supabase (usando variáveis de ambiente ou fallbacks)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://yuhtzkhoxnabrsrhqdni.supabase.co";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalização da lista de mensagens
    let rawMessages: any[] = [];
    if (Array.isArray(body?.data)) {
      rawMessages = body.data;
    } else if (Array.isArray(body?.data?.messages)) {
      rawMessages = body.data.messages;
    } else if (body?.data && typeof body.data === "object") {
      rawMessages = [body.data];
    }

    if (rawMessages.length === 0) {
      console.log("⚠️ Nenhuma mensagem encontrada no pacote recebido.");
      return new Response(
        JSON.stringify({ success: true, message: "Webhook processado: Nenhuma mensagem para persistir." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertedMessages = [];

    for (const m of rawMessages) {
      const remoteJid = m?.key?.remoteJid || body?.sender || "";

      // Ignora status de broadcast/stories do WhatsApp
      if (remoteJid === "status@broadcast" || remoteJid.includes("@broadcast")) {
        console.log(`ℹ️ Ignorando transmissão de status/story: ${remoteJid}`);
        continue;
      }

      const fromMe = Boolean(m?.key?.fromMe);
      const cleanPhone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");

      // Mapeamento de chat e remetente
      const known = KNOWN_CONTACTS[cleanPhone];
      let chatId = "";
      if (known) {
        chatId = known.id;
      } else if (cleanPhone) {
        chatId = `wa-${cleanPhone}`;
      } else {
        chatId = "wa-desconhecido";
      }

      let senderId = "";
      let senderName = "";

      if (fromMe) {
        senderId = "u_matriz";
        senderName = "EduChat Matriz (Oficial)";
      } else {
        senderId = chatId;
        const pushName = (m?.pushName || body?.data?.pushName || "").trim();
        senderName = pushName || known?.name || (cleanPhone ? `Lead ${formatPhone(cleanPhone)}` : "Lead WhatsApp");
      }

      const { text, isAudio } = extractMessageContent(m?.message);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const messageId = m?.key?.id ? `wa_${m.key.id}` : `wa_in_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      console.log(`💬 Processando mensagem para Chat "${chatId}":`, {
        id: messageId,
        fromMe,
        remoteJid,
        senderName,
        textPreview: text.length > 60 ? `${text.slice(0, 57)}...` : text,
        isAudio,
      });

      // 1. Inserção na tabela 'messages' do EduChat
      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert([
          {
            id: messageId,
            chat_id: chatId,
            sender_id: senderId,
            sender_name: senderName,
            text: text,
            timestamp: timeStr,
          },
        ])
        .select();

      if (insertError) {
        console.error("❌ Erro ao inserir mensagem no Supabase:", insertError);
      } else {
        console.log(`✅ [Supabase] Mensagem ${messageId} inserida com sucesso no chat ${chatId}!`);
        insertedMessages.push(inserted?.[0] || { id: messageId });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rawMessages.length,
        insertedCount: insertedMessages.length,
        messages: insertedMessages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("🔥 [Evolution Webhook] Falha crítica de processamento:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro interno ao processar webhook.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
