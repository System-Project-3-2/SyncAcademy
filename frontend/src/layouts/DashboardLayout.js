/**
 * Dashboard Layout Component
 * Main layout wrapper for authenticated pages with navbar and sidebar
 * Includes dark mode support and smooth transitions
 */
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import { Navbar, Sidebar } from '../components';

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

      {/* Main Content – fills remaining space next to sidebar */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 1.5, sm: 2.5, md: 3 },
          transition: 'background-color 0.3s ease',
          minHeight: '100vh',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;
