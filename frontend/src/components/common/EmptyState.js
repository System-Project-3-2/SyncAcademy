/**
 * EmptyState Component
 * Displays a polished placeholder when there's no content
 */
import React from 'react';
import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import { Inbox as InboxIcon } from '@mui/icons-material';

const EmptyState = ({
  icon = <InboxIcon sx={{ fontSize: 64 }} />,
  title = 'No data found',
  description = 'There is no content to display at the moment.',
  actionLabel = null,
  onAction = null,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      className="fade-in"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box 
        sx={{ 
          color: alpha(theme.palette.text.primary, 0.2),
          mb: 2.5,
          p: 2,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.05),
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" color="text.primary" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography 
        variant="body2" 
        color="text.secondary" 
        sx={{ mb: 3, maxWidth: 400, lineHeight: 1.6 }}
      >
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button 
          variant="contained" 
          onClick={onAction}
          sx={{ 
            px: 4,
            py: 1,
            borderRadius: 2,
            fontWeight: 600,
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
