/**
 * My Courses Page
 * Shows enrolled courses for students with join/unenroll functionality
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Chip,
  Paper,
  alpha,
  useTheme,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  School as CourseIcon,
  LibraryBooks as MaterialsIcon,
  Person as TeacherIcon,
  ExitToApp as UnenrollIcon,
  Close as CloseIcon,
  LoginOutlined as JoinIcon,
  CalendarToday as DateIcon,
  Quiz as QuizIcon,
  Forum as StreamIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  PageHeader,
  LoadingSpinner,
  EmptyState,
} from '../../components';
import { enrollmentService } from '../../services';

const MyCourses = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Join Course dialog
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Unenroll confirmation dialog
  const [unenrollDialog, setUnenrollDialog] = useState({ open: false, course: null });
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      const data = await enrollmentService.getMyEnrolledCourses();
      setCourses(data);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const regex = new RegExp(searchQuery, 'i');
    return courses.filter(
      (c) => regex.test(c.courseNo) || regex.test(c.courseTitle)
    );
  }, [courses, searchQuery]);

  const handleJoinCourse = async () => {
    if (!courseCode.trim()) {
      toast.error('Please enter a course code');
      return;
    }

    setIsJoining(true);
    try {
      await enrollmentService.enrollInCourse(courseCode.trim());
      toast.success('Successfully enrolled in course!');
      setJoinDialogOpen(false);
      setCourseCode('');
      fetchEnrolledCourses();
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to join course';
      toast.error(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleUnenroll = async () => {
    if (!unenrollDialog.course) return;

    setIsUnenrolling(true);
    try {
      await enrollmentService.unenrollFromCourse(unenrollDialog.course._id);
      toast.success('Successfully unenrolled from course');
      setUnenrollDialog({ open: false, course: null });
      fetchEnrolledCourses();
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to unenroll';
      toast.error(message);
    } finally {
      setIsUnenrolling(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading your courses..." />;
  }

  return (
    <Box className="fade-in">
      <PageHeader
        title="My Courses"
        subtitle={`You are enrolled in ${courses.length} course(s)`}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setJoinDialogOpen(true)}
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Join Course
          </Button>
        }
      />

      {/* Search */}
      {courses.length > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search enrolled courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Paper>
      )}

      {/* Courses Grid */}
      {filteredCourses.length > 0 ? (
        <Grid container spacing={3}>
          {filteredCourses.map((course) => (
            <Grid item xs={12} sm={6} md={4} key={course._id}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {/* Card Header with color strip */}
                <Box
                  sx={{
                    height: 8,
                    borderRadius: '12px 12px 0 0',
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  }}
                />
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={course.courseNo}
                      size="small"
                      color="primary"
                      variant={isDark ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                    />
                    {course.department && (
                      <Chip
                        label={course.department}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1, lineHeight: 1.3 }}>
                    {course.courseTitle}
                  </Typography>
                  {course.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {course.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TeacherIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {course.createdBy?.name || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <MaterialsIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {course.materialCount || 0} material(s)
                      </Typography>
                    </Box>
                    {course.enrolledAt && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DateIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Joined {new Date(course.enrolledAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 3, pb: 2, pt: 0, justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<MaterialsIcon />}
                      onClick={() => navigate('/student/materials')}
                      sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                      Materials
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<StreamIcon />}
                      onClick={() => navigate(`/student/courses/${course._id}/stream`)}
                      sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                      Notice
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<QuizIcon />}
                      onClick={() => navigate(`/student/courses/${course._id}/quizzes`)}
                      sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                      Quizzes
                    </Button>
                  </Box>
                  <Tooltip title="Unenroll from course">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() =>
                        setUnenrollDialog({ open: true, course })
                      }
                    >
                      <UnenrollIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : courses.length > 0 ? (
        <EmptyState
          title="No matching courses"
          description="No courses match your search query."
          icon={<SearchIcon sx={{ fontSize: 64 }} />}
        />
      ) : (
        <EmptyState
          title="No enrolled courses"
          description="You haven't enrolled in any courses yet. Click 'Join Course' to get started!"
          actionLabel="Join a Course"
          onAction={() => setJoinDialogOpen(true)}
          icon={<CourseIcon sx={{ fontSize: 64 }} />}
        />
      )}

      {/* Join Course Dialog */}
      <Dialog
        open={joinDialogOpen}
        onClose={() => {
          if (!isJoining) {
            setJoinDialogOpen(false);
            setCourseCode('');
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
          <JoinIcon color="primary" />
          Join a Course
          <IconButton
            onClick={() => {
              setJoinDialogOpen(false);
              setCourseCode('');
            }}
            sx={{ ml: 'auto' }}
            disabled={isJoining}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter the secret enrollment code provided by your teacher to join a course.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Enrollment Code"
            placeholder="e.g., A3F7B2C1"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoinCourse();
            }}
            disabled={isJoining}
            helperText="Ask your teacher for the secret code"
            inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setJoinDialogOpen(false);
              setCourseCode('');
            }}
            disabled={isJoining}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleJoinCourse}
            disabled={isJoining || !courseCode.trim()}
            startIcon={<JoinIcon />}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {isJoining ? 'Joining...' : 'Join'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unenroll Confirmation Dialog */}
      <Dialog
        open={unenrollDialog.open}
        onClose={() => {
          if (!isUnenrolling) setUnenrollDialog({ open: false, course: null });
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Unenroll from Course?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to unenroll from{' '}
            <strong>
              {unenrollDialog.course?.courseNo} — {unenrollDialog.course?.courseTitle}
            </strong>
            ? You will lose access to its materials until you re-enroll.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setUnenrollDialog({ open: false, course: null })}
            disabled={isUnenrolling}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleUnenroll}
            disabled={isUnenrolling}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {isUnenrolling ? 'Unenrolling...' : 'Unenroll'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyCourses;
