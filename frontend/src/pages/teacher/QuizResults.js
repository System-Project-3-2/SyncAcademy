/**
 * QuizResults Page (Teacher)
 * Shows all student attempts and statistics for a quiz
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  BarChart as StatsIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { quizService } from '../../services';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components';

const QuizResults = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      const result = await quizService.getQuizResults(quizId);
      setData(result);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <Typography>No data available</Typography>;

  const { quiz, attempts, stats } = data;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <PageHeader
        title={`Results: ${quiz?.title || 'Quiz'}`}
        subtitle={`${quiz?.totalQuestions || 0} questions`}
        actions={
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
            Back
          </Button>
        }
      />

      {/* Statistics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <PeopleIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{stats.totalAttempts}</Typography>
            <Typography variant="body2" color="text.secondary">Total Attempts</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <StatsIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{stats.averageScore}%</Typography>
            <Typography variant="body2" color="text.secondary">Average Score</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{stats.highestScore}%</Typography>
            <Typography variant="body2" color="text.secondary">Highest Score</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>{stats.lowestScore}%</Typography>
            <Typography variant="body2" color="text.secondary">Lowest Score</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Attempts Table */}
      {attempts.length === 0 ? (
        <EmptyState title="No Attempts Yet" description="No students have attempted this quiz yet." />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>ID</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Percentage</TableCell>
                <TableCell align="center">Time Taken</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={attempt.student?.avatar} sx={{ width: 32, height: 32 }}>
                        {attempt.student?.name?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {attempt.student?.name || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {attempt.student?.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{attempt.student?.idNumber || '—'}</TableCell>
                  <TableCell align="center">
                    {attempt.score}/{attempt.totalMarks}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                      <LinearProgress
                        variant="determinate"
                        value={attempt.percentage}
                        sx={{ width: 60, height: 6, borderRadius: 3 }}
                        color={attempt.percentage >= 70 ? 'success' : attempt.percentage >= 40 ? 'warning' : 'error'}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {attempt.percentage}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {attempt.timeTaken > 0
                      ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s`
                      : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={attempt.percentage >= 70 ? 'Passed' : attempt.percentage >= 40 ? 'Below Avg' : 'Low'}
                      size="small"
                      color={attempt.percentage >= 70 ? 'success' : attempt.percentage >= 40 ? 'warning' : 'error'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default QuizResults;
