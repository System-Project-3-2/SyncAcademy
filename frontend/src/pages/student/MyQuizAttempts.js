/**
 * MyQuizAttempts Page (Student)
 * Shows all quiz attempts for the current student across all courses
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Quiz as QuizIcon,
  ArrowBack as BackIcon,
  Visibility as ViewIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { quizService } from '../../services';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components';

const MyQuizAttempts = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAttempts = useCallback(async () => {
    try {
      const data = await quizService.getMyAttempts();
      setAttempts(data);
    } catch (err) {
      toast.error('Failed to load quiz attempts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  if (loading) return <LoadingSpinner />;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title="My Quizzes"
        subtitle="Your quiz history and scores"
        actions={
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
            Back
          </Button>
        }
      />

      {attempts.length === 0 ? (
        <EmptyState
          title="No Quiz Attempts"
          description="You haven't taken any quizzes yet. Check your courses for available quizzes."
          icon={<QuizIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
        />
      ) : (
        attempts.map((attempt) => (
          <Card key={attempt._id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {attempt.quiz?.title || 'Quiz'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {attempt.quiz?.course?.courseNo} — {attempt.quiz?.course?.courseTitle}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                    <Chip
                      label={`${attempt.percentage}%`}
                      color={attempt.percentage >= 70 ? 'success' : attempt.percentage >= 40 ? 'warning' : 'error'}
                      size="small"
                    />
                    <Typography variant="body2" color="text.secondary">
                      {attempt.score}/{attempt.totalMarks} correct
                    </Typography>
                    {attempt.timeTaken > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        · {Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s
                      </Typography>
                    )}
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={attempt.percentage}
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                    color={attempt.percentage >= 70 ? 'success' : attempt.percentage >= 40 ? 'warning' : 'error'}
                  />
                </Box>
                <TrophyIcon
                  sx={{
                    fontSize: 40,
                    color: attempt.percentage >= 70 ? 'success.main' : attempt.percentage >= 40 ? 'warning.main' : 'error.main',
                    ml: 2,
                  }}
                />
              </Box>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2 }}>
              <Button
                size="small"
                startIcon={<ViewIcon />}
                onClick={() => navigate(`/student/quizzes/${attempt.quiz?._id}/take`)}
                variant="outlined"
              >
                View Results
              </Button>
            </CardActions>
          </Card>
        ))
      )}
    </Box>
  );
};

export default MyQuizAttempts;
