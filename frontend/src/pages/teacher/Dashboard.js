/**
 * Teacher Dashboard
 * Overview of teacher's activities and statistics
 * Polished with dark mode support
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Box, Typography, Button, Paper, Chip, useTheme, alpha } from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Feedback as FeedbackIcon,
  CheckCircle as ResolvedIcon,
  HourglassEmpty as PendingIcon,
  Search as SearchIcon,
  ArrowForward as ArrowForwardIcon,
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import { PageHeader, StatCard, LoadingSpinner, EmptyState } from '../../components';
import { useAuth } from '../../hooks';
import { feedbackService } from '../../services';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [stats, setStats] = useState({
    totalFeedbacks: 0,
    pending: 0,
    resolved: 0,
  });
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const feedbacks = await feedbackService.getAllFeedbacks();
      
      const pending = feedbacks.filter((f) => f.status === 'pending').length;
      const resolved = feedbacks.filter((f) => f.status === 'resolved').length;
      
      setStats({
        totalFeedbacks: feedbacks.length,
        pending,
        resolved,
      });
      
      // Get recent pending feedbacks
      setRecentFeedbacks(
        feedbacks.filter((f) => f.status === 'pending').slice(0, 5)
      );
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
    { label: 'Upload Material', icon: <UploadIcon />, path: '/teacher/materials/upload', color: 'primary' },
    { label: 'My Materials', icon: <LibraryIcon />, path: '/teacher/materials', color: 'info' },
    { label: 'All Feedbacks', icon: <FeedbackIcon />, path: '/teacher/feedbacks', color: 'secondary' },
    { label: 'Search Materials', icon: <SearchIcon />, path: '/teacher/search', color: 'success' },
  ];

  return (
    <Box className="fade-in">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}! 👋`}
        subtitle="Manage materials and student feedbacks"
        actions={
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => navigate('/teacher/materials/upload')}
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Upload Material
          </Button>
        }
      />

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Feedbacks"
            value={stats.totalFeedbacks}
            icon={<FeedbackIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/teacher/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<PendingIcon fontSize="large" />}
            color="warning.main"
            subtitle="Awaiting response"
            onClick={() => navigate('/teacher/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={<ResolvedIcon fontSize="large" />}
            color="success.main"
          />
        </Grid>
      </Grid>

      {/* Quick Actions and Recent Feedbacks */}
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
                  Pending Feedbacks
                </Typography>
                {stats.pending > 0 && (
                  <Chip 
                    label={stats.pending} 
                    size="small" 
                    color="warning" 
                    sx={{ fontWeight: 700, fontSize: '0.75rem' }} 
                  />
                )}
              </Box>
              <Button 
                size="small" 
                onClick={() => navigate('/teacher/feedbacks')}
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 600, borderRadius: 2 }}
              >
                View All
              </Button>
            </Box>
            {recentFeedbacks.length === 0 ? (
              <EmptyState
                title="No pending feedbacks"
                description="All student feedbacks have been addressed. Great job!"
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
                    onClick={() => navigate('/teacher/feedbacks')}
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
                        label="Pending"
                        size="small"
                        color="warning"
                        variant={isDark ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
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

export default TeacherDashboard;
