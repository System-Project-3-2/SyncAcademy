/**
 * ManualQuizCreator Page (Teacher)
 * Create quizzes by manually entering questions, options, and correct answers.
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
  Chip,
  Radio,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Publish as PublishIcon,
  ArrowBack as BackIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CorrectIcon,
  Cancel as WrongIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { quizService, courseService } from '../../services';
import { PageHeader, LoadingSpinner } from '../../components';

const emptyQuestion = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
  difficulty: 'medium',
});

const ManualQuizCreator = () => {
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
  const [timeLimit, setTimeLimit] = useState('');
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);

  // Created quiz state (for preview after creation)
  const [quiz, setQuiz] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const data = await courseService.getAllCourses({ limit: 100 });
      const courseList = data.data || data.courses || data;
      setCourses(Array.isArray(courseList) ? courseList : []);
    } catch {
      toast.error('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // ─── Question Editing Helpers ───────────────────────────────────────

  const updateQuestion = (index, field, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateOption = (qIndex, optIndex, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) return toast.error('Quiz must have at least 1 question');
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!courseId) return toast.error('Please select a course');
    if (!title.trim()) return toast.error('Please enter a quiz title');

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return toast.error(`Question ${i + 1} text is required`);
      if (q.options.some((o) => !o.trim())) return toast.error(`All options in question ${i + 1} must be filled`);
    }

    try {
      setSubmitting(true);
      const data = await quizService.createManualQuiz({
        courseId,
        title: title.trim(),
        description: description.trim(),
        questions,
        timeLimit: timeLimit ? Number(timeLimit) : null,
      });
      setQuiz(data);
      toast.success(`Quiz created with ${data.questions?.length || 0} questions!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create quiz');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Publish ────────────────────────────────────────────────────────

  const handlePublish = async () => {
    try {
      setPublishing(true);
      await quizService.publishQuiz(quiz._id, true);
      toast.success('Quiz published! Students can now take it.');
      navigate(`/${user.role}/courses/${quiz.course._id || quiz.course}/quizzes`);
    } catch {
      toast.error('Failed to publish quiz');
    } finally {
      setPublishing(false);
    }
  };

  if (loadingCourses) return <LoadingSpinner />;

  // ─── Quiz Preview (after creation) ──────────────────────────────────
  if (quiz) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <PageHeader
          title={quiz.title}
          subtitle={`${quiz.totalQuestions} questions`}
          actions={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<BackIcon />} onClick={() => setQuiz(null)} variant="outlined">
                Back to Edit
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
          Review the questions below. You can go back to edit or publish the quiz.
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
                <Alert severity="success" sx={{ mb: 1 }}>
                  <strong>Explanation:</strong> {q.explanation}
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  }

  // ─── Manual Creation Form ───────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <PageHeader
        title="Create Quiz Manually"
        subtitle="Enter your own questions, options, and correct answers"
        actions={
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
            Back
          </Button>
        }
      />

      {/* Quiz Metadata */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Alert severity="info" icon={<EditIcon />}>
            Manually create quiz questions. You can review and publish after creation.
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
            placeholder="e.g., Midterm Review Quiz"
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

          <TextField
            label="Time Limit (minutes, optional)"
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            fullWidth
            placeholder="Leave empty for no time limit"
            inputProps={{ min: 1, max: 180 }}
          />
        </CardContent>
      </Card>

      {/* Questions */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Questions ({questions.length})
      </Typography>

      {questions.map((q, qIndex) => (
        <Card key={qIndex} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Chip label={`Question ${qIndex + 1}`} color="primary" />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  select
                  label="Difficulty"
                  value={q.difficulty}
                  onChange={(e) => updateQuestion(qIndex, 'difficulty', e.target.value)}
                  size="small"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </TextField>
                <IconButton
                  color="error"
                  onClick={() => removeQuestion(qIndex)}
                  disabled={questions.length <= 1}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>

            <TextField
              label="Question Text"
              value={q.questionText}
              onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
              fullWidth
              multiline
              rows={2}
              required
              sx={{ mb: 2 }}
            />

            {q.options.map((opt, oIndex) => (
              <TextField
                key={oIndex}
                label={`Option ${oIndex + 1}${oIndex === q.correctAnswer ? ' (Correct)' : ''}`}
                value={opt}
                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                fullWidth
                required
                sx={{ mb: 1 }}
                color={oIndex === q.correctAnswer ? 'success' : 'primary'}
                focused={oIndex === q.correctAnswer}
              />
            ))}

            <FormControl sx={{ mt: 1 }}>
              <FormLabel>Correct Answer</FormLabel>
              <RadioGroup
                row
                value={q.correctAnswer}
                onChange={(e) => updateQuestion(qIndex, 'correctAnswer', Number(e.target.value))}
              >
                {q.options.map((_, oIndex) => (
                  <FormControlLabel
                    key={oIndex}
                    value={oIndex}
                    control={<Radio />}
                    label={`Option ${oIndex + 1}`}
                  />
                ))}
              </RadioGroup>
            </FormControl>

            <TextField
              label="Explanation (optional)"
              value={q.explanation}
              onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ mt: 1 }}
              placeholder="Explain why this is the correct answer..."
            />
          </CardContent>
        </Card>
      ))}

      {/* Add Question & Submit Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addQuestion}>
          Add Question
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <EditIcon />}
          sx={{ flex: 1, py: 1.5 }}
        >
          {submitting ? 'Creating Quiz...' : `Create Quiz (${questions.length} Questions)`}
        </Button>
      </Box>
    </Box>
  );
};

export default ManualQuizCreator;
