/**
 * PageHeader Component
 * Professional page header with title, breadcrumbs, and optional actions
 */
import React from 'react';
import { Box, Typography, Breadcrumbs, Link, useTheme, alpha } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

const PageHeader = ({ 
  title, 
  subtitle = null, 
  breadcrumbs = [], 
  actions = null 
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
          sx={{ mb: 1.5 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Typography 
                key={crumb.label} 
                color="primary.main"
                sx={{ fontWeight: 500, fontSize: '0.875rem' }}
              >
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.path}
                underline="hover"
                color="text.secondary"
                sx={{ 
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  '&:hover': { color: 'primary.main' },
                  transition: 'color 0.2s ease',
                }}
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Title and Actions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            fontWeight={800} 
            color="text.primary"
            sx={{ 
              letterSpacing: '-0.02em',
              lineHeight: 1.3,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography 
              variant="body1" 
              color="text.secondary" 
              sx={{ mt: 0.5, lineHeight: 1.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Box>
    </Box>
  );
};

export default PageHeader;
