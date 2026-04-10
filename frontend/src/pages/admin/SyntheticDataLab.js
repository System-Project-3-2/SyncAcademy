/**
 * Synthetic Data Lab (Admin)
 * Generate scalable synthetic users/courses/materials/quizzes/events from the website.
 */
import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Grid,
  Stack,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import {
  Science as ScienceIcon,
  RocketLaunch as RocketIcon,
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components';
import { adminService } from '../../services';

const initialConfig = {
  namespace: '',
  teachers: 3,
  students: 60,
  coursesPerTeacher: 2,
  materialsPerCourse: 8,
  quizzesPerCourse: 3,
  eventsPerEnrollment: 35,
  enrollmentsPerStudent: 2,
  password: 'Demo@123',
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const SyntheticDataLab = () => {
  const [config, setConfig] = useState(initialConfig);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const estimatedScale = useMemo(() => {
    const teachers = toNumber(config.teachers, 0);
    const students = toNumber(config.students, 0);
    const courses = teachers * toNumber(config.coursesPerTeacher, 0);
    const materials = courses * toNumber(config.materialsPerCourse, 0);
    const quizzes = courses * toNumber(config.quizzesPerCourse, 0);
    const enrollments = students * toNumber(config.enrollmentsPerStudent, 0);
    const events = enrollments * toNumber(config.eventsPerEnrollment, 0);

    return { teachers, students, courses, materials, quizzes, enrollments, events };
  }, [config]);

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (preset) => {
    if (preset === 'small') {
      setConfig((prev) => ({
        ...prev,
        teachers: 2,
        students: 30,
        coursesPerTeacher: 2,
        materialsPerCourse: 6,
        quizzesPerCourse: 2,
        eventsPerEnrollment: 20,
        enrollmentsPerStudent: 2,
      }));
    }

    if (preset === 'medium') {
      setConfig((prev) => ({
        ...prev,
        teachers: 4,
        students: 120,
        coursesPerTeacher: 3,
        materialsPerCourse: 10,
        quizzesPerCourse: 4,
        eventsPerEnrollment: 40,
        enrollmentsPerStudent: 3,
      }));
    }

    if (preset === 'large') {
      setConfig((prev) => ({
        ...prev,
        teachers: 8,
        students: 500,
        coursesPerTeacher: 4,
        materialsPerCourse: 15,
        quizzesPerCourse: 5,
        eventsPerEnrollment: 55,
        enrollmentsPerStudent: 4,
      }));
    }
  };

  const handleGenerate = async () => {
    try {
      setIsSubmitting(true);
      const payload = {
        ...config,
        teachers: toNumber(config.teachers, 0),
        students: toNumber(config.students, 0),
        coursesPerTeacher: toNumber(config.coursesPerTeacher, 0),
        materialsPerCourse: toNumber(config.materialsPerCourse, 0),
        quizzesPerCourse: toNumber(config.quizzesPerCourse, 0),
        eventsPerEnrollment: toNumber(config.eventsPerEnrollment, 0),
        enrollmentsPerStudent: toNumber(config.enrollmentsPerStudent, 0),
      };

      const data = await adminService.generateSyntheticData(payload);
      setResult(data);
      toast.success('Synthetic dataset generated successfully');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to generate synthetic data';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Synthetic Data Lab"
        subtitle="Generate scalable users, courses, materials, quizzes and learning events for live demos."
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <ScienceIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Generator Configuration
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Namespace (optional)"
                  value={config.namespace}
                  onChange={(e) => handleInputChange('namespace', e.target.value)}
                  helperText="Used to prefix synthetic emails and course codes"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Default Password"
                  value={config.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Teachers" value={config.teachers} onChange={(e) => handleInputChange('teachers', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Students" value={config.students} onChange={(e) => handleInputChange('students', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Courses / Teacher" value={config.coursesPerTeacher} onChange={(e) => handleInputChange('coursesPerTeacher', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Materials / Course" value={config.materialsPerCourse} onChange={(e) => handleInputChange('materialsPerCourse', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Quizzes / Course" value={config.quizzesPerCourse} onChange={(e) => handleInputChange('quizzesPerCourse', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Enrollments / Student" value={config.enrollmentsPerStudent} onChange={(e) => handleInputChange('enrollmentsPerStudent', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField fullWidth type="number" label="Events / Enrollment" value={config.eventsPerEnrollment} onChange={(e) => handleInputChange('eventsPerEnrollment', e.target.value)} />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
              <Chip label="Small Preset" color="default" onClick={() => applyPreset('small')} />
              <Chip label="Medium Preset" color="primary" onClick={() => applyPreset('medium')} />
              <Chip label="Large Preset" color="secondary" onClick={() => applyPreset('large')} />
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<RocketIcon />}
                onClick={handleGenerate}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Generating...' : 'Generate Synthetic Dataset'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={() => setConfig(initialConfig)}
                disabled={isSubmitting}
              >
                Reset
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Estimated Scale
            </Typography>
            <Stack spacing={1.2}>
              <Chip label={`Teachers: ${estimatedScale.teachers}`} />
              <Chip label={`Students: ${estimatedScale.students}`} />
              <Chip label={`Courses: ${estimatedScale.courses}`} />
              <Chip label={`Materials: ${estimatedScale.materials}`} />
              <Chip label={`Quizzes: ${estimatedScale.quizzes}`} />
              <Chip label={`Enrollments: ${estimatedScale.enrollments}`} />
              <Chip label={`Learning Events: ${estimatedScale.events}`} color="warning" />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {result && (
        <Paper sx={{ p: 3, borderRadius: 3, mt: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Last Run Summary
          </Typography>

          <Alert severity="success" sx={{ mb: 2 }}>
            Namespace: <strong>{result.namespace}</strong>
          </Alert>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {Object.entries(result.summary || {}).map(([key, value]) => (
              <Grid item xs={12} sm={6} md={3} key={key}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {key}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Alert severity="info">
            Sample Teacher: <strong>{result.sampleAccounts?.teacher}</strong>
            <br />
            Sample Student: <strong>{result.sampleAccounts?.student}</strong>
            <br />
            Password: <strong>{result.sampleAccounts?.password}</strong>
          </Alert>
        </Paper>
      )}
    </Box>
  );
};

export default SyntheticDataLab;
