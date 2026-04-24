/**
 * Register Page
 * Handles new user registration with OTP verification
 * Includes dark mode support
 */
import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  InputAdornment,
  IconButton,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Visibility,
  VisibilityOff,
  School as SchoolIcon,
  Pin as PinIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggleButton } from '../../components/common/ThemeToggle';

const steps = ['Account Details', 'Verify Email'];

const Register = () => {
  const navigate = useNavigate();
  const { register, verifyOtp } = useAuth();
  const { isDark } = useTheme();
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    idNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.idNumber || !/^\d{7}$/.test(formData.idNumber)) {
      setError('ID number must be exactly 7 digits');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      await register({
        name: formData.name,
        email: formData.email,
        idNumber: formData.idNumber,
        password: formData.password,
      });
      toast.success('OTP sent to your email!');
      setActiveStep(1);
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await verifyOtp({
        email: formData.email,
        otp: otp,
      });
      toast.success('Email verified successfully! Please login.');
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.message || 'OTP verification failed.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: 4,
        background: isDark 
          ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)'
          : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)',
        transition: 'background 0.3s ease',
        position: 'relative',
      }}
    >
      {/* Theme Toggle - Fixed position in top right */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
        }}
      >
        <ThemeToggleButton 
          sx={{ 
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.1)',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.2)',
            },
          }} 
        />
      </Box>

      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            p: 4,
            borderRadius: 3,
            bgcolor: 'background.paper',
            transition: 'background-color 0.3s ease',
          }}
        >
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                mb: 2,
              }}
            >
              <SchoolIcon fontSize="large" />
            </Box>
            <Typography variant="h4" fontWeight={700} color="primary">
              SyncAcademy
            </Typography>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Step 1: Registration Form */}
          {activeStep === 0 && (
            <Box component="form" onSubmit={handleRegister}>
              <Typography variant="h5" textAlign="center" gutterBottom fontWeight={600}>
                Create Account
              </Typography>
              <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
                Use your institutional email to register
              </Typography>

              <TextField
                fullWidth
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                margin="normal"
                helperText="Use your KUET email address"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="ID Number"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleChange}
                required
                margin="normal"
                helperText="7-digit unique ID (e.g., 2107119)"
                inputProps={{ maxLength: 7 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BadgeIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                margin="normal"
                helperText="Minimum 6 characters"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?{' '}
                  <Link component={RouterLink} to="/login" fontWeight={600}>
                    Sign in here
                  </Link>
                </Typography>
              </Box>
            </Box>
          )}

          {/* Step 2: OTP Verification */}
          {activeStep === 1 && (
            <Box component="form" onSubmit={handleVerifyOtp}>
              <Typography variant="h5" textAlign="center" gutterBottom fontWeight={600}>
                Verify Your Email
              </Typography>
              <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
                We've sent a 6-digit OTP to <strong>{formData.email}</strong>
              </Typography>

              <TextField
                fullWidth
                label="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                margin="normal"
                inputProps={{
                  maxLength: 6,
                  style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PinIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading || otp.length !== 6}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Didn't receive the code?{' '}
                  <Link
                    component="button"
                    type="button"
                    onClick={() => setActiveStep(0)}
                    fontWeight={600}
                  >
                    Go back
                  </Link>
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Register;
