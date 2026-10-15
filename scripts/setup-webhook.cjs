// Script para registrar e verificar o Webhook da Evolution API apontando para a Supabase Edge Function
const https = require('https');

const EVO_URL = process.env.VITE_EVOLUTION_API_URL || 'https://evolution-api-production-3fb2.up.railway.app';
const EVO_KEY = process.env.VITE_EVOLUTION_API_KEY || 'e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f';
const EVO_INSTANCE = process.env.VITE_EVOLUTION_INSTANCE || 'EduChat-Matriz-01';
const WEBHOOK_URL = 'https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook';

async function setupWebhook() {
  console.log('====================================================');
  console.log('🔄 Configurando Webhook na Evolution API (Railway)');
  console.log('====================================================');
  console.log('• Servidor Evolution:', EVO_URL);
  console.log('• Instância:', EVO_INSTANCE);
  console.log('• Webhook de Destino:', WEBHOOK_URL);

  const payload = {
    webhook: {
      enabled: true,
      url: WEBHOOK_URL,
      byEvents: false,
      base64: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'SEND_MESSAGE'
      ]
    }
  };

  try {
    const res = await fetch(`${EVO_URL}/webhook/set/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVO_KEY
      },
      body: JSON.stringify(payload)
    });

    console.log(`\nHTTP Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Resposta:', JSON.stringify(data, null, 2));

    if (res.ok) {
      console.log('\n✅ Webhook registrado com sucesso na Evolution API!');
      console.log('Todas as mensagens recebidas via WhatsApp serão enviadas para:');
      console.log(WEBHOOK_URL);
    } else {
      console.error('\n❌ Falha ao registrar webhook:', data);
    }

    // Consulta estado atual
    console.log('\n🔍 Verificando configuração ativa na Evolution API...');
    const findRes = await fetch(`${EVO_URL}/webhook/find/${EVO_INSTANCE}`, {
      headers: { apikey: EVO_KEY }
    });
    const findData = await findRes.json();
    console.log('Webhook ativo:', JSON.stringify(findData, null, 2));

  } catch (err) {
    console.error('Erro na requisição:', err.message);
  }
}

setupWebhook();
