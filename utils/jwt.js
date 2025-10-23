const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m'; // Short-lived access tokens
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Long-lived refresh tokens

/**
 * Generate access token (short-lived)
 * @param {Object} payload - User data to include in token
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {string} payload.role - User role
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: 'serverless-api',
    audience: 'api-users',
    subject: payload.userId
  });
};

/**
 * Generate refresh token (long-lived)
 * @param {Object} payload - User data to include in token
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {string} payload.role - User role
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'serverless-api',
    audience: 'api-users',
    subject: payload.userId
  });
};

/**
 * Generate both access and refresh tokens
 * @param {Object} payload - User data
 * @returns {Object} Object containing both tokens
 */
const generateTokenPair = (payload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

/**
 * Verify access token
 * @param {string} token - JWT access token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

/**
 * Generate a secure random token for email verification, password reset, etc.
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} Random hex token
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};
 
// Extract user information from API Gateway authorizer context (Lambda event object) 
const getUserFromContext = (event) => {  
  console.log("event.requestContext?.authorizer: ", event.requestContext?.authorizer);
  // For HTTP API with Lambda Authorizer (your current setup)
  if (event.requestContext?.authorizer?.lambda) {
    return {
      userId: event.requestContext.authorizer?.lambda?.userId,
      email: event.requestContext.authorizer?.lambda?.email,
      role: event.requestContext.authorizer?.lambda?.role
    };
  }

  // For REST API with Lambda Authorizer (alternative structure)
  if (event.requestContext?.authorizer?.context) {
    return {
      userId: event.requestContext.authorizer.context.userId,
      email: event.requestContext.authorizer.context.email,
      role: event.requestContext.authorizer.context.role
    };
  }
  
  // For JWT Authorizer (if you switch to built-in JWT)
  if (event.requestContext?.authorizer?.jwt?.claims) {
    const claims = event.requestContext.authorizer.jwt.claims;
    return {
      userId: claims.userId || claims.sub,
      email: claims.email,
      role: claims.role
    };
  }

  return null;
};
 
// Middleware to check if user has required role 
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    const user = getUserFromContext(req.apiGateway?.event || {});
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (user.role !== requiredRole && user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.user = user;
    next();
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  getUserFromContext,
  requireRole
};
