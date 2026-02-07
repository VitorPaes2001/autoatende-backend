/**
 * Migration segura para adaptar usage_counters
 * ao modelo de Conversas (24h) + Templates
 *
 * - NÃO remove colunas existentes
 * - NÃO zera dados
 * - Pode rodar múltiplas vezes (idempotente)
 */

const supabase = require('../config/supabase');

async function run() {
  console.log('🔄 Iniciando migration de usage_counters...');

  // 1️⃣ Verificar se a tabela existe
  const { data: tableCheck, error: tableError } = await supabase
    .from('usage_counters')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ Tabela usage_counters não encontrada ou erro de acesso.');
    throw tableError;
  }

  console.log('✅ Tabela usage_counters encontrada.');

  // 2️⃣ Adicionar conversations_used (se não existir)
  const { error: convError } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE usage_counters
      ADD COLUMN IF NOT EXISTS conversations_used INTEGER NOT NULL DEFAULT 0;
    `,
  });

  if (convError) {
    console.error('❌ Erro ao adicionar conversations_used');
    throw convError;
  }

  console.log('✅ Coluna conversations_used OK');

  // 3️⃣ Adicionar templates_used (se não existir)
  const { error: tmplError } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE usage_counters
      ADD COLUMN IF NOT EXISTS templates_used INTEGER NOT NULL DEFAULT 0;
    `,
  });

  if (tmplError) {
    console.error('❌ Erro ao adicionar templates_used');
    throw tmplError;
  }

  console.log('✅ Coluna templates_used OK');

  console.log('🎉 Migration finalizada com sucesso.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Migration falhou:', err);
    process.exit(1);
  });

