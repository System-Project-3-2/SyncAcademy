/**
 * CourseAssignments Page (Shared)
 * Teacher: list assignments + create new
 * Student: list assignments with submission status
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Add as AddIcon,
  ArrowBack as BackIcon,
  CalendarToday as CalendarIcon,
  Grade as GradeIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AttachFile as AttachIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { assignmentService, courseService } from '../../services';
import { LoadingSpinner } from '../../components';

const formatDate = (date) => {
  if (!date) return 'No due date';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const getDueStatus = (dueDate) => {
  if (!dueDate) return { label: 'No deadline', color: 'default' };
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  const hoursLeft = diff / (1000 * 60 * 60);
  if (diff < 0) return { label: 'Overdue', color: 'error' };
  if (hoursLeft < 24) return { label: 'Due soon', color: 'warning' };
  return { label: `Due ${formatDate(dueDate)}`, color: 'default' };
};

const getSubmissionChip = (status) => {
  switch (status) {
    case 'graded': return { label: 'Graded', color: 'info' };
    case 'submitted': return { label: 'Submitted', color: 'success' };
    default: return { label: 'Not Submitted', color: 'default' };
  }
};

const CourseAssignments = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [assignments, setAssignments] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', totalMarks: 100 });
  const [files, setFiles] = useState([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '', totalMarks: 100 });
  const [editId, setEditId] = useState(null);
  const [editFiles, setEditFiles] = useState([]);
  const [editing, setEditing] = useState(false);

  // Menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuAssignment, setMenuAssignment] = useState(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchAssignments = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await assignmentService.getAssignmentsByCourse(courseId, { page });
      setAssignments(data.assignments);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const fetchCourse = useCallback(async () => {
    try {
      const data = await courseService.getCourseById(courseId);
      setCourse(data);
    } catch { /* ignore */ }
  }, [courseId]);

  useEffect(() => {
    fetchAssignments();
    fetchCourse();
  }, [fetchAssignments, fetchCourse]);

  // Create
  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    try {
      setCreating(true);
      await assignmentService.createAssignment({ ...form, courseId, files });
      toast.success('Assignment created');
      setCreateOpen(false);
      setForm({ title: '', description: '', dueDate: '', totalMarks: 100 });
      setFiles([]);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create assignment');
    } finally {
      setCreating(false);
    }
  };

  // Edit
  const openEdit = (a) => {
    setEditId(a._id);
    setEditForm({
      title: a.title,
      description: a.description || '',
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : '',
      totalMarks: a.totalMarks,
    });
    setEditFiles([]);
    setEditOpen(true);
    setMenuAnchor(null);
  };

  const handleEdit = async () => {
    if (!editForm.title.trim()) return toast.error('Title is required');
    try {
      setEditing(true);
      await assignmentService.updateAssignment(editId, { ...editForm, files: editFiles });
      toast.success('Assignment updated');
      setEditOpen(false);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setEditing(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await assignmentService.deleteAssignment(menuAssignment._id);
      toast.success('Assignment deleted');
      setDeleteOpen(false);
      setMenuAssignment(null);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleCardClick = (assignment) => {
    if (isTeacher) {
      navigate(`/${user.role}/courses/${courseId}/assignments/${assignment._id}`);
    } else {
      navigate(`/${user.role}/courses/${courseId}/assignments/${assignment._id}/submit`);
    }
  };

  if (loading && assignments.length === 0) return <LoadingSpinner />;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(`/${user.role}/courses/${courseId}/stream`)}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Assignments</Typography>
          {course && (
            <Typography variant="body2" color="text.secondary">
              {course.courseNo} — {course.courseTitle}
            </Typography>
          )}
        </Box>
        {isTeacher && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Create Assignment
          </Button>
        )}
      </Box>

      {/* Assignment list */}
      {assignments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">No assignments yet</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {assignments.map((a) => {
            const dueStatus = getDueStatus(a.dueDate);
            const subChip = !isTeacher ? getSubmissionChip(a.submissionStatus) : null;
            return (
              <Card
                key={a._id}
                sx={{
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 6 },
                  borderLeft: 4,
                  borderColor: dueStatus.color === 'error'
                    ? 'error.main'
                    : dueStatus.color === 'warning'
                    ? 'warning.main'
                    : 'primary.main',
                }}
                onClick={() => handleCardClick(a)}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight={600}>{a.title}</Typography>
                      {a.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                          {a.description}
                        </Typography>
                      )}
                    </Box>
                    {isTeacher && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAnchor(e.currentTarget);
                          setMenuAssignment(a);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, pt: 0, flexWrap: 'wrap', gap: 1 }}>
                  <Chip icon={<CalendarIcon />} label={dueStatus.label} size="small" color={dueStatus.color} variant="outlined" />
                  <Chip icon={<GradeIcon />} label={`${a.totalMarks} marks`} size="small" variant="outlined" />
                  {a.attachments?.length > 0 && (
                    <Chip icon={<AttachIcon />} label={`${a.attachments.length} file(s)`} size="small" variant="outlined" />
                  )}
                  {!a.isPublished && <Chip label="Draft" size="small" color="default" />}
                  {subChip && (
                    <Chip
                      icon={subChip.color === 'success' ? <CheckIcon /> : subChip.color === 'info' ? <GradeIcon /> : <ScheduleIcon />}
                      label={subChip.label}
                      size="small"
                      color={subChip.color}
                    />
                  )}
                  {!isTeacher && a.submissionStatus === 'graded' && a.myGrade !== undefined && (
                    <Chip label={`Grade: ${a.myGrade}/${a.totalMarks}`} size="small" color="info" variant="filled" />
                  )}
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 1 }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === pagination.page ? 'contained' : 'outlined'}
              size="small"
              onClick={() => fetchAssignments(p)}
            >
              {p}
            </Button>
          ))}
        </Box>
      )}

      {/* Context Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { openEdit(menuAssignment); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); setDeleteOpen(true); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Assignment</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Title" required fullWidth value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Description" multiline rows={3} fullWidth value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField
            label="Due Date"
            type="datetime-local"
            fullWidth
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Total Marks"
            type="number"
            fullWidth
            value={form.totalMarks}
            onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
          />
          <Button variant="outlined" component="label" startIcon={<AttachIcon />}>
            Attach Files
            <input type="file" hidden multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
          </Button>
          {files.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {files.map((f) => f.name).join(', ')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Assignment</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Title" required fullWidth value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          <TextField label="Description" multiline rows={3} fullWidth value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          <TextField
            label="Due Date"
            type="datetime-local"
            fullWidth
            value={editForm.dueDate}
            onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Total Marks"
            type="number"
            fullWidth
            value={editForm.totalMarks}
            onChange={(e) => setEditForm({ ...editForm, totalMarks: e.target.value })}
          />
          <Button variant="outlined" component="label" startIcon={<AttachIcon />}>
            Attach New Files
            <input type="file" hidden multiple onChange={(e) => setEditFiles(Array.from(e.target.files))} />
          </Button>
          {editFiles.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              New: {editFiles.map((f) => f.name).join(', ')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editing}>
            {editing ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Assignment?</DialogTitle>
        <DialogContent>
          <Typography>
            This will permanently delete "{menuAssignment?.title}" and all student submissions. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CourseAssignments;
