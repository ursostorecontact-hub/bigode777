/**
 * import-messages-30d.mjs
 *
 * Importa mensagens dos últimos 30 dias da Evolution API (rodando localmente)
 * e insere no Supabase Cloud com o tenant_id correto.
 *
 * Pré-requisitos:
 *   - Node.js >= 18  (ou Bun)
 *   - Evolution API rodando em EVOLUTION_URL
 *   - Preencha as 4 constantes abaixo antes de rodar
 *
 * Uso:
 *   node scripts/import-messages-30d.mjs
 *   # ou
 *   bun scripts/import-messages-30d.mjs
 */

// ──────────────────────────────────────────────
// CONFIGURE AQUI
// ──────────────────────────────────────────────
const EVOLUTION_URL     = 'http://localhost:64644';
const EVOLUTION_API_KEY = 'bigodao77chave';
const INSTANCE_NAME     = 'nova-empresa-pro';

const SUPABASE_URL          = 'https://wdgmmmbctqrubrxnmtsf.supabase.co';
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';  // passe via env
const TENANT_ID             = '0c1ee0e7-205d-44ac-b19e-c1a66ae14df4';
// ──────────────────────────────────────────────

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌  Defina SUPABASE_SERVICE_KEY no ambiente:');
  console.error('   SUPABASE_SERVICE_KEY=xxx node scripts/import-messages-30d.mjs');
  process.exit(1);
}

const DAYS = 30;
const SINCE_TS = Math.floor(Date.now() / 1000) - DAYS * 86400; // Unix epoch seconds
const MESSAGES_PER_CHAT = 200; // máximo por conversa — ajuste se necessário
const BATCH_SIZE = 50;         // inserts em lote para o Supabase

// ── helpers ──

