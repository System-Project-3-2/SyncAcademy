/**
 * MyEventRegistrations
 * Student page: register for an event using a code, and view registered events.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, CircularProgress,
  Alert, Card, CardContent, Chip, Stack, Grid, Divider,
} from '@mui/material';
import { EventAvailable as EventIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import eventService from '../../services/eventService';

const TYPE_LABELS = {
  central_viva: 'Central Viva',
  presentation: 'Presentation',
  thesis_defense: 'Thesis Defense',
  project_show: 'Project Show',
};

const STATUS_COLOR = { upcoming: 'info', ongoing: 'warning', completed: 'success' };

export default function MyEventRegistrations() {
  const [code, setCode] = useState('');
  const [registering, setRegistering] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    eventService.getMyRegistrations()
      .then((data) => setEvents(data))
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRegister = async () => {
    if (!code.trim()) {
      toast.error('Enter a registration code');
      return;
    }
    setRegistering(true);
    try {
      const res = await eventService.registerForEvent(code.trim());
      toast.success(res.message || 'Registered successfully!');
      setCode('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <Box maxWidth={800} mx="auto" p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>My Events</Typography>

      {/* Registration form */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            Register for an Event
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Event Registration Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 8, style: { fontFamily: 'monospace', letterSpacing: 2 } }}
              placeholder="e.g. A1B2C3D4"
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              startIcon={<EventIcon />}
              onClick={handleRegister}
              disabled={registering}
            >
              {registering ? <CircularProgress size={18} /> : 'Register'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" mb={2}>Registered Events</Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : events.length === 0 ? (
        <Alert severity="info">You haven't registered for any event yet.</Alert>
      ) : (
        <Grid container spacing={2}>
          {events.map((reg) => {
            const ev = reg.event;
            return (
              <Grid item xs={12} sm={6} key={reg._id}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" mb={1}>
                      <Chip
                        label={TYPE_LABELS[ev.type] || ev.type}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      <Chip label={ev.status} size="small" color={STATUS_COLOR[ev.status]} />
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={600}>{ev.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(ev.eventDate).toLocaleDateString('en-GB')}
                    </Typography>
                    {ev.venue && (
                      <Typography variant="body2" color="text.secondary">
                        Venue: {ev.venue}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Courses: {ev.courses?.map((c) => c.course?.courseNo).join(', ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Registered: {new Date(reg.createdAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
