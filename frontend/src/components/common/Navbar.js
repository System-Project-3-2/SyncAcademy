/**
 * Navbar Component
 * Role-based navigation bar with user menu and theme toggle
 * Polished with glassmorphism and smooth transitions
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  School as SchoolIcon,
  Logout,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  UploadFile as UploadIcon,
  Campaign as AnnouncementIcon,
  Comment as CommentIcon,
  Assignment as AssignmentIcon,
  Grading as GradingIcon,
  EmojiEvents as ResultIcon,
  Description as ScriptIcon,
  Feedback as FeedbackIcon,
  School as EnrollmentIcon,
  Quiz as QuizNotifIcon,
  Circle as UnreadDot,
} from '@mui/icons-material';
import { useAuth } from '../../hooks';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggleMenu } from './ThemeToggle';
import notificationService from '../../services/notificationService';

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const muiTheme = useMuiTheme();
  const navigate = useNavigate();
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [anchorElNotif, setAnchorElNotif] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Poll unread count every 30 seconds
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleOpenNotif = async (event) => {
    setAnchorElNotif(event.currentTarget);
    setNotifLoading(true);
    try {
      const res = await notificationService.getNotifications(1, 5);
      setRecentNotifs(res.data.data);
    } catch { /* ignore */ }
    setNotifLoading(false);
  };

  const handleCloseNotif = () => setAnchorElNotif(null);

  const handleNotifClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif._id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifs((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
      } catch { /* ignore */ }
    }
    handleCloseNotif();
    if (notif.link) {
      const link = notif.link.startsWith(`/${user?.role}`) ? notif.link : `/${user?.role}${notif.link}`;
      navigate(link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setUnreadCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  const notifTypeIcons = {
    material_upload: <UploadIcon fontSize="small" color="primary" />,
    announcement: <AnnouncementIcon fontSize="small" color="warning" />,
    comment: <CommentIcon fontSize="small" color="info" />,
    assignment_created: <AssignmentIcon fontSize="small" color="secondary" />,
    assignment_graded: <GradingIcon fontSize="small" color="success" />,
    result_published: <ResultIcon fontSize="small" sx={{ color: '#f59e0b' }} />,
    evaluated_script: <ScriptIcon fontSize="small" color="primary" />,
    feedback_response: <FeedbackIcon fontSize="small" color="info" />,
    enrollment: <EnrollmentIcon fontSize="small" color="success" />,
    quiz_created: <QuizNotifIcon fontSize="small" color="secondary" />,
    quiz_scheduled: <QuizNotifIcon fontSize="small" color="info" />,
    quiz_published: <QuizNotifIcon fontSize="small" color="success" />,
  };

  const formatTime = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

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

          {/* Notification Bell */}
          {user && (
            <Box sx={{ mr: 1 }}>
              <Tooltip title="Notifications">
                <IconButton color="inherit" onClick={handleOpenNotif}>
                  <Badge badgeContent={unreadCount} color="error" max={99}>
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Popover
                open={Boolean(anchorElNotif)}
                anchorEl={anchorElNotif}
                onClose={handleCloseNotif}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    width: { xs: 'calc(100vw - 24px)', sm: 360 },
                    maxWidth: 360,
                    maxHeight: { xs: '70vh', sm: 420 },
                    borderRadius: 2,
                    mt: 0.5,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
                  <Typography fontWeight={700} variant="body1">Notifications</Typography>
                  {unreadCount > 0 && (
                    <Button size="small" onClick={handleMarkAllRead}>Mark all read</Button>
                  )}
                </Box>
                <Divider />
                {notifLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : recentNotifs.length === 0 ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No notifications</Typography>
                  </Box>
                ) : (
                  <List disablePadding dense>
                    {recentNotifs.map((n) => (
                      <ListItem
                        key={n._id}
                        onClick={() => handleNotifClick(n)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: n.isRead ? 'transparent' : alpha(muiTheme.palette.primary.main, 0.04),
                          '&:hover': { bgcolor: alpha(muiTheme.palette.primary.main, 0.08) },
                          py: 1,
                          px: 2,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {notifTypeIcons[n.type] || <NotificationsIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {!n.isRead && <UnreadDot sx={{ fontSize: 6, color: 'primary.main' }} />}
                              <Typography variant="body2" fontWeight={n.isRead ? 400 : 600} noWrap>
                                {n.title}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {n.message} · {formatTime(n.createdAt)}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Divider />
                <Box sx={{ p: 1, textAlign: 'center' }}>
                  <Button
                    size="small"
                    onClick={() => { handleCloseNotif(); navigate(`/${user?.role}/notifications`); }}
                  >
                    See all notifications
                  </Button>
                </Box>
              </Popover>
            </Box>
          )}

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
                    src={user.avatar || ''}
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
                    minWidth: { xs: 180, sm: 200 },
                    maxWidth: 'calc(100vw - 24px)',
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
