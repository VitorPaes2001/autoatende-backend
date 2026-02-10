const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load frontend-admin .env
const envPath = path.join(__dirname, '../frontend-admin/.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = envConfig.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in frontend-admin/.env');
  process.exit(1);
}

console.log('✅ Loaded credentials from frontend-admin/.env');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Key: ${SUPABASE_ANON_KEY.substring(0, 10)}...`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuth() {
  console.log('\n🔄 Testing Authentication for vitor.escocard@gmail.com...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'vitor.escocard@gmail.com',
    password: 'TemporaryPassword123!',
  });

  if (error) {
    console.error('❌ Auth Failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Authentication Successful!');
  console.log(`   User ID: ${data.user.id}`);
  console.log(`   Email: ${data.user.email}`);
  console.log(`   Role: ${data.user.role}`);
  
  // Check onboarding status
  const onboardingCompleted = data.user.user_metadata?.onboarding_completed;
  console.log(`   Onboarding Completed: ${onboardingCompleted} (Expected: false)`);

  if (onboardingCompleted === false) {
    console.log('✅ Onboarding status is correct (false).');
  } else {
    console.warn('⚠️ Onboarding status mismatch!');
  }

  console.log('\n🎉 Frontend configuration is valid. Please restart your Vite server (npm run dev) to apply changes.');
}

testAuth();
