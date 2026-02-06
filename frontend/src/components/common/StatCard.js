/**
 * StatCard Component
 * Displays a polished statistic card for dashboards with dark mode support
 */
import React from 'react';
import { Paper, Box, Typography, useTheme, alpha } from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';

const StatCard = ({ 
  title, 
  value, 
  icon, 
  color = 'primary.main',
  subtitle = null,
  trend = null,
  onClick = null,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Resolve color string to actual color value
  const resolveColor = (colorStr) => {
    const parts = colorStr.split('.');
    let resolved = theme.palette;
    for (const part of parts) {
      resolved = resolved?.[part];
    }
    return resolved || colorStr;
  };

  const resolvedColor = resolveColor(color);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      className="fade-in"
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: isDark 
            ? `0 8px 30px ${alpha(resolvedColor, 0.2)}`
            : `0 8px 30px ${alpha(resolvedColor, 0.15)}`,
          borderColor: alpha(resolvedColor, 0.3),
        } : {},
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${resolvedColor}, ${alpha(resolvedColor, 0.4)})`,
          borderRadius: '3px 3px 0 0',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="overline" 
            color="text.secondary" 
            sx={{ 
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h3" 
            fontWeight={800} 
            sx={{ 
              color: resolvedColor,
              lineHeight: 1.2,
              mt: 0.5,
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="caption" color="success.main" fontWeight={600}>
                {trend}
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            backgroundColor: alpha(resolvedColor, isDark ? 0.15 : 0.1),
            color: resolvedColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
};

export default StatCard;
