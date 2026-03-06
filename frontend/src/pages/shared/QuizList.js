/**
 * QuizList Page (Shared)
 * Shows quizzes for a course. Teachers see all (draft+published), students see only published.
 * Teachers can manage quizzes, students can take/view results.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Quiz as QuizIcon,
  AutoAwesome as AIIcon,
  ArrowBack as BackIcon,
  MoreVert as MoreVertIcon,
  Publish as PublishIcon,
  Unpublished as UnpublishIcon,
  Delete as DeleteIcon,
  BarChart as ResultsIcon,
  PlayArrow as StartIcon,
  CheckCircle as CompletedIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { quizService, courseService } from '../../services';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components';

const QuizList = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [quizzes, setQuizzes] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuQuiz, setMenuQuiz] = useState(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await quizService.getQuizzesByCourse(courseId);
      setQuizzes(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const fetchCourse = useCallback(async () => {
    try {
      const data = await courseService.getCourseById(courseId);
      setCourse(data);
    } catch { /* ignore */ }
  }, [courseId]);

  useEffect(() => {
    fetchQuizzes();
    fetchCourse();
  }, [fetchQuizzes, fetchCourse]);

  const handleMenuOpen = (event, quiz) => {
    setMenuAnchor(event.currentTarget);
    setMenuQuiz(quiz);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuQuiz(null);
  };

  const handlePublishToggle = async () => {
    if (!menuQuiz) return;
    try {
      await quizService.publishQuiz(menuQuiz._id, !menuQuiz.isPublished);
      toast.success(menuQuiz.isPublished ? 'Quiz unpublished' : 'Quiz published');
      fetchQuizzes();
    } catch (err) {
      toast.error('Failed to update quiz');
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!menuQuiz) return;
    try {
      setDeleting(true);
      await quizService.deleteQuiz(menuQuiz._id);
      toast.success('Quiz deleted');
      setDeleteOpen(false);
      fetchQuizzes();
    } catch (err) {
      toast.error('Failed to delete quiz');
    } finally {
      setDeleting(false);
      handleMenuClose();
    }
  };

  const handleViewResults = () => {
    if (!menuQuiz) return;
    navigate(`/${user.role}/quizzes/${menuQuiz._id}/results`);
    handleMenuClose();
  };

  const handleEditQuiz = () => {
    if (!menuQuiz) return;
    navigate(`/${user.role}/quizzes/${menuQuiz._id}/edit`);
    handleMenuClose();
  };

  const basePath = `/${user?.role}`;

  if (loading) return <LoadingSpinner />;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title={`Quizzes${course ? ` — ${course.courseNo}` : ''}`}
        subtitle={course?.courseTitle || ''}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
              Back
            </Button>
            {isTeacher && (
              <Button
                startIcon={<AIIcon />}
                onClick={() => navigate(`${basePath}/quizzes/generate?courseId=${courseId}`)}
                variant="contained"
              >
                Generate AI Quiz
              </Button>
            )}
          </Box>
        }
      />

      {quizzes.length === 0 ? (
        <EmptyState
          title="No Quizzes Yet"
          description={
            isTeacher
              ? 'Generate your first AI quiz from course materials.'
              : 'No quizzes are available for this course yet.'
          }
          icon={<QuizIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
        />
      ) : (
        quizzes.map((quiz) => (
          <Card key={quiz._id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <QuizIcon color="primary" />
                    <Typography variant="h6">{quiz.title}</Typography>
                  </Box>
                  {quiz.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {quiz.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`${quiz.totalQuestions} Questions`} size="small" variant="outlined" />
                    {quiz.timeLimit && (
                      <Chip label={`${quiz.timeLimit} min`} size="small" variant="outlined" />
                    )}
                    {isTeacher && (
                      <Chip
                        label={quiz.isPublished ? 'Published' : 'Draft'}
                        size="small"
                        color={quiz.isPublished ? 'success' : 'default'}
                      />
                    )}
                    {!isTeacher && quiz.attemptStatus === 'completed' && (
                      <Chip
                        icon={<CompletedIcon />}
                        label={`Score: ${quiz.myPercentage}%`}
                        size="small"
                        color={quiz.myPercentage >= 70 ? 'success' : quiz.myPercentage >= 40 ? 'warning' : 'error'}
                      />
                    )}
                    {!isTeacher && quiz.attemptStatus === 'not_attempted' && (
                      <Chip label="Not Attempted" size="small" color="default" />
                    )}
                  </Box>
                </Box>
                {isTeacher && (
                  <IconButton onClick={(e) => handleMenuOpen(e, quiz)}>
                    <MoreVertIcon />
                  </IconButton>
                )}
              </Box>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2 }}>
              {isTeacher ? (
                <>
                  <Button
                    size="small"
                    startIcon={<ResultsIcon />}
                    onClick={() => navigate(`${basePath}/quizzes/${quiz._id}/results`)}
                  >
                    View Results
                  </Button>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`${basePath}/quizzes/${quiz._id}/edit`)}
                  >
                    Edit
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant={quiz.attemptStatus === 'completed' ? 'outlined' : 'contained'}
                  startIcon={quiz.attemptStatus === 'completed' ? <CompletedIcon /> : <StartIcon />}
                  onClick={() => navigate(`${basePath}/quizzes/${quiz._id}/take`)}
                >
                  {quiz.attemptStatus === 'completed' ? 'View Results' : 'Start Quiz'}
                </Button>
              )}
            </CardActions>
          </Card>
        ))
      )}

      {/* Teacher Action Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handlePublishToggle}>
          <ListItemIcon>
            {menuQuiz?.isPublished ? <UnpublishIcon /> : <PublishIcon />}
          </ListItemIcon>
          <ListItemText>{menuQuiz?.isPublished ? 'Unpublish' : 'Publish'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleViewResults}>
          <ListItemIcon><ResultsIcon /></ListItemIcon>
          <ListItemText>View Results</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEditQuiz}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setDeleteOpen(true); }}>
          <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Quiz</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{menuQuiz?.title}&quot;? This will also delete all student attempts and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteOpen(false); handleMenuClose(); }}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuizList;
