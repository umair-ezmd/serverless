const jwt = require('jsonwebtoken');

// JWT Secret - In production, use AWS Secrets Manager or Parameter Store
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Lambda Authorizer for API Gateway
 * Validates JWT tokens and returns IAM policy for API access
 */
exports.handler = async (event) => {  
  try {
    // Extract token from Authorization header
    const token = extractToken(event);
    
    if (!token) {
      console.log('No token provided');
      return generatePolicy('user', 'Deny', event.routeArn);
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, JWT_SECRET); 

    // Generate IAM policy for successful authentication
    let policy = generatePolicy(decoded.sub || decoded.userId || 'user', 'Allow', event.routeArn || event.methodArn);
    
    // Add user context to the policy
     policy.context = {
      userId: decoded.sub || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    }; 

    return policy;

  } catch (error) {
    console.error('Authorization failed:', error.message);
    return generatePolicy('user', 'Deny', event.routeArn || event.methodArn);
  }
};

/**
 * Extract JWT token from Authorization header
 */
function extractToken(event) {
  if (Array.isArray(event.identitySource) && event.identitySource.length > 0) {
    const authHeader = event.identitySource[0];
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  }

  if (event.authorizationToken) {
    const authHeader = event.authorizationToken;
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  }

  // For REQUEST authorizers
  if (event.headers && event.headers.Authorization) {
    const authHeader = event.headers.Authorization;
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  } 

  return null; 
 
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(principalId, effect, resource) { 
  const authResponse = {
    principalId: principalId
  };

  if (effect && resource) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    };
    authResponse.policyDocument = policyDocument;
  }

  return authResponse;
}
