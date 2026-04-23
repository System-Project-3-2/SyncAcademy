/**
 * Materials Page
 * Role-based materials display with CRUD operations
 * - Student: Read-only access to all materials
 * - Teacher: CRUD on own materials only
 * - Admin: CRUD on all materials
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Tooltip,
  Badge,
  alpha,
  Snackbar,
  Alert,
  Avatar,
  Skeleton,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Description as DocumentIcon,
  PictureAsPdf as PdfIcon,
  Article as DocIcon,
  Slideshow as PptIcon,
  FilterList as FilterIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  School as CourseIcon,
  CalendarToday as DateIcon,
  CloudUpload as UploadIcon,
  Clear as ClearIcon,
  LibraryBooks as LibraryIcon,
  Person as PersonIcon,
  Visibility as ViewIcon,
  LocalOffer as TagsIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { PageHeader, EmptyState, PaginationControl } from '../../components';
import { materialService } from '../../services';
import { useAuth } from '../../hooks';
import { useNavigate } from 'react-router-dom';
import { MATERIAL_TYPES } from '../../constants/materialTypes';

// Get file type icon based on file extension
const getFileIcon = (fileUrl, type) => {
  const url = fileUrl?.toLowerCase() || '';
  const materialType = type?.toLowerCase() || '';
  
  if (url.includes('.pdf') || materialType.includes('pdf')) {
    return <PdfIcon sx={{ fontSize: 32, color: '#e53935' }} />;
  } else if (url.includes('.pptx') || url.includes('.ppt') || materialType.includes('ppt') || materialType.includes('presentation') || materialType.includes('slide')) {
    return <PptIcon sx={{ fontSize: 32, color: '#ff6d00' }} />;
  } else if (url.includes('.docx') || url.includes('.doc') || materialType.includes('doc')) {
    return <DocIcon sx={{ fontSize: 32, color: '#1976d2' }} />;
  }
  return <DocumentIcon sx={{ fontSize: 32, color: '#757575' }} />;
};

// Format date nicely
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Material Card Component
const MaterialCardItem = ({ material, userRole, currentUserId, onDelete, onEdit, onDownload, onView, onViewTags }) => {
  const theme = useTheme();
  const isOwner = material.uploadedBy?._id === currentUserId;
  const canEdit = userRole === 'admin' || (userRole === 'teacher' && isOwner);
  const canDelete = userRole === 'admin' || (userRole === 'teacher' && isOwner);
  const isReadOnly = userRole === 'student';
  const topicTagCount = Array.isArray(material.topicTags) ? material.topicTags.length : 0;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        bgcolor: 'background.paper',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      {/* Type Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1,
        }}
      >
        <Chip
          size="small"
          label={material.type}
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 600,
            fontSize: '0.7rem',
          }}
        />
      </Box>

      {/* Card Header with Icon */}
      <Box
        sx={{
          p: 2.5,
          pb: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
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
          {getFileIcon(material.fileUrl, material.type)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, pr: 6 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            title={material.title || material.courseTitle}
            sx={{
              color: 'text.primary',
              lineHeight: 1.3,
              mb: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {material.title || material.courseTitle}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {material.courseTitle} • {material.courseNo}
          </Typography>
        </Box>
      </Box>

      {/* Card Body */}
      <CardContent sx={{ flex: 1, pt: 0, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Avatar
            sx={{
              width: 24,
              height: 24,
              bgcolor: alpha(theme.palette.secondary.main, 0.1),
              color: 'secondary.main',
            }}
          >
            <PersonIcon sx={{ fontSize: 14 }} />
          </Avatar>
          <Typography variant="caption" color="text.secondary" noWrap>
            {material.uploadedBy?.name || 'Unknown'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DateIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">
            {formatDate(material.createdAt)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <TagsIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">
            {topicTagCount} tag{topicTagCount === 1 ? '' : 's'}
          </Typography>
        </Box>
      </CardContent>

      {/* Card Actions */}
      <Box
        sx={{
          p: 2,
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          justifyContent: 'space-between',
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.8)
            : alpha(theme.palette.grey[50], 0.5),
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Download">
            <IconButton
              size="small"
              color="primary"
              onClick={() => onDownload(material)}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                },
              }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Preview">
            <IconButton
              size="small"
              color="info"
              onClick={() => onView(material)}
              sx={{
                bgcolor: alpha(theme.palette.info.main, 0.08),
                '&:hover': {
                  bgcolor: alpha(theme.palette.info.main, 0.15),
                },
              }}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View tags">
            <IconButton
              size="small"
              color="secondary"
              onClick={() => onViewTags(material)}
              sx={{
                bgcolor: alpha(theme.palette.secondary.main, 0.08),
                '&:hover': {
                  bgcolor: alpha(theme.palette.secondary.main, 0.15),
                },
              }}
            >
              <TagsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        {!isReadOnly && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canEdit && (
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => onEdit(material)}
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.08),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.warning.main, 0.15),
                    },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDelete(material)}
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.15),
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
    </Card>
  );
};

// Course Group Accordion Component
const CourseGroup = ({ courseNo, courseTitle, materials, expandedCourse, onExpand, userRole, currentUserId, onDelete, onEdit, onDownload, onView, onViewTags }) => {
  const theme = useTheme();
  const isExpanded = expandedCourse === courseNo;

  return (
    <Accordion
      expanded={isExpanded}
      onChange={() => onExpand(isExpanded ? null : courseNo)}
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: isExpanded ? 'primary.main' : 'divider',
        borderRadius: '16px !important',
        mb: 2,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:before': { display: 'none' },
        '&:hover': {
          borderColor: 'primary.main',
        },
      }}
    >
      <AccordionSummary
        expandIcon={
          <ExpandMoreIcon
            sx={{
              color: isExpanded ? 'primary.main' : 'text.secondary',
              transition: 'transform 0.3s',
            }}
          />
        }
        sx={{
          bgcolor: isExpanded ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
          minHeight: 72,
          '& .MuiAccordionSummary-content': {
            my: 1.5,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: isExpanded
                ? alpha(theme.palette.primary.main, 0.12)
                : theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.5)
                : alpha(theme.palette.grey[200], 0.6),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
            }}
          >
            {isExpanded ? (
              <FolderOpenIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            ) : (
              <FolderIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
            )}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              fontWeight={600}
              sx={{
                color: isExpanded ? 'primary.main' : 'text.primary',
                transition: 'color 0.3s',
              }}
            >
              {courseTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {courseNo} • {materials.length} material{materials.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Badge
            badgeContent={materials.length}
            color="primary"
            sx={{
              mr: 2,
              '& .MuiBadge-badge': {
                fontSize: '0.85rem',
                height: 24,
                minWidth: 24,
                borderRadius: 12,
              },
            }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ 
        p: 3, 
        bgcolor: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.paper, 0.6)
          : alpha(theme.palette.grey[50], 0.5)
      }}>
        <Grid container spacing={2}>
          {materials.map((material) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={material._id}>
              <MaterialCardItem
                material={material}
                userRole={userRole}
                currentUserId={currentUserId}
                onDelete={onDelete}
                onEdit={onEdit}
                onDownload={onDownload}
                onView={onView}
                onViewTags={onViewTags}
              />
            </Grid>
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

// Edit Dialog Component
const EditMaterialDialog = ({ open, material, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    courseTitle: '',
    courseNo: '',
    type: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (material) {
      setFormData({
        title: material.title || '',
        courseTitle: material.courseTitle || '',
        courseNo: material.courseNo || '',
        type: material.type || '',
      });
    }
  }, [material]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave(material._id, formData);
      onClose();
    } catch (error) {
      console.error('Error updating material:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon color="primary" />
        Edit Material
        <IconButton
          onClick={onClose}
          sx={{ ml: 'auto' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            fullWidth
            label="Material Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            variant="outlined"
            placeholder="e.g., Lecture 3 - Sorting Algorithms"
          />
          <TextField
            fullWidth
            label="Course Title"
            name="courseTitle"
            value={formData.courseTitle}
            onChange={handleChange}
            variant="outlined"
          />
          <TextField
            fullWidth
            label="Course Number"
            name="courseNo"
            value={formData.courseNo}
            onChange={handleChange}
            variant="outlined"
          />
          <FormControl fullWidth>
            <InputLabel>Material Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              label="Material Type"
              onChange={handleChange}
            >
              {MATERIAL_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={<SaveIcon />}
          sx={{ borderRadius: 2 }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const MaterialTagsDialog = ({ open, material, onClose }) => {
  const tags = Array.isArray(material?.topicTags) ? material.topicTags : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TagsIcon color="secondary" />
        Material Tags
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap title={material?.title || material?.courseTitle || ''}>
            {material?.title || material?.courseTitle || 'Untitled material'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {material?.courseNo || ''} {material?.courseTitle ? `• ${material.courseTitle}` : ''}
          </Typography>
        </Box>

        {tags.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No tags added for this material yet.
          </Alert>
        ) : (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {tags.length} tag{tags.length === 1 ? '' : 's'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {tags.map((tag, index) => {
                const topicLabel = tag?.topicId || tag?.topic || 'topic';
                const confidence = Number(tag?.confidence ?? 0);
                return (
                  <Chip
                    key={`${topicLabel}-${index}`}
                    label={confidence > 0 ? `${topicLabel} (${Math.round(confidence * 100)}%)` : topicLabel}
                    variant="outlined"
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 2 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Loading Skeleton Component
const MaterialsSkeleton = () => (
  <Box>
    {[1, 2].map((i) => (
      <Paper key={i} sx={{ mb: 2, p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Skeleton variant="rounded" width={56} height={56} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={28} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
        </Box>
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((j) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={j}>
              <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      </Paper>
    ))}
  </Box>
);

// Main Materials Component
const Materials = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, material: null });
  const [editDialog, setEditDialog] = useState({ open: false, material: null });
  const [previewDialog, setPreviewDialog] = useState({ open: false, material: null });
  const [tagsDialog, setTagsDialog] = useState({ open: false, material: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const userRole = user?.role;
  const currentUserId = user?.id || user?._id;

  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await materialService.getAllMaterials({
        page,
        limit: pageLimit,
        sort: '-createdAt',
      });
      // Handle both paginated and non-paginated API responses
      if (data && data.data) {
        setMaterials(data.data);
        setTotalMaterials(data.pagination?.total || data.data.length);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        // Non-paginated (array) response
        const arr = Array.isArray(data) ? data : [];
        setMaterials(arr);
        setTotalMaterials(arr.length);
        setTotalPages(1);
      }
      // Expand first course by default
      const matArr = data?.data || (Array.isArray(data) ? data : []);
      if (matArr.length > 0) {
        const courses = [...new Set(matArr.map((m) => m.courseNo))];
        setExpandedCourse(courses[0]);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load materials. Please try again.',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageLimit]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Get unique types and courses for filters
  const { types, courses } = useMemo(() => {
    const typesSet = new Set(materials.map((m) => m.type));
    const coursesSet = new Set(materials.map((m) => m.courseNo));
    return {
      types: [...typesSet].sort(),
      courses: [...coursesSet].sort(),
    };
  }, [materials]);

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const matchesSearch =
        !searchQuery ||
        material.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.courseTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.courseNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.uploadedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = !filterType || material.type === filterType;
      const matchesCourse = !filterCourse || material.courseNo === filterCourse;

      return matchesSearch && matchesType && matchesCourse;
    });
  }, [materials, searchQuery, filterType, filterCourse]);

  // Group materials by course
  const groupedMaterials = useMemo(() => {
    const groups = {};
    filteredMaterials.forEach((material) => {
      const key = material.courseNo;
      if (!groups[key]) {
        groups[key] = {
          courseNo: material.courseNo,
          courseTitle: material.courseTitle,
          materials: [],
        };
      }
      groups[key].materials.push(material);
    });
    return Object.values(groups).sort((a, b) => a.courseNo.localeCompare(b.courseNo));
  }, [filteredMaterials]);

  const handleDownload = async (material) => {
    try {
      const response = await fetch(material.fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Use originalFileName if available, then derive from URL, finally fallback
      const fileName = material.originalFileName
        || decodeURIComponent(new URL(material.fileUrl).pathname.split('/').pop())
        || `${material.courseTitle || 'material'}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(material.fileUrl, '_blank');
    }
  };

  const handleView = (material) => {
    setPreviewDialog({ open: true, material });
  };

  const handleViewTags = (material) => {
    setTagsDialog({ open: true, material });
  };

  const getPreviewUrl = (fileUrl) => {
    if (!fileUrl) return '';
    // Use Google Docs Viewer for all document types (PDF, DOCX, PPTX, etc.)
    // This provides reliable cross-browser preview without download issues
    return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  };

  const handleDeleteClick = (material) => {
    setDeleteDialog({ open: true, material });
  };

  const handleDeleteConfirm = async () => {
    const { material } = deleteDialog;
    if (!material) return;

    try {
      await materialService.deleteMaterial(material._id);
      setMaterials((prev) => prev.filter((m) => m._id !== material._id));
      setSnackbar({
        open: true,
        message: 'Material deleted successfully!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting material:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to delete material.',
        severity: 'error',
      });
    } finally {
      setDeleteDialog({ open: false, material: null });
    }
  };

  const handleEditClick = (material) => {
    setEditDialog({ open: true, material });
  };

  const handleEditSave = async (materialId, data) => {
    try {
      const updated = await materialService.updateMaterial(materialId, data);
      setMaterials((prev) =>
        prev.map((m) => (m._id === materialId ? { ...m, ...updated } : m))
      );
      setSnackbar({
        open: true,
        message: 'Material updated successfully!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating material:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update material.',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterType('');
    setFilterCourse('');
  };

  const hasActiveFilters = searchQuery || filterType || filterCourse;
  const canUpload = userRole === 'admin' || userRole === 'teacher';

  // Get page title based on role
  const getPageTitle = () => {
    if (userRole === 'teacher') return 'My Materials';
    return 'All Materials';
  };

  const getPageSubtitle = () => {
    if (userRole === 'teacher') {
      return `Manage your uploaded educational materials • ${materials.length} material${materials.length !== 1 ? 's' : ''}`;
    }
    if (userRole === 'student') {
      return `Browse all available educational materials • ${materials.length} material${materials.length !== 1 ? 's' : ''}`;
    }
    return `Manage all educational materials • ${materials.length} material${materials.length !== 1 ? 's' : ''}`;
  };

  if (isLoading) {
    return (
      <Box>
        <PageHeader
          title={getPageTitle()}
          subtitle="Loading materials..."
        />
        <MaterialsSkeleton />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={getPageTitle()}
        subtitle={getPageSubtitle()}
        actions={
          canUpload && (
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => navigate(`/${userRole}/materials/upload`)}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Upload Material
            </Button>
          )
        }
      />

      {/* Filters Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 1)
            : alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.primary' }}>
          <FilterIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600} color="text.primary">
            Filter Materials
          </Typography>
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
              placeholder="Search by title, course, type, or uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Filter by Course</InputLabel>
              <Select
                value={filterCourse}
                label="Filter by Course"
                onChange={(e) => setFilterCourse(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">All Courses</MenuItem>
                {courses.map((course) => (
                  <MenuItem key={course} value={course}>
                    {course}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Filter by Type</InputLabel>
              <Select
                value={filterType}
                label="Filter by Type"
                onChange={(e) => setFilterType(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">All Types</MenuItem>
                {types.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
            }}
          >
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {materials.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Materials
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.main, 0.02)} 100%)`,
            }}
          >
            <Typography variant="h4" fontWeight={700} color="success.main">
              {courses.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Courses
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)} 0%, ${alpha(theme.palette.warning.main, 0.02)} 100%)`,
            }}
          >
            <Typography variant="h4" fontWeight={700} color="warning.main">
              {types.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Types
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
            }}
          >
            <Typography variant="h4" fontWeight={700} color="info.main">
              {filteredMaterials.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Materials List */}
      {filteredMaterials.length === 0 ? (
        <EmptyState
          icon={<LibraryIcon sx={{ fontSize: 64 }} />}
          title={hasActiveFilters ? 'No materials match your filters' : 'No materials yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search or filter criteria'
              : canUpload 
                ? 'Start by uploading your first educational material'
                : 'No materials have been uploaded yet'
          }
          actionLabel={
            hasActiveFilters ? 'Clear Filters' : canUpload ? 'Upload Material' : null
          }
          onAction={
            hasActiveFilters
              ? handleClearFilters
              : canUpload
              ? () => navigate(`/${userRole}/materials/upload`)
              : null
          }
        />
      ) : (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.primary' }}>
            <CourseIcon color="primary" />
            <Typography variant="h6" fontWeight={600} color="text.primary">
              Materials by Course
            </Typography>
          </Box>
          {groupedMaterials.map((group) => (
            <CourseGroup
              key={group.courseNo}
              courseNo={group.courseNo}
              courseTitle={group.courseTitle}
              materials={group.materials}
              expandedCourse={expandedCourse}
              onExpand={setExpandedCourse}
              userRole={userRole}
              currentUserId={currentUserId}
              onDelete={handleDeleteClick}
              onEdit={handleEditClick}
              onDownload={handleDownload}
              onView={handleView}
              onViewTags={handleViewTags}
            />
          ))}
          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationControl
              page={page}
              totalPages={totalPages}
              total={totalMaterials}
              limit={pageLimit}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setPageLimit(newLimit);
                setPage(1);
              }}
            />
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, material: null })}
        PaperProps={{
          sx: { borderRadius: 3, maxWidth: 400 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            Delete Material
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete{' '}
            <strong>"{deleteDialog.material?.title || deleteDialog.material?.courseTitle}"</strong>? This action cannot
            be undone and will also remove all associated data.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={() => setDeleteDialog({ open: false, material: null })}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            sx={{ borderRadius: 2 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <EditMaterialDialog
        open={editDialog.open}
        material={editDialog.material}
        onClose={() => setEditDialog({ open: false, material: null })}
        onSave={handleEditSave}
      />

      <MaterialTagsDialog
        open={tagsDialog.open}
        material={tagsDialog.material}
        onClose={() => setTagsDialog({ open: false, material: null })}
      />

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false, material: null })}
        fullScreen
        PaperProps={{ sx: { bgcolor: 'background.default' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <ViewIcon color="info" />
            <Typography variant="h6" noWrap fontWeight={600}>
              {previewDialog.material?.title || previewDialog.material?.courseTitle || 'Preview'}
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewDialog({ open: false, material: null })}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {previewDialog.material && (
            <iframe
              src={getPreviewUrl(previewDialog.material.fileUrl)}
              title="Material Preview"
              style={{ width: '100%', flex: 1, border: 'none', minHeight: '80vh' }}
              allow="autoplay"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Snackbar for notifications */}
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

export default Materials;