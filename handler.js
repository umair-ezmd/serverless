const serverless = require("serverless-http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { connectDB } = require("./config/db");
const productRoutes = require("./routes/product");
const authRoutes = require("./routes/auth");
const redis = require("./config/redis");
const { getUserFromContext } = require("./utils/jwt");
const { 
  generalLimiter,
  securityHeaders,
  corsOptions,
  sanitizeRequest,
  requestLogger,
  errorResponse
} = require("./middleware/security");

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(requestLogger);
app.use(sanitizeRequest);

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
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

// Middleware to add user context from authorizer
app.use((req, res, next) => {
  console.log("user context middleware");
  // Store the original event for access in routes
  req.apiGateway = { event: req.apiGateway?.event || {} };
  
  // Add user context if available
  const user = getUserFromContext(req.apiGateway.event); 
  if (user) {
    req.user = user;
  }
  
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/products", productRoutes);

app.get("/hello", async (req, res) => {
  res.json({ 
    message: "Hello from serverless!",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
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
 
app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

// Error handling middleware
app.use(errorResponse);


exports.handler = serverless(app, {
  // Ensure we have access to the original event
  request: function(request, event, context) {
    request.context = context;
    request.event = event;
    request.apiGateway = {
      event: event,
      context: context
    };
  }
});