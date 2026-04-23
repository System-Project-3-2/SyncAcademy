/**
 * Adaptive Tutor Recommendations Page
 * Dedicated page for weak-topic insights and personalized material suggestions.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  LinearProgress,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  Psychology as WeaknessIcon,
  Launch as OpenIcon,
  ThumbUp as HelpfulIcon,
  VisibilityOff as DismissIcon,
  AutoAwesome as SuggestionIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../components';
import { useAuth } from '../../hooks';
import enrollmentService from '../../services/enrollmentService';
import materialService from '../../services/materialService';
import ktService from '../../services/ktService';

const AdaptiveTutorRecommendations = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [insights, setInsights] = useState(null);
  const [explainability, setExplainability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explainabilityLoading, setExplainabilityLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [helpfulIds, setHelpfulIds] = useState(new Set());

  const weakTopics = insights?.weakTopics?.items || [];
  const recommendations = (insights?.recommendations?.items || []).filter(
    (item) => !dismissedIds.has(String(item.materialId))
  );
  const signalSummary = insights?.signalSummary || {};
  const globalDrivers = explainability?.recommendationExplainability?.globalDrivers || [];
  const increasedActions = explainability?.topContributingActions?.increasedMastery || [];
  const decreasedActions = explainability?.topContributingActions?.decreasedMastery || [];

  const weakColor = (score) => {
    if (score >= 0.75) return 'error';
    if (score >= 0.55) return 'warning';
    return 'default';
  };

  const formatDriverLabel = (driver) => {
    if (driver === 'topic_weakness_alignment') return 'Targets weak topics';
    if (driver === 'material_relevance_score') return 'Material relevance';
    if (driver === 'confidence_support') return 'Confidence support';
    return String(driver || '').replace(/_/g, ' ');
  };

  const getMatchTone = (score) => {
    if (score >= 0.75) return 'success';
    if (score >= 0.5) return 'info';
    return 'warning';
  };

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const enrolledCourses = await enrollmentService.getMyEnrolledCourses();
        const normalized = Array.isArray(enrolledCourses)
          ? enrolledCourses
          : enrolledCourses?.courses || [];

        setCourses(normalized);
        if (normalized.length > 0) {
          setSelectedCourseId((prev) => prev || normalized[0]._id);
        }
      } catch {
        setCourses([]);
      }
    };

    loadCourses();
  }, []);

  useEffect(() => {
    const loadInsights = async () => {
      if (!selectedCourseId) {
        setInsights(null);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await ktService.getInsights(selectedCourseId, {
          weakLimit: 6,
          topN: 3,
          perTopic: 3,
          page: 1,
          limit: 3,
        });
        setInsights(data);
      } catch (err) {
        setInsights(null);
        setError(err?.response?.data?.message || 'Unable to load recommendation insights right now.');
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [selectedCourseId]);

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

  const logRecommendationEvent = (recommendation, actionType) => {
    if (!selectedCourseId || !recommendation?.topicId) return;

    const payload = {
      courseId: selectedCourseId,
      topicId: recommendation.topicId,
      sourceType: actionType === 'quick_check_requested' ? 'hint' : 'material',
      eventType: actionType === 'quick_check_requested' ? 'hint_used' : 'material_view',
      materialId: recommendation.materialId,
      materialType: recommendation.type,
      materialTopicMatchScore: Number(recommendation.score || 0),
      metadata: { recommendationAction: actionType, reasonCodes: recommendation.reasonCodes || [] },
    };

    ktService.logLearningEvent(payload).catch(() => {});
  };

  const handleOpenMaterial = async (recommendation) => {
    const materialId = recommendation?.materialId;
    if (!materialId) return;

    logRecommendationEvent(recommendation, 'open');

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
    setHelpfulIds((prev) => new Set(prev).add(materialId));
    logRecommendationEvent(recommendation, 'helpful');
  };

  const handleDismiss = (recommendation) => {
    const materialId = String(recommendation?.materialId || '');
    if (!materialId) return;
    setDismissedIds((prev) => new Set(prev).add(materialId));
    logRecommendationEvent(recommendation, 'dismiss');
  };

  const handleQuickCheck = (recommendation) => {
    const topicText = recommendation?.topicId || 'this topic';
    const materialText = recommendation?.title || 'the suggested material';
    const prompt = `Give me a quick 3-question check on ${topicText} based on ${materialText}. Keep it concise and include answers at the end.`;

    logRecommendationEvent(recommendation, 'quick_check_requested');
    navigate(`/${user?.role || 'student'}/ai-tutor`, {
      state: { prefillPrompt: prompt },
    });
  };

  return (
    <Box className="fade-in">
      <PageHeader
        title="Adaptive Recommendations"
        subtitle="Weak-topic insights and personalized materials to recover faster"
        breadcrumbs={[
          { label: 'Dashboard', path: `/${user?.role || 'student'}/dashboard` },
          { label: 'Adaptive Recommendations' },
        ]}
      />

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.background.paper, 0.96),
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
                Adaptive Tutor Recommendation Engine
              </Typography>
            </Stack>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 320 } }}>
              <InputLabel id="adaptive-course-select-page">Course</InputLabel>
              <Select
                labelId="adaptive-course-select-page"
                value={selectedCourseId || ''}
                label="Course"
                onChange={(e) => setSelectedCourseId(e.target.value)}
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

        <Box sx={{ p: 2 }}>
          <Alert
            icon={<InfoIcon fontSize="inherit" />}
            severity="info"
            sx={{ mb: 1.5, borderRadius: 2 }}
          >
            Match % shows how strongly a material fits your weak topics right now. Start with rank #1, then use Quick Check to verify understanding.
          </Alert>

          {insights?.masterySummary && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              <Chip size="small" label={`Mastery ${(insights.masterySummary.overallMastery * 100).toFixed(0)}%`} color="primary" variant="outlined" />
              <Chip size="small" label={`Risk Topics ${insights.masterySummary.highRiskTopics}`} color="warning" variant="outlined" />
              <Chip size="small" label={`Confidence ${(insights.masterySummary.averageConfidence * 100).toFixed(0)}%`} color="info" variant="outlined" />
              <Chip size="small" label={`Signals ${signalSummary.topicsDiscovered ?? 0}`} color="success" variant="outlined" />
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
                    <Tooltip
                      key={topic.topicId}
                      title={`Reason codes: ${(topic.reasonCodes || []).join(', ') || 'No specific reason code yet'}`}
                    >
                      <Chip
                        size="small"
                        icon={<WeaknessIcon sx={{ fontSize: 14 }} />}
                        label={`${topic.topicId} • ${(topic.weaknessScore * 100).toFixed(0)}% weak`}
                        color={weakColor(Number(topic.weaknessScore || 0))}
                        variant="outlined"
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}>
                  Recommended Materials
                </Typography>
                <Stack spacing={1}>
                  {recommendations.length === 0 && (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      No recommendations yet for this course. Try attempting a quiz or using AI Tutor quick checks to generate learning signals.
                    </Alert>
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
                              <Chip size="small" label={rec.type || 'Material'} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {rec.title}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Topic: {rec.topicId} • Match: {(Number(rec.score || 0) * 100).toFixed(0)}%
                          </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.max(0, Math.min(100, Number(rec.score || 0) * 100))}
                              color={getMatchTone(Number(rec.score || 0))}
                              sx={{ mt: 0.6, mb: 0.75, height: 6, borderRadius: 999 }}
                            />
                          <Typography variant="caption" color="text.secondary">
                            {rec.reason}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Open material">
                            <IconButton size="small" onClick={() => handleOpenMaterial(rec)}>
                              <OpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Mark helpful">
                            <IconButton size="small" color={helpfulIds.has(String(rec.materialId)) ? 'success' : 'default'} onClick={() => handleMarkHelpful(rec)}>
                              <HelpfulIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Dismiss">
                            <IconButton size="small" onClick={() => handleDismiss(rec)}>
                              <DismissIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Quick check in AI Tutor">
                            <IconButton size="small" color="primary" onClick={() => handleQuickCheck(rec)}>
                              <SuggestionIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Button size="small" variant="text" onClick={() => handleQuickCheck(rec)} startIcon={<SuggestionIcon fontSize="small" />}>
                            Quick Check
                          </Button>
                          <Button size="small" variant="text" onClick={() => handleOpenMaterial(rec)} startIcon={<OpenIcon fontSize="small" />}>
                            Open
                          </Button>
                        </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}>
                  Recommendation Insights
                </Typography>
                {(signalSummary.topicsDiscovered || signalSummary.masteryUpdated) && (
                  <Alert severity="success" sx={{ mb: 1, borderRadius: 2 }}>
                    Signals found: {signalSummary.topicsDiscovered || 0} topic groups, {signalSummary.masteryUpdated || 0} mastery rows refreshed.
                  </Alert>
                )}
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
                            label={`${formatDriverLabel(driver.driver)} • ${(Number(driver.meanContribution || 0) * 100).toFixed(1)}%`}
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
        </Box>
      </Paper>
    </Box>
  );
};

export default AdaptiveTutorRecommendations;
