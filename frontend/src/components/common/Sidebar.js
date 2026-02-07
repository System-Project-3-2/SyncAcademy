/**
 * Sidebar Component
 * Compact, professional role-based navigation
 * Responsive: permanent on desktop, temporary drawer on mobile/tablet
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
<<<<<<< HEAD
=======
  List as ListIcon,
>>>>>>> feature/materials-page
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks';

const drawerWidth = 230;

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
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
      <Box sx={{ px: 1.75, pt: 1.75, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography 
            variant="overline" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
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
                height: 18, 
                fontSize: '0.55rem', 
                fontWeight: 700, 
                textTransform: 'uppercase',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>
      </Box>
      <Divider sx={{ mx: 1.75, borderColor: 'divider' }} />
      <List sx={{ px: 1.25, pt: 0.75, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isActive}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
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
                    minWidth: 34,
                    color: isActive ? 'inherit' : 'primary.main',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.835rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      
      {/* Footer */}
      <Box sx={{ px: 1.75, py: 1.25, textAlign: 'center' }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', opacity: 0.5 }}>
          Student Aid v1.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile / Tablet – temporary overlay drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
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

      {/* Desktop – permanent inline drawer */}
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
