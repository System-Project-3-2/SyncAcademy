/**
 * AI Tutor Chat Page
 * RAG-powered chatbot that helps students learn from uploaded materials
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Avatar,
  Chip,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  useMediaQuery,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Stack,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Add as NewChatIcon,
  Delete as DeleteIcon,
  DeleteSweep as ClearAllIcon,
  History as HistoryIcon,
  MenuOpen as SidebarIcon,
  FolderOpen as SourceIcon,
  Circle as StatusIcon,
  School as TutorIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  AutoAwesome as SuggestionIcon,
  Insights as InsightsIcon,
  Psychology as WeaknessIcon,
  Launch as OpenIcon,
  ThumbUp as HelpfulIcon,
  VisibilityOff as DismissIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import chatService from '../../services/chatService';
import enrollmentService from '../../services/enrollmentService';
import materialService from '../../services/materialService';
import ktService from '../../services/ktService';

// ── Markdown-lite renderer ───────────────────────────────
// Renders basic markdown: **bold**, `code`, ```blocks```, bullet points
const MarkdownText = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeKey = 0;

  const processInline = (line, key) => {
    // Bold
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={i}
                style={{
                  background: 'rgba(0,0,0,0.08)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: '0.9em',
                  fontFamily: 'monospace',
                }}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        })}
      </span>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <Paper
            key={`code-${codeKey++}`}
            sx={{
              p: 1.5,
              my: 1,
              bgcolor: 'grey.900',
              color: 'grey.100',
              borderRadius: 2,
              fontFamily: 'monospace',
              fontSize: '0.85em',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {codeLines.join('\n')}
          </Paper>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Bullet points
    if (line.match(/^[\s]*[-•*]\s/)) {
      elements.push(
        <Box key={i} sx={{ display: 'flex', gap: 1, ml: 1, my: 0.25 }}>
          <Typography variant="body2" sx={{ minWidth: 12 }}>•</Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {processInline(line.replace(/^[\s]*[-•*]\s/, ''), i)}
          </Typography>
        </Box>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^[\s]*\d+[.)]\s/)) {
      const match = line.match(/^[\s]*(\d+[.)])\s(.*)/);
      elements.push(
        <Box key={i} sx={{ display: 'flex', gap: 1, ml: 1, my: 0.25 }}>
          <Typography variant="body2" sx={{ minWidth: 20, fontWeight: 600 }}>{match[1]}</Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {processInline(match[2], i)}
          </Typography>
        </Box>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <Typography key={i} variant="subtitle2" fontWeight={700} sx={{ mt: 1.5, mb: 0.5 }}>
          {line.slice(4)}
        </Typography>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <Typography key={i} variant="subtitle1" fontWeight={700} sx={{ mt: 1.5, mb: 0.5 }}>
          {line.slice(3)}
        </Typography>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<Box key={i} sx={{ height: 8 }} />);
      continue;
    }

    // Regular text
    elements.push(
      <Typography key={i} variant="body2" sx={{ lineHeight: 1.7 }}>
        {processInline(line, i)}
      </Typography>
    );
  }

  return <>{elements}</>;
};

// ── Message Bubble ───────────────────────────────────────
const MessageBubble = ({ message, theme }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        mb: 2,
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
      }}
    >
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: isUser ? 'primary.main' : alpha(theme.palette.success.main, 0.15),
          color: isUser ? 'white' : 'success.main',
          mt: 0.5,
        }}
      >
        {isUser ? <UserIcon fontSize="small" /> : <BotIcon fontSize="small" />}
      </Avatar>

      <Box sx={{ maxWidth: '75%', minWidth: 0 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: isUser
              ? 'primary.main'
              : alpha(theme.palette.background.paper, 0.8),
            color: isUser ? 'white' : 'text.primary',
            border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
            position: 'relative',
          }}
        >
          {isUser ? (
            <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography>
          ) : (
            <MarkdownText text={message.content} />
          )}

          {/* Copy button for assistant messages */}
          {!isUser && (
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  opacity: 0.4,
                  '&:hover': { opacity: 1 },
                }}
              >
                {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          )}
        </Paper>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
            <SourceIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
            {message.sources.map((src, i) => (
              <Chip
                key={i}
                label={`${src.courseNo} - ${src.courseTitle}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            ))}
          </Box>
        )}

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 0.5, display: 'block', textAlign: isUser ? 'right' : 'left' }}
        >
          {message.timestamp
            ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </Typography>
      </Box>
    </Box>
  );
};

// ── Typing Indicator ─────────────────────────────────────
const TypingIndicator = ({ theme }) => (
  <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-start' }}>
    <Avatar
      sx={{
        width: 36,
        height: 36,
        bgcolor: alpha(theme.palette.success.main, 0.15),
        color: 'success.main',
      }}
    >
      <BotIcon fontSize="small" />
    </Avatar>
    <Paper
      elevation={0}
      sx={{
        p: 2,
        px: 3,
        borderRadius: 3,
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        border: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        gap: 0.75,
        alignItems: 'center',
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'text.disabled',
            animation: 'pulse 1.4s infinite ease-in-out',
            animationDelay: `${i * 0.2}s`,
            '@keyframes pulse': {
              '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
              '40%': { transform: 'scale(1)', opacity: 1 },
            },
          }}
        />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
        Thinking...
      </Typography>
    </Paper>
  </Box>
);

// ── Welcome Screen ───────────────────────────────────────
const WelcomeScreen = ({ theme, onSuggestion }) => {
  const suggestions = [
    "What topics are covered in the uploaded materials?",
    "How does the Student-Aid platform work?",
    "Explain the key concepts from the latest notes",
    "Help me understand semantic search",
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Avatar
        sx={{
          width: 72,
          height: 72,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main',
          mb: 2,
        }}
      >
        <TutorIcon sx={{ fontSize: 40 }} />
      </Avatar>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Student Aid Tutor
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
        I'm your AI-powered learning assistant. Ask me anything about your course
        materials, or let me help you understand how this platform works!
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 600 }}>
        {suggestions.map((s, i) => (
          <Chip
            key={i}
            label={s}
            variant="outlined"
            clickable
            onClick={() => onSuggestion(s)}
            sx={{
              borderRadius: 3,
              py: 2.5,
              px: 0.5,
              fontSize: '0.85rem',
              borderColor: alpha(theme.palette.primary.main, 0.3),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderColor: 'primary.main',
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

const AdaptiveTutorPanel = ({
  theme,
  courses,
  selectedCourseId,
  onCourseChange,
  insights,
  explainability,
  loading,
  explainabilityLoading,
  error,
  dismissedIds,
  helpfulIds,
  onOpenMaterial,
  onMarkHelpful,
  onDismiss,
  onQuickCheck,
}) => {
  const weakTopics = insights?.weakTopics?.items || [];
  const recommendations = (insights?.recommendations?.items || []).filter(
    (item) => !dismissedIds.has(String(item.materialId))
  );
  const globalDrivers = explainability?.recommendationExplainability?.globalDrivers || [];
  const increasedActions = explainability?.topContributingActions?.increasedMastery || [];
  const decreasedActions = explainability?.topContributingActions?.decreasedMastery || [];

  const weakColor = (score) => {
    if (score >= 0.75) return 'error';
    if (score >= 0.55) return 'warning';
    return 'default';
  };

  return (
    <Card
      elevation={0}
      sx={{
        mb: 2,
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.08)} 100%)`,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 220 }}>
            <InsightsIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={800}>
              Adaptive Tutor Recommendations
            </Typography>
          </Stack>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 320 } }}>
            <InputLabel id="adaptive-course-select">Course</InputLabel>
            <Select
              labelId="adaptive-course-select"
              value={selectedCourseId || ''}
              label="Course"
              onChange={(e) => onCourseChange(e.target.value)}
            >
              {courses.map((course) => (
                <MenuItem key={course._id} value={course._id}>
                  {course.courseNo} - {course.courseTitle}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      <CardContent sx={{ p: 2 }}>
        {insights?.masterySummary && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              label={`Mastery ${(insights.masterySummary.overallMastery * 100).toFixed(0)}%`}
              color="primary"
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Risk Topics ${insights.masterySummary.highRiskTopics}`}
              color="warning"
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Confidence ${(insights.masterySummary.averageConfidence * 100).toFixed(0)}%`}
              color="info"
              variant="outlined"
            />
          </Stack>
        )}

        {loading && (
          <Stack spacing={1} sx={{ mb: 1.5 }}>
            <LinearProgress sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={32} />
            <Skeleton variant="rounded" height={32} />
          </Stack>
        )}

        {error && <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert>}
        {!loading && !error && courses.length === 0 && (
          <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
            Enroll in a course to unlock weak-topic insights and personalized recommendations.
          </Alert>
        )}

        {!loading && !error && selectedCourseId && (
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}>
                Weak Topics To Focus On
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {weakTopics.length === 0 && (
                  <Chip size="small" label="No weak topics yet" variant="outlined" />
                )}
                {weakTopics.slice(0, 6).map((topic) => (
                  <Chip
                    key={topic.topicId}
                    size="small"
                    icon={<WeaknessIcon sx={{ fontSize: 14 }} />}
                    label={`${topic.topicId} • ${(topic.weaknessScore * 100).toFixed(0)}% weak`}
                    color={weakColor(Number(topic.weaknessScore || 0))}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}>
                Recommended Materials
              </Typography>
              <Stack spacing={1}>
                {recommendations.length === 0 && (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>No recommendations yet for this course.</Alert>
                )}
                {recommendations.slice(0, 3).map((rec, index) => (
                  <Paper
                    key={`${rec.topicId}-${rec.materialId}`}
                    variant="outlined"
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                          <Chip size="small" label={`#${index + 1}`} color="primary" variant="filled" sx={{ height: 20, fontSize: '0.7rem' }} />
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {rec.title}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Topic: {rec.topicId} • Match: {(Number(rec.score || 0) * 100).toFixed(0)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rec.reason}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Open material">
                          <IconButton size="small" onClick={() => onOpenMaterial(rec)}>
                            <OpenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark helpful">
                          <IconButton
                            size="small"
                            color={helpfulIds.has(String(rec.materialId)) ? 'success' : 'default'}
                            onClick={() => onMarkHelpful(rec)}
                          >
                            <HelpfulIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dismiss">
                          <IconButton size="small" onClick={() => onDismiss(rec)}>
                            <DismissIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Quick check">
                          <IconButton size="small" color="primary" onClick={() => onQuickCheck(rec)}>
                            <SuggestionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}>
                Recommendation Insights
              </Typography>
              {explainabilityLoading ? (
                <LinearProgress sx={{ borderRadius: 2 }} />
              ) : (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {globalDrivers.length === 0 && (
                      <Chip size="small" variant="outlined" label="Explainability appears after more interactions" />
                    )}
                    {globalDrivers.slice(0, 3).map((driver) => (
                      <Chip
                        key={driver.driver}
                        size="small"
                        variant="outlined"
                        label={`${driver.driver.replace(/_/g, ' ')} • ${(Number(driver.meanContribution || 0) * 100).toFixed(1)}%`}
                      />
                    ))}
                  </Stack>
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                    <Typography variant="caption" color="success.dark" sx={{ display: 'block' }}>
                      Improved actions: {increasedActions.slice(0, 2).map((a) => a.action).join(' | ') || 'N/A'}
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
                    <Typography variant="caption" color="warning.dark" sx={{ display: 'block' }}>
                      Declining actions: {decreasedActions.slice(0, 2).map((a) => a.action).join(' | ') || 'N/A'}
                    </Typography>
                  </Paper>
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Chat Component ──────────────────────────────────
const AITutor = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth(); // ensure user is authenticated
  const navigate = useNavigate();

  // State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [aiHealthy, setAiHealthy] = useState(null); // null=checking, true/false
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [insights, setInsights] = useState(null);
  const [explainability, setExplainability] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [explainabilityLoading, setExplainabilityLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState(new Set());
  const [helpfulRecommendationIds, setHelpfulRecommendationIds] = useState(new Set());

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const healthFailureCountRef = useRef(0);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessionsData = await chatService.getSessions();
        setSessions(sessionsData);
      } catch {
        // silently ignore – user just has no sessions yet
      }
    };
    loadSessions();
  }, []);

  // Load student courses for adaptive tutor panel
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const enrolledCourses = await enrollmentService.getMyEnrolledCourses();
        const normalizedCourses = Array.isArray(enrolledCourses)
          ? enrolledCourses
          : enrolledCourses?.courses || [];

        setCourses(normalizedCourses);
        if (normalizedCourses.length > 0) {
          setSelectedCourseId((prev) => prev || normalizedCourses[0]._id);
        }
      } catch {
        setCourses([]);
      }
    };

    loadCourses();
  }, []);

  // Pull adaptive mastery/recommendation insights for selected course
  useEffect(() => {
    const loadInsights = async () => {
      if (!selectedCourseId) {
        setInsights(null);
        setInsightsError('');
        return;
      }

      setInsightsLoading(true);
      setInsightsError('');

      try {
        const data = await ktService.getInsights(selectedCourseId, {
          weakLimit: 5,
          topN: 3,
          perTopic: 3,
          page: 1,
          limit: 3,
        });
        setInsights(data);
      } catch (err) {
        setInsights(null);
        setInsightsError(err?.response?.data?.message || 'Unable to load adaptive insights right now.');
      } finally {
        setInsightsLoading(false);
      }
    };

    loadInsights();
  }, [selectedCourseId]);

  // Pull explainability payload for recommendation transparency.
  useEffect(() => {
    const loadExplainability = async () => {
      if (!selectedCourseId) {
        setExplainability(null);
        return;
      }

      setExplainabilityLoading(true);
      try {
        const data = await ktService.getExplainability(selectedCourseId, {
          weakLimit: 5,
          topN: 3,
          traceLimit: 12,
        });
        setExplainability(data);
      } catch {
        setExplainability(null);
      } finally {
        setExplainabilityLoading(false);
      }
    };

    loadExplainability();
  }, [selectedCourseId]);

  // Health check with retry every 15 seconds while offline
  useEffect(() => {
    let timer;
    const check = async () => {
      try {
        const health = await chatService.checkHealth();
        const healthy = health.healthy && health.modelLoaded;
        if (healthy) {
          healthFailureCountRef.current = 0;
          setAiHealthy(true);
        } else {
          healthFailureCountRef.current += 1;
          if (healthFailureCountRef.current >= 2) {
            setAiHealthy(false);
          }
        }
      } catch {
        healthFailureCountRef.current += 1;
        if (healthFailureCountRef.current >= 2) {
          setAiHealthy(false);
        }
      }
    };
    check();
    timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  // Load a specific session
  const loadSession = async (id) => {
    try {
      const session = await chatService.getSession(id);
      setSessionId(session._id);
      setMessages(session.messages);
      setError(null);
      if (isMobile) setSidebarOpen(false);
    } catch {
      setError('Failed to load chat session');
    }
  };

  // Start new chat
  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    if (isMobile) setSidebarOpen(false);
    inputRef.current?.focus();
  };

  // Send message
  const handleSend = async (overrideMessage) => {
    const text = overrideMessage || input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);

    // Optimistically add user message
    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(text, sessionId);

      setSessionId(response.sessionId);
      setMessages((prev) => [...prev, response.message]);

      // Refresh sessions list
      const updated = await chatService.getSessions();
      setSessions(updated);
    } catch (err) {
      const errMsg =
        err.response?.data?.message || 'Failed to get a response. Is the AI model running?';
      setError(errMsg);
      // Remove optimistic user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Delete session
  const handleDeleteSession = async () => {
    const { id } = deleteDialog;
    if (!id) return;
    try {
      await chatService.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s._id !== id));
      if (sessionId === id) newChat();
    } catch {
      setError('Failed to delete session');
    }
    setDeleteDialog({ open: false, id: null });
  };

  // Clear all sessions
  const handleClearAll = async () => {
    try {
      await chatService.clearSessions();
      setSessions([]);
      newChat();
    } catch {
      setError('Failed to clear sessions');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenMaterial = async (recommendation) => {
    const materialId = recommendation?.materialId;
    if (!materialId) return;

    if (selectedCourseId && recommendation?.topicId) {
      ktService.logLearningEvent({
        courseId: selectedCourseId,
        topicId: recommendation.topicId,
        sourceType: 'material',
        eventType: 'material_view',
        materialId,
        materialType: recommendation.type,
        materialTopicMatchScore: Number(recommendation.score || 0),
        metadata: { recommendationAction: 'open', reasonCodes: recommendation.reasonCodes || [] },
      }).catch(() => {});
    }

    try {
      const response = await materialService.getSignedUrl(materialId);
      const signedUrl = response?.url;
      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        navigate(`/${user?.role || 'student'}/materials`);
      }
    } catch {
      navigate(`/${user?.role || 'student'}/materials`);
    }
  };

  const handleMarkHelpful = (recommendation) => {
    const materialId = String(recommendation?.materialId || '');
    if (!materialId) return;
    setHelpfulRecommendationIds((prev) => new Set(prev).add(materialId));

    if (selectedCourseId && recommendation?.topicId) {
      ktService.logLearningEvent({
        courseId: selectedCourseId,
        topicId: recommendation.topicId,
        sourceType: 'material',
        eventType: 'material_view',
        materialId,
        materialType: recommendation.type,
        materialTopicMatchScore: Number(recommendation.score || 0),
        metadata: { recommendationAction: 'helpful', reasonCodes: recommendation.reasonCodes || [] },
      }).catch(() => {});
    }
  };

  const handleDismissRecommendation = (recommendation) => {
    const materialId = String(recommendation?.materialId || '');
    if (!materialId) return;
    setDismissedRecommendationIds((prev) => new Set(prev).add(materialId));

    if (selectedCourseId && recommendation?.topicId) {
      ktService.logLearningEvent({
        courseId: selectedCourseId,
        topicId: recommendation.topicId,
        sourceType: 'material',
        eventType: 'material_view',
        materialId,
        materialType: recommendation.type,
        materialTopicMatchScore: Number(recommendation.score || 0),
        metadata: { recommendationAction: 'dismiss', reasonCodes: recommendation.reasonCodes || [] },
      }).catch(() => {});
    }
  };

  const handleQuickCheck = (recommendation) => {
    const topicText = recommendation?.topicId || 'this topic';
    const materialText = recommendation?.title || 'the suggested material';
    const prompt = `Give me a quick 3-question check on ${topicText} based on ${materialText}. Keep it concise and include answers at the end.`;

    if (selectedCourseId && recommendation?.topicId) {
      ktService.logLearningEvent({
        courseId: selectedCourseId,
        topicId: recommendation.topicId,
        sourceType: 'hint',
        eventType: 'hint_used',
        metadata: { recommendationAction: 'quick_check_requested' },
      }).catch(() => {});
    }

    handleSend(prompt);
  };

  // ── Sidebar Drawer ──────────────────
  const sidebarWidth = 280;
  const sidebar = (
    <Box
      sx={{
        width: sidebarWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<NewChatIcon />}
          onClick={newChat}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          New Chat
        </Button>
      </Box>
      <Divider />

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            HISTORY
          </Typography>
          {sessions.length > 0 && (
            <Tooltip title="Clear all">
              <IconButton size="small" onClick={handleClearAll}>
                <ClearAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <List dense>
          {sessions.map((s) => (
            <ListItem
              key={s._id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialog({ open: true, id: s._id });
                  }}
                  sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={sessionId === s._id}
                onClick={() => loadSession(s._id)}
                sx={{ borderRadius: 1.5, mx: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={s.title}
                  primaryTypographyProps={{
                    noWrap: true,
                    variant: 'body2',
                    fontWeight: sessionId === s._id ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {sessions.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ p: 2, display: 'block', textAlign: 'center' }}>
              No chat history yet
            </Typography>
          )}
        </List>
      </Box>

      {/* Health status */}
      <Divider />
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatusIcon
          sx={{
            fontSize: 10,
            color: aiHealthy === null ? 'warning.main' : aiHealthy ? 'success.main' : 'error.main',
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {aiHealthy === null ? 'Checking AI...' : aiHealthy ? 'AI Model Online' : 'AI Model Offline'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: { xs: 'calc(100vh - 88px)', sm: 'calc(100vh - 104px)', md: 'calc(100vh - 112px)' }, overflow: 'hidden' }}>
      {/* Sidebar */}
      {isMobile ? (
        <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          {sidebar}
        </Drawer>
      ) : (
        sidebarOpen && sidebar
      )}

      {/* Main Chat Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          bgcolor: alpha(theme.palette.background.default, 0.5),
        }}
      >
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
            borderRadius: 0,
          }}
        >
          <Tooltip title="Toggle history">
            <IconButton size="small" onClick={() => setSidebarOpen((v) => !v)}>
              <SidebarIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <BotIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            AI Tutor
          </Typography>
          <Chip
            label="RAG-Powered"
            size="small"
            color="success"
            variant="outlined"
            sx={{ ml: 'auto', fontSize: '0.7rem', height: 24 }}
          />
        </Paper>

        {/* Messages Area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <AdaptiveTutorPanel
            theme={theme}
            courses={courses}
            selectedCourseId={selectedCourseId}
            onCourseChange={setSelectedCourseId}
            insights={insights}
            explainability={explainability}
            loading={insightsLoading}
            explainabilityLoading={explainabilityLoading}
            error={insightsError}
            dismissedIds={dismissedRecommendationIds}
            helpfulIds={helpfulRecommendationIds}
            onOpenMaterial={handleOpenMaterial}
            onMarkHelpful={handleMarkHelpful}
            onDismiss={handleDismissRecommendation}
            onQuickCheck={handleQuickCheck}
          />

          {aiHealthy === false && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              AI model is offline. Make sure Ollama is running locally (<code>ollama serve</code>). Retrying automatically...
            </Alert>
          )}
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen theme={theme} onSuggestion={handleSend} />
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} theme={theme} />
              ))}
              {isLoading && <TypingIndicator theme={theme} />}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>

        {/* Input Area */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            borderRadius: 0,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', maxWidth: 900, mx: 'auto' }}>
            <TextField
              inputRef={inputRef}
              fullWidth
              multiline
              maxRows={4}
              placeholder="Ask me anything about your course materials..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                width: 42,
                height: 42,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </IconButton>
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            AI Tutor uses RAG to answer from your uploaded materials. Responses may not always be accurate.
          </Typography>
        </Paper>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null })}
        PaperProps={{ sx: { borderRadius: 3, maxWidth: 360 } }}
      >
        <DialogTitle>Delete Chat?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete this conversation.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteSession} sx={{ borderRadius: 2 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AITutor;
