/**
 * CourseStream Page — Notice & Discussion
 *
 * Tabs:
 *   Notice   — Teacher/admin posts announcements with attachments/links.
 *              All enrolled users can comment (edit own comments).
 *   Discussion — Any enrolled user can open a question thread (with attachments).
 *                Anyone enrolled can reply. Teacher/author can mark solved.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Avatar,
  TextField,
  Button,
  IconButton,
  Chip,
  Collapse,
  Divider,
  Tooltip,
  Paper,
  alpha,
  useTheme,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Fade,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Campaign as NoticeIcon,
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Close as CloseIcon,
  AttachFile as AttachIcon,
  Image as ImageIcon,
  InsertDriveFile as DocIcon,
  Link as LinkIcon,
  Forum as DiscussionIcon,
  CheckCircle as SolvedIcon,
  RadioButtonUnchecked as OpenIcon,
  Reply as ReplyIcon,
  TaskAlt as AcceptIcon,
  QuestionMark as QuestionIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  ThumbDownOutlined as ThumbDownOutlinedIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks';
import { announcementService, discussionService } from '../../services';
import { LoadingSpinner } from '../../components';
import { Assignment as AssignmentNavIcon, Quiz as QuizNavIcon } from '@mui/icons-material';

// ─── Utility helpers ─────────────────────────────────────────────────────────

const getInitials = (name = '') =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const timeAgo = (date) => {
  try {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(date).toLocaleDateString();
  } catch { return ''; }
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const isImageAttachment = (att) => att.fileType === 'image' || IMAGE_EXTS.has((att.fileName || '').slice((att.fileName || '').lastIndexOf('.')).toLowerCase());

// ─── Contribution Badge (shown next to username) ─────────────────────────────

const ContributionBadge = ({ contribution }) => {
  if (!contribution && contribution !== 0) return null;
  return (
    <Chip
      icon={<StarIcon sx={{ fontSize: '11px !important' }} />}
      label={contribution}
      size="small"
      color={contribution > 0 ? 'success' : contribution < 0 ? 'error' : 'default'}
      variant="outlined"
      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, ml: 0.5 }}
    />
  );
};

// ─── Linkify text (make URLs clickable in content) ───────────────────────────

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;
const URL_TEST = /^https?:\/\/[^\s<]+$/;

const LinkifiedText = ({ text, variant = 'body2', color, sx = {} }) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <Typography variant={variant} color={color} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...sx }}>
      {parts.map((part, i) =>
        URL_TEST.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </Typography>
  );
};

// ─── Vote Controls ───────────────────────────────────────────────────────────

const VoteControls = ({ votes = [], currentUserId, onVote, size = 'small' }) => {
  const score = votes.reduce((sum, v) => sum + v.value, 0);
  const myVote = votes.find((v) => v.user === currentUserId || v.user?._id === currentUserId);
  const myValue = myVote?.value || 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Tooltip title="Upvote">
        <IconButton
          size={size}
          onClick={(e) => { e.stopPropagation(); onVote(myValue === 1 ? 0 : 1); }}
          sx={{ p: 0.25, color: myValue === 1 ? 'success.main' : 'text.disabled', '&:hover': { color: 'success.main' } }}
        >
          {myValue === 1 ? <ThumbUpIcon sx={{ fontSize: size === 'small' ? 16 : 20 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: size === 'small' ? 16 : 20 }} />}
        </IconButton>
      </Tooltip>
      <Typography
        variant="caption"
        fontWeight={700}
        sx={{ minWidth: 20, textAlign: 'center', color: score > 0 ? 'success.main' : score < 0 ? 'error.main' : 'text.disabled' }}
      >
        {score}
      </Typography>
      <Tooltip title="Downvote">
        <IconButton
          size={size}
          onClick={(e) => { e.stopPropagation(); onVote(myValue === -1 ? 0 : -1); }}
          sx={{ p: 0.25, color: myValue === -1 ? 'error.main' : 'text.disabled', '&:hover': { color: 'error.main' } }}
        >
          {myValue === -1 ? <ThumbDownIcon sx={{ fontSize: size === 'small' ? 16 : 20 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: size === 'small' ? 16 : 20 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// ─── Attachment Display ───────────────────────────────────────────────────────

const AttachmentList = ({ attachments = [], links = [] }) => {
  if (!attachments.length && !links.length) return null;
  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {attachments.map((att, i) =>
        isImageAttachment(att) ? (
          <Box
            key={i}
            component="a"
            href={att.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'block', width: 100, height: 80, borderRadius: 2,
              overflow: 'hidden', border: '1px solid', borderColor: 'divider', flexShrink: 0,
            }}
          >
            <img src={att.fileUrl} alt={att.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        ) : (
          <Chip
            key={i}
            icon={<DocIcon />}
            label={att.fileName || 'File'}
            size="small"
            variant="outlined"
            component="a"
            href={att.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            sx={{ maxWidth: 200 }}
          />
        )
      )}
      {links.filter(Boolean).map((link, i) => (
        <Chip
          key={`link-${i}`}
          icon={<LinkIcon />}
          label={link.length > 40 ? link.slice(0, 40) + '...' : link}
          size="small"
          variant="outlined"
          component="a"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          clickable
          color="primary"
          sx={{ maxWidth: 220 }}
        />
      ))}
    </Box>
  );
};

// ─── File / Link Picker ───────────────────────────────────────────────────────

const AttachmentPicker = ({ files, setFiles, links, setLinks }) => {
  const fileInputRef = useRef(null);
  const [linkInput, setLinkInput] = useState('');

  const handleAddLink = () => {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/.test(trimmed)) {
      toast.error('Link must start with http:// or https://');
      return;
    }
    setLinks((prev) => [...prev, trimmed]);
    setLinkInput('');
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const chosen = Array.from(e.target.files || []);
          if (files.length + chosen.length > 5) {
            toast.error('Maximum 5 files allowed');
            return;
          }
          setFiles((prev) => [...prev, ...chosen]);
          e.target.value = '';
        }}
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Button
          size="small"
          startIcon={<AttachIcon />}
          onClick={() => fileInputRef.current?.click()}
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          Add Files ({files.length}/5)
        </Button>
      </Box>

      {files.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          {files.map((f, i) => (
            <Chip
              key={i}
              label={f.name}
              size="small"
              onDelete={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              icon={IMAGE_EXTS.has(f.name.slice(f.name.lastIndexOf('.')).toLowerCase()) ? <ImageIcon /> : <DocIcon />}
            />
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="https://..."
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          InputProps={{ startAdornment: <LinkIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.disabled' }} /> }}
        />
        <Button size="small" onClick={handleAddLink} variant="outlined" sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>
          Add Link
        </Button>
      </Box>

      {links.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {links.map((l, i) => (
            <Chip
              key={i}
              label={l.length > 35 ? l.slice(0, 35) + '...' : l}
              size="small"
              icon={<LinkIcon />}
              onDelete={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

// =============================================================================
// NOTICE TAB COMPONENTS
// =============================================================================

const CommentItem = ({ comment, announcementId, currentUserId, currentUserRole, onEdit, onDelete, onCommentUpdated }) => {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isSaving, setIsSaving] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const canEdit = comment.user?._id === currentUserId;
  const canDelete = comment.user?._id === currentUserId || currentUserRole === 'admin';

  const handleSave = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      await onEdit(comment._id, editText);
      setIsEditing(false);
    } catch {
      toast.error('Failed to update comment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    try {
      const updated = await announcementService.addCommentReply(announcementId, comment._id, replyText);
      onCommentUpdated(updated);
      setReplyText('');
      setIsReplying(false);
      setShowReplies(true);
    } catch { toast.error('Failed to add reply'); }
    finally { setIsSendingReply(false); }
  };

  const handleEditReply = async (replyId, text) => {
    const updated = await announcementService.editCommentReply(announcementId, comment._id, replyId, text);
    onCommentUpdated(updated);
  };

  const handleDeleteReply = async (replyId) => {
    try {
      const updated = await announcementService.deleteCommentReply(announcementId, comment._id, replyId);
      onCommentUpdated(updated);
    } catch { toast.error('Failed to delete reply'); }
  };

  const replyCount = comment.replies?.length || 0;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Avatar
          src={comment.user?.avatar || ''}
          sx={{
            width: 32, height: 32,
            bgcolor: alpha(theme.palette.secondary.main, 0.8),
            fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
          }}
        >
          {getInitials(comment.user?.name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                autoFocus size="small" fullWidth
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <IconButton size="small" color="primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
              </IconButton>
              <IconButton size="small" onClick={() => { setIsEditing(false); setEditText(comment.text); }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" fontWeight={700}>{comment.user?.name || 'Unknown'}</Typography>
                <ContributionBadge contribution={comment.user?.contribution} />
                <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>{timeAgo(comment.createdAt)}</Typography>
                {comment.editedAt && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>(edited)</Typography>
                )}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
                  {canEdit && (
                    <Tooltip title="Edit comment">
                      <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete comment">
                      <IconButton size="small" onClick={() => onDelete(comment._id)} sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <LinkifiedText text={comment.text} variant="body2" />
              {/* Reply / View Replies buttons */}
              <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{ cursor: 'pointer', fontWeight: 600, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                  onClick={() => setIsReplying((p) => !p)}
                >
                  Reply
                </Typography>
                {replyCount > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ cursor: 'pointer', fontWeight: 600, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    onClick={() => setShowReplies((p) => !p)}
                  >
                    {showReplies ? 'Hide' : 'View'} {replyCount} repl{replyCount !== 1 ? 'ies' : 'y'}
                  </Typography>
                )}
              </Box>
            </>
          )}

          {/* Inline reply input */}
          {isReplying && !isEditing && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 1 }}>
              <TextField
                autoFocus size="small" fullWidth
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <IconButton size="small" color="primary" onClick={handleSendReply} disabled={!replyText.trim() || isSendingReply}>
                {isSendingReply ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
              </IconButton>
              <IconButton size="small" onClick={() => { setIsReplying(false); setReplyText(''); }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          )}

          {/* Nested replies */}
          <Collapse in={showReplies} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
              {comment.replies?.map((reply) => (
                <CommentReplyItem
                  key={reply._id}
                  reply={reply}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onEdit={handleEditReply}
                  onDelete={handleDeleteReply}
                  onReply={(name) => { setReplyText(`@${name} `); setIsReplying(true); setShowReplies(true); }}
                />
              ))}
            </Box>
          </Collapse>
        </Box>
      </Box>
    </Box>
  );
};

