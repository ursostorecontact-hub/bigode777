
## Sistema de Distribuição WhatsApp + Leads

### 1. Banco de Dados
- Tabela `whatsapp_instances`: adicionar suporte a múltiplos números conectados via Evolution API (já existe, será adaptada)
- Nova tabela `whatsapp_assignments`: vincula vendedores a números de WhatsApp com porcentagem de distribuição
  - `whatsapp_instance_id` → qual número
  - `user_id` → qual vendedor
  - `percentage` → % de leads que esse vendedor recebe nesse número (ex: 30%)
  - Um número pode ter vários vendedores; um vendedor pode estar em vários números

### 2. Página WhatsApp (Admin)
- Conectar múltiplos números via QR Code (cada um é uma instância na Evolution API)
- Para cada número conectado:
  - Ver status (conectado/desconectado)
  - Atribuir vendedores com slider de porcentagem (como já existe na página de Distribuição)
  - Validação: porcentagens somam 100% por número
- Opção de desconectar/reconectar cada número

### 3. Integração com Distribuição de Leads
- Na página de Distribuição existente, exibir qual número WhatsApp está vinculado a cada vendedor
- Quando um lead chega por WhatsApp, o sistema distribui automaticamente ao vendedor correto baseado na porcentagem configurada

### 4. Envio de Mensagens
- Quando vendedor envia mensagem a um lead, usa o número de WhatsApp ao qual está vinculado
- Se o vendedor está em mais de um número, usa o número pelo qual o lead chegou

### Ordem de implementação
1. Migration do banco (tabela `whatsapp_assignments`)
2. Edge function para gerenciar múltiplas instâncias
3. UI da página WhatsApp com gestão de números e atribuições
4. Integração com página de Distribuição
