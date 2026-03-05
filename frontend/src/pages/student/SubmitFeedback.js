/**
 * Submit Feedback Page
 * Allows students to submit new feedback or queries
 */
import React, { useState, useEffect } from 'react';
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
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components';
import { feedbackService } from '../../services';

// Feedback categories matching backend enum
const CATEGORIES = [
  { value: 'Missing Material', label: 'Missing Material', description: 'Report missing course materials' },
  { value: 'Wrong Content', label: 'Wrong Content', description: 'Report incorrect content in materials' },
  { value: 'Technical Issue', label: 'Technical Issue', description: 'Report technical problems' },
  { value: 'Private Feedback', label: 'Private Feedback', description: 'Send private feedback to a specific teacher' },
  { value: 'Other', label: 'Other', description: 'General feedback or queries' },
];

const SubmitFeedback = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'Other',
    targetTeacher: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const isPrivate = formData.category === 'Private Feedback';

  // Fetch teachers when Private Feedback is selected
  useEffect(() => {
    if (isPrivate && teachers.length === 0) {
      const fetchTeachers = async () => {
        setLoadingTeachers(true);
        try {
          const data = await feedbackService.getTeachers();
          setTeachers(data);
        } catch (err) {
          console.error('Error fetching teachers:', err);
        } finally {
          setLoadingTeachers(false);
        }
      };
      fetchTeachers();
    }
  }, [isPrivate, teachers.length]);

  // Unsaved changes guard
  const isDirty = formData.title.trim() !== '' || formData.message.trim() !== '';

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'category' && value !== 'Private Feedback' ? { targetTeacher: null } : {}),
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Please enter a title');
      return false;
    }
    if (formData.title.length < 5) {
      setError('Title must be at least 5 characters');
      return false;
    }
    if (!formData.message.trim()) {
      setError('Please enter a message');
      return false;
    }
    if (formData.message.length < 20) {
      setError('Message must be at least 20 characters');
      return false;
    }
    if (isPrivate && !formData.targetTeacher) {
      setError('Please select a teacher for private feedback');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const payload = {
        title: formData.title,
        message: formData.message,
        category: formData.category,
      };
      if (isPrivate && formData.targetTeacher) {
        payload.targetTeacher = formData.targetTeacher._id;
      }
      await feedbackService.createFeedback(payload);
      toast.success('Feedback submitted successfully!');
      navigate('/student/feedbacks');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit feedback';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Submit Feedback"
        subtitle="Let us know about any issues or suggestions"
        breadcrumbs={[
          { label: 'Dashboard', path: '/student/dashboard' },
          { label: 'Submit Feedback' },
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

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Category</InputLabel>
          <Select
            name="category"
            value={formData.category}
            label="Category"
            onChange={handleChange}
          >
            {CATEGORIES.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                <Box>
                  <Typography>{cat.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {cat.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {isPrivate && (
          <Autocomplete
            options={teachers}
            loading={loadingTeachers}
            getOptionLabel={(option) => `${option.name} (${option.email})`}
            value={formData.targetTeacher}
            onChange={(_, newValue) => {
              setFormData((prev) => ({ ...prev, targetTeacher: newValue }));
              setError('');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Teacher"
                required
                placeholder="Search for a teacher..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingTeachers ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            sx={{ mb: 3 }}
          />
        )}

        <TextField
          fullWidth
          label="Title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          sx={{ mb: 3 }}
          placeholder="Brief summary of your feedback"
          helperText={`${formData.title.length}/100 characters`}
          inputProps={{ maxLength: 100 }}
        />

        <TextField
          fullWidth
          label="Message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          multiline
          rows={6}
          sx={{ mb: 3 }}
          placeholder="Describe your issue or feedback in detail..."
          helperText={`${formData.message.length}/2000 characters`}
          inputProps={{ maxLength: 2000 }}
        />

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
            startIcon={<SendIcon />}
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SubmitFeedback;
