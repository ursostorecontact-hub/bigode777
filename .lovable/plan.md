
# Flash CRMs - Plataforma Multi-Tenant Profissional

## Etapa 1: Landing Page Pública
- Hero section com "Flash CRMs - O CRM que acelera suas vendas"
- Seção de features/benefícios
- Planos de preço (Básico R$99, Pro R$199, Enterprise R$499)
- Botão "Começar agora" → registro de empresa
- Design profissional com animações (framer-motion)

## Etapa 2: Banco de Dados Multi-Tenant
- Tabela `tenants` (empresa): id, name, slug, plan, active, created_at
- Adicionar `tenant_id` em todas as tabelas existentes (leads, clients, tasks, etc.)
- Tabela `tenant_members` para vincular usuários a empresas
- RLS atualizado para isolar dados por tenant_id
- Função `current_tenant_id()` para simplificar RLS

## Etapa 3: Registro de Empresa
- Formulário: nome da empresa, slug, nome do admin, email, senha
- Cria tenant + usuário admin automaticamente
- Redirect para o workspace da empresa

## Etapa 4: Super Admin Panel (/superadmin)
- Acesso restrito ao email ursostorecontact@gmail.com
- Dashboard com estatísticas de uso (total empresas, usuários, leads)
- Lista de empresas com ações: ativar/suspender
- Visualização de dados de cada empresa

## Etapa 5: Isolamento por Workspace
- Após login, usuário acessa workspace da sua empresa
- Todos os dados filtrados por tenant_id
- Cada empresa tem seus próprios usuários, leads, pipeline, etc.

## Ordem de implementação
1. Migration do banco (tenants, tenant_members, tenant_id nas tabelas)
2. Landing page
3. Registro de empresa + login adaptado
4. Contexto de tenant no app
5. Super admin panel
