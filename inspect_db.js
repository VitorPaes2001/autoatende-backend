
require('dotenv').config();
const supabase = require('./src/config/supabase');

async function inspect() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Company sample:', data);
  }
}

inspect();
