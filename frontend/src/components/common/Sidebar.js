/**
 * Sidebar Component
 * Role-based sidebar navigation
 */
import React, { useState, useEffect } from 'react';
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
  Collapse,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  CloudUpload as UploadIcon,
  Feedback as FeedbackIcon,
  People as PeopleIcon,
  Add as AddIcon,
  LibraryBooks as LibraryIcon,
  School as CourseIconNav,
  SmartToy as AITutorIcon,
  ClassOutlined as MyCoursesIcon,
  Assignment as AssignmentIcon,
  Grading as GradingIcon,
  Notifications as NotificationsIcon,
  PersonAdd as InviteIcon,
  Event as EventIcon,
  Quiz as QuizIconNav,
  ExpandLess,
  ExpandMore,
  AutoAwesome as AIQuizIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks';

const drawerWidth = 260;

// Navigation items based on user role
const getNavItems = (role) => {
  const items = {
    student: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/student/dashboard' },
      { text: 'My Courses', icon: <MyCoursesIcon />, path: '/student/my-courses' },
      { text: 'AI Tutor', icon: <AITutorIcon />, path: '/student/ai-tutor' },
      { text: 'All Materials', icon: <LibraryIcon />, path: '/student/materials' },
      { text: 'Search Materials', icon: <SearchIcon />, path: '/student/search' },
      { text: 'Results', icon: <GradingIcon />, path: '/student/my-grades' },
      { text: 'My Quizzes', icon: <QuizIconNav />, path: '/student/my-quizzes' },
      { text: 'Events', icon: <EventIcon />, path: '/student/events' },
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/student/notifications' },
      { text: 'Submit Feedback', icon: <AddIcon />, path: '/student/feedback/new' },
      { text: 'My Feedbacks', icon: <FeedbackIcon />, path: '/student/feedbacks' },
    ],
    teacher: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/teacher/dashboard' },
      { text: 'AI Tutor', icon: <AITutorIcon />, path: '/teacher/ai-tutor' },
      { text: 'My Materials', icon: <LibraryIcon />, path: '/teacher/materials' },
      { text: 'Upload Material', icon: <UploadIcon />, path: '/teacher/materials/upload' },
      { text: 'Courses', icon: <CourseIconNav />, path: '/teacher/courses' },
      {
        text: 'Quizzes',
        icon: <QuizIconNav />,
        key: 'quizzes',
        children: [
          { text: 'My Quizzes', icon: <QuizIconNav />, path: '/teacher/quizzes' },
          { text: 'AI Quiz Generator', icon: <AIQuizIcon />, path: '/teacher/quizzes/generate' },
          { text: 'Create Quiz', icon: <AddIcon />, path: '/teacher/quizzes/create' },
        ],
      },
      { text: 'Course Invitations', icon: <InviteIcon />, path: '/teacher/invitations' },
      { text: 'Events', icon: <EventIcon />, path: '/teacher/events' },
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/teacher/notifications' },
      { text: 'All Feedbacks', icon: <FeedbackIcon />, path: '/teacher/feedbacks' },
      { text: 'Search Materials', icon: <SearchIcon />, path: '/teacher/search' },
    ],
    admin: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
      { text: 'AI Tutor', icon: <AITutorIcon />, path: '/admin/ai-tutor' },
      { text: 'All Materials', icon: <LibraryIcon />, path: '/admin/materials' },
      { text: 'Courses', icon: <CourseIconNav />, path: '/admin/courses' },
      { text: 'User Management', icon: <PeopleIcon />, path: '/admin/users' },
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/admin/notifications' },
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

  // Track which collapsible groups are expanded
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    navItems.forEach((item) => {
      if (item.children && item.children.some((c) => location.pathname.startsWith(c.path))) {
        initial[item.key] = true;
      }
    });
    return initial;
  });

  // Auto-expand group when user navigates into it externally
  useEffect(() => {
    const updates = {};
    navItems.forEach((item) => {
      if (item.children && item.children.some((c) => location.pathname.startsWith(c.path))) {
        updates[item.key] = true;
      }
    });
    if (Object.keys(updates).length) {
      setOpenGroups((prev) => ({ ...prev, ...updates }));
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const sharedItemSx = {
    mx: 1,
    borderRadius: 2,
    mb: 0.5,
    '&.Mui-selected': {
      backgroundColor: 'primary.main',
      color: 'white',
      '& .MuiListItemIcon-root': { color: 'white' },
      '&:hover': { backgroundColor: 'primary.dark' },
    },
  };

  const renderItem = (item) => {
    // ── Group item (collapsible) ──────────────────────────────
    if (item.children) {
      const isOpen = !!openGroups[item.key];
      const isGroupActive = item.children.some((c) => location.pathname.startsWith(c.path));
      return (
        <React.Fragment key={item.key}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => toggleGroup(item.key)}
              sx={{
                ...sharedItemSx,
                ...(isGroupActive && {
                  '& .MuiListItemText-primary': { fontWeight: 700 },
                }),
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
              {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </ListItemButton>
          </ListItem>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List disablePadding>
              {item.children.map((child) => (
                <ListItem key={child.path} disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation(child.path)}
                    selected={location.pathname === child.path}
                    sx={{ ...sharedItemSx, pl: 4 }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 36,
                        color: location.pathname === child.path ? 'inherit' : 'primary.main',
                      }}
                    >
                      {child.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={child.text}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
        </React.Fragment>
      );
    }

    // ── Flat item ─────────────────────────────────────────────
    return (
      <ListItem key={item.text} disablePadding>
        <ListItemButton
          onClick={() => handleNavigation(item.path)}
          selected={location.pathname === item.path}
          sx={sharedItemSx}
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
    );
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
        {navItems.map(renderItem)}
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
