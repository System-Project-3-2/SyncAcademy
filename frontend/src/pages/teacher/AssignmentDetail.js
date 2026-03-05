/**
 * AssignmentDetail Page (Teacher/Admin)
 * Shows assignment details + all submissions + grading dialog
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Divider,
  Link as MuiLink,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CalendarToday as CalendarIcon,
  Grade as GradeIcon,
  AttachFile as AttachIcon,
  Publish as PublishIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  RateReview as EvaluateIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { assignmentService } from '../../services';
import { LoadingSpinner, PdfAnnotator } from '../../components';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const AssignmentDetail = () => {
  const { courseId, assignmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Grade dialog
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });
  const [grading, setGrading] = useState(false);

  // Publish & Result Sheet
  const [publishing, setPublishing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // PDF Annotator
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const [annotatorTarget, setAnnotatorTarget] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignmentData, submissionData] = await Promise.all([
        assignmentService.getAssignment(assignmentId),
        assignmentService.getSubmissions(assignmentId),
      ]);
      setAssignment(assignmentData);
      setSubmissions(submissionData.submissions);
      setStats(submissionData.stats);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openGradeDialog = (sub) => {
    setGradeTarget(sub);
    setGradeForm({
      grade: sub.grade !== null && sub.grade !== undefined ? sub.grade : '',
      feedback: sub.feedback || '',
    });
    setGradeOpen(true);
  };

  const handleGrade = async () => {
    if (gradeForm.grade === '' || gradeForm.grade === null) return toast.error('Grade is required');
    try {
      setGrading(true);
      await assignmentService.gradeSubmission(assignmentId, gradeTarget._id, {
        grade: Number(gradeForm.grade),
        feedback: gradeForm.feedback,
      });
      toast.success('Submission graded');
      setGradeOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to grade');
    } finally {
      setGrading(false);
    }
  };

  const handlePublishResult = async () => {
    try {
      setPublishing(true);
      const newState = !assignment.isResultPublished;
      await assignmentService.publishResult(assignmentId, newState);
      toast.success(newState ? 'Result published' : 'Result unpublished');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish result');
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateResultSheet = async () => {
    try {
      setGeneratingPdf(true);
      const data = await assignmentService.generateResultSheet(assignmentId);
      toast.success('Result sheet generated');
      fetchData();
      // Open the PDF in a new tab
      if (data.resultSheetUrl) {
        window.open(data.resultSheetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate result sheet');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleOpenAnnotator = (sub) => {
    setAnnotatorTarget(sub);
    setAnnotatorOpen(true);
  };

  const handleSaveEvaluated = async (file) => {
    if (!annotatorTarget) return;
    try {
      await assignmentService.saveEvaluatedFile(assignmentId, annotatorTarget._id, file);
      toast.success('Evaluated script saved');
      setAnnotatorOpen(false);
      setAnnotatorTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save evaluated file');
    }
  };

  const handleToggleEvaluatedVisibility = async (sub) => {
    try {
      const newState = !sub.showEvaluatedToStudent;
      await assignmentService.toggleEvaluatedVisibility(assignmentId, sub._id, newState);
      toast.success(newState ? 'Evaluated script visible to student' : 'Evaluated script hidden from student');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle visibility');
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

      {/* Details card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {assignment.description && (
            <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {assignment.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip icon={<CalendarIcon />} label={`Due: ${formatDate(assignment.dueDate)}`} variant="outlined" />
            <Chip icon={<GradeIcon />} label={`${assignment.totalMarks} marks`} variant="outlined" />
            {!assignment.isPublished && <Chip label="Draft (not visible to students)" color="warning" />}
            {assignment.isResultPublished && <Chip label="Result Published" color="success" size="small" />}
            {!assignment.isResultPublished && <Chip label="Result Not Published" color="default" size="small" variant="outlined" />}
          </Box>
          {assignment.attachments?.length > 0 && (
            <>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Attachments</Typography>
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

      {/* Actions: Publish Result & Generate Result Sheet */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant={assignment.isResultPublished ? 'outlined' : 'contained'}
          color={assignment.isResultPublished ? 'warning' : 'success'}
          startIcon={<PublishIcon />}
          onClick={handlePublishResult}
          disabled={publishing}
        >
          {publishing ? <CircularProgress size={20} /> : assignment.isResultPublished ? 'Unpublish Result' : 'Publish Result'}
        </Button>
        <Button
          variant="outlined"
          startIcon={generatingPdf ? <CircularProgress size={20} /> : <PdfIcon />}
          onClick={handleGenerateResultSheet}
          disabled={generatingPdf}
        >
          Generate Result Sheet
        </Button>
        {assignment.resultSheetUrl && (
          <Button
            variant="text"
            startIcon={<DownloadIcon />}
            component="a"
            href={assignment.resultSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Result Sheet
          </Button>
        )}
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1, minWidth: 120, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} color="primary.main">{stats.totalEnrolled || 0}</Typography>
          <Typography variant="body2" color="text.secondary">Enrolled</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 120, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} color="success.main">{stats.totalSubmitted || 0}</Typography>
          <Typography variant="body2" color="text.secondary">Submitted</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 120, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} color="info.main">{stats.totalGraded || 0}</Typography>
          <Typography variant="body2" color="text.secondary">Graded</Typography>
        </Paper>
      </Box>

      {/* Submissions Table */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Submissions</Typography>
      {submissions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No submissions yet</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Late</TableCell>
                <TableCell>Mark</TableCell>
                <TableCell>Evaluate</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub._id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={sub.student?.avatar} sx={{ width: 32, height: 32 }}>
                        {sub.student?.name?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{sub.student?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{sub.student?.email}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {sub.student?.idNumber || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(sub.submittedAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    {sub.fileUrl ? (
                      <MuiLink href={sub.fileUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                        {sub.fileName || 'Download'}
                      </MuiLink>
                    ) : sub.textContent ? (
                      <Tooltip title={sub.textContent}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          {sub.textContent}
                        </Typography>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {sub.isLate ? (
                      <Chip label="Late" size="small" color="error" />
                    ) : (
                      <Chip label="On time" size="small" color="success" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    {sub.grade !== null && sub.grade !== undefined ? (
                      <Chip label={`${sub.grade}/${assignment.totalMarks}`} size="small" color="info" />
                    ) : (
                      <Chip label="Pending" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                      {sub.fileUrl && sub.fileUrl.toLowerCase().endsWith('.pdf') && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EvaluateIcon />}
                          onClick={() => handleOpenAnnotator(sub)}
                        >
                          Evaluate
                        </Button>
                      )}
                      {sub.evaluatedFileUrl && (
                        <>
                          <MuiLink href={sub.evaluatedFileUrl} target="_blank" rel="noopener noreferrer" underline="hover" variant="caption">
                            View Evaluated
                          </MuiLink>
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={!!sub.showEvaluatedToStudent}
                                onChange={() => handleToggleEvaluatedVisibility(sub)}
                              />
                            }
                            label={
                              <Typography variant="caption">
                                {sub.showEvaluatedToStudent ? 'Visible to student' : 'Hidden from student'}
                              </Typography>
                            }
                          />
                        </>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => openGradeDialog(sub)}>
                      {sub.grade !== null && sub.grade !== undefined ? 'Re-mark' : 'Mark'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Grade Dialog */}
      <Dialog open={gradeOpen} onClose={() => setGradeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Mark Submission — {gradeTarget?.student?.name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {gradeTarget?.fileUrl && (
            <MuiLink href={gradeTarget.fileUrl} target="_blank" rel="noopener noreferrer">
              View submitted file: {gradeTarget.fileName}
            </MuiLink>
          )}
          {gradeTarget?.textContent && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Text Response</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{gradeTarget.textContent}</Typography>
            </Paper>
          )}
          <TextField
            label={`Mark (out of ${assignment?.totalMarks})`}
            type="number"
            fullWidth
            value={gradeForm.grade}
            onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })}
            inputProps={{ min: 0, max: assignment?.totalMarks }}
          />
          <TextField
            label="Feedback (optional)"
            multiline
            rows={3}
            fullWidth
            value={gradeForm.feedback}
            onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGradeOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleGrade} disabled={grading}>
            {grading ? <CircularProgress size={20} /> : 'Save Mark'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF Annotator */}
      <PdfAnnotator
        open={annotatorOpen}
        onClose={() => { setAnnotatorOpen(false); setAnnotatorTarget(null); }}
        fileUrl={annotatorTarget?.fileUrl}
        fileName={annotatorTarget?.fileName}
        onSave={handleSaveEvaluated}
      />
    </Box>
  );
};

export default AssignmentDetail;
