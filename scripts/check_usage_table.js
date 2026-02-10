const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMonthlyUsage() {
  console.log('Checking monthly_usage table...');
  const { data, error } = await supabase
    .from('monthly_usage')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error accessing monthly_usage:', error.message);
    if (error.code === '42P01') { // undefined_table
      console.log('❌ Table monthly_usage DOES NOT EXIST.');
    }
  } else {
    console.log('✅ Table monthly_usage exists.');
    console.log('Sample data:', data);
  }
}

checkMonthlyUsage();
