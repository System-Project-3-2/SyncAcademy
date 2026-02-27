/**
 * Navbar Component
 * Role-based navigation bar with user menu and theme toggle
 * Polished with glassmorphism and smooth transitions
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Divider,
  useTheme as useMuiTheme,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  School as SchoolIcon,
  Logout,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggleMenu } from './ThemeToggle';

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const muiTheme = useMuiTheme();
  const navigate = useNavigate();
  const [anchorElUser, setAnchorElUser] = useState(null);

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleCloseUserMenu();
  };


  const handleLogoClick = () => {
    // If user is authenticated, send them to their role-based dashboard
    if (user && user.role) {
      navigate(`/${user.role}/dashboard`);
    } else {
      navigate("/");
    }
  };

  const handleProfile = () => {
    navigate(`/${user.role}/profile`);
    handleCloseUserMenu();
  };

  // Get role color
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return '#ef4444';
      case 'teacher':
        return '#8b5cf6';
      case 'student':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: isDark 
          ? `linear-gradient(135deg, ${alpha('#0f172a', 0.95)} 0%, ${alpha('#1e3a8a', 0.95)} 100%)`
          : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid',
        borderColor: isDark ? alpha('#ffffff', 0.08) : 'transparent',
        transition: 'all 0.3s ease',
      }}
    >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, sm: 2.5 } }}>
          {/* Mobile Menu Button */}
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 1.5, display: { md: 'none' } }}
            onClick={onMenuClick}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogoClick(); }}
            sx={{ 
              display: { xs: 'none', md: 'flex' }, 
              alignItems: 'center', 
              textDecoration: 'none',
              color: 'inherit',
              mr: 3,
              gap: 1,
              cursor: 'pointer',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: alpha('#ffffff', 0.15),
              }}
            >
              <SchoolIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              Student Aid
            </Typography>
          </Box>

          {/* Mobile Logo */}
          <Box
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogoClick(); }}
            sx={{ 
              display: { xs: 'flex', md: 'none' }, 
              alignItems: 'center', 
              textDecoration: 'none',
              color: 'inherit',
              flexGrow: 1,
              gap: 1,
              cursor: 'pointer',
            }}
          >
            <SchoolIcon sx={{ fontSize: 22 }} />
            <Typography variant="h6" noWrap sx={{ fontWeight: 800 }}>
              Student Aid
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }} />

          {/* Theme Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <ThemeToggleMenu size="medium" />
          </Box>

          {/* User Menu */}
          {user && (
            <Box sx={{ flexGrow: 0 }}>
              <Tooltip title="Account settings">
                <IconButton 
                  onClick={handleOpenUserMenu} 
                  sx={{ 
                    p: 0.5,
                    border: '2px solid',
                    borderColor: alpha('#ffffff', 0.3),
                    transition: 'border-color 0.2s ease',
                    '&:hover': { borderColor: alpha('#ffffff', 0.6) },
                  }}
                >
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(user.role),
                      fontWeight: 700,
                      width: 34,
                      height: 34,
                      fontSize: '0.95rem',
                    }}
                  >
                    {user.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                sx={{ mt: '50px' }}
                id="menu-appbar"
                anchorEl={anchorElUser}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
                PaperProps={{
                  sx: {
                    borderRadius: 2,
                    minWidth: 200,
                    border: '1px solid',
                    borderColor: 'divider',
                    mt: 0.5,
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography fontWeight={700} variant="body1">{user.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {user.email}
                  </Typography>
                  <Box
                    sx={{
                      display: 'inline-block',
                      mt: 0.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: getRoleColor(user.role),
                      color: 'white',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {user.role}
                  </Box>
                </Box>
                <Divider />
                <MenuItem 
                  onClick={handleProfile}
                  sx={{ 
                    mt: 0.5, 
                    mx: 1, 
                    borderRadius: 1,
                    '&:hover': { bgcolor: alpha(muiTheme.palette.primary.main, 0.08) },
                  }}
                >
                  <PersonIcon sx={{ mr: 1.5 }} fontSize="small" />
                  My Profile
                </MenuItem>
                <MenuItem 
                  onClick={handleLogout}
                  sx={{ 
                    mx: 1, 
                    mb: 0.5,
                    borderRadius: 1,
                    color: 'error.main',
                    '&:hover': { bgcolor: alpha(muiTheme.palette.error.main, 0.08) },
                  }}
                >
                  <Logout sx={{ mr: 1.5 }} fontSize="small" />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
    </AppBar>
  );
};

export default Navbar;
