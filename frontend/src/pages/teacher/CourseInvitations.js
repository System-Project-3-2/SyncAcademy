/**
 * CourseInvitations
 * Teacher page: manage incoming and outgoing co-teacher invitations.
 * Also lets the teacher send a new invitation from any of their courses.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import invitationService from '../../services/invitationService';
import courseService from '../../services/courseService';

const statusColor = { pending: 'warning', accepted: 'success', declined: 'error' };

export default function CourseInvitations() {
  const [tab, setTab] = useState(0);
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  // Send invitation dialog state
  const [sendOpen, setSendOpen] = useState(false);
  const [myCourses, setMyCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recv, snt] = await Promise.all([
        invitationService.getReceived(),
        invitationService.getSent(),
      ]);
      setReceived(recv);
      setSent(snt);
    } catch {
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openSendDialog = async () => {
    setSendOpen(true);
    try {
      const [coursesRes, teachersRes] = await Promise.all([
        courseService.getAllCourses({ limit: 200 }),
        invitationService.getAllTeachers(),
      ]);
      // Only show own courses
      setMyCourses(coursesRes.data || []);
      setTeachers(teachersRes);
    } catch {
      toast.error('Failed to load data');
    }
  };

  const handleSend = async () => {
    if (!selectedCourse || !selectedTeacher) {
      toast.error('Please select a course and a teacher');
      return;
    }
    setSending(true);
    try {
      await invitationService.sendInvitation({
        courseId: selectedCourse._id,
        toTeacherId: selectedTeacher._id,
        message: inviteMessage,
      });
      toast.success('Invitation sent!');
      setSendOpen(false);
      setSelectedCourse(null);
      setSelectedTeacher(null);
      setInviteMessage('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (id, status) => {
    setRespondingId(id);
    try {
      await invitationService.respond(id, status);
      toast.success(status === 'accepted' ? 'Invitation accepted!' : 'Invitation declined');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
  );

  const renderReceived = () => (
    received.length === 0
      ? <Alert severity="info">No received invitations.</Alert>
      : received.map((inv) => (
        <Card key={inv._id} sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {inv.course?.courseTitle}
              </Typography>
              <Chip label={inv.status} color={statusColor[inv.status]} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Course: {inv.course?.courseNo} — {inv.course?.department || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              From: {inv.from?.name} ({inv.from?.email})
            </Typography>
            {inv.message && (
              <Typography variant="body2" mt={1} sx={{ fontStyle: 'italic' }}>
                "{inv.message}"
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {new Date(inv.createdAt).toLocaleDateString()}
            </Typography>
          </CardContent>
          {inv.status === 'pending' && (
            <CardActions>
              <Button
                size="small"
                color="success"
                variant="contained"
                startIcon={<AcceptIcon />}
                onClick={() => handleRespond(inv._id, 'accepted')}
                disabled={respondingId === inv._id}
              >
                Accept
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={<DeclineIcon />}
                onClick={() => handleRespond(inv._id, 'declined')}
                disabled={respondingId === inv._id}
              >
                Decline
              </Button>
            </CardActions>
          )}
        </Card>
      ))
  );

  const renderSent = () => (
    sent.length === 0
      ? <Alert severity="info">No sent invitations.</Alert>
      : sent.map((inv) => (
        <Card key={inv._id} sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {inv.course?.courseTitle}
              </Typography>
              <Chip label={inv.status} color={statusColor[inv.status]} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Course: {inv.course?.courseNo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              To: {inv.to?.name} ({inv.to?.email})
            </Typography>
            {inv.message && (
              <Typography variant="body2" mt={1} sx={{ fontStyle: 'italic' }}>
                "{inv.message}"
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {new Date(inv.createdAt).toLocaleDateString()}
            </Typography>
          </CardContent>
        </Card>
      ))
  );

  return (
    <Box maxWidth={700} mx="auto" p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Course Invitations</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={openSendDialog}
        >
          Invite Co-Teacher
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Received (${received.length})`} />
        <Tab label={`Sent (${sent.length})`} />
      </Tabs>
      <Divider sx={{ mb: 3 }} />

      {tab === 0 ? renderReceived() : renderSent()}

      {/* Send Invitation Dialog */}
      <Dialog open={sendOpen} onClose={() => setSendOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invite a Co-Teacher</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Autocomplete
              options={myCourses}
              getOptionLabel={(o) => `${o.courseNo} — ${o.courseTitle}`}
              value={selectedCourse}
              onChange={(_, v) => setSelectedCourse(v)}
              renderInput={(params) => <TextField {...params} label="Select Course" required />}
            />
            <Autocomplete
              options={teachers}
              getOptionLabel={(o) => `${o.name} (${o.email})`}
              value={selectedTeacher}
              onChange={(_, v) => setSelectedTeacher(v)}
              renderInput={(params) => <TextField {...params} label="Select Teacher" required />}
            />
            <TextField
              label="Optional Message"
              multiline
              rows={3}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSend} disabled={sending}>
            {sending ? <CircularProgress size={20} /> : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
