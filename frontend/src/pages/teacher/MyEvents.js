/**
 * MyEvents
 * Teacher page: list all events where the teacher is creator or assigned examiner.
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, CardActions, Button,
  Chip, CircularProgress, Alert, Stack, Grid,
} from '@mui/material';
import { Add as AddIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import eventService from '../../services/eventService';

const TYPE_LABELS = {
  central_viva: 'Central Viva',
  presentation: 'Presentation',
  thesis_defense: 'Thesis Defense',
  project_show: 'Project Show',
};

const STATUS_COLOR = {
  upcoming: 'info',
  ongoing: 'warning',
  completed: 'success',
};

export default function MyEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventService.getMyEvents()
      .then(setEvents)
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
  );

  return (
    <Box maxWidth={1000} mx="auto" p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>My Events</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/teacher/events/create')}>
          Create Event
        </Button>
      </Stack>

      {events.length === 0 ? (
        <Alert severity="info">No events yet. Create one to get started.</Alert>
      ) : (
        <Grid container spacing={2}>
          {events.map((ev) => (
            <Grid item xs={12} md={6} key={ev._id}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Chip label={TYPE_LABELS[ev.type] || ev.type} size="small" color="primary" variant="outlined" />
                    <Chip label={ev.status} size="small" color={STATUS_COLOR[ev.status]} />
                  </Stack>
                  <Typography variant="subtitle1" fontWeight={600}>{ev.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(ev.eventDate).toLocaleDateString('en-GB')}
                  </Typography>
                  {ev.venue && (
                    <Typography variant="body2" color="text.secondary">Venue: {ev.venue}</Typography>
                  )}
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Courses: {ev.courses?.length ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Created by: {ev.createdBy?.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Registration Code: <strong>{ev.registrationCode}</strong>
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => navigate(`/teacher/events/${ev._id}`)}
                  >
                    View / Mark
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
