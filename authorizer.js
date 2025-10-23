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
    console.log('Token decoded successfully for user:', decoded.sub || decoded.userId);

    // Generate IAM policy for successful authentication
    let policy = generatePolicy(decoded.sub || decoded.userId || 'user', 'Allow', event.routeArn || event.methodArn);
    
    // Add user context to the policy
     policy.context = {
      userId: decoded.sub || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    }; 

    console.log('Authorization successful, returning policy');
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
  console.log("event.identitySource: ", event.identitySource);
  console.log("event.authorizationToken: ", event.authorizationToken); 

  if (Array.isArray(event.identitySource) && event.identitySource.length > 0) {
    const authHeader = event.identitySource[0];
    console.log("Using identitySource:", authHeader ? 'Token found' : 'Empty token');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return authHeader;
  }

  if (event.authorizationToken) {
    const authHeader = event.authorizationToken;
    console.log("Using authorizationToken:", authHeader ? 'Token found' : 'Empty token');
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return authHeader;
  }

  // For REQUEST authorizers
  // if (event.headers && event.headers.Authorization) {
  //   const authHeader = event.headers.Authorization;
  //   console.log("Using headers.Authorization:", authHeader);
  //   return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  // } 

  // For REQUEST authorizers with lowercase headers
  // if (event.headers && event.headers.authorization) {
  //   const authHeader = event.headers.authorization;
  //   console.log("Using headers.authorization:", authHeader);
  //   return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  // }

   console.log('No authorization token found in any expected location');
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

  console.log('Generated policy:', JSON.stringify(authResponse, null, 2));
  return authResponse;
}
