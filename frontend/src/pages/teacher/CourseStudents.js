/**
 * Course Students Page
 * Shows enrolled students for a specific course (Teacher/Admin)
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  ArrowBack as BackIcon,
  PersonRemove as RemoveIcon,
  People as PeopleIcon,
  School as CourseIcon,
  ContentCopy as CopyIcon,
  Key as KeyIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components';
import { enrollmentService } from '../../services';
import { useAuth } from '../../hooks';

const CourseStudents = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [courseInfo, setCourseInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Remove student dialog
  const [removeDialog, setRemoveDialog] = useState({ open: false, student: null });
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    fetchCourseStudents();
  }, [courseId]);

  const fetchCourseStudents = async () => {
    try {
      const data = await enrollmentService.getCourseStudents(courseId);
      setCourseInfo(data.course);
      setStudents(data.students);
    } catch (error) {
      console.error('Error fetching course students:', error);
      toast.error(error.response?.data?.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!removeDialog.student) return;

    setIsRemoving(true);
    try {
      await enrollmentService.removeStudent(courseId, removeDialog.student._id);
      toast.success(`${removeDialog.student.name} removed from course`);
      setRemoveDialog({ open: false, student: null });
      fetchCourseStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove student');
    } finally {
      setIsRemoving(false);
    }
  };

  const filteredStudents = searchQuery.trim()
    ? students.filter((s) => {
        const regex = new RegExp(searchQuery, 'i');
        return regex.test(s.name) || regex.test(s.email);
      })
    : students;

  const basePath = user?.role === 'admin' ? '/admin' : '/teacher';

  if (isLoading) {
    return <LoadingSpinner message="Loading students..." />;
  }

  return (
    <Box className="fade-in">
      <PageHeader
        title={courseInfo ? `${courseInfo.courseNo} — Students` : 'Course Students'}
        subtitle={
          courseInfo
            ? `${courseInfo.courseTitle} • ${students.length} enrolled student(s)`
            : ''
        }
        breadcrumbs={[
          { label: 'Courses', path: `${basePath}/courses` },
          { label: courseInfo?.courseNo || 'Students' },
        ]}
        actions={
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate(`${basePath}/courses`)}
            sx={{ borderRadius: 2 }}
          >
            Back to Courses
          </Button>
        }
      />

      {/* Search */}
      {students.length > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search students by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Paper>
      )}

      {/* Students Table */}
      {filteredStudents.length > 0 ? (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: isDark
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'grey.50',
                }}
              >
                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Enrolled On</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow
                  key={student._id}
                  sx={{
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, isDark ? 0.05 : 0.02),
                    },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        src={student.avatar || ''}
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: 'primary.main',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                        }}
                      >
                        {student.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600}>
                        {student.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {student.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(student.enrolledAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove student">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setRemoveDialog({ open: true, student })
                        }
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : students.length > 0 ? (
        <EmptyState
          title="No matching students"
          description="No students match your search query."
          icon={<SearchIcon sx={{ fontSize: 64 }} />}
        />
      ) : (
        <EmptyState
          title="No enrolled students"
          description="No students have enrolled in this course yet. Share the course code with your students so they can join."
          icon={<PeopleIcon sx={{ fontSize: 64 }} />}
        />
      )}

      {/* Course Code Info */}
      {courseInfo && (
        <Paper
          sx={{
            p: 3,
            mt: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <KeyIcon color="warning" />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Enrollment Code
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Share this secret code with students so they can enroll:{' '}
              <Chip
                label={courseInfo.courseCode || courseInfo.courseNo}
                size="small"
                color="warning"
                variant={isDark ? 'filled' : 'outlined'}
                sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1, ml: 0.5 }}
                onDelete={() => {
                  navigator.clipboard.writeText(courseInfo.courseCode || courseInfo.courseNo);
                  toast.success('Enrollment code copied!');
                }}
                deleteIcon={<CopyIcon sx={{ fontSize: 14 }} />}
              />
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Remove Student Confirmation Dialog */}
      <Dialog
        open={removeDialog.open}
        onClose={() => {
          if (!isRemoving) setRemoveDialog({ open: false, student: null });
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Student?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove{' '}
            <strong>{removeDialog.student?.name}</strong> from this course? They
            will lose access to course materials.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setRemoveDialog({ open: false, student: null })}
            disabled={isRemoving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRemoveStudent}
            disabled={isRemoving}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {isRemoving ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CourseStudents;
