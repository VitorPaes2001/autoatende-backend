const { createClient } = require("redis");

// Dentro do Docker, NUNCA use localhost para outros serviços
const redisHost = process.env.REDIS_HOST || "whatsapp-redis";
const redisPort = process.env.REDIS_PORT || 6379;

const redisUrl = `redis://${redisHost}:${redisPort}`;

console.log("Redis connecting to:", redisUrl);

const client = createClient({
  url: redisUrl
});

client.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

(async () => {
  try {
    await client.connect();
    console.log("Redis connected successfully");
  } catch (err) {
    console.error("Redis Connection Failed (Non-fatal):", err.message);
    // Suppress throw to allow app to start without Redis
  }
})();

module.exports = client;

