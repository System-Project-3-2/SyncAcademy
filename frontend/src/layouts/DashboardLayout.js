/**
 * Dashboard Layout Component
 * Main layout wrapper for authenticated pages with navbar and sidebar
 * Includes dark mode support and smooth transitions
 */
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import { Navbar, Sidebar, drawerWidth } from '../components';

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          p: { xs: 2, sm: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: 'background-color 0.3s ease',
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for fixed navbar */}
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardLayout;
