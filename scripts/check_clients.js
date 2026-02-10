
require('dotenv').config();
const supabase = require('../src/config/supabase');

async function inspect() {
  console.log('--- Clients Table ---');
  const { data, error } = await supabase.from('clients').select('*').limit(1);
  if (error) console.log('Error:', error.message);
  else console.log('Keys:', data.length > 0 ? Object.keys(data[0]) : 'Table empty');
}

inspect();
