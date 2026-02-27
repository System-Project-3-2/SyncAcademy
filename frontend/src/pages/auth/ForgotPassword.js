/**
 * Forgot Password Page
 * Allows users to request a password reset OTP
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
} from '@mui/material';
import {
  Email as MailIcon,
  ArrowBack as ArrowLeftIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { authService } from '../../services';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.forgotPassword({ email });
      toast.success(response.message || 'OTP sent to your email');
      setOtpSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  if (otpSent) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}>
        <Container maxWidth="sm">
          <Paper elevation={10} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <Box sx={{ width: 64, height: 64, bgcolor: 'success.light', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 32, color: 'success.dark' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              OTP Sent Successfully!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              We've sent a 6-digit OTP to <strong>{email}</strong>.
              Please check your inbox and use it to reset your password.
            </Typography>
            <Button
              component={Link}
              to="/reset-password"
              state={{ email }}
              variant="contained"
              fullWidth
              size="large"
              sx={{ mb: 2 }}
            >
              Continue to Reset Password
            </Button>
            <Button component={Link} to="/login" size="small">
              Back to Login
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}>
      <Container maxWidth="sm">
        <Paper elevation={10} sx={{ p: 4, borderRadius: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ width: 64, height: 64, bgcolor: 'primary.light', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <MailIcon sx={{ fontSize: 32, color: 'primary.dark' }} />
            </Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Forgot Password?
            </Typography>
            <Typography color="text.secondary">
              Enter your email and we'll send you an OTP to reset your password
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type="email"
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              disabled={loading}
              required
              margin="normal"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? 'Sending OTP...' : 'Send Reset OTP'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              component={Link}
              to="/login"
              startIcon={<ArrowLeftIcon />}
              size="small"
            >
              Back to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ForgotPassword;
