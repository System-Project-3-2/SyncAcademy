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
  Radar as RadarIcon,
  Timeline as TimelineIcon,
  EmojiEvents as EmojiEventsIcon,
} from '@mui/icons-material';
import { PageHeader, StatCard, LoadingSpinner, EmptyState } from '../../components';
import { useAuth } from '../../hooks';
import { feedbackService, statsService } from '../../services';

const MAX_SPIDER_COURSES = 8;

const toShortCourseLabel = (courseNo, courseTitle) => {
  if (courseNo) return String(courseNo).toUpperCase();
  if (!courseTitle) return 'COURSE';
  return courseTitle
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'COURSE';
};

const PerformanceSpiderChart = ({ courses = [] }) => {
  const chartSize = 500;
  const center = chartSize / 2;
  const maxRadius = 136;
  const rings = [20, 40, 60, 80, 100];
  const radialData = (courses.length ? courses : []).slice(0, MAX_SPIDER_COURSES);

  if (!radialData.length) {
    return (
      <Box
        sx={{
          minHeight: 320,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          px: 3,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.8 }}>
            No performance data yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Student quiz/assignment attempts are needed to generate the course spider graph.
          </Typography>
        </Box>
      </Box>
    );
  }

  const axisCount = radialData.length;
  const angleStep = (Math.PI * 2) / axisCount;
  const startAngle = -Math.PI / 2;

  const getPoint = (index, percent, radiusOverride = null) => {
    const angle = startAngle + index * angleStep;
    const radius = radiusOverride !== null
      ? radiusOverride
      : (Math.max(0, Math.min(100, Number(percent) || 0)) / 100) * maxRadius;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  };

  const getAxisEnd = (index) => {
    const point = getPoint(index, 100, maxRadius);
    const labelPoint = getPoint(index, 100, maxRadius + 46);

    let anchor = 'middle';
    if (labelPoint.x < center - 16) anchor = 'end';
    if (labelPoint.x > center + 16) anchor = 'start';

    return {
      x: point.x,
      y: point.y,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      anchor,
    };
  };

  const assignmentPolygonPoints = radialData
    .map((course, index) => {
      const point = getPoint(index, course.assignmentAverage);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  const quizPolygonPoints = radialData
    .map((course, index) => {
      const point = getPoint(index, course.quizAverage);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  const ringPolygons = rings.map((ring) => {
    const ringRadius = (ring / 100) * maxRadius;
    return radialData
      .map((_, index) => {
        const point = getPoint(index, ring, ringRadius);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  });

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 1.4 }}>
      <svg width="100%" viewBox={`0 0 ${chartSize} ${chartSize}`} style={{ maxWidth: 540 }}>
        <defs>
          <filter id="teacherAssignmentGlow">
            <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="teacherQuizGlow">
            <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ringPolygons.map((points, index) => (
          <polygon
            key={`ring-${rings[index]}`}
            points={points}
            fill="none"
            stroke={index === ringPolygons.length - 1 ? 'rgba(231, 239, 244, 0.62)' : 'rgba(192, 203, 210, 0.42)'}
            strokeWidth={index === ringPolygons.length - 1 ? '2.2' : '1.5'}
          />
        ))}

        {radialData.map((_, index) => {
          const axis = getAxisEnd(index);
          return (
            <line
              key={`axis-${index}`}
              x1={center}
              y1={center}
              x2={axis.x}
              y2={axis.y}
              stroke="rgba(191, 206, 214, 0.48)"
              strokeWidth="1.4"
            />
          );
        })}

        <polygon
          points={assignmentPolygonPoints}
          fill="rgba(255, 235, 59, 0.10)"
          stroke="#f8e71c"
          strokeWidth="3.4"
          filter="url(#teacherAssignmentGlow)"
        />

        <polygon
          points={quizPolygonPoints}
          fill="rgba(255, 59, 48, 0.08)"
          stroke="#ff3b30"
          strokeWidth="3.2"
          filter="url(#teacherQuizGlow)"
        />

        {radialData.map((course, index) => {
          const assignmentPoint = getPoint(index, course.assignmentAverage);
          const quizPoint = getPoint(index, course.quizAverage);
          const axis = getAxisEnd(index);
          const shortLabel = toShortCourseLabel(course.courseNo, course.courseTitle);

          return (
            <g key={`point-${course.courseId || index}`}>
              <circle cx={assignmentPoint.x} cy={assignmentPoint.y} r="6" fill="#f8e71c" stroke="#fef08a" strokeWidth="1.4" />
              <circle cx={quizPoint.x} cy={quizPoint.y} r="6" fill="#ff3b30" stroke="#fda4af" strokeWidth="1.4" />
              <text
                x={axis.labelX}
                y={axis.labelY}
                fill="rgba(251, 253, 255, 1)"
                textAnchor={axis.anchor}
                dominantBaseline="middle"
                style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.6px' }}
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f8e71c', boxShadow: '0 0 8px rgba(248,231,28,0.7)' }} />
          <Typography variant="body2" sx={{ color: alpha('#f8fafc', 0.9), fontWeight: 700 }}>
            Assignment
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff3b30', boxShadow: '0 0 8px rgba(255,59,48,0.72)' }} />
          <Typography variant="body2" sx={{ color: alpha('#f8fafc', 0.9), fontWeight: 700 }}>
            Quiz
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [stats, setStats] = useState({
    materials: { total: 0, byType: [], recentlyAdded: 0 },
    feedbacks: { total: 0, pending: 0, resolved: 0, respondedByYou: 0, recentPending: 0 },
    performanceAnalytics: { byCourse: [], summary: { overallAverage: 0, coursesWithData: 0, bestCourse: null } },
  });
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats from the new endpoint
      const statsData = await statsService.getTeacherStats();
      setStats(statsData);
      
      // Fetch recent feedbacks
      const feedbacks = await feedbackService.getAllFeedbacks();
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

  const performanceCourses = (stats.performanceAnalytics?.byCourse || []).slice(0, MAX_SPIDER_COURSES);
  const performanceSummary = stats.performanceAnalytics?.summary || {
    overallAverage: 0,
    coursesWithData: 0,
    bestCourse: null,
  };

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
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="My Materials"
            value={stats.materials?.total || 0}
            icon={<LibraryIcon fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/teacher/materials')}
            subtitle={`${stats.materials?.recentlyAdded || 0} this month`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Feedbacks"
            value={stats.feedbacks?.total || 0}
            icon={<FeedbackIcon fontSize="large" />}
            color="info.main"
            onClick={() => navigate('/teacher/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending"
            value={stats.feedbacks?.pending || 0}
            icon={<PendingIcon fontSize="large" />}
            color="warning.main"
            subtitle="Awaiting response"
            onClick={() => navigate('/teacher/feedbacks')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Responded"
            value={stats.feedbacks?.respondedByYou || 0}
            icon={<ResolvedIcon fontSize="large" />}
            color="success.main"
            subtitle="By you"
          />
        </Grid>
      </Grid>

      {/* Quick Actions and Recent Feedbacks */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              background: `linear-gradient(140deg, ${alpha('#07191f', isDark ? 0.97 : 0.94)} 0%, ${alpha('#0b2630', isDark ? 0.95 : 0.9)} 54%, ${alpha('#11242a', isDark ? 0.93 : 0.88)} 100%)`,
              color: '#f8fafc',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 14% 20%, rgba(90,122,136,0.15), transparent 36%), radial-gradient(circle at 82% 70%, rgba(68,90,102,0.13), transparent 42%)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: 0.14,
                backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 8px)',
                pointerEvents: 'none',
              }}
            />

            <Grid container spacing={0} sx={{ position: 'relative', zIndex: 1 }}>
              <Grid item xs={12} lg={7}>
                <Box sx={{ p: { xs: 2.2, md: 3.2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                    <RadarIcon sx={{ color: '#d9e7ec' }} />
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                      Course Performance Analytics
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: alpha('#f8fafc', 0.84), maxWidth: 640, mb: 2.2 }}>
                    Spider graph showing how students are performing across your courses.
                    Yellow line represents Assignment average and Red line represents Quiz average.
                  </Typography>
                  <PerformanceSpiderChart courses={performanceCourses} />
                </Box>
              </Grid>

              <Grid item xs={12} lg={5}>
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 2.2, md: 3.2 },
                    borderLeft: { xs: 'none', lg: `1px solid ${alpha('#f8fafc', 0.14)}` },
                    borderTop: { xs: `1px solid ${alpha('#f8fafc', 0.14)}`, lg: 'none' },
                    backdropFilter: 'blur(2px)',
                  }}
                >
                  <Grid container spacing={1.5} sx={{ mb: 1.2 }}>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.8,
                          borderRadius: 2.5,
                          backgroundColor: alpha('#0891b2', 0.18),
                          border: `1px solid ${alpha('#67e8f9', 0.35)}`,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.86), fontWeight: 600 }}>
                          Overall Performance
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, mt: 0.4 }}>
                          {performanceSummary.overallAverage}%
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.8,
                          borderRadius: 2.5,
                          backgroundColor: alpha('#ea580c', 0.16),
                          border: `1px solid ${alpha('#fdba74', 0.35)}`,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.86), fontWeight: 600 }}>
                          Courses With Data
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, mt: 0.4 }}>
                          {performanceSummary.coursesWithData}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Box sx={{ mb: 2.1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <EmojiEventsIcon sx={{ color: '#fde68a', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Best Performing Course
                      </Typography>
                    </Box>
                    {performanceSummary.bestCourse ? (
                      <Chip
                        label={`${performanceSummary.bestCourse.courseNo} • ${performanceSummary.bestCourse.overallAverage}%`}
                        sx={{
                          bgcolor: alpha('#22c55e', 0.2),
                          color: '#dcfce7',
                          border: `1px solid ${alpha('#86efac', 0.44)}`,
                          fontWeight: 700,
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: alpha('#f8fafc', 0.82) }}>
                        No graded student data found yet.
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TimelineIcon sx={{ color: '#fda4af', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Course Breakdown
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {performanceCourses.length ? (
                        performanceCourses.map((course) => (
                          <Box
                            key={course.courseId}
                            sx={{
                              p: 1.2,
                              borderRadius: 2,
                              backgroundColor: alpha('#f8fafc', 0.1),
                              border: `1px solid ${alpha('#f8fafc', 0.15)}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                {course.courseNo}
                              </Typography>
                              <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.84) }} noWrap>
                                Quiz {course.quizAverage}% | Assignment {course.assignmentAverage}%
                              </Typography>
                            </Box>
                            <Chip
                              label={`${course.overallAverage}%`}
                              size="small"
                              sx={{
                                bgcolor: alpha('#0ea5e9', 0.26),
                                color: '#e0f2fe',
                                fontWeight: 700,
                                border: `1px solid ${alpha('#7dd3fc', 0.4)}`,
                              }}
                            />
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" sx={{ color: alpha('#f8fafc', 0.82) }}>
                          Students start attempting quizzes/assignments to see course analytics here.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

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
                {stats.feedbacks?.pending > 0 && (
                  <Chip 
                    label={stats.feedbacks?.pending} 
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
