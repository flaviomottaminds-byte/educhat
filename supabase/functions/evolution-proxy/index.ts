// =========================================================================
// SUPABASE EDGE FUNCTION: EVOLUTION API PROXY (CORS Bypass & QR Code Handler)
// Endpoint: /functions/v1/evolution-proxy
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface ProxyPayload {
  action?: "connect" | "logout" | "status" | "restart";
  apiUrl?: string;
  instanceName?: string;
  apiKey?: string;
}

function extractBase64(data: any): string | null {
  if (!data) return null;

  if (typeof data === "object") {
    const candidate =
      data.base64 ||
      (typeof data.qrcode === "string" ? data.qrcode : null) ||
      data.qrcode?.base64 ||
      data.instance?.qrcode?.base64 ||
      data.instance?.base64 ||
      (Array.isArray(data) && (data[0]?.base64 || data[0]?.qrcode?.base64 || (typeof data[0] === "string" ? data[0] : null)));

    if (candidate && typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.startsWith("data:image/")) return trimmed;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return `data:image/png;base64,${trimmed.replace(/\s/g, "")}`;
    }
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractBase64(parsed);
      } catch {}
    }
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.startsWith("iVBORw0KGgo") || trimmed.length > 250) {
      return `data:image/png;base64,${trimmed.replace(/\s/g, "")}`;
    }
  }

  return null;
}

serve(async (req: Request) => {
  // 1. Tratamento de Preflight CORS do Navegador
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let payload: ProxyPayload = {};
    if (req.method === "POST" || req.method === "PUT") {
      try {
        payload = await req.json();
      } catch {
        payload = {};
      }
    } else {
      const url = new URL(req.url);
      payload = {
        action: (url.searchParams.get("action") as any) || "connect",
        apiUrl: url.searchParams.get("apiUrl") || undefined,
        instanceName: url.searchParams.get("instanceName") || undefined,
        apiKey: url.searchParams.get("apiKey") || undefined,
      };
    }

    const envApiUrl = Deno.env.get("EVOLUTION_API_URL") || Deno.env.get("VITE_EVOLUTION_API_URL") || "";
    const envApiKey = Deno.env.get("EVOLUTION_API_KEY") || Deno.env.get("VITE_EVOLUTION_API_KEY") || "";
    const envInstance = Deno.env.get("EVOLUTION_INSTANCE") || Deno.env.get("VITE_EVOLUTION_INSTANCE") || "EduChat-Matriz-01";

    const apiUrl = (payload.apiUrl || envApiUrl || "").replace(/\/+$/, "");
    const instanceName = (payload.instanceName || envInstance || "").trim();
    const apiKey = (payload.apiKey || envApiKey || "").trim();
    const action = payload.action || "connect";

    if (!apiUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "URL da Evolution API não configurada. Defina a variável VITE_EVOLUTION_API_URL ou informe a URL no formulário.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!instanceName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nome da instância da Evolution API não informado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evoHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      evoHeaders["apikey"] = apiKey;
    }

    // 2. Ação: Logout da Instância (Reset de socket fantasma)
    if (action === "logout") {
      const logoutUrl = `${apiUrl}/instance/logout/${instanceName}`;
      let logoutRes: Response;
      try {
        logoutRes = await fetch(logoutUrl, { method: "DELETE", headers: evoHeaders });
      } catch {
        logoutRes = await fetch(logoutUrl, { method: "POST", headers: evoHeaders });
      }

      let logoutData = null;
      try {
        logoutData = await logoutRes.json();
      } catch {}

      return new Response(
        JSON.stringify({
          success: logoutRes.ok,
          status: logoutRes.status,
          message: logoutRes.ok
            ? `Instância "${instanceName}" desconectada com sucesso`
            : `Resposta do logout da instância: ${logoutRes.status}`,
          data: logoutData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Ação: Status da Conexão
    if (action === "status") {
      const stateUrl = `${apiUrl}/instance/connectionState/${instanceName}`;
      const stateRes = await fetch(stateUrl, { method: "GET", headers: evoHeaders });
      let stateData = null;
      try {
        stateData = await stateRes.json();
      } catch {}

      return new Response(
        JSON.stringify({
          success: stateRes.ok,
          status: stateRes.status,
          data: stateData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Ação: Conectar / Obter QR Code (action === 'connect')
    const connectUrl = `${apiUrl}/instance/connect/${instanceName}`;
    const evoResponse = await fetch(connectUrl, { method: "GET", headers: evoHeaders });

    if (!evoResponse.ok) {
      const errText = await evoResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          status: evoResponse.status,
          statusText: evoResponse.statusText,
          error: `Evolution API retornou status ${evoResponse.status}: ${errText || evoResponse.statusText}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evoData = await evoResponse.json();
    const base64Image = extractBase64(evoData);

    let pairingCode: string | null = null;
    if (typeof evoData === "object" && evoData) {
      pairingCode = evoData.pairingCode || evoData.qrcode?.pairingCode || null;
    }

    let rawCode: string | null = null;
    if (typeof evoData === "object" && evoData) {
      rawCode = evoData.code || evoData.qrcode?.code || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        instance: instanceName,
        base64: base64Image,
        pairingCode,
        code: rawCode,
        data: evoData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Falha na requisição para Evolution API via Edge Function: ${err.message}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
