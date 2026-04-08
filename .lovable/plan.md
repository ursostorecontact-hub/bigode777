
## Chat WhatsApp Integrado ao App

### O que será construído
Um módulo de conversas WhatsApp completo dentro do aplicativo, onde os vendedores podem conversar com seus leads sem sair da plataforma.

### Funcionalidades por fase

#### Fase 1 — Chat de texto básico (prioridade)
- **Tela de conversas**: Lista de chats à esquerda, conversa aberta à direita (estilo WhatsApp Web)
- **Enviar e receber mensagens de texto** via Evolution API
- **Webhook para receber mensagens** em tempo real (Evolution API → Edge Function → banco → Realtime)
- **Tabelas no banco**: `whatsapp_messages` (remetente, destinatário, conteúdo, timestamp, status) e `whatsapp_chats` (último contato, última mensagem)
- **Vendedor vê apenas seus leads** (RLS baseado em `assigned_to`)

#### Fase 2 — Mídia e áudio
- **Enviar/receber áudio** (gravação no navegador + envio via API)
- **Enviar/receber imagens, vídeos e documentos**
- **Storage** para armazenar mídias recebidas
- **Preview de mídia** na conversa

#### Fase 3 — Funcionalidades avançadas
- **Status de mensagem** (enviado, entregue, lido — via webhook `MESSAGES_UPDATE`)
- **Contatos** — salvar/visualizar contatos do WhatsApp
- **Chamadas** — iniciar chamada via link `tel:` ou integração
- **Indicador de digitando** (typing)
- **Notificações** no app quando chega mensagem

### Infraestrutura necessária
1. **Edge Function `whatsapp-webhook`** — recebe eventos da Evolution API (mensagens recebidas, status updates)
2. **Tabelas**: `whatsapp_messages`, `whatsapp_chats` com Realtime habilitado
3. **Edge Function `whatsapp-send`** — envia mensagens via Evolution API
4. **RLS** — vendedores veem apenas conversas dos seus leads

### Ordem de implementação
1. Criar tabelas `whatsapp_chats` e `whatsapp_messages` com RLS
2. Edge Function para receber webhooks da Evolution API
3. Edge Function para enviar mensagens
4. UI do chat (lista de conversas + área de mensagens)
5. Configurar webhook na Evolution API apontando para nossa Edge Function

### Observações
- A página `/whatsapp` atual (admin) continua para gestão de números e distribuição
- Nova rota `/conversas` acessível a todos os vendedores
- O vendedor usa o número de WhatsApp ao qual está vinculado para enviar mensagens
