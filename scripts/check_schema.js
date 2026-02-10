
require('dotenv').config();
const supabase = require('../src/config/supabase');

async function inspect() {
  console.log('--- Subscriptions Table ---');
  const { data: subData, error: subError } = await supabase.from('subscriptions').select('*').limit(1);
  if (subError) console.log('Error:', subError.message);
  else console.log('Keys:', subData.length > 0 ? Object.keys(subData[0]) : 'Table empty');

  console.log('\n--- Companies Table ---');
  const { data: compData, error: compError } = await supabase.from('companies').select('*').limit(1);
  if (compError) console.log('Error:', compError.message);
  else console.log('Keys:', compData.length > 0 ? Object.keys(compData[0]) : 'Table empty');

  console.log('\n--- Users Table (public) ---');
  const { data: userData, error: userError } = await supabase.from('users').select('*').limit(1);
  if (userError) console.log('Error:', userError.message);
  else console.log('Keys:', userData.length > 0 ? Object.keys(userData[0]) : 'Table empty');

  console.log('\n--- Plans Table ---');
  const { data: planData, error: planError } = await supabase.from('plans').select('*').limit(1);
  if (planError) console.log('Error:', planError.message);
  else console.log('Keys:', planData.length > 0 ? Object.keys(planData[0]) : 'Table empty');

  console.log('\n--- WhatsApp Accounts Table ---');
  const { data: waData, error: waError } = await supabase.from('whatsapp_accounts').select('*').limit(1);
  if (waError) console.log('Error:', waError.message);
  else console.log('Keys:', waData.length > 0 ? Object.keys(waData[0]) : 'Table empty');

  console.log('\n--- Plans Data ---');
  const { data: plansData, error: plansError } = await supabase.from('plans').select('*');
  if (plansError) console.log('Error:', plansError.message);
  else console.log('Plans:', plansData);
}

inspect();
