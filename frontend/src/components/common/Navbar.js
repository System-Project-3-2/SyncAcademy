/**
 * Navbar Component
 * Role-based navigation bar with user menu and theme toggle
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Container,
  Button,
  Divider,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  School as SchoolIcon,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useAuth } from '../../hooks';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggleButton, ThemeToggleMenu } from './ThemeToggle';

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
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: isDark 
          ? 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)'
          : 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)',
        transition: 'background 0.3s ease',
      }}
    >
      <Container maxWidth={false}>
        <Toolbar disableGutters>
          {/* Mobile Menu Button */}
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2, display: { md: 'none' } }}
            onClick={onMenuClick}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <SchoolIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Student Aid
          </Typography>

          {/* Mobile Logo */}
          <SchoolIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              flexGrow: 1,
              display: { xs: 'flex', md: 'none' },
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Student Aid
          </Typography>

          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }} />

          {/* Theme Toggle - Always visible */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <ThemeToggleMenu size="medium" />
          </Box>

          {/* User Menu */}
          {user && (
            <Box sx={{ flexGrow: 0 }}>
              <Tooltip title="Account settings">
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(user.role),
                      fontWeight: 600,
                    }}
                  >
                    {user.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                sx={{ mt: '45px' }}
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
              >
                <MenuItem disabled>
                  <Box>
                    <Typography fontWeight={600}>{user.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                    <Box
                      sx={{
                        display: 'inline-block',
                        ml: 1,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: getRoleColor(user.role),
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {user.role}
                    </Box>
                  </Box>
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <Logout sx={{ mr: 1 }} fontSize="small" />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
