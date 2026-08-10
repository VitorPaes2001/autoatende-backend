const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load frontend-admin .env
const envPath = path.join(__dirname, '../frontend-admin/.env');
if (!fs.existsSync(envPath)) {
  console.error('Missing required frontend environment file: frontend-admin/.env');
  process.exit(1);
}
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = envConfig.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.VITE_SUPABASE_ANON_KEY;
const AUTH_TEST_EMAIL = String(process.env.AUTOATENDE_FRONTEND_AUTH_TEST_EMAIL || '').trim();
const AUTH_TEST_PASSWORD = String(process.env.AUTOATENDE_FRONTEND_AUTH_TEST_PASSWORD || '');

const requiredConfiguration = [
  ['VITE_SUPABASE_URL', SUPABASE_URL],
  ['VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
  ['AUTOATENDE_FRONTEND_AUTH_TEST_EMAIL', AUTH_TEST_EMAIL],
  ['AUTOATENDE_FRONTEND_AUTH_TEST_PASSWORD', AUTH_TEST_PASSWORD],
];
const missingConfiguration = requiredConfiguration
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingConfiguration.length > 0) {
  console.error('Missing required environment configuration: ' + missingConfiguration.join(', '));
  process.exit(1);
}

console.log('✅ Loaded Supabase frontend configuration and explicit auth test credentials');
console.log(`   URL: ${SUPABASE_URL}`);
console.log('   Supabase anon key configured: yes');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuth() {
  console.log('Testing configured frontend auth credentials...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: AUTH_TEST_EMAIL,
    password: AUTH_TEST_PASSWORD,
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
