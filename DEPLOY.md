# Deploy — Flash CRMs

## Pré-requisito: aplicar migrations no Supabase SQL Editor

Antes de deployar, execute os dois arquivos SQL no **Supabase SQL Editor** (projeto `wdgmmmbctqrubrxnmtsf`), **nesta ordem**:

1. `supabase/migrations/20260525120000_whatsapp_complete.sql`
2. `supabase/migrations/20260525130000_health_check_cron.sql`

> **Atenção:** verifique se a extensão `pg_net` está habilitada no projeto antes de rodar a segunda migration. Caso o cron use `net.http_post` ao invés de `extensions.http_post`, ajuste o SQL conforme necessário.

## Comando único de deploy (rodar no VPS)

```bash
cd /var/www/flashcrms && git stash && git pull origin main && npm install && npm run build && cp -r dist/* . && systemctl reload nginx && export SUPABASE_ACCESS_TOKEN=sbp_acea424a6562d5addfb2ad3f198ef001feb8e2dd && supabase functions deploy whatsapp-webhook --project-ref wdgmmmbctqrubrxnmtsf --no-verify-jwt && supabase functions deploy whatsapp-qrcode --project-ref wdgmmmbctqrubrxnmtsf --no-verify-jwt && supabase functions deploy whatsapp-health-check --project-ref wdgmmmbctqrubrxnmtsf --no-verify-jwt && supabase functions deploy whatsapp-send-media --project-ref wdgmmmbctqrubrxnmtsf --no-verify-jwt && supabase functions deploy whatsapp-sync-groups --project-ref wdgmmmbctqrubrxnmtsf --no-verify-jwt && echo "✅ TUDO DEPLOYADO!"
```

## O que este deploy faz

1. Descarta alterações locais no VPS e puxa o `main` atualizado
2. Instala dependências e gera o build de produção
3. Copia o build para a raiz do nginx e recarrega o servidor
4. Deploya as 4 Edge Functions no Supabase:
   - `whatsapp-webhook` — recebe eventos do Evolution API (mensagens, grupos, contatos, mídia)
   - `whatsapp-qrcode` — gera QR, cria instância e registra webhook com retry
   - `whatsapp-health-check` — self-healing agendado via pg_cron a cada 5 min
   - `whatsapp-send-media` — envia mensagens com mídia (imagem, vídeo, áudio, documento)
   - `whatsapp-sync-groups` — sincroniza nomes reais dos grupos via Evolution API
