
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOUNDER_EMAIL = String(process.env.AUTOATENDE_BOOTSTRAP_FOUNDER_EMAIL || '').trim();
const FOUNDER_PASSWORD = String(process.env.AUTOATENDE_BOOTSTRAP_FOUNDER_PASSWORD || '');
const FOUNDER_NAME = String(process.env.AUTOATENDE_BOOTSTRAP_FOUNDER_NAME || '').trim();

const requiredConfiguration = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_KEY],
  ['AUTOATENDE_BOOTSTRAP_FOUNDER_EMAIL', FOUNDER_EMAIL],
  ['AUTOATENDE_BOOTSTRAP_FOUNDER_PASSWORD', FOUNDER_PASSWORD],
  ['AUTOATENDE_BOOTSTRAP_FOUNDER_NAME', FOUNDER_NAME],
];
const missingConfiguration = requiredConfiguration
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingConfiguration.length > 0) {
  console.error('Missing required environment configuration: ' + missingConfiguration.join(', '));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function bootstrap() {
  console.log('🚀 Bootstrapping First Client...');

  // 1. Get or Create Auth User
  console.log("Founder email configured; checking user...");
  let { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  let user = users.find(u => u.email === FOUNDER_EMAIL);

  if (!user) {
    console.log('Creating new user...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: FOUNDER_EMAIL,
      password: FOUNDER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: FOUNDER_NAME,
        role: 'company',
        onboarding_completed: false // Force false as requested
      }
    });
    if (createError) throw createError;
    user = newUser.user;
    console.log('User created:', user.id);
  } else {
    console.log('User exists:', user.id);
    // Update metadata to ensure correct state
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        name: FOUNDER_NAME,
        role: 'company',
        onboarding_completed: false
      }
    });
    console.log('User metadata updated.');
  }

  // 1.5. Create/Get Client Profile
  console.log('Creating Client Profile...');
  let { data: client } = await supabase.from('clients').select('*').eq('email', FOUNDER_EMAIL).maybeSingle();
  
  if (!client) {
    // Try to use user.id as client.id if possible, or let it generate
    // Error suggested companies.client_id references clients.id
    // auth.middleware suggests user.id matches client_id
    // So we try to insert with id = user.id
    const clientData = {
      id: user.id,
      user_id: user.id,
      name: FOUNDER_NAME,
      email: FOUNDER_EMAIL,
      status: 'active'
    };
    
    const { data: newClient, error: clientError } = await supabase.from('clients').insert(clientData).select().single();
    if (clientError) {
        console.warn('Could not insert client with explicit ID, trying without ID...');
        delete clientData.id;
        const { data: newClient2, error: clientError2 } = await supabase.from('clients').insert(clientData).select().single();
        if (clientError2) throw clientError2;
        client = newClient2;
    } else {
        client = newClient;
    }
  }
  console.log('Client ID:', client.id);

  // 2. Create Company
  console.log('Creating Company...');
  // Use client.id here
  let { data: company } = await supabase.from('companies').select('*').eq('client_id', client.id).maybeSingle();
  
  const companyData = {
    id: uuidv4(), 
    name: 'AutoAtende AI',
    client_id: client.id, // Reference to clients table
    // Try to include requested fields if schema supports them
    slug: 'autoatendeai',
    plan: 'business',
    status: 'active'
  };

  try {
    if (!company) {
      const { data: newCompany, error } = await supabase.from('companies').insert(companyData).select().single();
      if (error) throw error;
      company = newCompany;
    } else {
      const { error } = await supabase.from('companies').update(companyData).eq('id', company.id);
      if (error) throw error;
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('column') || err.code === 'PGRST204') {
       console.warn('⚠️ Schema mismatch: Some columns (slug, plan, status) do not exist in companies table.');
       console.warn('⚠️ Please run migration 002_bootstrap_company_schema.sql in Supabase SQL Editor.');
       // Fallback: update without extra columns
       delete companyData.slug;
       delete companyData.plan;
       delete companyData.status;
       
       // Retry
       if (!company) {
         const { data: newCompany, error } = await supabase.from('companies').insert(companyData).select().single();
         if (error) throw error; // If it fails again, throw
         company = newCompany;
       } else {
         // Should we update name?
         const { error } = await supabase.from('companies').update(companyData).eq('id', company.id);
         if (error) throw error;
       }
    } else {
      throw err;
    }
  }
  console.log('Company ID:', company.id);

  // 3. Sync Plans
  console.log('Syncing Plans...');
  const { data: planData } = await supabase.from('plans').select('id').eq('name', 'Business').maybeSingle();
  let planId = planData?.id;
  
  if (!planId) {
     const { data: newPlan } = await supabase.from('plans').insert({
       name: 'Business',
       conversations_limit: 1200,
       templates_limit: 400,
       max_human_agents: 8,
       features: ['whitelabel', 'analytics', 'attendance_transfer'],
       price_cents: 69900
     }).select().single();
     planId = newPlan.id;
  } else {
    await supabase.from('plans').update({
       conversations_limit: 1200,
       templates_limit: 400,
       max_human_agents: 8,
       features: ['whitelabel', 'analytics', 'attendance_transfer']
    }).eq('id', planId);
  }

  // 4. Create Subscription
  console.log('Creating Subscription...');
  // Check if subscriptions table has company_id
  const subData = {
    client_id: client.id, // Use client.id
    plan_id: planId,
    status: 'active',
    user_id: user.id,
    company_id: company.id, 
    provider: 'manual'
  };

  try {
    // Cancel old
    await supabase.from('subscriptions').update({ status: 'canceled' }).eq('client_id', client.id).neq('status', 'canceled');
    
    const { error } = await supabase.from('subscriptions').insert(subData);
    if (error) throw error;
  } catch (err) {
     if (err.message.includes('column')) {
        console.warn('⚠️ Schema mismatch: company_id or provider column missing in subscriptions.');
        delete subData.company_id;
        delete subData.provider;
        await supabase.from('subscriptions').insert(subData);
     } else {
        throw err;
     }
  }

  // 5. Initialize Usage
  console.log('Initializing Usage...');
  // Check if monthly_usage table exists
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  try {
      const { error: usageError } = await supabase.from('monthly_usage').upsert({
        company_id: company.id,
        month: currentMonth,
        conversations: 0,
        templates: 0,
        agents: 1
      }, { onConflict: 'company_id, month' });
      if (usageError) throw usageError;
  } catch (err) {
      console.warn('⚠️ Could not update monthly_usage (table might be missing):', err.message);
  }

  // 6. Initialize WhatsApp
  console.log('Initializing WhatsApp Account...');
  const waData = {
    client_id: client.id, // Use client.id
    status: 'disconnected',
    phone_number_id: null,
    waba_id: null,
    phone_number: '',
    access_token: '',
    company_id: company.id // Try to add
  };

  try {
      const { data: existingWa } = await supabase.from('whatsapp_accounts').select('id').eq('client_id', client.id).maybeSingle();
      if (existingWa) {
        await supabase.from('whatsapp_accounts').update(waData).eq('id', existingWa.id);
      } else {
        await supabase.from('whatsapp_accounts').insert(waData);
      }
  } catch (err) {
     if (err.message.includes('column')) {
        delete waData.company_id;
        // Retry
        const { data: existingWa } = await supabase.from('whatsapp_accounts').select('id').eq('client_id', client.id).maybeSingle();
        if (existingWa) {
            await supabase.from('whatsapp_accounts').update(waData).eq('id', existingWa.id);
        } else {
            await supabase.from('whatsapp_accounts').insert(waData);
        }
     } else {
        console.error('Error initializing WhatsApp:', err.message);
     }
  }

  console.log('✅ Bootstrap Complete!');
  console.log("Founder authentication configured for configured account");
  console.log('Founder authentication configured: yes');
  console.log('⚠️ NOTE: If you saw schema warnings, please run migrations/002_bootstrap_company_schema.sql manually.');
}

bootstrap().catch(err => {
  console.error('❌ Bootstrap Failed:', err);
  process.exit(1);
});
