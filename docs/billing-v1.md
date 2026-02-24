# Billing v1 (franquia + excedente)

## Regras
- Planos: Starter (300), Pro (800), Business (2000) templates/mês.
- Excedente: R$0,99 por template acima da franquia.
- Sem bloqueio por excedente: mensagens continuam sendo autorizadas.
- Cobrança idempotente no Stripe por chave `overage:{client_id}:{year}-{month}`.

## Fluxo
1. `try_consume_usage` incrementa consumo mensal e calcula `overage_templates`.
2. API de billing expõe resumo mensal (`/api/billing/summary`).
3. Ciclo mensal executa `run_overage_billing_cycle.js` para gerar invoice items de excedente.
4. A tabela `monthly_overage_invoice_items` impede dupla cobrança por período.
