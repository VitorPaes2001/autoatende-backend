#!/usr/bin/env node

const overageBillingService = require('../src/services/overageBilling.service');
const supabase = require('../src/config/supabase');

async function main() {
  const month = Number(process.argv[2]);
  const year = Number(process.argv[3]);
  const dryRun = process.argv.includes('--dry-run');

  if (!month || !year) {
    console.error('Uso: node scripts/run_overage_billing_cycle.js <month> <year> [--dry-run]');
    process.exit(1);
  }

  const { data: clients, error } = await supabase
    .from('subscriptions')
    .select('client_id')
    .in('status', ['active', 'trialing']);

  if (error) throw error;

  const uniqueClientIds = [...new Set((clients || []).map((row) => row.client_id).filter(Boolean))];
  const results = [];

  for (const clientId of uniqueClientIds) {
    const result = await overageBillingService.chargeMonthlyOverage({ clientId, month, year, dryRun });
    results.push({ clientId, ...result });
  }

  console.log(JSON.stringify({ month, year, dryRun, total: uniqueClientIds.length, results }, null, 2));
}

main().catch((err) => {
  console.error('[billing-v1] overage cycle failed', err);
  process.exit(1);
});
