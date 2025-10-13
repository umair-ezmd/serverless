const serverless = require("serverless-http");
const express = require("express");
const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const productRoutes = require("./routes/product");
const redis = require("./config/redis");

const app = express();
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    return next(); // Skip body parsing
  }
  express.json({ limit: '100mb' })(req, res, next);
});
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Initialize database connection on startup
let dbInitialized = false;

const initializeDB = async () => {
  if (!dbInitialized) {
    try {
      await connectDB();
      dbInitialized = true;
      console.log("Database initialized on startup");
    } catch (error) {
      console.error("Failed to initialize database on startup:", error);
    }
  }
};

// Initialize DB when the Lambda starts (for warm starts)
initializeDB();

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    const redisState = await redis.get("mongo:connection:status");

    // 🚀 FAST PATH: Redis says DB is live and mongoose reflects it
    if (redisState === "connected" && mongoose.connection.readyState === 1) {
      return next();
    }

    // Else → connect normally
    await connectDB();
    next();
  } catch (error) {
    console.error("❌ Redis + DB middleware failed:", error);
    return res.status(503).json({
      error: "Service Unavailable - DB Cold Start",
      message: "Retry request in a moment",
    });
  }
});

// Routes
app.use("/products", productRoutes);

app.get("/hello", async (req, res) => {
  res.json({ 
    message: "Hello from serverless!",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbStatus = await redis.get("mongo:connection:status");
    res.json({ 
      status: "OK", 
      database: dbStatus ? "connected" : "disconnected",
      readyState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: "Unhealthy", 
      database: "error",
      error: error.message,
      readyState: mongoose.connection.readyState
    });
  }
});

// Test connection endpoint
app.get("/test-db", async (req, res) => {
  try {
    await connectDB();
    res.json({ 
      message: "Database connection successful",
      readyState: mongoose.connection.readyState
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Database connection failed",
      message: error.message
    });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'dev' ? error.message : 'Something went wrong'
  });
});


exports.handler = serverless(app);