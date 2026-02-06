/**
 * LoadingSpinner Component
 * Displays a centered loading spinner with dark mode support
 */
import React from 'react';
import { Box, CircularProgress, Typography, useTheme, alpha } from '@mui/material';

const LoadingSpinner = ({ message = 'Loading...', fullScreen = false, size = 48 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        {/* Background ring */}
        <CircularProgress 
          size={size} 
          thickness={3}
          variant="determinate"
          value={100}
          sx={{ 
            color: alpha(theme.palette.primary.main, 0.12),
            position: 'absolute',
          }} 
        />
        {/* Spinning ring */}
        <CircularProgress 
          size={size} 
          thickness={3}
          sx={{ 
            color: 'primary.main',
            animationDuration: '1.2s',
          }} 
        />
      </Box>
      <Typography 
        variant="body1" 
        color="text.secondary"
        sx={{ fontWeight: 500, letterSpacing: '0.02em' }}
      >
        {message}
      </Typography>
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(
            isDark ? theme.palette.background.default : '#ffffff',
            0.92
          ),
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        width: '100%',
      }}
    >
      {content}
    </Box>
  );
};

export default LoadingSpinner;
