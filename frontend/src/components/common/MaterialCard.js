/**
 * MaterialCard Component
 * Displays a search result material with matched content
 * Includes dark mode support
 */
import React from 'react';
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
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  School as CourseIcon,
  Category as TypeIcon,
} from '@mui/icons-material';

const MaterialCard = ({
  material,
  expanded = false,
  onToggleExpand = null,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleDownload = () => {
    window.open(material.fileUrl, '_blank');
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
                {material.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Chip
                  size="small"
                  icon={<CourseIcon />}
                  label={material.course}
                  variant="outlined"
                  color="primary"
                />
                <Chip
                  size="small"
                  icon={<TypeIcon />}
                  label={material.type}
                  variant="outlined"
                />
              </Box>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            size="small"
          >
            Download
          </Button>
        </Box>

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
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            color="text.primary"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              bgcolor: isDark ? 'grey.800' : 'white',
                              p: 1.5,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              transition: 'background-color 0.3s ease',
                            }}
                          >
                            ...{match}...
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialCard;
