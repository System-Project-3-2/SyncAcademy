/**
 * Course Management Page
 * CRUD interface for managing courses (Admin/Teacher)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Tooltip,
  Chip,
  alpha,
  Snackbar,
  Alert,
  Skeleton,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  School as CourseIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  LibraryBooks as MaterialsIcon,
  CalendarToday as SemesterIcon,
  Business as DepartmentIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { PageHeader, EmptyState, PaginationControl } from '../../components';
import { courseService } from '../../services';
import { useAuth } from '../../hooks';

// Semester options
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

// Course Card Component
const CourseCard = ({ course, onEdit, onDelete, canEdit, canDelete }) => {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      <CardContent sx={{ flex: 1, p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CourseIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {course.courseTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {course.courseNo}
            </Typography>
          </Box>
        </Box>

        {course.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {course.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {course.department && (
            <Chip
              icon={<DepartmentIcon sx={{ fontSize: 14 }} />}
              label={course.department}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            />
          )}
          {course.semester && (
            <Chip
              icon={<SemesterIcon sx={{ fontSize: 14 }} />}
              label={`Sem ${course.semester}`}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            />
          )}
          <Chip
            icon={<MaterialsIcon sx={{ fontSize: 14 }} />}
            label={`${course.materialCount || 0} materials`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          />
        </Box>

        {course.createdBy && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
            <PersonIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              {course.createdBy.name}
            </Typography>
          </Box>
        )}
      </CardContent>

      {(canEdit || canDelete) && (
        <Box
          sx={{
            p: 2,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          {canEdit && (
            <Tooltip title="Edit Course">
              <IconButton
                size="small"
                color="warning"
                onClick={() => onEdit(course)}
                sx={{
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.15) },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete Course">
              <IconButton
                size="small"
                color="error"
                onClick={() => onDelete(course)}
                sx={{
                  bgcolor: alpha(theme.palette.error.main, 0.08),
                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.15) },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Card>
  );
};

// Course Form Dialog
const CourseFormDialog = ({ open, course, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    courseNo: '',
    courseTitle: '',
    description: '',
    department: '',
    semester: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (course) {
      setFormData({
        courseNo: course.courseNo || '',
        courseTitle: course.courseTitle || '',
        description: course.description || '',
        department: course.department || '',
        semester: course.semester || '',
      });
    } else {
      setFormData({
        courseNo: '',
        courseTitle: '',
        description: '',
        department: '',
        semester: '',
      });
    }
  }, [course, open]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave(formData, course?._id);
      onClose();
    } catch (error) {
      console.error('Error saving course:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValid = formData.courseNo.trim() && formData.courseTitle.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CourseIcon color="primary" />
        {course ? 'Edit Course' : 'Add New Course'}
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            fullWidth
            label="Course Number *"
            name="courseNo"
            value={formData.courseNo}
            onChange={handleChange}
            placeholder="e.g., CS101"
            disabled={!!course}
          />
          <TextField
            fullWidth
            label="Course Title *"
            name="courseTitle"
            value={formData.courseTitle}
            onChange={handleChange}
            placeholder="e.g., Introduction to Computer Science"
          />
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            multiline
            rows={3}
            placeholder="Brief course description..."
          />
          <TextField
            fullWidth
            label="Department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="e.g., Computer Science"
          />
          <FormControl fullWidth>
            <InputLabel>Semester</InputLabel>
            <Select
              name="semester"
              value={formData.semester}
              label="Semester"
              onChange={handleChange}
            >
              <MenuItem value="">None</MenuItem>
              {SEMESTERS.map((sem) => (
                <MenuItem key={sem} value={sem}>{sem}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !isValid}
          startIcon={<SaveIcon />}
          sx={{ borderRadius: 2 }}
        >
          {loading ? 'Saving...' : course ? 'Save Changes' : 'Create Course'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Loading Skeleton
const CoursesSkeleton = () => (
  <Grid container spacing={2}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Grid item xs={12} sm={6} md={4} key={i}>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
      </Grid>
    ))}
  </Grid>
);

// Main Course Management Component
const CourseManagement = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [formDialog, setFormDialog] = useState({ open: false, course: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, course: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [departments, setDepartments] = useState([]);

  const userRole = user?.role;
  const canCreate = userRole === 'admin' || userRole === 'teacher';
  const canEdit = userRole === 'admin' || userRole === 'teacher';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    fetchCourses();
    fetchDepartments();
  }, [pagination.page, pagination.limit]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchQuery) params.search = searchQuery;
      if (filterDepartment) params.department = filterDepartment;
      if (filterSemester) params.semester = filterSemester;

      const data = await courseService.getAllCourses(params);
      
      if (data.pagination) {
        setCourses(data.data);
        setPagination((prev) => ({ ...prev, ...data.pagination }));
      } else {
        setCourses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load courses.',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await courseService.getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCourses();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterDepartment('');
    setFilterSemester('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setTimeout(fetchCourses, 0);
  };

  const handleSaveCourse = async (formData, courseId) => {
    try {
      if (courseId) {
        await courseService.updateCourse(courseId, formData);
        setSnackbar({ open: true, message: 'Course updated successfully!', severity: 'success' });
      } else {
        await courseService.createCourse(formData);
        setSnackbar({ open: true, message: 'Course created successfully!', severity: 'success' });
      }
      fetchCourses();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to save course.';
      setSnackbar({ open: true, message: msg, severity: 'error' });
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    const { course } = deleteDialog;
    if (!course) return;

    try {
      await courseService.deleteCourse(course._id);
      setSnackbar({ open: true, message: 'Course deleted successfully!', severity: 'success' });
      fetchCourses();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to delete course.';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setDeleteDialog({ open: false, course: null });
    }
  };

  const hasActiveFilters = searchQuery || filterDepartment || filterSemester;

  if (isLoading && courses.length === 0) {
    return (
      <Box>
        <PageHeader title="Course Management" subtitle="Loading courses..." />
        <CoursesSkeleton />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Course Management"
        subtitle={`Manage courses • ${pagination.total || courses.length} course${(pagination.total || courses.length) !== 1 ? 's' : ''}`}
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormDialog({ open: true, course: null })}
              sx={{ borderRadius: 2, px: 3, py: 1, textTransform: 'none', fontWeight: 600 }}
            >
              Add Course
            </Button>
          )
        }
      />

      {/* Filters */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FilterIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>Filter Courses</Typography>
          {hasActiveFilters && (
            <Button
              size="small"
              color="error"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              sx={{ ml: 'auto', textTransform: 'none' }}
            >
              Clear All
            </Button>
          )}
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={filterDepartment}
                label="Department"
                onChange={(e) => setFilterDepartment(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">All Departments</MenuItem>
                {departments.map((dept) => (
                  <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Semester</InputLabel>
              <Select
                value={filterSemester}
                label="Semester"
                onChange={(e) => setFilterSemester(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">All Semesters</MenuItem>
                {SEMESTERS.map((sem) => (
                  <MenuItem key={sem} value={sem}>{sem}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              sx={{ borderRadius: 2, height: 56 }}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Course List */}
      {courses.length === 0 ? (
        <EmptyState
          icon={<CourseIcon sx={{ fontSize: 64 }} />}
          title={hasActiveFilters ? 'No courses match your filters' : 'No courses yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search or filter criteria'
              : canCreate
              ? 'Start by adding your first course'
              : 'No courses have been created yet'
          }
          actionLabel={hasActiveFilters ? 'Clear Filters' : canCreate ? 'Add Course' : null}
          onAction={
            hasActiveFilters
              ? handleClearFilters
              : canCreate
              ? () => setFormDialog({ open: true, course: null })
              : null
          }
        />
      ) : (
        <>
          <Grid container spacing={2}>
            {courses.map((course) => (
              <Grid item xs={12} sm={6} md={4} key={course._id}>
                <CourseCard
                  course={course}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={(c) => setFormDialog({ open: true, course: c })}
                  onDelete={(c) => setDeleteDialog({ open: true, course: c })}
                />
              </Grid>
            ))}
          </Grid>

          {pagination.pages > 1 && (
            <PaginationControl
              page={pagination.page}
              totalPages={pagination.pages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => setPagination((prev) => ({ ...prev, page: newPage }))}
              onLimitChange={(newLimit) =>
                setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }))
              }
            />
          )}
        </>
      )}

      {/* Course Form Dialog */}
      <CourseFormDialog
        open={formDialog.open}
        course={formDialog.course}
        onClose={() => setFormDialog({ open: false, course: null })}
        onSave={handleSaveCourse}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, course: null })}
        PaperProps={{ sx: { borderRadius: 3, maxWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            Delete Course
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete{' '}
            <strong>"{deleteDialog.course?.courseTitle}"</strong> ({deleteDialog.course?.courseNo})?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, course: null })} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm} sx={{ borderRadius: 2 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CourseManagement;
