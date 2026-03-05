/**
 * PdfAnnotator Component
 * Renders PDF pages on canvases and allows freehand drawing annotations.
 * Teacher can draw, erase, change color/size, navigate pages, and save.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  IconButton,
  Typography,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Create as PenIcon,
  Delete as EraserIcon,
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';

const COLORS = ['#FF0000', '#0000FF', '#00AA00', '#FF6600', '#000000', '#9C27B0'];

const PdfAnnotator = ({ open, onClose, fileUrl, fileName, onSave }) => {
  const theme = useTheme();
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scale = 1.5;

  // Drawing state
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  // Store annotations per page: { pageNum: [imageDataUrl, ...] }
  const annotationsRef = useRef({});
  // Undo history per page
  const undoStackRef = useRef({});

  // Load PDF
  useEffect(() => {
    if (!open || !fileUrl) return;

    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
          annotationsRef.current = {};
          undoStackRef.current = {};
        }
      } catch (err) {
        console.error('Failed to load PDF:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [open, fileUrl]);

  // Render current page
  const renderPage = useCallback(async (pageNum) => {
    if (!pdfDoc || !pdfCanvasRef.current || !drawCanvasRef.current) return;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const pdfCanvas = pdfCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;

    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    drawCanvas.width = viewport.width;
    drawCanvas.height = viewport.height;

    const pdfCtx = pdfCanvas.getContext('2d');
    await page.render({ canvasContext: pdfCtx, viewport }).promise;

    // Restore annotations for this page if they exist
    const drawCtx = drawCanvas.getContext('2d');
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    if (annotationsRef.current[pageNum]) {
      const img = new Image();
      img.onload = () => {
        drawCtx.drawImage(img, 0, 0);
      };
      img.src = annotationsRef.current[pageNum];
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  // Save current page annotations before navigating away
  const saveCurrentPageAnnotations = useCallback(() => {
    if (drawCanvasRef.current && currentPage) {
      annotationsRef.current[currentPage] = drawCanvasRef.current.toDataURL();
    }
  }, [currentPage]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    saveCurrentPageAnnotations();
    setCurrentPage(page);
  };

  // Drawing handlers
  const getPos = (e) => {
    const canvas = drawCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');

    // Save state for undo
    if (!undoStackRef.current[currentPage]) {
      undoStackRef.current[currentPage] = [];
    }
    undoStackRef.current[currentPage].push(canvas.toDataURL());

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = drawCanvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = drawCanvasRef.current.getContext('2d');
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
    setIsDrawing(false);
  };

  const handleUndo = () => {
    const stack = undoStackRef.current[currentPage];
    if (!stack || stack.length === 0) return;

    const prevState = stack.pop();
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (prevState) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = prevState;
    }
  };

  // Save annotated PDF
  const handleSave = async () => {
    if (!pdfDoc) return;
    setSaving(true);

    try {
      saveCurrentPageAnnotations();

      // Get first page to determine dimensions
      const firstPage = await pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale });
      const width = viewport.width;
      const height = viewport.height;

      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });

      for (let i = 1; i <= totalPages; i++) {
        if (i > 1) {
          const pg = await pdfDoc.getPage(i);
          const vp = pg.getViewport({ scale });
          pdf.addPage([vp.width, vp.height], vp.width > vp.height ? 'landscape' : 'portrait');
        }

        // Render page to offscreen canvas
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = vp.width;
        offCanvas.height = vp.height;
        const offCtx = offCanvas.getContext('2d');

        await page.render({ canvasContext: offCtx, viewport: vp }).promise;

        // Overlay annotations if any
        if (annotationsRef.current[i]) {
          const annotImg = new Image();
          await new Promise((resolve) => {
            annotImg.onload = resolve;
            annotImg.src = annotationsRef.current[i];
          });
          offCtx.drawImage(annotImg, 0, 0);
        }

        const imgData = offCanvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', 0, 0, vp.width, vp.height);
      }

      const blob = pdf.output('blob');
      const file = new File([blob], `evaluated_${fileName || 'submission'}.pdf`, { type: 'application/pdf' });

      if (onSave) {
        await onSave(file);
      }
    } catch (err) {
      console.error('Failed to save annotated PDF:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: { width: '95vw', height: '95vh', maxWidth: '95vw', maxHeight: '95vh', borderRadius: 2 },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }} noWrap>
          Evaluate: {fileName || 'Submission'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Page {currentPage} / {totalPages}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
        {/* Tool selection */}
        <ToggleButtonGroup
          value={tool}
          exclusive
          onChange={(_, v) => v && setTool(v)}
          size="small"
        >
          <ToggleButton value="pen">
            <Tooltip title="Pen"><PenIcon fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="eraser">
            <Tooltip title="Eraser"><EraserIcon fontSize="small" /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Color picker */}
        {tool === 'pen' && (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {COLORS.map((c) => (
              <Box
                key={c}
                onClick={() => setColor(c)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: c,
                  cursor: 'pointer',
                  border: color === c ? '3px solid' : '2px solid transparent',
                  borderColor: color === c ? 'text.primary' : 'transparent',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </Box>
        )}

        {/* Brush size */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">Size:</Typography>
          <Slider
            value={brushSize}
            onChange={(_, v) => setBrushSize(v)}
            min={1}
            max={15}
            size="small"
            sx={{ width: 80 }}
          />
        </Box>

        {/* Undo */}
        <Tooltip title="Undo">
          <IconButton size="small" onClick={handleUndo}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Page navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          <IconButton size="small" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
            <PrevIcon />
          </IconButton>
          <Typography variant="body2">{currentPage} / {totalPages}</Typography>
          <IconButton size="small" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
            <NextIcon />
          </IconButton>
        </Box>
      </Box>

      <DialogContent
        ref={containerRef}
        sx={{ p: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.200' }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading PDF...</Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', display: 'inline-block', my: 2 }}>
            <canvas ref={pdfCanvasRef} style={{ display: 'block' }} />
            <canvas
              ref={drawCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                cursor: tool === 'eraser' ? 'crosshair' : 'crosshair',
                touchAction: 'none',
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save Evaluated Script'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PdfAnnotator;
