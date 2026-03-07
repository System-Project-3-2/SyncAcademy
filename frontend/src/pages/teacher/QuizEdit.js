/**
 * QuizEdit Page (Teacher)
 * Edit an existing quiz: modify questions, title, and publish
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Publish as PublishIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CorrectIcon,
  Cancel as WrongIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { quizService } from '../../services';
import { PageHeader, LoadingSpinner } from '../../components';

const QuizEdit = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Schedule state
  const [schedStart, setSchedStart] = useState('');
  const [schedEnd, setSchedEnd] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Edit form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('');

  // Question editing
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await quizService.getQuiz(quizId);
      setQuiz(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setTimeLimit(data.timeLimit || '');
      setSchedStart(data.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 16) : '');
      setSchedEnd(data.availableUntil ? new Date(data.availableUntil).toISOString().slice(0, 16) : '');
    } catch (err) {
      toast.error('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleSaveDetails = async () => {
    if (!title.trim()) return toast.error('Title is required');
    try {
      setSaving(true);
      const updated = await quizService.updateQuiz(quizId, {
        title: title.trim(),
        description: description.trim(),
        timeLimit: timeLimit ? Number(timeLimit) : null,
      });
      setQuiz(updated);
      toast.success('Quiz details updated');
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (index) => {
    const q = quiz.questions[index];
    setEditingQuestion(index);
    setEditForm({
      questionText: q.questionText,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
    });
  };

  const saveEditedQuestion = async () => {
    if (!editForm.questionText.trim()) return toast.error('Question text is required');
    if (editForm.options.some((o) => !o.trim())) return toast.error('All options must be filled');

    const updatedQuestions = [...quiz.questions];
    updatedQuestions[editingQuestion] = {
      ...updatedQuestions[editingQuestion],
      ...editForm,
    };

    try {
      setSaving(true);
      const updated = await quizService.updateQuiz(quizId, { questions: updatedQuestions });
      setQuiz(updated);
      setEditingQuestion(null);
      setEditForm(null);
      toast.success('Question updated');
    } catch (err) {
      toast.error('Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (index) => {
    if (quiz.questions.length <= 1) return toast.error('Quiz must have at least 1 question');
    const updatedQuestions = quiz.questions.filter((_, i) => i !== index);
    try {
      const updated = await quizService.updateQuiz(quizId, { questions: updatedQuestions });
      setQuiz(updated);
      toast.success('Question removed');
    } catch (err) {
      toast.error('Failed to remove question');
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      await quizService.publishQuiz(quizId, !quiz.isPublished);
      toast.success(quiz.isPublished ? 'Quiz unpublished' : 'Quiz published');
      fetchQuiz();
    } catch (err) {
      toast.error('Failed to update quiz');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      setScheduling(true);
      await quizService.scheduleQuiz(quizId, {
        scheduledAt: schedStart || null,
        availableUntil: schedEnd || null,
      });
      toast.success('Schedule saved — students notified!');
      fetchQuiz();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setScheduling(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!quiz) return <Alert severity="error">Quiz not found</Alert>;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title="Edit Quiz"
        subtitle={quiz.title}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
              Back
            </Button>
            <Button
              startIcon={<PublishIcon />}
              onClick={handlePublish}
              variant="contained"
              color={quiz.isPublished ? 'warning' : 'success'}
              disabled={publishing}
            >
              {quiz.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </Box>
        }
      />

      {/* Quiz Details */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
        <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={2} fullWidth />
        <TextField
          label="Time Limit (minutes)"
          type="number"
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
          fullWidth
          inputProps={{ min: 1, max: 180 }}
        />
        <Button startIcon={<SaveIcon />} onClick={handleSaveDetails} variant="outlined" disabled={saving}>
          {saving ? 'Saving...' : 'Save Details'}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Scheduling Section */}
      <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScheduleIcon color="info" fontSize="small" /> Schedule
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Optionally restrict when students can access this quiz. Setting a start time auto-publishes the quiz.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
        <TextField
          label="Start date &amp; time"
          type="datetime-local"
          value={schedStart}
          onChange={(e) => setSchedStart(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="Leave blank for immediate access"
        />
        <TextField
          label="End date &amp; time (optional)"
          type="datetime-local"
          value={schedEnd}
          onChange={(e) => setSchedEnd(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="Leave blank for no end time"
        />
      </Box>
      <Button
        startIcon={<ScheduleIcon />}
        onClick={handleSaveSchedule}
        variant="outlined"
        color="info"
        disabled={scheduling}
        sx={{ mb: 3 }}
      >
        {scheduling ? 'Saving...' : 'Save Schedule'}
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>Questions ({quiz.questions?.length || 0})</Typography>

      {quiz.questions?.map((q, index) => (
        <Accordion key={q._id || index} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
              <Chip label={`Q${index + 1}`} size="small" color="primary" />
              <Typography sx={{ flex: 1 }} noWrap>{q.questionText}</Typography>
              <Chip label={q.difficulty} size="small" variant="outlined" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 2 }}>
              {q.options.map((opt, oi) => (
                <Box key={oi} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, color: oi === q.correctAnswer ? 'success.main' : 'text.primary', fontWeight: oi === q.correctAnswer ? 600 : 400 }}>
                  {oi === q.correctAnswer ? <CorrectIcon color="success" fontSize="small" /> : <WrongIcon color="disabled" fontSize="small" />}
                  <Typography variant="body2">{opt}</Typography>
                </Box>
              ))}
            </Box>
            {q.explanation && (
              <Alert severity="success" sx={{ mb: 2 }}><strong>Explanation:</strong> {q.explanation}</Alert>
            )}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<EditIcon />} onClick={() => openEditDialog(index)}>Edit</Button>
              <Button size="small" startIcon={<DeleteIcon />} color="error" onClick={() => deleteQuestion(index)}>Remove</Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Edit Question Dialog */}
      <Dialog open={editingQuestion !== null} onClose={() => setEditingQuestion(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Question {editingQuestion !== null ? editingQuestion + 1 : ''}</DialogTitle>
        <DialogContent>
          {editForm && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Question" multiline rows={3} value={editForm.questionText} onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })} fullWidth />
              {editForm.options.map((opt, oi) => (
                <TextField
                  key={oi}
                  label={`Option ${oi + 1}${oi === editForm.correctAnswer ? ' (Correct)' : ''}`}
                  value={opt}
                  onChange={(e) => {
                    const opts = [...editForm.options];
                    opts[oi] = e.target.value;
                    setEditForm({ ...editForm, options: opts });
                  }}
                  fullWidth
                  color={oi === editForm.correctAnswer ? 'success' : 'primary'}
                />
              ))}
              <FormControl>
                <FormLabel>Correct Answer</FormLabel>
                <RadioGroup row value={editForm.correctAnswer} onChange={(e) => setEditForm({ ...editForm, correctAnswer: Number(e.target.value) })}>
                  {editForm.options.map((_, oi) => (
                    <FormControlLabel key={oi} value={oi} control={<Radio />} label={`Option ${oi + 1}`} />
                  ))}
                </RadioGroup>
              </FormControl>
              <TextField label="Explanation" multiline rows={2} value={editForm.explanation} onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })} fullWidth />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingQuestion(null)}>Cancel</Button>
          <Button onClick={saveEditedQuestion} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuizEdit;
