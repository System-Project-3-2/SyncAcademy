/**
 * File Preview Dialog Component
 * In-app file preview for PDFs, documents, and images
 *
 * Strategy:
 * - PDF:    embed directly via <iframe> (browser native PDF viewer)
 * - DOC/PPT: Google Docs Viewer (browsers can't render natively)
 * - Image:  <img> tag
 * - Other:  fallback with "Open in New Tab"
 *
 * Download uses fetch+blob to guarantee the browser triggers a save-dialog
 * regardless of Cloudinary resource_type (raw vs image).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  PictureAsPdf as PdfIcon,
  Article as DocIcon,
  Slideshow as PptIcon,
  Description as FileIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';

// ── helpers ──────────────────────────────────────────────

const getFileType = (url) => {
  if (!url) return 'unknown';
  const lower = url.toLowerCase();
  if (lower.includes('.pdf')) return 'pdf';
  if (lower.includes('.doc') || lower.includes('.docx')) return 'doc';
  if (lower.includes('.ppt') || lower.includes('.pptx')) return 'ppt';
  if (
    lower.includes('.jpg') ||
    lower.includes('.jpeg') ||
    lower.includes('.png') ||
    lower.includes('.gif') ||
    lower.includes('.webp')
  )
    return 'image';
  return 'unknown';
};

const getFileTypeIcon = (type) => {
  switch (type) {
    case 'pdf':
      return <PdfIcon sx={{ color: '#e53935' }} />;
    case 'doc':
      return <DocIcon sx={{ color: '#1976d2' }} />;
    case 'ppt':
      return <PptIcon sx={{ color: '#ff6d00' }} />;
    default:
      return <FileIcon sx={{ color: '#757575' }} />;
  }
};

/**
 * Return an embeddable URL.
 * - Image → direct URL
 * - PDF/DOC/PPT → Google Docs Viewer (most reliable for Cloudinary-hosted files)
 */
const getPreviewUrl = (url, fileType) => {
  if (!url) return null;
  if (fileType === 'image') return url;
  if (fileType === 'pdf' || fileType === 'doc' || fileType === 'ppt') {
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return null;
};

/**
 * Download any remote file using fetch → Blob → object-URL trick.
 * Works for both Cloudinary raw/ and image/ resource types.
 */
const fetchAndDownload = async (url, filename) => {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch {
    // Fallback: just open the URL in a new tab
    window.open(url, '_blank');
    return false;
  }
};

// ── component ────────────────────────────────────────────

const FilePreviewDialog = ({ open, onClose, material }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const timeoutRef = useRef(null);

  // Reset state on every open / material change
  useEffect(() => {
    if (open && material) {
      setLoading(true);
      setError(false);
      setDownloading(false);

      // Safety-net: if nothing fires onLoad within 8 s, dismiss the spinner
      // (cross-origin iframes sometimes swallow load events)
      timeoutRef.current = setTimeout(() => setLoading(false), 8000);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [open, material?.fileUrl]);

  if (!material) return null;

  const fileUrl = material.fileUrl;
  const fileType = getFileType(fileUrl);
  const previewUrl = getPreviewUrl(fileUrl, fileType);
  const canPreview = previewUrl !== null;

  const handleLoad = () => {
    clearTimeout(timeoutRef.current);
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    clearTimeout(timeoutRef.current);
    setLoading(false);
    setError(true);
  };

  const handleOpenExternal = () => window.open(fileUrl, '_blank');

  const handleDownload = async () => {
    setDownloading(true);
    const name =
      material.courseTitle ||
      material.courseNo ||
      fileUrl.split('/').pop() ||
      'download';
    await fetchAndDownload(fileUrl, name);
    setDownloading(false);
  };

  // ── render ──

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, height: '85vh', maxHeight: '85vh' },
      }}
    >
      {/* ── title bar ── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1.5,
          px: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {getFileTypeIcon(fileType)}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {material.courseTitle}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {material.courseNo}
            </Typography>
            {material.type && (
              <Chip
                size="small"
                label={material.type}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              />
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ── content ── */}
      <DialogContent sx={{ p: 0, position: 'relative', overflow: 'hidden' }}>
        {canPreview ? (
          <>
            {/* Loading overlay */}
            {loading && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }}
              >
                <CircularProgress size={48} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading preview…
                </Typography>
              </Box>
            )}

            {/* Error state */}
            {error ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 2,
                }}
              >
                <ErrorIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary">
                  Preview unavailable
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  This file cannot be previewed in the browser.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<OpenInNewIcon />}
                  onClick={handleOpenExternal}
                >
                  Open in New Tab
                </Button>
              </Box>
            ) : fileType === 'image' ? (
              /* ── image preview ── */
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                }}
              >
                <img
                  src={previewUrl}
                  alt={material.courseTitle}
                  onLoad={handleLoad}
                  onError={handleError}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                />
              </Box>
            ) : (
              /* ── PDF / DOC / PPT preview via iframe ── */
              <iframe
                src={previewUrl}
                title={material.courseTitle}
                width="100%"
                height="100%"
                onLoad={handleLoad}
                onError={handleError}
                style={{ border: 'none' }}
                allow="autoplay"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            )}
          </>
        ) : (
          /* ── unsupported type fallback ── */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2,
            }}
          >
            <FileIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">
              Preview not available for this file type
            </Typography>
            <Typography variant="body2" color="text.disabled">
              You can download the file or open it in a new tab.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? 'Downloading…' : 'Download'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenExternal}
              >
                Open in New Tab
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* ── action bar ── */}
      <DialogActions
        sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
      >
        <Button
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          onClick={handleOpenExternal}
          sx={{ borderRadius: 2 }}
        >
          Open in New Tab
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          disabled={downloading}
          sx={{ borderRadius: 2 }}
        >
          {downloading ? 'Downloading…' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilePreviewDialog;
