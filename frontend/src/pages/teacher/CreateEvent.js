/**
 * CreateEvent
 * Teacher creates a new academic event.
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, MenuItem, Button,
  Stack, CircularProgress, IconButton, Divider,
  Autocomplete, Card, CardContent,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import eventService from '../../services/eventService';
import courseService from '../../services/courseService';
import invitationService from '../../services/invitationService';
import { useAuth } from '../../hooks';

const EVENT_TYPES = [
  { value: 'central_viva', label: 'Central Viva' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'thesis_defense', label: 'Thesis Defense' },
  { value: 'project_show', label: 'Project Show' },
];

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '',
    type: '',
    eventDate: '',
    venue: '',
    description: '',
  });
  const [courseEntries, setCourseEntries] = useState([{ course: null, teacher: null }]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      courseService.getAllCourses({ limit: 200 }),
      invitationService.getAllTeachers(),
    ]).then(([coursesRes, teachersRes]) => {
      setCourses(coursesRes.data || []);
      // Include current user so they can assign themselves
      const allTeachers = teachersRes || [];
      const selfIncluded = allTeachers.some((t) => t._id === user._id);
      if (!selfIncluded && user) {
        setTeachers([{ _id: user._id, name: user.name, email: user.email }, ...allTeachers]);
      } else {
        setTeachers(allTeachers);
      }
    });
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const updateEntry = (idx, field, value) => {
    setCourseEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const addEntry = () => setCourseEntries((p) => [...p, { course: null, teacher: null }]);

  const removeEntry = (idx) => setCourseEntries((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.type || !form.eventDate) {
      toast.error('Title, type, and date are required');
      return;
    }
    for (const entry of courseEntries) {
      if (!entry.course || !entry.teacher) {
        toast.error('Each course entry must have a course and an assigned teacher');
        return;
      }
    }

    setLoading(true);
    try {
      await eventService.createEvent({
        ...form,
        courses: courseEntries.map((e) => ({ course: e.course._id, teacher: e.teacher._id })),
      });
      toast.success('Event created!');
      navigate('/teacher/events');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={700} mx="auto" p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>Create New Event</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <TextField
            label="Event Title" name="title" value={form.title}
            onChange={handleChange} required fullWidth
          />
          <TextField
            select label="Event Type" name="type" value={form.type}
            onChange={handleChange} required fullWidth
          >
            {EVENT_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Event Date & Time" name="eventDate" type="datetime-local"
            value={form.eventDate} onChange={handleChange} required fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Venue (optional)" name="venue" value={form.venue}
            onChange={handleChange} fullWidth
          />
          <TextField
            label="Description (optional)" name="description" value={form.description}
            onChange={handleChange} fullWidth multiline rows={3}
          />

          <Divider />
          <Typography variant="subtitle1" fontWeight={600}>
            Courses & Assigned Teachers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add each course that will be evaluated and assign the teacher who will mark it.
          </Typography>

          {courseEntries.map((entry, idx) => (
            <Card key={idx} variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={600}>Course Entry {idx + 1}</Typography>
                    {courseEntries.length > 1 && (
                      <IconButton size="small" color="error" onClick={() => removeEntry(idx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <Autocomplete
                    options={courses}
                    getOptionLabel={(o) => `${o.courseNo} — ${o.courseTitle}`}
                    value={entry.course}
                    onChange={(_, v) => updateEntry(idx, 'course', v)}
                    renderInput={(params) => <TextField {...params} label="Course" required />}
                  />
                  <Autocomplete
                    options={teachers}
                    getOptionLabel={(o) => `${o.name} (${o.email})`}
                    value={entry.teacher}
                    onChange={(_, v) => updateEntry(idx, 'teacher', v)}
                    renderInput={(params) => <TextField {...params} label="Assigned Teacher" required />}
                  />
                </Stack>
              </CardContent>
            </Card>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addEntry}
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          >
            Add Another Course
          </Button>

          <Button
            type="submit" variant="contained" size="large"
            disabled={loading}
            sx={{ alignSelf: 'flex-start' }}
          >
            {loading ? <CircularProgress size={20} /> : 'Create Event'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
