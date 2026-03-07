import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Button,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Notifications as NotifIcon,
  UploadFile as UploadIcon,
  Campaign as AnnouncementIcon,
  Comment as CommentIcon,
  Assignment as AssignmentIcon,
  Grading as GradingIcon,
  EmojiEvents as ResultIcon,
  Description as ScriptIcon,
  Feedback as FeedbackIcon,
  School as EnrollmentIcon,
  Quiz as QuizNotifIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  DeleteSweep as ClearAllIcon,
  Circle as UnreadDot,
} from '@mui/icons-material';
import { PageHeader, PaginationControl } from '../../components';
import notificationService from '../../services/notificationService';
import { useAuth } from '../../hooks';

const typeIcons = {
  material_upload: <UploadIcon color="primary" />,
  announcement: <AnnouncementIcon color="warning" />,
  comment: <CommentIcon color="info" />,
  assignment_created: <AssignmentIcon color="secondary" />,
  assignment_graded: <GradingIcon color="success" />,
  result_published: <ResultIcon sx={{ color: '#f59e0b' }} />,
  evaluated_script: <ScriptIcon color="primary" />,
  feedback_response: <FeedbackIcon color="info" />,
  enrollment: <EnrollmentIcon color="success" />,
  quiz_created: <QuizNotifIcon color="secondary" />,
  quiz_published: <QuizNotifIcon color="success" />,
};

const Notifications = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications(page, 15);
      setNotifications(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  const handleClearAll = async () => {
    try {
      await notificationService.clearAll();
      setNotifications([]);
      setPagination({ total: 0, pages: 1 });
    } catch { /* ignore */ }
  };

  const handleClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif._id);
        setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
      } catch { /* ignore */ }
    }
    if (notif.link) {
      // Prefix with user role if the link is relative and doesn't start with /<role>
      const link = notif.link.startsWith(`/${user?.role}`) ? notif.link : `/${user?.role}${notif.link}`;
      navigate(link);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setPagination((p) => ({ ...p, total: p.total - 1 }));
    } catch { /* ignore */ }
  };

  const formatTime = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <Box>
      <PageHeader
        title="Notifications"
        subtitle={`${pagination.total} notification${pagination.total !== 1 ? 's' : ''}`}
      />

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<DoneAllIcon />}
          onClick={handleMarkAllRead}
          disabled={!notifications.some((n) => !n.isRead)}
        >
          Mark all read
        </Button>
        <Button
          size="small"
          color="error"
          startIcon={<ClearAllIcon />}
          onClick={handleClearAll}
          disabled={!notifications.length}
        >
          Clear all
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : notifications.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No notifications yet.
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <List disablePadding>
            {notifications.map((notif, idx) => (
              <React.Fragment key={notif._id}>
                {idx > 0 && <Divider />}
                <ListItem
                  onClick={() => handleClick(notif)}
                  secondaryAction={
                    <Tooltip title="Delete">
                      <IconButton edge="end" size="small" onClick={(e) => handleDelete(e, notif._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                  sx={{
                    cursor: 'pointer',
                    bgcolor: notif.isRead ? 'transparent' : alpha(theme.palette.primary.main, 0.04),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                    py: 1.5,
                    px: 2,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {typeIcons[notif.type] || <NotifIcon color="action" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {!notif.isRead && (
                          <UnreadDot sx={{ fontSize: 8, color: 'primary.main' }} />
                        )}
                        <Typography variant="body2" fontWeight={notif.isRead ? 400 : 600}>
                          {notif.title}
                        </Typography>
                        <Chip label={formatTime(notif.createdAt)} size="small" variant="outlined" sx={{ ml: 'auto', fontSize: '0.7rem', height: 22 }} />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                        {notif.message}
                      </Typography>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {pagination.pages > 1 && (
        <Box sx={{ mt: 2 }}>
          <PaginationControl
            page={page}
            totalPages={pagination.pages}
            onPageChange={setPage}
          />
        </Box>
      )}
    </Box>
  );
};

export default Notifications;
