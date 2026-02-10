const supabase = require('../config/supabase');
const redis = require('../../utils/redis');

/**
 * Verifica conectividade com o Banco de Dados (Supabase)
 * Executa uma query simples na tabela 'companies' (SELECT id FROM companies LIMIT 1)
 * Simula um "SELECT 1" para verificar se a conexão e permissões estão OK.
 */
const checkDatabase = async () => {
  // Usamos 'companies' pois é uma tabela central e garantida de existir.
  // O uso de count ou head pode ser mais leve, mas um select id limit 1 é muito rápido.
  const { error } = await supabase
    .from('companies')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
  return true;
};

/**
 * Verifica conectividade com o Redis
 * Executa comando PING
 */
const checkRedis = async () => {
  try {
    const response = await redis.ping();
    if (response !== 'PONG') {
      throw new Error('Redis PING failed');
    }
    return true;
  } catch (err) {
    throw new Error(`Redis error: ${err.message}`);
  }
};

module.exports = {
  checkDatabase,
  checkRedis
};