/** Nested reply under a comment (Facebook-style) */
const CommentReplyItem = ({ reply, currentUserId, currentUserRole, onEdit, onDelete, onReply }) => {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.text);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = reply.user?._id === currentUserId;
  const canDelete = reply.user?._id === currentUserId || currentUserRole === 'admin';

  const handleSave = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      await onEdit(reply._id, editText);
      setIsEditing(false);
    } catch { toast.error('Failed to update reply'); }
    finally { setIsSaving(false); }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.75 }}>
      <Avatar
        src={reply.user?.avatar || ''}
        sx={{
          width: 24, height: 24,
          bgcolor: alpha(theme.palette.info.main, 0.7),
          fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
        }}
      >
        {getInitials(reply.user?.name)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <TextField
              autoFocus size="small" fullWidth value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            <IconButton size="small" color="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <CircularProgress size={14} /> : <SendIcon sx={{ fontSize: 14 }} />}
            </IconButton>
            <IconButton size="small" onClick={() => { setIsEditing(false); setEditText(reply.text); }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>{reply.user?.name || 'Unknown'}</Typography>
              <ContributionBadge contribution={reply.user?.contribution} />
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>{timeAgo(reply.createdAt)}</Typography>
              {reply.editedAt && <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '0.65rem' }}>(edited)</Typography>}
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
                {canEdit && (
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ p: 0.15, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => onDelete(reply._id)} sx={{ p: 0.15, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
            <LinkifiedText text={reply.text} variant="body2" sx={{ fontSize: '0.8rem' }} />
            <Typography
              variant="caption"
              sx={{ cursor: 'pointer', fontWeight: 600, color: 'text.secondary', '&:hover': { color: 'primary.main' }, mt: 0.25, display: 'inline-block' }}
              onClick={() => onReply && onReply(reply.user?.name || '')}
            >
              Reply
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

const AnnouncementCard = ({
  announcement, currentUserId, currentUserRole, courseTeacherId,
  onUpdate, onDelete, onPin, onCommentUpdated,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(announcement.title);
  const [editContent, setEditContent] = useState(announcement.content);
  const [editFiles, setEditFiles] = useState([]);
  const [editLinks, setEditLinks] = useState(announcement.links || []);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isPinning, setIsPinning] = useState(false);

  const isAuthor = announcement.author?._id === currentUserId;
  const isAdmin = currentUserRole === 'admin';
  const isTeacher = currentUserRole === 'teacher';
  const canManage = isAuthor || isAdmin;
  const canPin = isAdmin || (isTeacher && courseTeacherId === currentUserId);

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setIsSendingComment(true);
    try {
      const updated = await announcementService.addComment(announcement._id, commentText);
      setCommentText('');
      onCommentUpdated(updated);
    } catch { toast.error('Failed to add comment'); }
    finally { setIsSendingComment(false); }
  };

  const handleEditComment = async (commentId, text) => {
    const updated = await announcementService.editComment(announcement._id, commentId, text);
    onCommentUpdated(updated);
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const updated = await announcementService.deleteComment(announcement._id, commentId);
      onCommentUpdated(updated);
    } catch { toast.error('Failed to delete comment'); }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) { toast.error('Title and content are required'); return; }
    setIsSavingEdit(true);
    try {
      const updated = await announcementService.updateAnnouncement(announcement._id, {
        title: editTitle, content: editContent, links: editLinks, files: editFiles,
      });
      onUpdate(updated);
      setIsEditing(false);
      setEditFiles([]);
      toast.success('Notice updated');
    } catch { toast.error('Failed to update notice'); }
    finally { setIsSavingEdit(false); }
  };

  const handlePin = async () => {
    setIsPinning(true);
    try {
      const result = await announcementService.pinAnnouncement(announcement._id);
      onPin(announcement._id, result.isPinned);
      toast.success(result.message);
    } catch { toast.error('Failed to pin notice'); }
    finally { setIsPinning(false); setAnchorEl(null); }
  };

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: announcement.isPinned ? alpha(theme.palette.warning.main, 0.5) : 'divider',
        borderRadius: 3,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.1)}` },
        bgcolor: announcement.isPinned ? alpha(theme.palette.warning.main, 0.03) : 'background.paper',
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Avatar src={announcement.author?.avatar || ''} sx={{ width: 40, height: 40, bgcolor: alpha(theme.palette.primary.main, 0.85), fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
            {getInitials(announcement.author?.name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>{announcement.author?.name || 'Unknown'}</Typography>
              <ContributionBadge contribution={announcement.author?.contribution} />
              <Typography variant="caption" color="text.disabled">{timeAgo(announcement.createdAt)}</Typography>
              {announcement.isPinned && (
                <Chip icon={<PinIcon sx={{ fontSize: '12px !important' }} />} label="Pinned" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {announcement.author?.role === 'teacher' ? 'Teacher' : announcement.author?.role}
            </Typography>
          </Box>
          {(canManage || canPin) && (
            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ flexShrink: 0 }}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            {canPin && (
              <MenuItem onClick={handlePin} disabled={isPinning}>
                <ListItemIcon>{announcement.isPinned ? <UnpinIcon fontSize="small" /> : <PinIcon fontSize="small" />}</ListItemIcon>
                <ListItemText>{announcement.isPinned ? 'Unpin' : 'Pin'}</ListItemText>
              </MenuItem>
            )}
            {canManage && (
              <MenuItem onClick={() => { setIsEditing(true); setAnchorEl(null); }}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            )}
            {canManage && (
              <MenuItem onClick={() => { onDelete(announcement._id); setAnchorEl(null); }} sx={{ color: 'error.main' }}>
                <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </Box>

        {isEditing ? (
          <Box sx={{ mt: 1 }}>
            <TextField fullWidth label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} size="small" sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <TextField fullWidth multiline minRows={3} label="Content" value={editContent} onChange={(e) => setEditContent(e.target.value)} size="small" sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <AttachmentPicker files={editFiles} setFiles={setEditFiles} links={editLinks} setLinks={setEditLinks} />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1.5 }}>
              <Button size="small" onClick={() => { setIsEditing(false); setEditFiles([]); setEditLinks(announcement.links || []); }} startIcon={<CloseIcon />}>Cancel</Button>
              <Button size="small" variant="contained" onClick={handleSaveEdit} disabled={isSavingEdit} startIcon={isSavingEdit ? <CircularProgress size={14} /> : <SendIcon />}>Save</Button>
            </Box>
          </Box>
        ) : (
          <>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>{announcement.title}</Typography>
            <LinkifiedText text={announcement.content} variant="body2" color="text.secondary" />
            <AttachmentList attachments={announcement.attachments} links={announcement.links} />
          </>
        )}
      </CardContent>

      {!isEditing && (
        <CardActions sx={{ px: 2, py: 0.5, justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button size="small" startIcon={<CommentIcon />} onClick={() => setExpanded((p) => !p)} sx={{ color: 'text.secondary', fontWeight: 500, textTransform: 'none' }}>
            {announcement.comments?.length || 0} comment{announcement.comments?.length !== 1 ? 's' : ''}
          </Button>
          <IconButton size="small" onClick={() => setExpanded((p) => !p)}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </CardActions>
      )}

      {!isEditing && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2, pb: 2 }}>
            <Divider sx={{ mb: 1.5 }} />
            {announcement.comments?.length > 0
              ? announcement.comments.map((c) => (
                <CommentItem
                  key={c._id}
                  comment={c}
                  announcementId={announcement._id}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onCommentUpdated={onCommentUpdated}
                />
              ))
              : <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>No comments yet. Be the first!</Typography>
            }
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                fullWidth size="small"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
              />
              <IconButton color="primary" onClick={handleSendComment} disabled={!commentText.trim() || isSendingComment}>
                {isSendingComment ? <CircularProgress size={20} /> : <SendIcon />}
              </IconButton>
            </Box>
          </Box>
        </Collapse>
      )}
    </Card>
  );
};

const NewNoticeForm = ({ courseId, onCreated }) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => { setExpanded(false); setTitle(''); setContent(''); setFiles([]); setLinks([]); };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { toast.error('Title and content are required'); return; }
    setIsSubmitting(true);
    try {
      const created = await announcementService.createAnnouncement({ courseId, title: title.trim(), content: content.trim(), files, links });
      onCreated(created);
      reset();
      toast.success('Notice posted!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post notice');
    } finally { setIsSubmitting(false); }
  };

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: expanded ? 'primary.main' : 'divider', borderRadius: 3, mb: 3, transition: 'border-color 0.2s' }}>
      <CardContent sx={{ pb: expanded ? 1 : '16px !important' }}>
        {!expanded ? (
          <Box onClick={() => setExpanded(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
            <NoticeIcon />
            <Typography variant="body1">Share a notice with your class...</Typography>
          </Box>
        ) : (
          <>
            <TextField autoFocus fullWidth label="Notice Title" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <TextField fullWidth multiline minRows={3} label="Content" placeholder="What do you want to announce?" value={content} onChange={(e) => setContent(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <AttachmentPicker files={files} setFiles={setFiles} links={links} setLinks={setLinks} />
          </>
        )}
      </CardContent>
      {expanded && (
        <CardActions sx={{ px: 2, pb: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={reset}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSubmit} disabled={isSubmitting || !title.trim() || !content.trim()} startIcon={isSubmitting ? <CircularProgress size={14} /> : <NoticeIcon />} sx={{ borderRadius: 2, fontWeight: 600 }}>Post</Button>
        </CardActions>
      )}
    </Card>
  );
};

// =============================================================================
// DISCUSSION TAB COMPONENTS
// =============================================================================

// Nested sub-reply inside a discussion reply (Facebook-style)
const DiscussionSubReplyItem = ({ subReply, currentUserId, currentUserRole, onEdit, onDelete, onReply }) => {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(subReply.content);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = subReply.user?._id === currentUserId;
  const canDelete = subReply.user?._id === currentUserId || currentUserRole === 'admin';

  const handleSave = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      await onEdit(subReply._id, editText);
      setIsEditing(false);
    } catch { toast.error('Failed to update reply'); }
    finally { setIsSaving(false); }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.75 }}>
      <Avatar
        src={subReply.user?.avatar || ''}
        sx={{ width: 24, height: 24, bgcolor: alpha(theme.palette.info.main, 0.7), fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}
      >
        {getInitials(subReply.user?.name)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <TextField
              autoFocus size="small" fullWidth value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            <IconButton size="small" color="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <CircularProgress size={14} /> : <SendIcon sx={{ fontSize: 14 }} />}
            </IconButton>
            <IconButton size="small" onClick={() => { setIsEditing(false); setEditText(subReply.content); }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>{subReply.user?.name || 'Unknown'}</Typography>
              <ContributionBadge contribution={subReply.user?.contribution} />
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>{timeAgo(subReply.createdAt)}</Typography>
              {subReply.editedAt && <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '0.65rem' }}>(edited)</Typography>}
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
                {canEdit && (
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ p: 0.15, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => onDelete(subReply._id)} sx={{ p: 0.15, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
            <LinkifiedText text={subReply.content} variant="body2" sx={{ fontSize: '0.8rem' }} />
            <Typography
              variant="caption"
              sx={{ cursor: 'pointer', fontWeight: 600, color: 'text.secondary', '&:hover': { color: 'primary.main' }, mt: 0.25, display: 'inline-block' }}
              onClick={() => onReply && onReply(subReply.user?.name || '')}
            >
              Reply
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

const ReplyItem = ({
  reply, currentUserId, currentUserRole,
  canAccept, discussionId, courseTeacherId, onReplyUpdated,
}) => {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showSubReplies, setShowSubReplies] = useState(false);

  const isOwner = reply.user?._id === currentUserId;
  const isAdmin = currentUserRole === 'admin';
  const isTeacher = currentUserRole === 'teacher';
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin || (isTeacher && courseTeacherId === currentUserId);
  const subReplies = reply.subReplies || [];

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      const updated = await discussionService.editReply(discussionId, reply._id, editText);
      onReplyUpdated(updated);
      setIsEditing(false);
      toast.success('Reply updated');
    } catch { toast.error('Failed to update reply'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    try {
      const updated = await discussionService.deleteReply(discussionId, reply._id);
      onReplyUpdated(updated);
    } catch { toast.error('Failed to delete reply'); }
  };

  const handleAccept = async () => {
    try {
      const updated = await discussionService.acceptReply(discussionId, reply._id);
      onReplyUpdated(updated);
      toast.success(reply.isAccepted ? 'Acceptance removed' : 'Marked as accepted answer!');
    } catch { toast.error('Failed to update'); }
  };

  const handleSendSubReply = async () => {
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    try {
      const updated = await discussionService.addSubReply(discussionId, reply._id, replyText);
      setReplyText('');
      setShowReplyForm(false);
      setShowSubReplies(true);
      onReplyUpdated(updated);
    } catch { toast.error('Failed to add reply'); }
    finally { setIsSendingReply(false); }
  };

  const handleEditSubReply = async (subReplyId, content) => {
    const updated = await discussionService.editSubReply(discussionId, reply._id, subReplyId, content);
    onReplyUpdated(updated);
  };

  const handleDeleteSubReply = async (subReplyId) => {
    try {
      const updated = await discussionService.deleteSubReply(discussionId, reply._id, subReplyId);
      onReplyUpdated(updated);
    } catch { toast.error('Failed to delete reply'); }
  };

  return (
    <Card
      elevation={0}
      sx={{
        ml: 2, mb: 1.5,
        border: '1px solid',
        borderColor: reply.isAccepted ? alpha(theme.palette.success.main, 0.5) : 'divider',
        borderRadius: 2.5,
        bgcolor: reply.isAccepted ? alpha(theme.palette.success.main, 0.03) : 'background.paper',
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Avatar src={reply.user?.avatar || ''} sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.secondary.main, 0.75), fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
              {getInitials(reply.user?.name)}
            </Avatar>
            <VoteControls
              votes={reply.votes || []}
              currentUserId={currentUserId}
              onVote={async (val) => {
                try {
                  const updated = await discussionService.voteReply(discussionId, reply._id, val);
                  onReplyUpdated(updated);
                } catch { toast.error('Failed to vote'); }
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography variant="caption" fontWeight={700}>{reply.user?.name || 'Unknown'}</Typography>
              <ContributionBadge contribution={reply.user?.contribution} />
              {reply.user?.role === 'teacher' && <Chip label="Teacher" size="small" color="primary" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />}
              <Typography variant="caption" color="text.disabled">{timeAgo(reply.createdAt)}</Typography>
              {reply.editedAt && <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>(edited)</Typography>}
              {reply.isAccepted && (
                <Chip icon={<AcceptIcon sx={{ fontSize: '12px !important' }} />} label="Accepted" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
              )}
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
                {canAccept && (
                  <Tooltip title={reply.isAccepted ? 'Remove acceptance' : 'Mark as accepted answer'}>
                    <IconButton size="small" onClick={handleAccept} sx={{ p: 0.25, color: reply.isAccepted ? 'success.main' : 'text.disabled', '&:hover': { color: 'success.main' } }}>
                      <AcceptIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip title="Edit reply">
                    <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title="Delete reply">
                    <IconButton size="small" onClick={handleDelete} sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {isEditing ? (
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', mt: 0.5 }}>
                <TextField autoFocus fullWidth size="small" multiline minRows={2} value={editText} onChange={(e) => setEditText(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <IconButton size="small" color="primary" onClick={handleSaveEdit} disabled={isSaving}>
                    {isSaving ? <CircularProgress size={14} /> : <SendIcon fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={() => { setIsEditing(false); setEditText(reply.content); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ) : (
              <>
                <LinkifiedText text={reply.content} variant="body2" />
                <AttachmentList attachments={reply.attachments} links={reply.links} />
                {/* Action links: Reply + view sub-replies toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => { setShowReplyForm((p) => !p); setShowSubReplies(true); }}
                  >
                    Reply
                  </Typography>
                  {subReplies.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }}
                      onClick={() => setShowSubReplies((p) => !p)}
                    >
                      {showSubReplies ? 'Hide' : `View ${subReplies.length}`} {subReplies.length === 1 ? 'reply' : 'replies'}
                    </Typography>
                  )}
                </Box>
              </>
            )}

            {/* Inline reply form */}
            {showReplyForm && !isEditing && (
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'primary.light' }}>
                <TextField
                  autoFocus fullWidth size="small"
                  placeholder={`Reply to ${reply.user?.name || 'this reply'}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendSubReply(); } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
                <IconButton size="small" color="primary" onClick={handleSendSubReply} disabled={!replyText.trim() || isSendingReply}>
                  {isSendingReply ? <CircularProgress size={16} /> : <SendIcon sx={{ fontSize: 16 }} />}
                </IconButton>
                <IconButton size="small" onClick={() => { setShowReplyForm(false); setReplyText(''); }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            )}

            {/* Nested sub-replies */}
            {showSubReplies && subReplies.length > 0 && (
              <Box sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
                {subReplies.map((sr) => (
                  <DiscussionSubReplyItem
                    key={sr._id}
                    subReply={sr}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onEdit={handleEditSubReply}
                    onDelete={handleDeleteSubReply}
                    onReply={(name) => { setReplyText(`@${name} `); setShowReplyForm(true); setShowSubReplies(true); }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DiscussionListCard = ({ discussion, onClick }) => {
  const theme = useTheme();
  const isSolved = discussion.status === 'solved';

  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        border: '1px solid',
        borderColor: isSolved ? alpha(theme.palette.success.main, 0.4) : 'divider',
        borderRadius: 3,
        transition: 'all 0.2s',
        '&:hover': { borderColor: 'primary.main', boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.1)}` },
        bgcolor: isSolved ? alpha(theme.palette.success.main, 0.02) : 'background.paper',
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 0.5, minWidth: 28 }}>
            {isSolved
              ? <SolvedIcon sx={{ color: 'success.main', fontSize: 22 }} />
              : <QuestionIcon sx={{ color: 'warning.main', fontSize: 22 }} />
            }
            {discussion.votes && (
              <Typography variant="caption" fontWeight={700} sx={{ color: (discussion.votes.reduce((s, v) => s + v.value, 0)) > 0 ? 'success.main' : (discussion.votes.reduce((s, v) => s + v.value, 0)) < 0 ? 'error.main' : 'text.disabled', mt: 0.25 }}>
                {discussion.votes.reduce((s, v) => s + v.value, 0)}
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ maxWidth: 400 }}>{discussion.title}</Typography>
              <Chip
                label={isSolved ? 'Solved' : 'Open'}
                size="small"
                color={isSolved ? 'success' : 'warning'}
                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 0.5 }}>
              {discussion.content}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.disabled">{discussion.author?.name}</Typography>
              <ContributionBadge contribution={discussion.author?.contribution} />
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption" color="text.disabled">{timeAgo(discussion.createdAt)}</Typography>
              <Chip
                icon={<ReplyIcon sx={{ fontSize: '11px !important' }} />}
                label={`${discussion.replyCount || 0} reply${discussion.replyCount !== 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
              {discussion.tags?.map((t, i) => (
                <Chip key={i} label={t} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
              ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DiscussionDetail = ({
  discussion: initialDiscussion, currentUserId, currentUserRole,
  courseTeacherId, onBack, onDiscussionUpdated, onDiscussionDeleted,
}) => {
  const theme = useTheme();
  const [discussion, setDiscussion] = useState(initialDiscussion);
  const [replyContent, setReplyContent] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [replyLinks, setReplyLinks] = useState([]);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isEditingDiscussion, setIsEditingDiscussion] = useState(false);
  const [editTitle, setEditTitle] = useState(initialDiscussion.title);
  const [editContent, setEditContent] = useState(initialDiscussion.content);
  const [editFiles, setEditFiles] = useState([]);
  const [editLinks, setEditLinks] = useState(initialDiscussion.links || []);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = discussion.author?._id === currentUserId;
  const isAdmin = currentUserRole === 'admin';
  const isTeacher = currentUserRole === 'teacher';
  const canManage = isAuthor || isAdmin || (isTeacher && courseTeacherId === currentUserId);
  const canAccept = isAuthor || isAdmin || (isTeacher && courseTeacherId === currentUserId);
  const canToggleStatus = canAccept;

  useEffect(() => { setDiscussion(initialDiscussion); }, [initialDiscussion]);

  const updateLocal = (updated) => {
    setDiscussion(updated);
    onDiscussionUpdated(updated);
  };

  const handleSendReply = async () => {
    if (!replyContent.trim()) return;
    setIsSendingReply(true);
    try {
      const updated = await discussionService.addReply(discussion._id, { content: replyContent, files: replyFiles, links: replyLinks });
      updateLocal(updated);
      setReplyContent('');
      setReplyFiles([]);
      setReplyLinks([]);
      toast.success('Reply posted');
    } catch { toast.error('Failed to post reply'); }
    finally { setIsSendingReply(false); }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) { toast.error('Title and content required'); return; }
    setIsSavingEdit(true);
    try {
      const updated = await discussionService.updateDiscussion(discussion._id, { title: editTitle, content: editContent, links: editLinks, files: editFiles });
      updateLocal(updated);
      setIsEditingDiscussion(false);
      setEditFiles([]);
      toast.success('Discussion updated');
    } catch { toast.error('Failed to update'); }
    finally { setIsSavingEdit(false); }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await discussionService.deleteDiscussion(discussion._id);
      onDiscussionDeleted(discussion._id);
      toast.success('Discussion deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setIsDeleting(false); setDeleteDialogOpen(false); }
  };

  const handleToggleStatus = async () => {
    try {
      const result = await discussionService.toggleStatus(discussion._id);
      const updatedStatus = { ...discussion, status: result.status };
      setDiscussion(updatedStatus);
      onDiscussionUpdated(updatedStatus);
      toast.success(result.message);
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={onBack} size="small" sx={{ mb: 2, color: 'text.secondary', textTransform: 'none' }}>
        All Discussions
      </Button>

      <Card
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: discussion.status === 'solved' ? alpha(theme.palette.success.main, 0.4) : 'divider',
          borderRadius: 3, mb: 2,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Avatar src={discussion.author?.avatar || ''} sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.85), fontWeight: 700, flexShrink: 0 }}>
                {getInitials(discussion.author?.name)}
              </Avatar>
              <VoteControls
                votes={discussion.votes || []}
                currentUserId={currentUserId}
                onVote={async (val) => {
                  try {
                    const updated = await discussionService.voteDiscussion(discussion._id, val);
                    updateLocal(updated);
                  } catch { toast.error('Failed to vote'); }
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" fontWeight={700}>{discussion.author?.name}</Typography>
                <ContributionBadge contribution={discussion.author?.contribution} />
                <Typography variant="caption" color="text.disabled">{timeAgo(discussion.createdAt)}</Typography>
                <Chip label={discussion.status === 'solved' ? 'Solved' : 'Open'} size="small" color={discussion.status === 'solved' ? 'success' : 'warning'} sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
                {discussion.tags?.map((t, i) => <Chip key={i} label={t} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />)}
              </Box>
            </Box>
            {(canManage || canAccept) && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {canToggleStatus && (
                  <Tooltip title={discussion.status === 'solved' ? 'Reopen discussion' : 'Mark as solved'}>
                    <IconButton size="small" onClick={handleToggleStatus} sx={{ color: discussion.status === 'solved' ? 'success.main' : 'text.disabled' }}>
                      {discussion.status === 'solved' ? <SolvedIcon fontSize="small" /> : <OpenIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
                {(isAuthor || isAdmin) && (
                  <Tooltip title="Edit discussion">
                    <IconButton size="small" onClick={() => setIsEditingDiscussion(true)} sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {canManage && (
                  <Tooltip title="Delete discussion">
                    <IconButton size="small" onClick={() => setDeleteDialogOpen(true)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>

          {isEditingDiscussion ? (
            <Box>
              <TextField autoFocus fullWidth label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} size="small" sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <TextField fullWidth multiline minRows={3} label="Content" value={editContent} onChange={(e) => setEditContent(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <AttachmentPicker files={editFiles} setFiles={setEditFiles} links={editLinks} setLinks={setEditLinks} />
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1.5 }}>
                <Button size="small" onClick={() => { setIsEditingDiscussion(false); setEditFiles([]); setEditLinks(discussion.links || []); }}>Cancel</Button>
                <Button size="small" variant="contained" onClick={handleSaveEdit} disabled={isSavingEdit} startIcon={isSavingEdit ? <CircularProgress size={14} /> : <SendIcon />}>Save</Button>
              </Box>
            </Box>
          ) : (
            <>
              <Typography variant="h6" fontWeight={700} gutterBottom>{discussion.title}</Typography>
              <LinkifiedText text={discussion.content} variant="body1" color="text.secondary" />
              <AttachmentList attachments={discussion.attachments} links={discussion.links} />
            </>
          )}
        </CardContent>
      </Card>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        {discussion.replies?.length || 0} Repl{discussion.replies?.length !== 1 ? 'ies' : 'y'}
      </Typography>

      {discussion.replies?.length > 0
        ? discussion.replies.map((reply) => (
          <ReplyItem
            key={reply._id}
            reply={reply}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            canAccept={canAccept}
            discussionId={discussion._id}
            courseTeacherId={courseTeacherId}
            onReplyUpdated={(updated) => updateLocal(updated)}
          />
        ))
        : (
          <Paper elevation={0} sx={{ p: 3, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography variant="body2" color="text.disabled">No replies yet. Be the first to help!</Typography>
          </Paper>
        )
      }

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Post a Reply</Typography>
          <TextField
            fullWidth multiline minRows={3}
            placeholder="Write your reply or solution here..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <AttachmentPicker files={replyFiles} setFiles={setReplyFiles} links={replyLinks} setLinks={setReplyLinks} />
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSendReply}
            disabled={!replyContent.trim() || isSendingReply}
            startIcon={isSendingReply ? <CircularProgress size={14} /> : <ReplyIcon />}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Reply
          </Button>
        </CardActions>
      </Card>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Discussion</DialogTitle>
        <DialogContent><DialogContentText>This will permanently delete the discussion and all its replies.</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={isDeleting} startIcon={isDeleting ? <CircularProgress size={14} /> : <DeleteIcon />}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const NewDiscussionForm = ({ courseId, onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { toast.error('Title and content are required'); return; }
    setIsSubmitting(true);
    try {
      const created = await discussionService.createDiscussion({ courseId, title: title.trim(), content: content.trim(), files, links, tags });
      onCreated(created);
      toast.success('Discussion posted!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to post discussion');
    } finally { setIsSubmitting(false); }
  };

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 3, mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>New Discussion</Typography>
        <TextField autoFocus fullWidth label="Title / Problem Summary" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <TextField fullWidth multiline minRows={4} label="Describe the problem in detail" value={content} onChange={(e) => setContent(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <AttachmentPicker files={files} setFiles={setFiles} links={links} setLinks={setLinks} />
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Add a tag (e.g. homework)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
            sx={{ flex: 1, minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Button size="small" onClick={handleAddTag} variant="outlined" sx={{ borderRadius: 2 }}>Add Tag</Button>
          {tags.map((t, i) => (
            <Chip key={i} label={t} size="small" onDelete={() => setTags((prev) => prev.filter((_, idx) => idx !== i))} />
          ))}
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'flex-end', gap: 1 }}>
        <Button size="small" onClick={onCancel}>Cancel</Button>
        <Button size="small" variant="contained" onClick={handleSubmit} disabled={isSubmitting || !title.trim() || !content.trim()} startIcon={isSubmitting ? <CircularProgress size={14} /> : <DiscussionIcon />} sx={{ borderRadius: 2, fontWeight: 600 }}>Post Discussion</Button>
      </CardActions>
    </Card>
  );
};

// =============================================================================
// NOTICE TAB
// =============================================================================

const NoticeTab = ({ courseId, course, currentUserId, currentUserRole }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, announcementId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const isTeacher = currentUserRole === 'teacher';
  const isAdmin = currentUserRole === 'admin';
  const canPost = isTeacher || isAdmin;
  const courseTeacherId = course?.createdBy?._id;

  const fetchNotices = useCallback(async (pageNum = 1, append = false) => {
    try {
      const data = await announcementService.getAnnouncementsByCourse(courseId, { page: pageNum, limit: 10 });
      setAnnouncements((prev) => append ? [...prev, ...data.announcements] : data.announcements);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load notices');
    } finally { setIsLoading(false); setIsLoadingMore(false); }
  }, [courseId]);

  useEffect(() => { fetchNotices(1); }, [fetchNotices]);

  const handleLoadMore = async () => {
    const next = page + 1;
    setPage(next);
    setIsLoadingMore(true);
    await fetchNotices(next, true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await announcementService.deleteAnnouncement(deleteDialog.announcementId);
      setAnnouncements((prev) => prev.filter((a) => a._id !== deleteDialog.announcementId));
      toast.success('Notice deleted');
    } catch { toast.error('Failed to delete notice'); }
    finally { setIsDeleting(false); setDeleteDialog({ open: false, announcementId: null }); }
  };

  const handlePinToggle = (id, isPinned) => {
    setAnnouncements((prev) => {
      const updated = prev.map((a) => a._id === id ? { ...a, isPinned } : a);
      return [...updated].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    });
  };

  if (isLoading) return <LoadingSpinner message="Loading notices..." />;

  return (
    <Box>
      {canPost && (
        <NewNoticeForm courseId={courseId} onCreated={(n) => setAnnouncements((prev) => [n, ...prev])} />
      )}

      {announcements.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <NoticeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No notices yet</Typography>
          <Typography variant="body2" color="text.disabled">
            {canPost ? 'Post the first notice to get started!' : "Your teacher hasn't posted any notices yet."}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {announcements.map((a) => (
            <Fade in key={a._id}>
              <div>
                <AnnouncementCard
                  announcement={a}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  courseTeacherId={courseTeacherId}
                  onUpdate={(updated) => setAnnouncements((prev) => prev.map((x) => x._id === updated._id ? updated : x))}
                  onDelete={(id) => setDeleteDialog({ open: true, announcementId: id })}
                  onPin={handlePinToggle}
                  onCommentUpdated={(updated) => setAnnouncements((prev) => prev.map((x) => x._id === updated._id ? updated : x))}
                />
              </div>
            </Fade>
          ))}

          {page < pagination.pages && (
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Button variant="outlined" onClick={handleLoadMore} disabled={isLoadingMore} startIcon={isLoadingMore ? <CircularProgress size={16} /> : <AddIcon />} sx={{ borderRadius: 2, fontWeight: 600, px: 4 }}>
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, announcementId: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Notice</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this notice? All comments will also be deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, announcementId: null })}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={isDeleting} startIcon={isDeleting ? <CircularProgress size={14} /> : <DeleteIcon />}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// =============================================================================
// DISCUSSION TAB
// =============================================================================

const DiscussionTab = ({ courseId, course, currentUserId, currentUserRole }) => {
  const [discussions, setDiscussions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedDiscussion, setSelectedDiscussion] = useState(null);

  const courseTeacherId = course?.createdBy?._id;

  const fetchDiscussions = useCallback(async (pageNum = 1, append = false, status = statusFilter) => {
    try {
      const data = await discussionService.getDiscussionsByCourse(courseId, { page: pageNum, limit: 10, status });
      setDiscussions((prev) => append ? [...prev, ...data.discussions] : data.discussions);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load discussions');
    } finally { setIsLoading(false); setIsLoadingMore(false); }
  }, [courseId, statusFilter]);

  useEffect(() => { fetchDiscussions(1); }, [fetchDiscussions]);

  const handleFilterChange = (status) => {
    setStatusFilter(status);
    setIsLoading(true);
    setPage(1);
    fetchDiscussions(1, false, status);
  };

  const handleLoadMore = async () => {
    const next = page + 1;
    setPage(next);
    setIsLoadingMore(true);
    await fetchDiscussions(next, true);
  };

  const handleDiscussionClick = async (d) => {
    try {
      const full = await discussionService.getDiscussion(d._id);
      setSelectedDiscussion(full);
    } catch { toast.error('Failed to load discussion'); }
  };

  const handleDiscussionUpdated = (updated) => {
    setDiscussions((prev) => prev.map((d) =>
      d._id === updated._id ? { ...d, ...updated, replyCount: updated.replies?.length ?? d.replyCount } : d
    ));
    if (selectedDiscussion?._id === updated._id) setSelectedDiscussion(updated);
  };

  const handleDiscussionDeleted = (id) => {
    setDiscussions((prev) => prev.filter((d) => d._id !== id));
    setSelectedDiscussion(null);
  };

  const handleCreated = (created) => {
    setDiscussions((prev) => [{ ...created, replyCount: 0 }, ...prev]);
    setShowNewForm(false);
    handleDiscussionClick(created);
  };

  if (isLoading) return <LoadingSpinner message="Loading discussions..." />;

  if (selectedDiscussion) {
    return (
      <DiscussionDetail
        discussion={selectedDiscussion}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        courseTeacherId={courseTeacherId}
        onBack={() => setSelectedDiscussion(null)}
        onDiscussionUpdated={handleDiscussionUpdated}
        onDiscussionDeleted={handleDiscussionDeleted}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowNewForm((p) => !p)}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          {showNewForm ? 'Cancel' : 'New Discussion'}
        </Button>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {[['', 'All'], ['open', 'Open'], ['solved', 'Solved']].map(([val, label]) => (
            <Chip
              key={val}
              label={label}
              size="small"
              onClick={() => handleFilterChange(val)}
              color={statusFilter === val ? 'primary' : 'default'}
              variant={statusFilter === val ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer', fontWeight: statusFilter === val ? 700 : 400 }}
            />
          ))}
        </Box>
      </Box>

      {showNewForm && (
        <NewDiscussionForm
          courseId={courseId}
          onCreated={handleCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {discussions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <DiscussionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No discussions yet</Typography>
          <Typography variant="body2" color="text.disabled">
            Start a discussion to ask questions or share problems with your class.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {discussions.map((d) => (
            <DiscussionListCard key={d._id} discussion={d} onClick={() => handleDiscussionClick(d)} />
          ))}
          {page < pagination.pages && (
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Button variant="outlined" onClick={handleLoadMore} disabled={isLoadingMore} startIcon={isLoadingMore ? <CircularProgress size={16} /> : <AddIcon />} sx={{ borderRadius: 2, fontWeight: 600, px: 4 }}>
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// =============================================================================
// MAIN PAGE
// =============================================================================

const CourseStream = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();

  const [course, setCourse] = useState(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const data = await announcementService.getAnnouncementsByCourse(courseId, { page: 1, limit: 1 });
        if (data.course) setCourse(data.course);
      } catch (error) {
        if (error.response?.status === 403) {
          toast.error('Access denied');
          navigate(-1);
        }
      } finally { setIsLoadingCourse(false); }
    };
    loadCourse();
  }, [courseId, navigate]);

  if (isLoadingCourse) return <LoadingSpinner message="Loading course..." />;

  return (
    <Box className="fade-in" sx={{ maxWidth: 820, mx: 'auto', pb: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} size="small" sx={{ mb: 2, color: 'text.secondary', textTransform: 'none' }}>
        Back
      </Button>

      {course && (
        <Paper
          elevation={0}
          sx={{
            p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.secondary.main, 0.04)})`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SchoolIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Chip label={course.courseNo} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                {course.department && <Chip label={course.department} size="small" variant="outlined" />}
                {course.semester && <Chip label={`Sem ${course.semester}`} size="small" variant="outlined" />}
              </Box>
              <Typography variant="h5" fontWeight={700} gutterBottom>{course.courseTitle}</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {course.createdBy && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">{course.createdBy.name}</Typography>
                  </Box>
                )}
                {course.enrollmentCount !== undefined && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PeopleIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {course.enrollmentCount} student{course.enrollmentCount !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, display: 'flex', alignItems: 'center' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ flex: 1, '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', minHeight: 48 } }}
        >
          <Tab icon={<NoticeIcon />} iconPosition="start" label="Notice" />
          <Tab icon={<DiscussionIcon />} iconPosition="start" label="Discussion" />
        </Tabs>
        <Button
          startIcon={<AssignmentNavIcon />}
          variant="outlined"
          size="small"
          sx={{ ml: 1, textTransform: 'none', whiteSpace: 'nowrap' }}
          onClick={() => navigate(`/${user?.role}/courses/${courseId}/assignments`)}
        >
          Assignments
        </Button>
        <Button
          startIcon={<QuizNavIcon />}
          variant="outlined"
          size="small"
          sx={{ ml: 1, textTransform: 'none', whiteSpace: 'nowrap' }}
          onClick={() => navigate(`/${user?.role}/courses/${courseId}/quizzes`)}
        >
          Quizzes
        </Button>
      </Box>

      {activeTab === 0 && (
        <NoticeTab
          courseId={courseId}
          course={course}
          currentUserId={user?._id}
          currentUserRole={user?.role}
        />
      )}
      {activeTab === 1 && (
        <DiscussionTab
          courseId={courseId}
          course={course}
          currentUserId={user?._id}
          currentUserRole={user?.role}
        />
      )}
    </Box>
  );
};

export default CourseStream;
