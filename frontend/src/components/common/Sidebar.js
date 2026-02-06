/**
 * Sidebar Component
 * Role-based sidebar navigation with polished dark mode support
 */
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  alpha,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  CloudUpload as UploadIcon,
  Feedback as FeedbackIcon,
  People as PeopleIcon,
  Add as AddIcon,
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks';

const drawerWidth = 260;

// Navigation items based on user role
const getNavItems = (role) => {
  const items = {
    student: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/student/dashboard' },
      { text: 'All Materials', icon: <LibraryIcon />, path: '/student/materials' },
      { text: 'Search Materials', icon: <SearchIcon />, path: '/student/search' },
      { text: 'Submit Feedback', icon: <AddIcon />, path: '/student/feedback/new' },
      { text: 'My Feedbacks', icon: <FeedbackIcon />, path: '/student/feedbacks' },
    ],
    teacher: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/teacher/dashboard' },
      { text: 'My Materials', icon: <LibraryIcon />, path: '/teacher/materials' },
      { text: 'Upload Material', icon: <UploadIcon />, path: '/teacher/materials/upload' },
      { text: 'All Feedbacks', icon: <FeedbackIcon />, path: '/teacher/feedbacks' },
      { text: 'Search Materials', icon: <SearchIcon />, path: '/teacher/search' },
    ],
    admin: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
      { text: 'All Materials', icon: <LibraryIcon />, path: '/admin/materials' },
      { text: 'User Management', icon: <PeopleIcon />, path: '/admin/users' },
      { text: 'All Feedbacks', icon: <FeedbackIcon />, path: '/admin/feedbacks' },
      { text: 'Upload Material', icon: <UploadIcon />, path: '/admin/materials/upload' },
      { text: 'Search Materials', icon: <SearchIcon />, path: '/admin/search' },
    ],
  };

  return items[role] || [];
};

const getRoleBadgeColor = (role) => {
  switch (role) {
    case 'admin': return 'error';
    case 'teacher': return 'secondary';
    case 'student': return 'primary';
    default: return 'default';
  }
};

const Sidebar = ({ open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';

  const navItems = getNavItems(user?.role);

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  const drawer = (
    <Box 
      sx={{ 
        overflow: 'auto',
        bgcolor: 'background.paper',
        height: '100%',
        transition: 'background-color 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Toolbar />
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography 
            variant="overline" 
            sx={{ 
              color: 'text.secondary',
              transition: 'color 0.3s ease',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            Navigation
          </Typography>
          {user?.role && (
            <Chip 
              label={user.role}
              size="small"
              color={getRoleBadgeColor(user.role)}
              sx={{ 
                height: 20, 
                fontSize: '0.6rem', 
                fontWeight: 700, 
                textTransform: 'uppercase',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )}
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'divider', mx: 2, transition: 'border-color 0.3s ease' }} />
      <List sx={{ px: 1, pt: 1, flex: 1 }}>
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isActive}
                sx={{
                  mx: 0.5,
                  borderRadius: 2,
                  py: 1,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                  '&:hover': {
                    backgroundColor: isDark 
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.primary.main, 0.06),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 38,
                    color: isActive ? 'inherit' : 'primary.main',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.875rem',
                    color: isActive ? 'inherit' : 'text.primary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      
      {/* Footer */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography 
          variant="caption" 
          color="text.disabled"
          sx={{ fontSize: '0.65rem' }}
        >
          Student Aid v1.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            bgcolor: 'background.paper',
            transition: 'background-color 0.3s ease',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export { drawerWidth };
export default Sidebar;