async function evo(path, opts = {}) {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY, ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Evolution ${path} → ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function sbRest(path, body, method = 'POST') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.ok;
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path} → ${res.status}`);
  return res.json();
}

function extractContent(msg) {
  const m = msg.message || {};
  if (m.conversation)                  return { content: m.conversation, messageType: 'text', mediaUrl: null };
  if (m.extendedTextMessage?.text)     return { content: m.extendedTextMessage.text, messageType: 'text', mediaUrl: null };
  if (m.imageMessage)   return { content: m.imageMessage.caption || '📷 Imagem', messageType: 'image', mediaUrl: m.imageMessage.url || null };
  if (m.audioMessage)   return { content: '🎵 Áudio', messageType: 'audio', mediaUrl: m.audioMessage.url || null };
  if (m.videoMessage)   return { content: m.videoMessage.caption || '🎥 Vídeo', messageType: 'video', mediaUrl: m.videoMessage.url || null };
  if (m.documentMessage) return { content: m.documentMessage.fileName || '📄 Documento', messageType: 'document', mediaUrl: m.documentMessage.url || null };
  if (m.stickerMessage) return { content: '🎨 Sticker', messageType: 'sticker', mediaUrl: null };
  return { content: 'Mensagem não suportada', messageType: 'text', mediaUrl: null };
}

async function insertBatch(rows) {
  if (rows.length === 0) return;
  await sbRest('whatsapp_messages', rows);
}

// ── main ──

async function main() {
  console.log(`\n🚀 Iniciando importação — últimos ${DAYS} dias (desde ${new Date(SINCE_TS * 1000).toISOString()})\n`);

  // 1. Buscar instance_id no banco
  const instances = await sbGet(
    `whatsapp_instances?instance_name=eq.${encodeURIComponent(INSTANCE_NAME)}&select=id,tenant_id&limit=1`
  );
  if (!instances.length) {
    console.error(`❌  Instância "${INSTANCE_NAME}" não encontrada no banco.`);
    process.exit(1);
  }
  const instanceId = instances[0].id;
  const tenantId   = instances[0].tenant_id || TENANT_ID;
  console.log(`✅  Instância encontrada: ${instanceId} | tenant: ${tenantId}\n`);

  // 2. Buscar todos os chats da Evolution API
  console.log('📋 Buscando chats da Evolution API...');
  let chats = [];
  try {
    const res = await evo(`/chat/findChats/${INSTANCE_NAME}`, { method: 'POST', body: '{}' });
    chats = Array.isArray(res) ? res : (res?.chats || res?.data || []);
  } catch (e) {
    console.error('❌  Erro ao buscar chats:', e.message);
    process.exit(1);
  }

  // Filtrar apenas contatos individuais (não grupos, não broadcasts)
  chats = chats.filter(c => {
    const jid = c.remoteJid || '';
    return jid.includes('@') && !jid.includes('@g.us') && jid !== 'status@broadcast';
  });

  console.log(`   ${chats.length} conversas individuais encontradas\n`);

  let totalMessages = 0;
  let totalChats    = 0;
  let skippedChats  = 0;

  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i];
    const remoteJid   = chat.remoteJid || '';
    const contactPhone = remoteJid.split('@')[0];
    const contactName  = chat.pushName || chat.name || contactPhone;

    process.stdout.write(`\r[${i + 1}/${chats.length}] ${remoteJid.slice(0, 40).padEnd(40)} | chats: ${totalChats} | msgs: ${totalMessages}`);

    // 3. Upsert chat no banco com tenant_id
    let chatRow;
    try {
      await sbRest('whatsapp_chats', {
        whatsapp_instance_id: instanceId,
        tenant_id: tenantId,
        remote_jid: remoteJid,
        contact_name: contactName,
        contact_phone: contactPhone,
        last_message: chat.lastMessage?.message?.conversation ||
          chat.lastMessage?.message?.extendedTextMessage?.text || '',
        last_message_at: chat.lastMessage?.messageTimestamp
          ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString(),
        unread_count: chat.unreadCount || 0,
      });

      // Buscar o id do chat inserido
      const rows = await sbGet(
        `whatsapp_chats?whatsapp_instance_id=eq.${instanceId}&remote_jid=eq.${encodeURIComponent(remoteJid)}&select=id&limit=1`
      );
      chatRow = rows[0];
    } catch (e) {
      console.error(`\n⚠️  Chat upsert error (${remoteJid}):`, e.message);
      skippedChats++;
      continue;
    }

    if (!chatRow) { skippedChats++; continue; }
    totalChats++;

    // 4. Buscar mensagens da Evolution API
    let messages = [];
    try {
      const res = await evo(`/chat/findMessages/${INSTANCE_NAME}`, {
        method: 'POST',
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: MESSAGES_PER_CHAT,
        }),
      });

      // Suporte a vários formatos de resposta
      if (Array.isArray(res)) messages = res;
      else if (res?.messages?.records) messages = res.messages.records;
      else if (Array.isArray(res?.messages)) messages = res.messages;
      else if (Array.isArray(res?.data)) messages = res.data;
      else if (Array.isArray(res?.records)) messages = res.records;
    } catch (e) {
      // Silencia erros de mensagem — continua para o próximo chat
      continue;
    }

    // Filtrar pelos últimos 30 dias
    const recent = messages.filter(m => {
      const ts = Number(m.messageTimestamp || m.key?.fromMe != null ? m.messageTimestamp : 0);
      return ts >= SINCE_TS;
    });

    if (recent.length === 0) continue;

    // 5. Buscar IDs já existentes para não duplicar
    let existingIds = new Set();
    try {
      const msgIds = recent.map(m => m.key?.id).filter(Boolean);
      if (msgIds.length > 0) {
        // Supabase REST: in filter
        const inClause = `evolution_message_id=in.(${msgIds.map(id => `"${id}"`).join(',')})`;
        const existing = await sbGet(`whatsapp_messages?${inClause}&select=evolution_message_id`);
        existingIds = new Set(existing.map(r => r.evolution_message_id));
      }
    } catch (_) { /* continua mesmo sem dedup */ }

    // Construir rows para inserção
    const rows = [];
    for (const msg of recent) {
      const key       = msg.key || {};
      const messageId = key.id || msg.id || '';
      if (!messageId || existingIds.has(messageId)) continue;

      const fromMe  = key.fromMe ?? false;
      const { content, messageType, mediaUrl } = extractContent(msg);
      const ts = Number(msg.messageTimestamp);
      const createdAt = ts >= SINCE_TS ? new Date(ts * 1000).toISOString() : new Date().toISOString();

      rows.push({
        chat_id: chatRow.id,
        tenant_id: tenantId,
        from_me: fromMe,
        remote_jid: remoteJid,
        message_type: messageType,
        content,
        media_url: mediaUrl,
        status: fromMe ? 'sent' : 'received',
        evolution_message_id: messageId,
        created_at: createdAt,
      });
    }

    // 6. Inserir em lotes
    for (let b = 0; b < rows.length; b += BATCH_SIZE) {
      const batch = rows.slice(b, b + BATCH_SIZE);
      try {
        await insertBatch(batch);
        totalMessages += batch.length;
      } catch (e) {
        console.error(`\n⚠️  Batch insert error (${remoteJid}):`, e.message);
      }
    }
  }

  console.log(`\n\n✅  Importação concluída!`);
  console.log(`   Conversas processadas : ${totalChats}`);
  console.log(`   Conversas com erro    : ${skippedChats}`);
  console.log(`   Mensagens importadas  : ${totalMessages}`);
  console.log(`   Período               : últimos ${DAYS} dias\n`);
}

main().catch(e => {
  console.error('\n💥 Erro fatal:', e.message);
  process.exit(1);
});
