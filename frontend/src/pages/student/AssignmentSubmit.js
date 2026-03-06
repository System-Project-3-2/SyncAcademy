/**
 * AssignmentSubmit Page (Student)
 * Shows assignment details, submit file / text, and shows grade+feedback
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
  IconButton,
  TextField,
  CircularProgress,
  Paper,
  Divider,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CalendarToday as CalendarIcon,
  Grade as GradeIcon,
  AttachFile as AttachIcon,
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { assignmentService } from '../../services';
import { LoadingSpinner } from '../../components';
import { useAuth } from '../../hooks';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const AssignmentSubmit = () => {
  const { courseId, assignmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  // Submit form
  const [file, setFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignmentData, submissionData] = await Promise.all([
        assignmentService.getAssignment(assignmentId),
        assignmentService.getMySubmission(assignmentId),
      ]);
      setAssignment(assignmentData);
      setSubmission(submissionData);
      if (submissionData?.textContent) {
        setTextContent(submissionData.textContent);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isOverdue = assignment?.dueDate && new Date() > new Date(assignment.dueDate);
  const isGraded = submission?.grade !== null && submission?.grade !== undefined;
  const isResultPublished = assignment?.isResultPublished;
  const lateNotAllowed = isOverdue && assignment?.allowLateSubmission === false;

  const handleSubmit = async () => {
    if (!file && !textContent.trim()) {
      return toast.error('Please upload a file or enter a text response');
    }
    try {
      setSubmitting(true);
      await assignmentService.submitAssignment(assignmentId, { file, textContent });
      toast.success(submission ? 'Submission updated' : 'Assignment submitted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
      setFile(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!assignment) return <Typography>Assignment not found</Typography>;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(`/${user.role}/courses/${courseId}/assignments`)}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>{assignment.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {assignment.course?.courseNo} — {assignment.course?.courseTitle}
          </Typography>
        </Box>
      </Box>

      {/* Assignment Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {assignment.description && (
            <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {assignment.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip
              icon={<CalendarIcon />}
              label={`Due: ${formatDate(assignment.dueDate)}`}
              color={isOverdue ? 'error' : 'default'}
              variant="outlined"
            />
            <Chip icon={<GradeIcon />} label={`${assignment.totalMarks} marks`} variant="outlined" />
          </Box>

          {assignment.attachments?.length > 0 && (
            <>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Reference Files</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {assignment.attachments.map((att, i) => (
                  <Chip
                    key={i}
                    icon={<AttachIcon />}
                    label={att.fileName}
                    component="a"
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Late Warning */}
      {isOverdue && !submission && !lateNotAllowed && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          This assignment is past the due date. Your submission will be marked as late.
        </Alert>
      )}

      {/* Late submission not allowed */}
      {lateNotAllowed && !submission && (
        <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 3 }}>
          Late submission is not allowed for this assignment.
        </Alert>
      )}

      {/* Submission Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {submission ? 'Your Submission' : 'Submit Your Work'}
          </Typography>

          {/* Existing submission info */}
          {submission && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Chip
                  icon={<CheckIcon />}
                  label={`Submitted ${formatDate(submission.submittedAt)}`}
                  color="success"
                  size="small"
                />
                {submission.isLate && <Chip label="Late" size="small" color="error" />}
              </Box>
              {submission.fileUrl && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  File: <MuiLink href={submission.fileUrl} target="_blank" rel="noopener noreferrer">{submission.fileName || 'Download'}</MuiLink>
                </Typography>
              )}
              {submission.textContent && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {submission.textContent}
                </Typography>
              )}
            </Paper>
          )}

          {/* Grade & Feedback */}
          {submission && isResultPublished && isGraded && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'info.main' }}>
              <Typography variant="subtitle2" color="info.main" sx={{ mb: 1 }}>
                Mark: {submission.grade} / {assignment.totalMarks}
                {' '}({((submission.grade / assignment.totalMarks) * 100).toFixed(1)}%)
              </Typography>
              {submission.feedback && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Teacher Feedback:</strong> {submission.feedback}
                </Typography>
              )}
              {submission.gradedBy && (
                <Typography variant="caption" color="text.secondary">
                  Graded by {submission.gradedBy.name} on {formatDate(submission.gradedAt)}
                </Typography>
              )}
            </Paper>
          )}

          {/* Evaluated Script */}
          {submission && submission.evaluatedFileUrl && submission.showEvaluatedToStudent && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'secondary.main' }}>
              <Typography variant="subtitle2" color="secondary.main" sx={{ mb: 1 }}>
                Evaluated Script
              </Typography>
              <MuiLink href={submission.evaluatedFileUrl} target="_blank" rel="noopener noreferrer">
                View Evaluated Script
              </MuiLink>
            </Paper>
          )}

          {/* Result not published */}
          {submission && !isResultPublished && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'warning.main' }}>
              <Typography variant="subtitle2" color="warning.main">
                Result not published yet
              </Typography>
            </Paper>
          )}

          {/* Submit / Resubmit form — hidden once results are published */}
          {isResultPublished ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Submissions are closed — results have been published.
            </Alert>
          ) : (
            <>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {submission ? 'Update Your Submission' : 'Upload your work'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button variant="outlined" component="label" startIcon={<UploadIcon />} sx={{ alignSelf: 'flex-start' }}>
                  {file ? file.name : 'Choose File'}
                  <input type="file" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
                </Button>
                <TextField
                  label="Text Response (optional)"
                  multiline
                  rows={4}
                  fullWidth
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={submitting || (lateNotAllowed && !submission)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {submitting ? <CircularProgress size={20} /> : submission ? 'Update Submission' : 'Submit'}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AssignmentSubmit;
