/**
 * Student Dashboard
 * Overview of student's activities and quick actions
 * Polished with dark mode support
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Box, Typography, Button, Paper, useTheme, alpha, Chip } from '@mui/material';
import {
  Feedback as FeedbackIcon,
  Search as SearchIcon,
  CheckCircle as ResolvedIcon,
  HourglassEmpty as PendingIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  LibraryBooks as LibraryIcon,
  SmartToy as AITutorIcon,
  Insights as InsightsIcon,
  ClassOutlined as MyCoursesIcon,
} from '@mui/icons-material';
import { PageHeader, StatCard, LoadingSpinner, EmptyState } from '../../components';
import { useAuth } from '../../hooks';
import { feedbackService, statsService } from '../../services';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [stats, setStats] = useState({
    materials: { total: 0, byType: [], recentlyAdded: 0 },
    feedbacks: { total: 0, pending: 0, resolved: 0, byCategory: [] },
    enrollments: { enrolledCourses: 0 },
  });
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats from the new endpoint
      const statsData = await statsService.getStudentStats();
      setStats(statsData);
      
      // Fetch recent feedbacks
      const feedbacks = await feedbackService.getMyFeedbacks();
      setRecentFeedbacks(feedbacks.slice(0, 3));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const quickActions = [
    { label: 'AI Tutor', icon: <AITutorIcon />, path: '/student/ai-tutor', color: 'warning' },
    { label: 'Adaptive Recommendations', icon: <InsightsIcon />, path: '/student/adaptive-recommendations', color: 'primary' },
    { label: 'My Courses', icon: <MyCoursesIcon />, path: '/student/my-courses', color: 'info' },
    { label: 'Search Materials', icon: <SearchIcon />, path: '/student/search', color: 'primary' },
    { label: 'Submit Feedback', icon: <AddIcon />, path: '/student/feedback/new', color: 'secondary' },
    { label: 'My Feedbacks', icon: <FeedbackIcon />, path: '/student/feedbacks', color: 'info' },
    { label: 'All Materials', icon: <LibraryIcon />, path: '/student/materials', color: 'success' },
  ];

  return (
    <Box className="fade-in">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}! `}
        subtitle="Here's an overview of your academic activities"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/student/feedback/new')}
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Submit Feedback
          </Button>
        }
      />

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Enrolled Courses"
            value={stats.enrollments?.enrolledCourses || 0}
            icon={<MyCoursesIcon fontSize="large" />}
            color="info.main"
            onClick={() => navigate('/student/my-courses')}
            subtitle="Active enrollments"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Materials"
            value={stats.materials?.total || 0}
            icon={<LibraryIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/student/materials')}
            subtitle={`${stats.materials?.recentlyAdded || 0} added this week`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="My Feedbacks"
            value={stats.feedbacks?.total || 0}
            icon={<FeedbackIcon fontSize="large" />}
            color="info.main"
            onClick={() => navigate('/student/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending"
            value={stats.feedbacks?.pending || 0}
            icon={<PendingIcon fontSize="large" />}
            color="warning.main"
            subtitle="Awaiting response"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Resolved"
            value={stats.feedbacks?.resolved || 0}
            icon={<ResolvedIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
      </Grid>

      {/* Quick Actions + Recent Feedbacks */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
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

        <Grid item xs={12} md={6}>
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
              <Typography variant="h6" fontWeight={700}>
                Recent Feedbacks
              </Typography>
              <Button 
                size="small" 
                onClick={() => navigate('/student/feedbacks')}
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 600, borderRadius: 2 }}
              >
                View All
              </Button>
            </Box>
            {recentFeedbacks.length === 0 ? (
              <EmptyState
                title="No feedbacks yet"
                description="You haven't submitted any feedback yet."
                actionLabel="Submit Feedback"
                onAction={() => navigate('/student/feedback/new')}
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
                    onClick={() => navigate('/student/feedbacks')}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: '65%' }}>
                        {feedback.title}
                      </Typography>
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
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {feedback.category}
                    </Typography>
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

export default StudentDashboard;
