## Plano: Aba de Integrações (Admin)

### 1. Banco de dados
- Tabela `whatsapp_instances` — armazena instâncias conectadas (nome, URL da Evolution, API key, nome da instância, status)
- Tabela `facebook_webhooks` — armazena config do webhook do Facebook (verify_token, page_name, ativo)
- RLS: apenas admins podem gerenciar

### 2. Edge Functions
- `whatsapp-qrcode` — chama a Evolution API para criar instância e retornar QR Code
- `facebook-webhook` — recebe leads do Facebook Lead Ads e insere na tabela `leads`

### 3. Página de Integrações (`/integracoes`)
- **Seção WhatsApp**: Configurar URL da Evolution API + API Key, criar instâncias, escanear QR Code, ver status de conexão, enviar mensagem de teste
- **Seção Facebook**: Gerar URL de webhook + token de verificação, instruções para configurar no Facebook Business

### 4. Sidebar
- Adicionar link "Integrações" visível apenas para admins

### 5. Fluxo WhatsApp QR Code
1. Admin configura URL + API Key da Evolution API
2. Clica "Adicionar Número" → cria instância na Evolution
3. Sistema exibe QR Code → admin escaneia com WhatsApp
4. Instância fica "connected" → pode enviar mensagens por ela
