/**
 * MaterialCard Component
 * Displays a search result material with matched content
 * Includes dark mode support, preview, and relevance score
 */
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  LinearProgress,
  useTheme,
  alpha,
  Dialog,
  DialogContent,
  IconButton,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Download as DownloadIcon,
  Visibility as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  School as CourseIcon,
  Category as TypeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

const MaterialCard = ({
  material,
  expanded = false,
  onToggleExpand = null,
  onPreview = null,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Resilient field access — works for both search results and Materials page context
  const title = material.title || material.courseTitle || 'Untitled Material';
  const course = material.courseNo || material.course || '';
  const courseTitle = material.courseTitle || '';
  const relevance = material.relevanceScore;
  const [selectedMatch, setSelectedMatch] = useState(null);

  const getMatchText = (match) => {
    if (typeof match === 'string') return match;
    if (!match || typeof match !== 'object') return '';
    return match.fullContent || match.content || match.text || match.snippet || '';
  };

  const openMatchDetail = (match) => {
    setSelectedMatch(getMatchText(match));
  };

  const handleDownload = async () => {
    const url = material.fileUrl;
    if (!url) return;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      // Use originalFileName if available, then derive from URL, finally fallback
      a.download =
        material.originalFileName ||
        decodeURIComponent(url.split('/').pop()) ||
        `${title}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        mb: 2,
        transition: 'all 0.2s',
        bgcolor: 'background.paper',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: isDark ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.2)}` : 2,
        },
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isDark 
                  ? alpha(theme.palette.primary.main, 0.15)
                  : 'primary.50',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DocumentIcon fontSize="large" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom color="text.primary">
                {title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {courseTitle && (
                  <Chip
                    size="small"
                    icon={<CourseIcon />}
                    label={courseTitle}
                    variant="outlined"
                    color="primary"
                  />
                )}
                {course && (
                  <Chip
                    size="small"
                    label={course}
                    variant="outlined"
                  />
                )}
                {material.type && (
                  <Chip
                    size="small"
                    icon={<TypeIcon />}
                    label={material.type}
                    variant="outlined"
                  />
                )}
                {relevance != null && (
                  <Chip
                    size="small"
                    label={`Relevance: ${Math.round(relevance * 100)}%`}
                    color={relevance >= 0.7 ? 'success' : relevance >= 0.4 ? 'warning' : 'default'}
                    variant="filled"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            {onPreview && (
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => onPreview(material)}
                size="small"
              >
                Preview
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              size="small"
            >
              Download
            </Button>
          </Box>
        </Box>

        {/* Relevance Progress Bar */}
        {relevance != null && (
          <Box sx={{ mt: 1.5, mb: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={Math.round(relevance * 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: isDark ? alpha(theme.palette.primary.main, 0.1) : 'grey.100',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  bgcolor: relevance >= 0.7 ? 'success.main' : relevance >= 0.4 ? 'warning.main' : 'grey.400',
                },
              }}
            />
          </Box>
        )}

        {/* Matched Content Preview */}
        {material.matches && material.matches.length > 0 && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 2,
                cursor: 'pointer',
              }}
              onClick={onToggleExpand}
            >
              <Typography variant="body2" color="primary">
                {material.matches.length} relevant section(s) found
              </Typography>
              <ExpandMoreIcon
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  color: 'primary.main',
                }}
              />
            </Box>
            <Collapse in={expanded}>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: isDark 
                    ? alpha(theme.palette.common.black, 0.2)
                    : 'grey.50',
                  borderRadius: 2,
                  maxHeight: 300,
                  overflow: 'auto',
                  transition: 'background-color 0.3s ease',
                }}
              >
                <List dense disablePadding>
                  {material.matches.map((match, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemButton
                        onClick={() => openMatchDetail(match)}
                        sx={{
                          px: 0,
                          borderRadius: 1,
                          alignItems: 'stretch',
                          '&:hover .match-chunk': {
                            borderColor: 'primary.main',
                            bgcolor: isDark
                              ? alpha(theme.palette.primary.main, 0.14)
                              : alpha(theme.palette.primary.main, 0.06),
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box
                              className="match-chunk"
                              sx={{
                                bgcolor: isDark
                                  ? alpha(theme.palette.background.paper, 0.8)
                                  : alpha(theme.palette.grey[100], 0.5),
                                p: 1.5,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                width: '100%',
                              }}
                            >
                              <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{
                                  whiteSpace: 'pre-wrap',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                ...{getMatchText(match)}...
                              </Typography>
                              <Typography
                                variant="caption"
                                color="primary"
                                sx={{ display: 'block', mt: 0.75, fontWeight: 500 }}
                              >
                                Click to open full chunk
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Collapse>
          </>
        )}
      </CardContent>

      {/* Full chunk page-style view */}
      <Dialog
        open={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: theme.palette.mode === 'dark' ? theme.palette.background.default : '#fff',
          },
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, md: 4 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.95) : '#fff',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Relevant Result
          </Typography>
          <IconButton onClick={() => setSelectedMatch(null)} aria-label="Close full chunk view">
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              maxWidth: 980,
              mx: 'auto',
              p: { xs: 2, md: 4 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.9) : '#fff',
            }}
          >
            <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {selectedMatch}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MaterialCard;
