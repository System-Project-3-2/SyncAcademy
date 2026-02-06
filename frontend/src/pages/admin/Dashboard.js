/**
 * Admin Dashboard
 * System overview with key statistics - polished with dark mode support
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Box, Typography, Paper, Button, Chip, useTheme, alpha, LinearProgress } from '@mui/material';
import {
  People as PeopleIcon,
  Feedback as FeedbackIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  School as StudentIcon,
  Work as TeacherIcon,
  ArrowForward as ArrowForwardIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { PageHeader, StatCard, LoadingSpinner, EmptyState } from '../../components';
import { useAuth } from '../../hooks';
import { feedbackService, adminService } from '../../services';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [stats, setStats] = useState({
    totalFeedbacks: 0,
    pending: 0,
    resolved: 0,
  });
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    students: 0,
    teachers: 0,
    admins: 0,
  });
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch feedbacks
      const feedbacks = await feedbackService.getAllFeedbacks();
      
      const pending = feedbacks.filter((f) => f.status === 'pending').length;
      const resolved = feedbacks.filter((f) => f.status === 'resolved').length;
      
      setStats({
        totalFeedbacks: feedbacks.length,
        pending,
        resolved,
      });
      
      setRecentFeedbacks(feedbacks.slice(0, 5));

      // Fetch user stats
      const userStatsData = await adminService.getUserStats();
      setUserStats(userStatsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const resolutionRate = stats.totalFeedbacks > 0
    ? Math.round((stats.resolved / stats.totalFeedbacks) * 100)
    : 0;

  const quickActions = [
    { label: 'User Management', icon: <PeopleIcon />, path: '/admin/users', color: 'primary' },
    { label: 'All Feedbacks', icon: <FeedbackIcon />, path: '/admin/feedbacks', color: 'secondary' },
    { label: 'Upload Material', icon: <UploadIcon />, path: '/admin/materials/upload', color: 'success' },
    { label: 'Search Materials', icon: <SearchIcon />, path: '/admin/search', color: 'info' },
  ];

  return (
    <Box className="fade-in">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}! 👋`}
        subtitle="System Administration Dashboard"
        actions={
          <Button
            variant="contained"
            startIcon={<PeopleIcon />}
            onClick={() => navigate('/admin/users')}
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Manage Users
          </Button>
        }
      />

      {/* User Stats Grid */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PeopleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="h6" fontWeight={700}>
          User Overview
        </Typography>
      </Box>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={userStats.totalUsers}
            icon={<PeopleIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/admin/users')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Students"
            value={userStats.students}
            icon={<StudentIcon fontSize="large" />}
            color="info.main"
            onClick={() => navigate('/admin/users')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Teachers"
            value={userStats.teachers}
            icon={<TeacherIcon fontSize="large" />}
            color="secondary.main"
            onClick={() => navigate('/admin/users')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Admins"
            value={userStats.admins}
            icon={<PeopleIcon fontSize="large" />}
            color="error.main"
            onClick={() => navigate('/admin/users')}
          />
        </Grid>
      </Grid>

      {/* Feedback Stats Grid */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FeedbackIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
        <Typography variant="h6" fontWeight={700}>
          Feedback Overview
        </Typography>
      </Box>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Feedbacks"
            value={stats.totalFeedbacks}
            icon={<FeedbackIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/admin/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<PendingIcon fontSize="large" />}
            color="warning.main"
            onClick={() => navigate('/admin/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={<CheckCircleIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {/* Resolution Rate Card with progress bar */}
          <Paper
            elevation={0}
            className="fade-in"
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, ${theme.palette.info.main}, ${alpha(theme.palette.info.main, 0.4)})`,
              },
            }}
          >
            <Typography 
              variant="overline" 
              color="text.secondary" 
              sx={{ fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 600 }}
            >
              Resolution Rate
            </Typography>
            <Typography variant="h3" fontWeight={800} color="info.main" sx={{ lineHeight: 1.2, mt: 0.5 }}>
              {resolutionRate}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={resolutionRate}
              sx={{
                mt: 1.5,
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.info.main, 0.12),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  bgcolor: 'info.main',
                },
              }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions and Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outlined"
                  fullWidth
                  startIcon={action.icon}
                  endIcon={<ArrowForwardIcon sx={{ fontSize: '16px !important' }} />}
                  onClick={() => navigate(action.path)}
                  sx={{ 
                    justifyContent: 'flex-start', 
                    py: 1.5,
                    borderRadius: 2,
                    fontWeight: 500,
                    borderColor: 'divider',
                    color: 'text.primary',
                    '& .MuiButton-endIcon': { ml: 'auto' },
                    '&:hover': { 
                      borderColor: `${action.color}.main`,
                      bgcolor: alpha(theme.palette[action.color].main, isDark ? 0.1 : 0.04),
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>
                  Recent Activity
                </Typography>
                {recentFeedbacks.length > 0 && (
                  <Chip 
                    label={recentFeedbacks.length}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Box>
              <Button 
                size="small" 
                onClick={() => navigate('/admin/feedbacks')}
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 600, borderRadius: 2 }}
              >
                View All
              </Button>
            </Box>
            {recentFeedbacks.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="There are no feedbacks in the system yet."
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {recentFeedbacks.map((feedback) => (
                  <Box
                    key={feedback._id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                        borderColor: 'primary.main',
                      },
                    }}
                    onClick={() => navigate('/admin/feedbacks')}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, mr: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} noWrap>
                          {feedback.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          From: {feedback.student?.name || 'Unknown'} • {feedback.category}
                        </Typography>
                      </Box>
                      <Chip
                        label={feedback.status}
                        size="small"
                        color={feedback.status === 'resolved' ? 'success' : 'warning'}
                        variant={isDark ? 'filled' : 'outlined'}
                        sx={{ 
                          textTransform: 'capitalize', 
                          fontWeight: 600, 
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
