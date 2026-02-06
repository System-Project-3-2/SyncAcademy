/**
 * Dashboard Layout Component
 * Main layout wrapper for authenticated pages with navbar and sidebar
 * Includes dark mode support
 */
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar, useTheme as useMuiTheme } from '@mui/material';
import { Navbar, Sidebar, drawerWidth } from '../components';

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const muiTheme = useMuiTheme();
  const isDark = muiTheme.palette.mode === 'dark';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        minHeight: '100vh', 
        bgcolor: 'background.default',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Navbar */}
      <Navbar onMenuClick={handleDrawerToggle} />

      {/* Sidebar */}
      <Sidebar open={mobileOpen} onClose={handleDrawerToggle} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: 'background-color 0.3s ease',
        }}
      >
        <Toolbar /> {/* Spacer for fixed navbar */}
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;
