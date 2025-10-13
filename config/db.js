const mongoose = require("mongoose");
const redis = require("./redis");

const REDIS_DB_STATE_KEY = "mongo:connection:status";

let cachedConnection = null;

const connectDB = async () => {
  // ✅ Check Redis first for connection state
  const redisState = await redis.get(REDIS_DB_STATE_KEY);
  if (redisState === "connected" && mongoose.connection.readyState === 1) {
    console.log("✅ Redis: MongoDB already connected (warm state)");
    return cachedConnection;
  }

  // ✅ If mongoose already connected but Redis has no state (set it)
  if (mongoose.connection.readyState === 1) {
    console.log("✅ Mongoose already connected but updating Redis state");
    await redis.set(REDIS_DB_STATE_KEY, "connected", "EX", 300); // TTL 5 min
    return cachedConnection;
  }

  // ❌ If no connection → connect to MongoDB
  console.log("⚠ No active DB connection. Creating new...");
  cachedConnection = await mongoose.connect(process.env.MONGODB_URL, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    maxPoolSize: 10,
    retryWrites: true,
  });

  // ✅ Once connected → set Redis flag
  await redis.set(REDIS_DB_STATE_KEY, "connected", "EX", 300);

  return cachedConnection;
};

module.exports = { connectDB };
