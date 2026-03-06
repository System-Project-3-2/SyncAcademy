/**
 * QuizGenerator Page (Teacher)
 * Select a course, configure quiz options, generate AI quiz, review/edit, publish
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Paper,
  IconButton,
  Chip,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Publish as PublishIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CorrectIcon,
  Cancel as WrongIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { quizService, courseService } from '../../services';
import { PageHeader, LoadingSpinner } from '../../components';

const QuizGenerator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCourseId = searchParams.get('courseId');

  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Form state
  const [courseId, setCourseId] = useState(preselectedCourseId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [timeLimit, setTimeLimit] = useState('');
  const [generating, setGenerating] = useState(false);

  // Generated quiz state
  const [quiz, setQuiz] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch teacher's courses
  const fetchCourses = useCallback(async () => {
    try {
      const data = await courseService.getAllCourses({ limit: 100 });
      const courseList = data.courses || data;
      setCourses(Array.isArray(courseList) ? courseList : []);
    } catch (err) {
      toast.error('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Generate quiz
  const handleGenerate = async () => {
    if (!courseId) return toast.error('Please select a course');
    if (!title.trim()) return toast.error('Please enter a quiz title');

    try {
      setGenerating(true);
      const data = await quizService.generateQuiz({
        courseId,
        title: title.trim(),
        description: description.trim(),
        numQuestions,
        difficulty,
        timeLimit: timeLimit ? Number(timeLimit) : null,
      });
      setQuiz(data);
      toast.success(`Generated ${data.questions?.length || 0} questions!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate quiz. Make sure the course has uploaded materials.');
    } finally {
      setGenerating(false);
    }
  };

  // Edit a question
  const openEditDialog = (index) => {
    const q = quiz.questions[index];
    setEditingQuestion(index);
    setEditForm({
      questionText: q.questionText,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
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
      const updated = await quizService.updateQuiz(quiz._id, { questions: updatedQuestions });
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

  // Delete a question
  const deleteQuestion = async (index) => {
    if (quiz.questions.length <= 1) return toast.error('Quiz must have at least 1 question');
    const updatedQuestions = quiz.questions.filter((_, i) => i !== index);
    try {
      const updated = await quizService.updateQuiz(quiz._id, { questions: updatedQuestions });
      setQuiz(updated);
      toast.success('Question removed');
    } catch (err) {
      toast.error('Failed to remove question');
    }
  };

  // Publish quiz
  const handlePublish = async () => {
    try {
      setPublishing(true);
      await quizService.publishQuiz(quiz._id, true);
      toast.success('Quiz published! Students can now take it.');
      navigate(`/${user.role}/courses/${quiz.course._id || quiz.course}/quizzes`);
    } catch (err) {
      toast.error('Failed to publish quiz');
    } finally {
      setPublishing(false);
    }
  };

  if (loadingCourses) return <LoadingSpinner />;

  // ─── Quiz Preview / Edit View ───────────────────────────────────────
  if (quiz) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <PageHeader
          title={quiz.title}
          subtitle={`${quiz.totalQuestions} questions · ${quiz.questions?.[0]?.difficulty || difficulty} difficulty`}
          actions={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<BackIcon />}
                onClick={() => setQuiz(null)}
                variant="outlined"
              >
                Back
              </Button>
              {!quiz.isPublished && (
                <Button
                  startIcon={<PublishIcon />}
                  onClick={handlePublish}
                  variant="contained"
                  color="success"
                  disabled={publishing}
                >
                  {publishing ? 'Publishing...' : 'Publish Quiz'}
                </Button>
              )}
            </Box>
          }
        />

        <Alert severity="info" sx={{ mb: 3 }}>
          Review the generated questions below. You can edit or remove any question before publishing.
        </Alert>

        {quiz.questions?.map((q, index) => (
          <Accordion key={q._id || index} defaultExpanded={index === 0} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                <Chip label={`Q${index + 1}`} size="small" color="primary" />
                <Typography sx={{ flex: 1 }} noWrap>
                  {q.questionText}
                </Typography>
                <Chip label={q.difficulty} size="small" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 2 }}>
                {q.options.map((opt, oi) => (
                  <Box
                    key={oi}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      color: oi === q.correctAnswer ? 'success.main' : 'text.primary',
                      fontWeight: oi === q.correctAnswer ? 600 : 400,
                    }}
                  >
                    {oi === q.correctAnswer ? (
                      <CorrectIcon color="success" fontSize="small" />
                    ) : (
                      <WrongIcon color="disabled" fontSize="small" />
                    )}
                    <Typography variant="body2">{opt}</Typography>
                  </Box>
                ))}
              </Box>
              {q.explanation && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <strong>Explanation:</strong> {q.explanation}
                </Alert>
              )}
              {q.sourceChunk && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Source: {q.sourceChunk.substring(0, 100)}...
                </Typography>
              )}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEditDialog(index)}>
                  Edit
                </Button>
                <Button size="small" startIcon={<DeleteIcon />} color="error" onClick={() => deleteQuestion(index)}>
                  Remove
                </Button>
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
                <TextField
                  label="Question"
                  multiline
                  rows={3}
                  value={editForm.questionText}
                  onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                  fullWidth
                />
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
                  <RadioGroup
                    row
                    value={editForm.correctAnswer}
                    onChange={(e) => setEditForm({ ...editForm, correctAnswer: Number(e.target.value) })}
                  >
                    {editForm.options.map((_, oi) => (
                      <FormControlLabel key={oi} value={oi} control={<Radio />} label={`Option ${oi + 1}`} />
                    ))}
                  </RadioGroup>
                </FormControl>
                <TextField
                  label="Explanation"
                  multiline
                  rows={2}
                  value={editForm.explanation}
                  onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                  fullWidth
                />
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
  }

  // ─── Generation Form ────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      <PageHeader
        title="AI Quiz Generator"
        subtitle="Generate quiz questions from your course materials using AI"
        actions={
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
            Back
          </Button>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Alert severity="info" icon={<AIIcon />}>
            Select a course with uploaded materials. The AI will analyze the material content and generate
            relevant multiple-choice questions.
          </Alert>

          <TextField
            select
            label="Select Course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            fullWidth
            required
          >
            {courses.map((c) => (
              <MenuItem key={c._id} value={c._id}>
                {c.courseNo} — {c.courseTitle}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Quiz Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Chapter 3 Review Quiz"
          />

          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Brief description of the quiz..."
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Number of Questions"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              sx={{ flex: 1 }}
            >
              {[5, 10, 15, 20].map((n) => (
                <MenuItem key={n} value={n}>{n} Questions</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </TextField>
          </Box>

          <TextField
            label="Time Limit (minutes, optional)"
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            fullWidth
            placeholder="Leave empty for no time limit"
            inputProps={{ min: 1, max: 180 }}
          />

          <Button
            variant="contained"
            size="large"
            startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <AIIcon />}
            onClick={handleGenerate}
            disabled={generating}
            sx={{ py: 1.5 }}
          >
            {generating ? 'Generating Quiz...' : 'Generate Quiz with AI'}
          </Button>

          {generating && (
            <Alert severity="warning">
              AI is analyzing course materials and generating questions. This may take a minute...
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default QuizGenerator;
