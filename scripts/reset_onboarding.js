const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESET_ONBOARDING_EMAIL = String(process.env.AUTOATENDE_RESET_ONBOARDING_EMAIL || '').trim();

const requiredConfiguration = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ['AUTOATENDE_RESET_ONBOARDING_EMAIL', RESET_ONBOARDING_EMAIL],
];
const missingConfiguration = requiredConfiguration
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingConfiguration.length > 0) {
  console.error('Missing required environment configuration: ' + missingConfiguration.join(', '));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetOnboarding() {
  const email = RESET_ONBOARDING_EMAIL;
  console.log('🔄 Resetting onboarding for configured account...');

  // 1. Get User ID
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error('❌ User not found');
    return;
  }

  // 2. Update user_metadata and public.users table (if it exists)
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { user_metadata: { onboarding_completed: false } }
  );

  if (updateError) {
    console.error('❌ Error updating auth user:', updateError);
    return;
  }

  console.log('✅ Auth metadata updated (onboarding_completed: false)');

  // Try to update public.users if possible
  const { error: dbError } = await supabase
    .from('users')
    .update({ onboarding_completed: false })
    .eq('id', user.id);

  if (dbError) {
    console.warn('⚠️ Could not update public.users (might not exist yet):', dbError.message);
  } else {
    console.log('✅ public.users updated');
  }
}

resetOnboarding();
