const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase service role credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetOnboarding() {
  const email = 'vitor.escocard@gmail.com';
  console.log(`🔄 Resetting onboarding for ${email}...`);

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
