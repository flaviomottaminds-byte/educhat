const SUPABASE_URL = 'https://yuhtzkhoxnabrsrhqdni.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function cleanupGhostMessages() {
  console.log('--- Iniciando limpeza de mensagens fantasmas no Supabase ---');

  // 1. Busca todas as mensagens fantasmas
  // Busca mensagens com 'Mensagem recebida'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?select=id,chat_id,text,created_at&text=like.%25Mensagem%20recebida%25`, { headers });
  const msgs = await res.json();
  console.log(`Encontradas ${msgs.length} mensagens fantasmas para exclusão.`);

  const affectedChatIds = new Set(msgs.map(m => m.chat_id).filter(Boolean));
  console.log(`Chats afetados (${affectedChatIds.size}):`, Array.from(affectedChatIds));

  // 2. Deleta as mensagens em lotes ou por filtro
  // No PostgREST, podemos deletar usando filtro na URL
  // Deleta mensagens que contenham 'Mensagem recebida'
  const deleteRes1 = await fetch(`${SUPABASE_URL}/rest/v1/messages?text=ilike.*Mensagem%20recebida*`, {
    method: 'DELETE',
    headers
  });
  console.log('DELETE com ilike *Mensagem recebida* status:', deleteRes1.status);

  // Também deleta por ID caso o ilike com wildcards varie no PostgREST
  if (msgs.length > 0) {
    const ids = msgs.map(m => m.id);
    const chunkSize = 50;
    let deletedCount = 0;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const delChunkRes = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=in.(${chunk.join(',')})`, {
        method: 'DELETE',
        headers
      });
      if (delChunkRes.ok) {
        deletedCount += chunk.length;
      }
    }
    console.log(`Deletadas ${deletedCount} mensagens por ID.`);
  }

  // 3. Verifica se sobrou alguma mensagem fantasma
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/messages?select=id&text=like.%25Mensagem%20recebida%25`, { headers });
  const remaining = await checkRes.json();
  console.log(`Mensagens fantasmas restantes no banco: ${remaining.length}`);

  // 4. Recalcula o último horário real para cada chat afetado
  console.log('--- Recalculando última mensagem real para os chats afetados ---');
  for (const chatId of affectedChatIds) {
    const chatMsgsRes = await fetch(`${SUPABASE_URL}/rest/v1/messages?chat_id=eq.${chatId}&select=id,created_at,text,timestamp&order=created_at.desc&limit=1`, { headers });
    const chatMsgs = await chatMsgsRes.json();
    if (chatMsgs && chatMsgs.length > 0) {
      const latest = chatMsgs[0];
      console.log(`Chat ${chatId}: última mensagem real em ${latest.created_at} ("${latest.text?.substring(0, 50)}")`);
    } else {
      console.log(`Chat ${chatId}: sem mensagens restantes (histórico limpo).`);
    }
  }

  console.log('✅ Limpeza concluída com sucesso!');
}

cleanupGhostMessages();
