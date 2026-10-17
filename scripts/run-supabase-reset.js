const SUPABASE_URL = 'https://yuhtzkhoxnabrsrhqdni.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function resetAssignmentsInSupabase() {
  console.log('--- Resetando atribuições no Supabase ---');
  
  // 1. Atualiza mensagens de atribuição existentes para assigned_to = null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?select=id,chat_id,text&text=like.%25ASSIGNMENT%25`, { headers });
  const msgs = await res.json();
  console.log(`Encontradas ${msgs.length} mensagens com ASSIGNMENT para zerar.`);

  for (const m of msgs) {
    const resetText = `📌 [Fila Geral / Triagem] Atendimento retornado para Fila Geral / Triagem (Zerar Carteiras).\n<!-- ASSIGNMENT:{"department":"Triagem URA","assignee":null,"assigned_to":null,"status":"ura_inedito","statusLabel":"Fila • Triagem Geral"} -->`;
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${m.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ text: resetText })
    });
    console.log(`Update ${m.id} (${m.chat_id}):`, updateRes.status);
  }

  // 2. Insere evento de reset para wa-carlos-eduardo e outros contatos principais
  const resetAudit = {
    id: `asgn_reset_${Date.now()}`,
    chat_id: 'wa-carlos-eduardo',
    sender_id: 'system',
    sender_name: 'EduChat (Sistema)',
    text: `📌 [Reset Geral de Carteiras] Todas as atribuições foram zeradas pela Gestão. Atendimento em Fila Geral.\n<!-- ASSIGNMENT:{"department":"Triagem URA","assignee":null,"assigned_to":null,"status":"ura_inedito","statusLabel":"Fila • Triagem Geral"} -->`,
    timestamp: '12:35'
  };
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(resetAudit)
  });
  console.log('Inserção de auditoria de reset geral:', insRes.status);

  // 3. Tenta update direto se houver tabela chats
  try {
    const patchChats = await fetch(`${SUPABASE_URL}/rest/v1/chats`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ assigned_to: null })
    });
    console.log('Update na tabela chats (se existir):', patchChats.status);
  } catch (e) {
    console.log('Tabela chats não disponível:', e.message);
  }
}

resetAssignmentsInSupabase();
