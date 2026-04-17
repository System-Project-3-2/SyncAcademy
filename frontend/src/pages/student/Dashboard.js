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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chartSize = 500;
  const center = chartSize / 2;
  const maxRadius = 136;
  const rings = [20, 40, 60, 80, 100];
  const ASSIGNMENT_AREA_VISUAL_FLOOR = 3;
  const radialData = (courses.length ? courses : []).slice(0, MAX_SPIDER_COURSES);
  const assignmentStroke = isDark ? '#facc15' : '#d97706';
  const assignmentFill = alpha(assignmentStroke, isDark ? 0.24 : 0.3);
  const assignmentPointStroke = isDark ? '#fde68a' : '#fef3c7';
  const quizStroke = isDark ? '#ff4d4f' : '#dc2626';
  const quizFill = alpha(quizStroke, isDark ? 0.1 : 0.14);
  const quizPointStroke = isDark ? '#fda4af' : '#fecaca';
  const axisStroke = alpha(isDark ? '#d5e2ea' : '#1e293b', isDark ? 0.42 : 0.32);
  const ringStroke = alpha(isDark ? '#dde8ef' : '#334155', isDark ? 0.42 : 0.26);
  const outerRingStroke = alpha(isDark ? '#edf4f8' : '#0f172a', isDark ? 0.62 : 0.4);
  const labelColor = alpha(isDark ? '#f8fafc' : theme.palette.text.primary, isDark ? 0.96 : 0.9);
  const tickColor = alpha(isDark ? '#e4ecf2' : theme.palette.text.secondary, isDark ? 0.5 : 0.7);

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
            Complete quizzes and receive graded assignments to unlock your multi-course spider graph.
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
      angle,
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

  const toAssignmentAreaPercent = (value) => {
    const normalized = Math.max(0, Math.min(100, Number(value) || 0));
    if (normalized <= 0) return ASSIGNMENT_AREA_VISUAL_FLOOR;
    return normalized;
  };

  const assignmentPolygonPoints = radialData
    .map((course, index) => {
      const point = getPoint(index, toAssignmentAreaPercent(course.assignmentAverage));
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
          <filter id="assignmentGlow">
            <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="quizGlow">
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
            stroke={index === ringPolygons.length - 1 ? outerRingStroke : ringStroke}
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
              stroke={axisStroke}
              strokeWidth="1.4"
            />
          );
        })}

        <polygon
          points={quizPolygonPoints}
          fill={quizFill}
          stroke={quizStroke}
          strokeWidth="3.2"
          filter="url(#quizGlow)"
        />

        <polygon
          points={assignmentPolygonPoints}
          fill={assignmentFill}
          stroke={assignmentStroke}
          strokeWidth="3.8"
          filter="url(#assignmentGlow)"
        />

        {radialData.map((course, index) => {
          const assignmentPoint = getPoint(index, course.assignmentAverage);
          const quizPoint = getPoint(index, course.quizAverage);
          const axis = getAxisEnd(index);
          const shortLabel = toShortCourseLabel(course.courseNo, course.courseTitle);
          const overlap = Math.abs(Number(course.assignmentAverage || 0) - Number(course.quizAverage || 0)) < 0.2;

          return (
            <g key={`point-${course.courseId || index}`}>
              {overlap ? (
                <>
                  <circle cx={assignmentPoint.x} cy={assignmentPoint.y} r="7.4" fill={assignmentStroke} stroke={assignmentPointStroke} strokeWidth="1.4" />
                  <circle cx={quizPoint.x} cy={quizPoint.y} r="4.4" fill={quizStroke} stroke={quizPointStroke} strokeWidth="1.2" />
                </>
              ) : (
                <>
                  <circle cx={assignmentPoint.x} cy={assignmentPoint.y} r="6.4" fill={assignmentStroke} stroke={assignmentPointStroke} strokeWidth="1.6" />
                  <circle cx={quizPoint.x} cy={quizPoint.y} r="6" fill={quizStroke} stroke={quizPointStroke} strokeWidth="1.4" />
                </>
              )}
              <text
                x={axis.labelX}
                y={axis.labelY}
                fill={labelColor}
                textAnchor={axis.anchor}
                dominantBaseline="middle"
                style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.6px' }}
              >
                {shortLabel}
              </text>
            </g>
          );
        })}

        {rings.map((ring) => {
          const ringY = center - (ring / 100) * maxRadius;
          return (
            <text
              key={`ring-value-${ring}`}
              x={center + 6}
              y={ringY - 4}
              fill={tickColor}
              style={{ fontSize: '10px', fontWeight: 600 }}
            >
              {ring}
            </text>
          );
        })}
      </svg>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: assignmentStroke, boxShadow: `0 0 8px ${alpha(assignmentStroke, 0.72)}` }} />
          <Typography variant="body2" sx={{ color: labelColor, fontWeight: 700 }}>
            Assignment
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: quizStroke, boxShadow: `0 0 8px ${alpha(quizStroke, 0.72)}` }} />
          <Typography variant="body2" sx={{ color: labelColor, fontWeight: 700 }}>
            Quiz
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [stats, setStats] = useState({
    materials: { total: 0, byType: [], recentlyAdded: 0 },
    feedbacks: { total: 0, pending: 0, resolved: 0, byCategory: [] },
    enrollments: { enrolledCourses: 0 },
    performanceAnalytics: { byCourse: [], summary: { overallAverage: 0, coursesWithData: 0, bestCourse: null, weakestCourse: null } },
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

  const performanceCourses = (stats.performanceAnalytics?.byCourse || []).slice(0, MAX_SPIDER_COURSES);
  const performanceSummary = stats.performanceAnalytics?.summary || {
    overallAverage: 0,
    coursesWithData: 0,
    bestCourse: null,
    weakestCourse: null,
  };
  const analyticsTextColor = isDark ? '#f8fafc' : theme.palette.text.primary;
  const analyticsMutedColor = alpha(analyticsTextColor, isDark ? 0.84 : 0.76);
  const analyticsSoftBorder = alpha(analyticsTextColor, isDark ? 0.14 : 0.16);
  const analyticsRowBg = isDark ? alpha('#f8fafc', 0.1) : alpha('#0f172a', 0.06);
  const analyticsRowBorder = isDark ? alpha('#f8fafc', 0.15) : alpha('#0f172a', 0.1);

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
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              background: isDark
                ? `linear-gradient(140deg, ${alpha('#07191f', 0.97)} 0%, ${alpha('#0b2630', 0.95)} 54%, ${alpha('#11242a', 0.93)} 100%)`
                : `linear-gradient(145deg, ${alpha('#f8fcff', 0.98)} 0%, ${alpha('#edf5ff', 0.95)} 55%, ${alpha('#e6f0ff', 0.92)} 100%)`,
              color: analyticsTextColor,
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: isDark
                  ? 'radial-gradient(circle at 14% 20%, rgba(90,122,136,0.15), transparent 36%), radial-gradient(circle at 82% 70%, rgba(68,90,102,0.13), transparent 42%)'
                  : 'radial-gradient(circle at 15% 24%, rgba(96,165,250,0.2), transparent 40%), radial-gradient(circle at 84% 72%, rgba(125,211,252,0.2), transparent 44%)',
                pointerEvents: 'none',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: isDark ? 0.14 : 0.12,
                backgroundImage: isDark
                  ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 8px)'
                  : 'repeating-linear-gradient(135deg, rgba(15,23,42,0.05) 0px, rgba(15,23,42,0.05) 1px, transparent 1px, transparent 9px)',
                pointerEvents: 'none',
              }}
            />

            <Grid container spacing={0} sx={{ position: 'relative', zIndex: 1 }}>
              <Grid item xs={12} lg={7}>
                <Box sx={{ p: { xs: 2.2, md: 3.2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                    <RadarIcon sx={{ color: isDark ? '#d9e7ec' : '#1d4ed8' }} />
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                      Performance Analytics
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: analyticsMutedColor, maxWidth: 640, mb: 2.2 }}>
                    Real spider graph with course corners as axes and two dimensions.
                    Yellow line shows Assignment performance and Red line shows Quiz performance.
                  </Typography>
                  <PerformanceSpiderChart courses={performanceCourses} />
                </Box>
              </Grid>

              <Grid item xs={12} lg={5}>
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 2.2, md: 3.2 },
                    borderLeft: { xs: 'none', lg: `1px solid ${analyticsSoftBorder}` },
                    borderTop: { xs: `1px solid ${analyticsSoftBorder}`, lg: 'none' },
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
                          backgroundColor: isDark ? alpha('#0891b2', 0.18) : alpha('#0ea5e9', 0.14),
                          border: `1px solid ${isDark ? alpha('#67e8f9', 0.35) : alpha('#0ea5e9', 0.35)}`,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: alpha(analyticsTextColor, isDark ? 0.86 : 0.8), fontWeight: 600 }}>
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
                          backgroundColor: isDark ? alpha('#ea580c', 0.16) : alpha('#f59e0b', 0.12),
                          border: `1px solid ${isDark ? alpha('#fdba74', 0.35) : alpha('#f59e0b', 0.36)}`,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: alpha(analyticsTextColor, isDark ? 0.86 : 0.8), fontWeight: 600 }}>
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
                      <EmojiEventsIcon sx={{ color: isDark ? '#fde68a' : '#b45309', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Top Course
                      </Typography>
                    </Box>
                    {performanceSummary.bestCourse ? (
                      <Chip
                        label={`${performanceSummary.bestCourse.courseNo} • ${performanceSummary.bestCourse.overallAverage}%`}
                        sx={{
                          bgcolor: isDark ? alpha('#22c55e', 0.2) : alpha('#16a34a', 0.16),
                          color: isDark ? '#dcfce7' : '#14532d',
                          border: `1px solid ${isDark ? alpha('#86efac', 0.44) : alpha('#16a34a', 0.42)}`,
                          fontWeight: 700,
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: alpha(analyticsTextColor, isDark ? 0.82 : 0.72) }}>
                        Not enough graded data yet.
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TimelineIcon sx={{ color: isDark ? '#fda4af' : '#be123c', fontSize: 20 }} />
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
                              backgroundColor: analyticsRowBg,
                              border: `1px solid ${analyticsRowBorder}`,
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
                              <Typography variant="caption" sx={{ color: alpha(analyticsTextColor, isDark ? 0.84 : 0.72) }} noWrap>
                                Quiz {course.quizAverage}% | Assignment {course.assignmentAverage}%
                              </Typography>
                            </Box>
                            <Chip
                              label={`${course.overallAverage}%`}
                              size="small"
                              sx={{
                                bgcolor: isDark ? alpha('#0ea5e9', 0.26) : alpha('#0284c7', 0.16),
                                color: isDark ? '#e0f2fe' : '#0c4a6e',
                                fontWeight: 700,
                                border: `1px solid ${isDark ? alpha('#7dd3fc', 0.4) : alpha('#0284c7', 0.35)}`,
                              }}
                            />
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" sx={{ color: alpha(analyticsTextColor, isDark ? 0.82 : 0.72) }}>
                          Your per-course performance will appear after your first graded quiz or assignment.
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
