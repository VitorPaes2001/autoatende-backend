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
  await client.connect();
})();

module.exports = client;

