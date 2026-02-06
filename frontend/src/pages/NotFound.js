/**
 * Not Found Page (404)
 * Displayed when a route doesn't exist - dark mode aware
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, useTheme } from '@mui/material';
import { Home as HomeIcon, ArrowBack as BackIcon } from '@mui/icons-material';

const NotFound = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        transition: 'background 0.3s ease',
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h1"
          className="fade-in"
          sx={{
            fontSize: { xs: '6rem', md: '10rem' },
            fontWeight: 800,
            background: isDark 
              ? 'linear-gradient(135deg, #60a5fa, #a78bfa)'
              : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            mb: 1,
          }}
        >
          404
        </Typography>
        <Typography variant="h4" fontWeight={700} gutterBottom color="text.primary">
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
          Oops! The page you're looking for doesn't exist or has been moved.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate(-1)}
            sx={{ px: 3, py: 1, borderRadius: 2 }}
          >
            Go Back
          </Button>
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/')}
            sx={{ px: 3, py: 1, borderRadius: 2 }}
          >
            Go Home
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default NotFound;
