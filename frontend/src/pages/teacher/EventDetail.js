/**
 * EventDetail
 * Teacher views an event, marks students for their assigned course(s),
 * and (if creator) downloads the result sheet.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Stack,
  Divider, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Button, Card, CardContent, Tabs, Tab, Grid, TableContainer,
} from '@mui/material';
import { Download as DownloadIcon, Save as SaveIcon, PictureAsPdf as PdfIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import eventService from '../../services/eventService';
import { useAuth } from '../../hooks';

const TYPE_LABELS = {
  central_viva: 'Central Viva',
  presentation: 'Presentation',
  thesis_defense: 'Thesis Defense',
  project_show: 'Project Show',
};

const STATUS_COLOR = { upcoming: 'info', ongoing: 'warning', completed: 'success' };

export default function EventDetail() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [marks, setMarks] = useState({});          // { "studentId:courseId": mark value }
  const [savedMarks, setSavedMarks] = useState([]); // from server
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, markData] = await Promise.all([
        eventService.getEventById(eventId),
        eventService.getMarks(eventId),
      ]);
      setEvent(detail.event);
      setRegistrations(detail.registrations);
      setSavedMarks(markData);

      // Pre-fill mark inputs from saved marks
      const markInit = {};
      for (const m of markData) {
        markInit[`${m.student._id}:${m.course._id}`] = m.mark;
      }
      setMarks(markInit);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (!event) return <Alert severity="error">Event not found.</Alert>;

  const isCreator = event.createdBy._id === user._id || event.createdBy._id?.toString() === user._id?.toString();

  // Courses this teacher is assigned to
  const assignedCourses = event.courses.filter(
    (c) => c.teacher._id === user._id || c.teacher._id?.toString() === user._id?.toString()
  );

  const eventNotStarted = new Date(event.eventDate) > new Date();

  const handleMarkChange = (studentId, courseId, value) => {
    setMarks((prev) => ({ ...prev, [`${studentId}:${courseId}`]: value }));
  };

  const handleSaveMarks = async (courseId) => {
    const entries = registrations.map((reg) => {
      const val = marks[`${reg.student._id}:${courseId}`];
      return { studentId: reg.student._id, courseId, mark: parseFloat(val) };
    }).filter((e) => !isNaN(e.mark));

    if (entries.length === 0) {
      toast.error('Enter at least one mark before saving');
      return;
    }

    setSaving(true);
    try {
      await eventService.saveMarks(eventId, entries);
      toast.success('Marks saved!');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await eventService.downloadDetailedResult(eventId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.title.replace(/\s+/g, '_')}_detailed_result.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download detailed result');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await eventService.downloadResultSheetPdf(eventId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.title.replace(/\s+/g, '_')}_result_sheet.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download result sheet');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const renderMarkingTable = (courseEntry) => {
    const cid = courseEntry.course._id;
    return (
      <Box key={cid} mb={4}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>
          {courseEntry.course.courseNo} — {courseEntry.course.courseTitle}
        </Typography>
        {registrations.length === 0 ? (
          <Alert severity="info">No registered students yet.</Alert>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Student Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell sx={{ width: { xs: 108, sm: 120 } }}>Mark (0–100)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {registrations.map((reg) => (
                  <TableRow key={reg.student._id}>
                    <TableCell>{reg.student.name}</TableCell>
                    <TableCell>{reg.student.email}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: 100, step: 0.5 }}
                        value={marks[`${reg.student._id}:${cid}`] ?? ''}
                        onChange={(e) => handleMarkChange(reg.student._id, cid, e.target.value)}
                        sx={{ width: { xs: 78, sm: 90 } }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </TableContainer>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => handleSaveMarks(cid)}
              disabled={saving || eventNotStarted}
              sx={{ mt: 2 }}
            >
              {saving ? <CircularProgress size={18} /> : eventNotStarted ? 'Event Not Started' : 'Save Marks'}
            </Button>
          </>
        )}
      </Box>
    );
  };

  return (
    <Box maxWidth={900} mx="auto" p={{ xs: 1.5, sm: 3 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }} spacing={{ xs: 1.5, sm: 0 }} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{event.title}</Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Chip label={TYPE_LABELS[event.type] || event.type} size="small" color="primary" variant="outlined" />
            <Chip label={event.status} size="small" color={STATUS_COLOR[event.status]} />
          </Stack>
        </Box>
        {isCreator && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
              size="small"
            >
              {downloading ? 'Downloading…' : 'Detailed Result'}
            </Button>
            <Button
              variant="contained"
              startIcon={<PdfIcon />}
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              size="small"
            >
              {downloadingPdf ? 'Downloading…' : 'Download Result Sheet'}
            </Button>
          </Stack>
        )}
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2"><strong>Date:</strong> {new Date(event.eventDate).toLocaleDateString('en-GB')}</Typography>
          {event.venue && <Typography variant="body2"><strong>Venue:</strong> {event.venue}</Typography>}
          <Typography variant="body2"><strong>Created by:</strong> {event.createdBy.name}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2">
            <strong>Registration Code:</strong>{' '}
            <Chip label={event.registrationCode} size="small" sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
          </Typography>
          <Typography variant="body2"><strong>Registered Students:</strong> {registrations.length}</Typography>
        </Grid>
      </Grid>

      {event.description && (
        <Alert severity="info" sx={{ mb: 3 }}>{event.description}</Alert>
      )}

      <Divider sx={{ mb: 3 }} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Mark Students" />
        <Tab label="Courses & Examiners" />
      </Tabs>

      {tab === 0 && (
        assignedCourses.length === 0 ? (
          <Alert severity="info">You are not assigned as examiner for any course in this event.</Alert>
        ) : (
          assignedCourses.map(renderMarkingTable)
        )
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {event.courses.map((c) => (
            <Card key={c.course._id} variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>
                  {c.course.courseNo} — {c.course.courseTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Examiner: {c.teacher.name} ({c.teacher.email})
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
