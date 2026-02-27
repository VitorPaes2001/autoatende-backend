# Inbox v1 Rollout

## Escopo desta release
- API protegida de Inbox:
  - `GET /api/inbox/conversations`
  - `GET /api/inbox/conversations/:id/messages`
  - `POST /api/inbox/conversations/:id/messages`
  - `POST /api/inbox/conversations/:id/assign`
  - `POST /api/inbox/conversations/:id/mode`
- Webhook WhatsApp (Cloud API):
  - resolve `company_id` por `phone_number_id` (com fallback legado)
  - upsert de conversa inbound
  - persistência de mensagem inbound
  - ACK 200 imediato com processamento assíncrono
- Frontend admin: página `/inbox` com lista, busca, thread e envio.

## Pré-checks
1. Confirmar variáveis de ambiente backend (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
2. Confirmar que tabelas `public.conversations` e `public.messages` já existem em produção.
3. Não executar SQL manual desta release no banco (migrations são apenas versionamento).

## Deploy Backend (Docker Compose)
```bash
cd /opt/autoatende
git pull origin main
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs -f whatsapp-api
```

## Build/Publish Frontend Admin
```bash
cd /opt/autoatende/frontend-admin
npm ci
npm run build
```

Publicação do build depende da estratégia do ambiente (ex.: upload para bucket/CDN ou cópia para host web do painel).

## Validação funcional
1. Validar healthcheck:
```bash
curl -i http://localhost:3000/api/health
```

2. Validar endpoints Inbox com JWT:
```bash
cd /opt/autoatende
BASE_URL=http://localhost:3000 JWT_TOKEN='<jwt>' ./scripts/verify_inbox.sh
```

3. Validar webhook inbound:
- Enviar mensagem real para o número conectado da Cloud API.
- Confirmar logs sem erro crítico em `whatsapp-api`.
- Confirmar criação/atualização da conversa em `conversations`.
- Confirmar inserção da mensagem inbound em `messages`.

4. Validar frontend `/inbox`:
- Lista de conversas carrega.
- Busca por telefone/nome funciona.
- Thread carrega ao selecionar conversa.
- Envio manual persiste outbound e tenta dispatch Cloud API.

## Rollback
1. Reverter commit/release para versão anterior.
2. Rebuild e restart:
```bash
cd /opt/autoatende
git checkout <commit_anterior>
docker compose build --no-cache
docker compose up -d
```
