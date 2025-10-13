// redis.js
const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_SOCKET_HOST,
  port: process.env.REDIS_SOCKET_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true, // Avoid connecting on every import
  maxRetriesPerRequest: 1
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

module.exports = redis;
