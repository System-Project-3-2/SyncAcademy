/**
 * Sidebar Component
 * Role-based sidebar navigation
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
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  CloudUpload as UploadIcon,
  Feedback as FeedbackIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  List as ListIcon,
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

const Sidebar = ({ open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const navItems = getNavItems(user?.role);

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  const drawer = (
    <Box sx={{ overflow: 'auto' }}>
      <Toolbar />
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Navigation
        </Typography>
      </Box>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                mx: 1,
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: location.pathname === item.path ? 'inherit' : 'primary.main',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
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
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
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
