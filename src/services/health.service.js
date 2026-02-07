const supabase = require('../config/supabase');
const redis = require('../../utils/redis');

/**
 * Verifica conectividade com o Banco de Dados (Supabase)
 * Executa uma query simples na tabela clients
 */
const checkDatabase = async () => {
  const { error } = await supabase.from('clients').select('id').limit(1);
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
