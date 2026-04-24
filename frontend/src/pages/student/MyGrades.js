/**
 * MyGrades Page (Student)
 * Shows all graded/submitted assignments across all courses
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TableSortLabel,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Grade as GradeIcon,
  Description as ScriptIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { assignmentService } from '../../services';
import { LoadingSpinner, PageHeader } from '../../components';
import { Link as MuiLink } from '@mui/material';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

const MyGrades = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState('submittedAt');
  const [order, setOrder] = useState('desc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        setLoading(true);
        const data = await assignmentService.getMyGrades();
        setSubmissions(data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load grades');
      } finally {
        setLoading(false);
      }
    };
    fetchGrades();
  }, []);

  const handleSort = (field) => {
    if (orderBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(field);
      setOrder('asc');
    }
  };

  const filtered = submissions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.assignment?.title?.toLowerCase().includes(q) ||
      s.assignment?.course?.courseNo?.toLowerCase().includes(q) ||
      s.assignment?.course?.courseTitle?.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    switch (orderBy) {
      case 'course':
        aVal = a.assignment?.course?.courseNo || '';
        bVal = b.assignment?.course?.courseNo || '';
        break;
      case 'assignment':
        aVal = a.assignment?.title || '';
        bVal = b.assignment?.title || '';
        break;
      case 'grade':
        aVal = a.grade ?? -1;
        bVal = b.grade ?? -1;
        break;
      case 'percentage':
        aVal = a.grade !== null && a.assignment?.totalMarks ? (a.grade / a.assignment.totalMarks) * 100 : -1;
        bVal = b.grade !== null && b.assignment?.totalMarks ? (b.grade / b.assignment.totalMarks) * 100 : -1;
        break;
      default:
        aVal = new Date(a.submittedAt).getTime();
        bVal = new Date(b.submittedAt).getTime();
    }
    if (typeof aVal === 'string') {
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return order === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <PageHeader
        title="Results"
        subtitle="View results and feedback for all your assignments"
      />

      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search by course or assignment..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
          }}
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 300 } }}
        />
      </Box>

      {sorted.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <GradeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">
            {search ? 'No matching grades found' : 'No submissions yet'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel active={orderBy === 'course'} direction={orderBy === 'course' ? order : 'asc'} onClick={() => handleSort('course')}>
                    Course
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'assignment'} direction={orderBy === 'assignment' ? order : 'asc'} onClick={() => handleSort('assignment')}>
                    Assignment
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'submittedAt'} direction={orderBy === 'submittedAt' ? order : 'asc'} onClick={() => handleSort('submittedAt')}>
                    Submitted
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'grade'} direction={orderBy === 'grade' ? order : 'asc'} onClick={() => handleSort('grade')}>
                    Mark
                  </TableSortLabel>
                </TableCell>
                <TableCell>Evaluated Script</TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'percentage'} direction={orderBy === 'percentage' ? order : 'asc'} onClick={() => handleSort('percentage')}>
                    Percentage
                  </TableSortLabel>
                </TableCell>
                <TableCell>Feedback</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((sub) => {
                const published = sub.assignment?.isResultPublished;
                const pct = published && sub.grade !== null && sub.grade !== undefined && sub.assignment?.totalMarks
                  ? ((sub.grade / sub.assignment.totalMarks) * 100).toFixed(1)
                  : null;
                return (
                  <TableRow key={sub._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {sub.assignment?.course?.courseNo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {sub.assignment?.course?.courseTitle}
                      </Typography>
                    </TableCell>
                    <TableCell>{sub.assignment?.title || '—'}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{formatDate(sub.submittedAt)}</Typography>
                        {sub.isLate && <Chip label="Late" size="small" color="error" sx={{ mt: 0.5 }} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {!published ? (
                        <Chip label="Not published" size="small" color="default" variant="outlined" />
                      ) : sub.grade !== null && sub.grade !== undefined ? (
                        <Chip label={sub.grade} size="small" color="info" />
                      ) : (
                        <Chip label="Pending" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.evaluatedFileUrl && sub.showEvaluatedToStudent ? (
                        <MuiLink href={sub.evaluatedFileUrl} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ScriptIcon fontSize="small" />
                          View Script
                        </MuiLink>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Not available</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {pct !== null ? (
                        <Chip
                          label={`${pct}%`}
                          size="small"
                          color={Number(pct) >= 80 ? 'success' : Number(pct) >= 50 ? 'warning' : 'error'}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 240, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {published ? (sub.feedback || '—') : '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default MyGrades;
