const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const { 
  validateRegistration, 
  validateLogin, 
  validatePasswordResetRequest,
  validatePasswordReset,
  validateChangePassword,
  validateUpdateProfile 
} = require("../middleware/validation");
const { 
  authLimiter, 
  passwordResetLimiter, 
  registrationLimiter 
} = require("../middleware/security");

// Public routes (no authentication required)
router.post("/register", registrationLimiter, validateRegistration, authController.register);
router.post("/login", authLimiter, validateLogin, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/request-password-reset", passwordResetLimiter, validatePasswordResetRequest, authController.requestPasswordReset);
router.post("/reset-password", validatePasswordReset, authController.resetPassword);

// Protected routes (authentication required)
router.get("/profile", authController.getProfile);
router.put("/profile", validateUpdateProfile, authController.updateProfile);
router.put("/change-password", validateChangePassword, authController.changePassword);
router.post("/logout", authController.logout);

module.exports = router;
