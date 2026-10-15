// Script de teste local para simular o recebimento de mensagem WhatsApp da Evolution API
const supabaseUrl = 'https://yuhtzkhoxnabrsrhqdni.supabase.co';
const supabaseKey = 'sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp';

async function testSimulatedWebhook() {
  console.log('🧪 Testando inserção direta de mensagem WhatsApp no Supabase...');

  const incomingPayload = {
    event: 'messages.upsert',
    instance: 'EduChat-Matriz-01',
    data: {
      key: {
        remoteJid: '5511999998888@s.whatsapp.net',
        fromMe: false,
        id: 'SIMULATED_TEST_' + Date.now()
      },
      pushName: 'Cliente Teste WhatsApp',
      message: {
        conversation: 'Olá EduChat, gostaria de saber informações sobre o curso!'
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };

  const remoteJid = incomingPayload.data.key.remoteJid;
  const cleanPhone = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
  const chatId = `wa-${cleanPhone}`;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const messageRecord = {
    id: 'wa_' + incomingPayload.data.key.id,
    chat_id: chatId,
    sender_id: chatId,
    sender_name: incomingPayload.data.pushName,
    text: incomingPayload.data.message.conversation,
    timestamp: timeStr
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(messageRecord)
  });

  console.log(`Status do Supabase: ${res.status}`);
  const result = await res.json();
  console.log('Mensagem gravada com sucesso:', JSON.stringify(result, null, 2));

  // Limpeza do teste para não poluir
  if (res.ok && result[0]?.id) {
    await fetch(`${supabaseUrl}/rest/v1/messages?id=eq.${result[0].id}`, {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });
    console.log('🧹 Mensagem de teste removida após validação.');
  }
}

testSimulatedWebhook();
