const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixUsage() {
  console.log('🔧 Starting Idempotent Usage Fix...');
  
  // 1. Get all active companies/clients
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, client_id, name');

  if (companyError) {
    console.error('❌ Error fetching companies:', companyError);
    return;
  }

  console.log(`Found ${companies.length} companies.`);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  for (const company of companies) {
    if (!company.client_id) {
        console.warn(`⚠️ Company ${company.name} (${company.id}) has no client_id. Skipping.`);
        continue;
    }

    // Check if usage exists
    const { data: usage, error: usageError } = await supabase
      .from('monthly_usage')
      .select('id')
      .eq('client_id', company.client_id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (usage) {
      console.log(`✅ Usage exists for ${company.name}.`);
      continue;
    }

    console.log(`⚠️ Usage missing for ${company.name}. Creating...`);

    // Get plan limits to set initial agents (optional, defaulting to 1 is safer for now)
    // We could fetch subscription here to get accurate agent count, but 1 is a safe bootstrap.
    
    // NOTE: Removed agents_used because column might not exist in remote DB schema yet.
    // Agents are tracked via 'users' table count in logic.
    const { error: insertError } = await supabase
      .from('monthly_usage')
      .insert({
        client_id: company.client_id,
        month,
        year,
        conversations_used: 0,
        templates_used: 0
        // agents_used: 1 // Removed to avoid schema error
      });

    if (insertError) {
      console.error(`❌ Failed to create usage for ${company.name}:`, insertError.message);
    } else {
      console.log(`✅ Created usage for ${company.name}.`);
    }
  }
  
  console.log('🎉 Fix completed.');
}

fixUsage();
