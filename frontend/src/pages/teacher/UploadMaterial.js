/**
 * Upload Material Page
 * Allows teachers to upload educational materials
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  LinearProgress,
  Autocomplete,
  Stack,
  Chip,
  Grid,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ArrowBack as BackIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTheme as useMuiTheme, alpha } from '@mui/material';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components';
import { materialService, courseService, topicTagService } from '../../services';
import { MATERIAL_TYPES } from '../../constants/materialTypes';

// Accepted file types
const ACCEPTED_FILES = '.pdf,.docx,.pptx';

const UploadMaterial = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const muiTheme = useMuiTheme();
  const isDark = muiTheme.palette.mode === 'dark';
  
  const [formData, setFormData] = useState({
    title: '',
    courseTitle: '',
    courseNo: '',
    type: '',
  });
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicInputValue, setTopicInputValue] = useState('');
  const [topicOptions, setTopicOptions] = useState([]);

  // Course autocomplete data
  const [courseOptions, setCourseOptions] = useState([]);

  // Track if form has unsaved changes
  const isDirty = Boolean(formData.courseTitle || formData.courseNo || formData.type || file || selectedTopics.length);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Fetch courses for autocomplete
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await courseService.getAllCourses();
        const courses = Array.isArray(data) ? data : data.data || [];
        setCourseOptions(courses);
      } catch (err) {
        console.error('Error fetching courses for autocomplete:', err);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchTopics = async () => {
      if (!selectedCourseId) {
        setTopicOptions([]);
        return;
      }

      try {
        const data = await topicTagService.getTaxonomyByCourse(selectedCourseId);
        const topics = Array.isArray(data) ? data : [];
        setTopicOptions(topics);
      } catch (err) {
        console.error('Error fetching topic taxonomy:', err);
        setTopicOptions([]);
      }
    };

    fetchTopics();
  }, [selectedCourseId]);

  useEffect(() => {
    if (!courseOptions.length) return;

    const title = String(formData.courseTitle || '').trim().toLowerCase();
    const courseNo = String(formData.courseNo || '').trim().toLowerCase();
    const matched = courseOptions.find((course) => {
      const titleMatch = String(course.courseTitle || '').trim().toLowerCase() === title;
      const noMatch = String(course.courseNo || '').trim().toLowerCase() === courseNo;
      return titleMatch || noMatch;
    });

    if (matched?._id) {
      setSelectedCourseId(matched._id);
      return;
    }

    if (!title && !courseNo) {
      setSelectedCourseId('');
      setTopicOptions([]);
      setSelectedTopics([]);
    }
  }, [formData.courseTitle, formData.courseNo, courseOptions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const normalizeTopicInput = (value) => String(value || '').trim();

  const handleTopicChange = (_, newValue) => {
    const values = Array.isArray(newValue) ? newValue : [];
    const unique = [...new Set(values.map(normalizeTopicInput).filter(Boolean))];
    setSelectedTopics(unique);
    setError('');
  };

  const commitTypedTopic = () => {
    const typed = normalizeTopicInput(topicInputValue);
    if (!typed) return;

    setSelectedTopics((prev) => {
      const next = [...new Set([...prev, typed])];
      return next;
    });
    setTopicInputValue('');
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (!['pdf', 'docx', 'pptx'].includes(ext)) {
        setError('Only PDF, DOCX, and PPTX files are supported');
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError('');
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    if (!formData.courseTitle.trim()) {
      setError('Please enter a course title');
      return false;
    }
    if (!formData.courseNo.trim()) {
      setError('Please enter a course number');
      return false;
    }
    if (!formData.title.trim()) {
      setError('Please enter a material title');
      return false;
    }
    if (!formData.type) {
      setError('Please select a material type');
      return false;
    }
    if (!file) {
      setError('Please select a file to upload');
      return false;
    }

    if (selectedCourseId && selectedTopics.length === 0) {
      // Topic tagging is optional for legacy compatibility, but nudge teachers to tag.
      return true;
    }
    return true;
  };

  const getTopicCatalog = () =>
    topicOptions.map((topic) => ({
      label: topic.topicName || topic.topicId,
      slug: topic.slug || topic.topicId,
      topicId: topic.topicId,
    }));

  const buildTopicPayload = () => {
    const catalog = getTopicCatalog();
    const catalogByNormalized = new Map(
      catalog.map((topic) => [normalizeTopicInput(topic.label).toLowerCase(), topic])
    );

    const selectedTopicIds = [];
    const newTopics = [];

    selectedTopics.forEach((topic) => {
      const normalized = normalizeTopicInput(topic).toLowerCase();
      const matched = catalogByNormalized.get(normalized);
      if (matched) {
        selectedTopicIds.push(matched.slug || matched.topicId);
      } else {
        newTopics.push(topic);
      }
    });

    return {
      selectedTopicIds: [...new Set(selectedTopicIds)],
      newTopics: [...new Set(newTopics)],
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      const uploadData = new FormData();
      uploadData.append('title', formData.title);
      uploadData.append('courseTitle', formData.courseTitle);
      uploadData.append('courseNo', formData.courseNo);
      uploadData.append('type', formData.type);
      uploadData.append('file', file);
      if (selectedCourseId) {
        uploadData.append('courseId', selectedCourseId);
      }

      const { selectedTopicIds, newTopics } = buildTopicPayload();
      if (selectedTopicIds.length) {
        uploadData.append('selectedTopicIds', JSON.stringify(selectedTopicIds));
      }
      if (newTopics.length) {
        uploadData.append('newTopics', JSON.stringify(newTopics));
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await materialService.uploadMaterial(uploadData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      toast.success('Material uploaded successfully!');
      
      // Navigate back after short delay
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to upload material';
      setError(message);
      toast.error(message);
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box>
      <PageHeader
        title="Upload Material"
        subtitle="Upload educational materials for students"
        breadcrumbs={[
          { label: 'Dashboard', path: '/teacher/dashboard' },
          { label: 'Upload Material' },
        ]}
        actions={
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        }
      />

      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: 700,
          mx: 'auto',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Autocomplete
          freeSolo
          options={courseOptions.map((c) => `${c.courseTitle} (${c.courseNo})`)}
          value={formData.courseTitle}
          onInputChange={(_, newValue) => {
            setFormData((prev) => ({ ...prev, courseTitle: newValue }));
            setError('');
            // Auto-fill courseNo when a matching course is selected
            const match = courseOptions.find((c) => `${c.courseTitle} (${c.courseNo})` === newValue || c.courseTitle === newValue || c.courseNo === newValue);
            if (match) {
              setFormData((prev) => ({ ...prev, courseTitle: match.courseTitle, courseNo: match.courseNo }));
              setSelectedCourseId(match._id);
            } else {
              setSelectedCourseId('');
              setTopicOptions([]);
              setSelectedTopics([]);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth
              label="Course Title"
              name="courseTitle"
              required
              placeholder="e.g., Introduction to Data Structures"
            />
          )}
          sx={{ mb: 3 }}
        />

        <Autocomplete
          freeSolo
          options={courseOptions.map((c) => c.courseNo)}
          value={formData.courseNo}
          onInputChange={(_, newValue) => {
            setFormData((prev) => ({ ...prev, courseNo: newValue }));
            setError('');
            // Auto-fill courseTitle when a matching course is selected
            const match = courseOptions.find((c) => c.courseNo === newValue);
            if (match) {
              setFormData((prev) => ({ ...prev, courseNo: newValue, courseTitle: match.courseTitle }));
              setSelectedCourseId(match._id);
            } else {
              setSelectedCourseId('');
              setTopicOptions([]);
              setSelectedTopics([]);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth
              label="Course Number"
              name="courseNo"
              required
              placeholder="e.g., CSE101, MATH201"
            />
          )}
          sx={{ mb: 3 }}
        />

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 2,
            bgcolor: 'background.default',
          }}
        >
          <Stack spacing={1.25}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Topic Tagging
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select existing topics for this course or type a new topic name. New topics will be normalized and added automatically.
              </Typography>
            </Box>

            <Autocomplete
              multiple
              freeSolo
              filterSelectedOptions
              options={getTopicCatalog().map((topic) => topic.label)}
              value={selectedTopics}
              inputValue={topicInputValue}
              onInputChange={(_, newInputValue) => setTopicInputValue(newInputValue)}
              onChange={handleTopicChange}
              onKeyDown={(e) => {
                // Prevent Enter from submitting the full form while adding multiple topics.
                if (e.key === 'Enter') {
                  commitTypedTopic();
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onBlur={commitTypedTopic}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                    sx={{ borderRadius: 1.5 }}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Topics"
                  placeholder={selectedCourseId ? 'Select or type topics' : 'Choose a course first'}
                  helperText={selectedCourseId ? 'Use existing taxonomy topics or type new ones.' : 'Select a course to load topics.'}
                />
              )}
              disabled={!selectedCourseId}
            />

            {topicOptions.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Available topics
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {topicOptions.slice(0, 10).map((topic) => (
                    <Chip
                      key={topic._id || topic.slug || topic.topicId}
                      size="small"
                      label={topic.topicName || topic.topicId}
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>

        <TextField
          fullWidth
          label="Material Title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          placeholder="e.g., Lecture 3 - Sorting Algorithms"
          helperText="Give a descriptive title for this material"
          sx={{ mb: 3 }}
        />

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Material Type</InputLabel>
              <Select
                name="type"
                value={formData.type}
                label="Material Type"
                onChange={handleChange}
                required
              >
                {MATERIAL_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.default',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Topic-based recommendations will use these tags to surface weak-topic materials for students.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* File Upload Area */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Upload File
          </Typography>
          
          {!file ? (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha(muiTheme.palette.primary.main, isDark ? 0.1 : 0.04),
                },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" gutterBottom>
                Click to upload or drag and drop
              </Typography>
              <Typography variant="body2" color="text.secondary">
                PDF, DOCX, or PPTX (max 10MB)
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILES}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(muiTheme.palette.primary.main, isDark ? 0.06 : 0.03),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FileIcon color="primary" fontSize="large" />
                <Box>
                  <Typography variant="subtitle2">{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(file.size)}
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleRemoveFile}
                disabled={isLoading}
              >
                Remove
              </Button>
            </Box>
          )}
        </Box>

        {/* Upload Progress */}
        {isLoading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Uploading... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => navigate(-1)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<UploadIcon />}
            disabled={isLoading}
          >
            {isLoading ? 'Uploading...' : 'Upload Material'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default UploadMaterial;
