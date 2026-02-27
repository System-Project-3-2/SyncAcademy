import express from 'express';
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { verifyOtp } from '../controllers/otpController.js';

const authRouter = express.Router();

// Authentication routes
authRouter.post('/register', registerUser);
authRouter.post('/login', loginUser);
authRouter.post('/verify-otp', verifyOtp);

// Password reset routes
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password', resetPassword);

export default authRouter;