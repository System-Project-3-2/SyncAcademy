/**
 * TakeQuiz Page (Student)
 * Students take a quiz: answer MCQs, submit, and see results
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Timer as TimerIcon,
  CheckCircle as CorrectIcon,
  Cancel as WrongIcon,
  Send as SubmitIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { quizService } from '../../services';
import { PageHeader, LoadingSpinner } from '../../components';

const TakeQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [startedAt] = useState(new Date().toISOString());
  const [timeLeft, setTimeLeft] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef(null);

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await quizService.getQuiz(quizId);
      setQuiz(data);

      // If already attempted, show results directly
      if (data.myAttempt) {
        setResult(data.myAttempt);
      }

      // Set timer if time limit exists and not yet attempted
      if (data.timeLimit && !data.myAttempt) {
        setTimeLeft(data.timeLimit * 60);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-submit when time runs out
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: Number(value) }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit) {
      const answeredCount = Object.keys(answers).length;
      const totalCount = quiz.questions?.length || 0;
      if (answeredCount < totalCount) {
        setConfirmOpen(true);
        return;
      }
    }
    setConfirmOpen(false);
    doSubmit();
  };

  const doSubmit = async () => {
    try {
      setSubmitting(true);
      if (timerRef.current) clearInterval(timerRef.current);

      const answersArray = Object.entries(answers).map(([idx, val]) => ({
        questionIndex: Number(idx),
        selectedAnswer: val,
      }));

      const data = await quizService.submitAttempt(quizId, {
        answers: answersArray,
        startedAt,
      });

      setResult(data.attempt);
      // Update quiz with full question data (answers visible now)
      if (data.quiz) setQuiz(data.quiz);
      toast.success('Quiz submitted!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!quiz) return <Alert severity="error">Quiz not found</Alert>;

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz.questions?.length || 0;

  // ─── Results View ───────────────────────────────────────────────────
  if (result) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <PageHeader
          title={quiz.title}
          subtitle="Quiz Results"
          actions={
            <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
              Back
            </Button>
          }
        />

        {/* Score Card */}
        <Card sx={{ mb: 3, textAlign: 'center' }}>
          <CardContent sx={{ py: 4 }}>
            <TrophyIcon sx={{ fontSize: 48, color: result.percentage >= 70 ? 'success.main' : result.percentage >= 40 ? 'warning.main' : 'error.main', mb: 1 }} />
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              {result.percentage}%
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {result.score} / {result.totalMarks} correct
            </Typography>
            {result.timeTaken > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Completed in {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
              </Typography>
            )}
            <Chip
              label={result.percentage >= 70 ? 'Passed' : result.percentage >= 40 ? 'Below Average' : 'Needs Improvement'}
              color={result.percentage >= 70 ? 'success' : result.percentage >= 40 ? 'warning' : 'error'}
              sx={{ mt: 2 }}
            />
          </CardContent>
        </Card>

        {/* Question Review */}
        {quiz.questions?.map((q, index) => {
          const studentAnswer = result.answers?.find((a) => a.questionIndex === index);
          const selectedIdx = studentAnswer?.selectedAnswer;
          const isCorrect = selectedIdx === q.correctAnswer;

          return (
            <Card key={q._id || index} sx={{ mb: 2, borderLeft: 4, borderColor: isCorrect ? 'success.main' : selectedIdx !== undefined ? 'error.main' : 'grey.300' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                  <Chip label={`Q${index + 1}`} size="small" color={isCorrect ? 'success' : 'error'} />
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {q.questionText}
                  </Typography>
                </Box>

                {q.options?.map((opt, oi) => {
                  const isSelected = oi === selectedIdx;
                  const isCorrectOpt = oi === q.correctAnswer;
                  let bgColor = 'transparent';
                  if (isCorrectOpt) bgColor = 'success.light';
                  else if (isSelected && !isCorrectOpt) bgColor = 'error.light';

                  return (
                    <Box
                      key={oi}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5,
                        px: 1,
                        borderRadius: 1,
                        bgcolor: bgColor,
                        opacity: bgColor === 'transparent' ? 0.7 : 1,
                      }}
                    >
                      {isCorrectOpt ? (
                        <CorrectIcon color="success" fontSize="small" />
                      ) : isSelected ? (
                        <WrongIcon color="error" fontSize="small" />
                      ) : (
                        <Radio disabled size="small" />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: isCorrectOpt || isSelected ? 600 : 400 }}>
                        {opt}
                      </Typography>
                    </Box>
                  );
                })}

                {q.explanation && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <strong>Explanation:</strong> {q.explanation}
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    );
  }

  // ─── Quiz Taking View ──────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <PageHeader
        title={quiz.title}
        subtitle={quiz.description || `${totalQuestions} questions`}
        actions={
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
            Back
          </Button>
        }
      />

      {/* Progress & Timer Bar */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2, position: 'sticky', top: 64, zIndex: 10 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Progress: {answeredCount} / {totalQuestions} answered
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(answeredCount / totalQuestions) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        {timeLeft !== null && (
          <Chip
            icon={<TimerIcon />}
            label={formatTime(timeLeft)}
            color={timeLeft < 60 ? 'error' : timeLeft < 300 ? 'warning' : 'default'}
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '1rem' }}
          />
        )}
      </Paper>

      {/* Questions */}
      {quiz.questions?.map((q, index) => (
        <Card key={q._id || index} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
              <Chip label={`Q${index + 1}`} size="small" color="primary" />
              {q.difficulty && <Chip label={q.difficulty} size="small" variant="outlined" />}
              <Typography variant="body1" sx={{ fontWeight: 500, flex: 1 }}>
                {q.questionText}
              </Typography>
            </Box>

            <FormControl component="fieldset">
              <RadioGroup
                value={answers[index] !== undefined ? answers[index] : ''}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
              >
                {q.options?.map((opt, oi) => (
                  <FormControlLabel
                    key={oi}
                    value={oi}
                    control={<Radio />}
                    label={opt}
                    sx={{
                      mb: 0.5,
                      borderRadius: 1,
                      px: 1,
                      bgcolor: answers[index] === oi ? 'action.selected' : 'transparent',
                    }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>
      ))}

      {/* Submit Button */}
      <Box sx={{ textAlign: 'center', my: 3 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SubmitIcon />}
          onClick={() => handleSubmit(false)}
          disabled={submitting || answeredCount === 0}
          sx={{ px: 6, py: 1.5 }}
        >
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </Button>
      </Box>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Submit with unanswered questions?</DialogTitle>
        <DialogContent>
          <Typography>
            You have answered {answeredCount} out of {totalQuestions} questions.
            Unanswered questions will be marked as incorrect. Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Go Back</Button>
          <Button onClick={doSubmit} color="primary" variant="contained">
            Submit Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TakeQuiz;
