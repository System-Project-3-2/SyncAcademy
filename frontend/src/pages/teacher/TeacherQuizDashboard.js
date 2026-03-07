/**
 * TeacherQuizDashboard Page
 * Shows all quizzes created by the teacher across all courses.
 * Lets the teacher manage (publish/unpublish, edit, view results, delete) from one place.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Quiz as QuizIcon,
  AutoAwesome as AIIcon,
  Edit as EditIcon,
  Publish as PublishIcon,
  Unpublished as UnpublishIcon,
  Delete as DeleteIcon,
  BarChart as ResultsIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Search as SearchIcon,
  PeopleAlt as AttemptIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { quizService } from '../../services';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components';

const TeacherQuizDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuQuiz, setMenuQuiz] = useState(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const basePath = `/${user?.role}`;

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await quizService.getMyCreatedQuizzes();
      setQuizzes(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleMenuOpen = (e, quiz) => { setMenuAnchor(e.currentTarget); setMenuQuiz(quiz); };
  const handleMenuClose = () => { setMenuAnchor(null); setMenuQuiz(null); };

  const handlePublishToggle = async () => {
    if (!menuQuiz) return;
    try {
      await quizService.publishQuiz(menuQuiz._id, !menuQuiz.isPublished);
      toast.success(menuQuiz.isPublished ? 'Quiz unpublished' : 'Quiz published — students notified!');
      fetchQuizzes();
    } catch {
      toast.error('Failed to update quiz status');
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
    } catch {
      toast.error('Failed to delete quiz');
    } finally {
      setDeleting(false);
      handleMenuClose();
    }
  };

  const filtered = quizzes.filter((q) => {
    const s = search.toLowerCase();
    return (
      q.title.toLowerCase().includes(s) ||
      (q.course?.courseNo || '').toLowerCase().includes(s) ||
      (q.course?.courseTitle || '').toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <PageHeader
        title="My Quizzes"
        subtitle="All quizzes you have created across your courses"
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<AIIcon />}
              variant="outlined"
              onClick={() => navigate(`${basePath}/quizzes/generate`)}
            >
              AI Quiz
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => navigate(`${basePath}/quizzes/create`)}
            >
              Create Manual Quiz
            </Button>
          </Box>
        }
      />

      {/* Search */}
      {quizzes.length > 0 && (
        <TextField
          placeholder="Search by title or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          fullWidth
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching quizzes' : 'No Quizzes Yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create your first quiz manually or generate one with AI.'
          }
          icon={<QuizIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
        />
      ) : (
        filtered.map((quiz) => (
          <Card key={quiz._id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  {/* Course badge */}
                  {quiz.course && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      fontWeight={600}
                      sx={{ mb: 0.5, display: 'block', cursor: 'pointer' }}
                      onClick={() => navigate(`${basePath}/courses/${quiz.course._id}/quizzes`)}
                    >
                      {quiz.course.courseNo} — {quiz.course.courseTitle}
                    </Typography>
                  )}
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
                    <Chip
                      label={quiz.isPublished ? 'Published' : 'Draft'}
                      size="small"
                      color={quiz.isPublished ? 'success' : 'default'}
                    />
                    <Chip
                      icon={<AttemptIcon sx={{ fontSize: 14 }} />}
                      label={`${quiz.attemptCount || 0} attempts`}
                      size="small"
                      variant="outlined"
                      color={quiz.attemptCount > 0 ? 'info' : 'default'}
                    />
                    <Chip
                      label={new Date(quiz.createdAt).toLocaleDateString()}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                <IconButton onClick={(e) => handleMenuOpen(e, quiz)} size="small">
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                size="small"
                startIcon={<ResultsIcon />}
                onClick={() => navigate(`${basePath}/quizzes/${quiz._id}/results`)}
              >
                Results
              </Button>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => navigate(`${basePath}/quizzes/${quiz._id}/edit`)}
              >
                Edit
              </Button>
              <Button
                size="small"
                startIcon={quiz.isPublished ? <UnpublishIcon /> : <PublishIcon />}
                color={quiz.isPublished ? 'warning' : 'success'}
                variant="outlined"
                onClick={async () => {
                  try {
                    await quizService.publishQuiz(quiz._id, !quiz.isPublished);
                    toast.success(quiz.isPublished ? 'Quiz unpublished' : 'Quiz published — students notified!');
                    fetchQuizzes();
                  } catch {
                    toast.error('Failed to update quiz status');
                  }
                }}
              >
                {quiz.isPublished ? 'Unpublish' : 'Publish'}
              </Button>
            </CardActions>
          </Card>
        ))
      )}

      {/* Context Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handlePublishToggle}>
          <ListItemIcon>
            {menuQuiz?.isPublished ? <UnpublishIcon /> : <PublishIcon />}
          </ListItemIcon>
          <ListItemText>{menuQuiz?.isPublished ? 'Unpublish' : 'Publish'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { navigate(`${basePath}/quizzes/${menuQuiz?._id}/results`); handleMenuClose(); }}>
          <ListItemIcon><ResultsIcon /></ListItemIcon>
          <ListItemText>View Results</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { navigate(`${basePath}/quizzes/${menuQuiz?._id}/edit`); handleMenuClose(); }}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setDeleteOpen(true); }}>
          <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => { setDeleteOpen(false); handleMenuClose(); }}>
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

export default TeacherQuizDashboard;
