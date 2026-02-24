#!/usr/bin/env node

const overageBillingService = require('../src/services/overageBilling.service');

async function main() {
  const clientId = process.argv[2] || process.env.SMOKE_CLIENT_ID;
  if (!clientId) {
    console.error('Uso: node scripts/smoke_billing_v1.js <client_id>');
    process.exit(1);
  }

  const summary = await overageBillingService.getMonthlyUsageSummary(clientId);
  console.log('[billing-v1] summary', JSON.stringify(summary, null, 2));

  const dryRun = await overageBillingService.chargeMonthlyOverage({
    clientId,
    month: summary.month,
    year: summary.year,
    dryRun: true
  });

  console.log('[billing-v1] dry-run overage', JSON.stringify(dryRun, null, 2));
}

main().catch((err) => {
  console.error('[billing-v1] smoke failed', err);
  process.exit(1);
});
