/**
 * Search Materials Page
 * Semantic search for educational materials with history and autocomplete
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Popper,
  ClickAwayListener,
  alpha,
  Pagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  School as CourseIcon,
  Description as MaterialIcon,
  DeleteSweep as ClearAllIcon,
  TrendingUp as SuggestionIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { PageHeader, LoadingSpinner, EmptyState, MaterialCard } from '../../components';
import { materialService, courseService } from '../../services';

const RESULTS_PER_PAGE = 5;

// Course options - can be fetched from API in production
const COURSES = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Electronics',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
];

// Material types
const MATERIAL_TYPES = ['Lecture Notes', 'Assignment', 'Lab Report', 'Book', 'Slides', 'Other'];

const SearchMaterials = () => {
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Search history and autocomplete state
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);
  const suggestionsAnchorRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Fetch search history on mount
  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const fetchSearchHistory = async () => {
    try {
      const data = await courseService.getSearchHistory(5);
      setSearchHistory(data);
    } catch (error) {
      console.error('Error fetching search history:', error);
    }
  };

  // Debounced autocomplete
  const fetchSuggestions = useCallback(async (value) => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await courseService.getSearchSuggestions(value);
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }, []);

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    // Debounce suggestions
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSuggestionClick = (text) => {
    setQuery(text);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleClearHistory = async () => {
    try {
      await courseService.clearSearchHistory();
      setSearchHistory([]);
      toast.success('Search history cleared');
    } catch (error) {
      toast.error('Failed to clear history');
    }
  };

  // Client-side pagination for search results
  const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * RESULTS_PER_PAGE;
    return results.slice(start, start + RESULTS_PER_PAGE);
  }, [results, currentPage]);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchParams = { query };
      if (course) searchParams.course = course;
      if (type) searchParams.type = type;

      const data = await materialService.searchMaterials(searchParams);
      setResults(data);
      setCurrentPage(1); // Reset to first page on new search
      
      if (data.length === 0) {
        toast.info('No materials found matching your query');
      } else {
        toast.success(`Found ${data.length} material(s)`);
      }

      // Refresh search history
      fetchSearchHistory();
    } catch (error) {
      toast.error('Search failed. Please try again.');
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setCourse('');
    setType('');
    setResults([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const toggleExpand = (materialTitle) => {
    setExpandedMaterial(expandedMaterial === materialTitle ? null : materialTitle);
  };

  return (
    <Box>
      <PageHeader
        title="Search Materials"
        subtitle="Find educational materials using semantic search"
      />

      {/* Search Form */}
      <Paper
        component="form"
        onSubmit={handleSearch}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12}>
            <Box ref={suggestionsAnchorRef}>
              <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    placeholder="Search for materials... (e.g., 'data structures and algorithms')"
                    value={query}
                    onChange={handleQueryChange}
                    onFocus={() => setShowSuggestions(true)}
                    inputRef={searchInputRef}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />
                  {/* Suggestions Dropdown */}
                  {showSuggestions && (suggestions.length > 0 || (searchHistory.length > 0 && !query)) && (
                    <Paper
                      elevation={8}
                      sx={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        mt: 0.5,
                        zIndex: 1300,
                        maxHeight: 320,
                        overflow: 'auto',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <List dense disablePadding>
                        {/* Show suggestions when typing */}
                        {query && suggestions.length > 0 && suggestions.map((s, index) => (
                          <ListItem key={index} disablePadding>
                            <ListItemButton onClick={() => handleSuggestionClick(s.text)}>
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                {s.type === 'history' ? <HistoryIcon fontSize="small" color="action" /> :
                                 s.type === 'course' ? <CourseIcon fontSize="small" color="primary" /> :
                                 <MaterialIcon fontSize="small" color="secondary" />}
                              </ListItemIcon>
                              <ListItemText
                                primary={s.text}
                                secondary={s.type === 'history' ? 'Recent search' : s.type === 'course' ? 'Course' : 'Material'}
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                        {/* Show history when input is empty */}
                        {!query && searchHistory.length > 0 && (
                          <>
                            <ListItem sx={{ py: 0.5, px: 2 }}>
                              <ListItemText
                                primary="Recent Searches"
                                primaryTypographyProps={{ variant: 'caption', fontWeight: 600, color: 'text.secondary' }}
                              />
                              <IconButton size="small" onClick={handleClearHistory} title="Clear history">
                                <ClearAllIcon fontSize="small" />
                              </IconButton>
                            </ListItem>
                            <Divider />
                            {searchHistory.map((item, index) => (
                              <ListItem key={item._id || index} disablePadding>
                                <ListItemButton onClick={() => handleSuggestionClick(item.query)}>
                                  <ListItemIcon sx={{ minWidth: 36 }}>
                                    <HistoryIcon fontSize="small" color="action" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.query}
                                    secondary={`${item.resultsCount} result(s)`}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </>
                        )}
                      </List>
                    </Paper>
                  )}
                </Box>
              </ClickAwayListener>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Course (Optional)</InputLabel>
              <Select
                value={course}
                label="Course (Optional)"
                onChange={(e) => setCourse(e.target.value)}
              >
                <MenuItem value="">All Courses</MenuItem>
                {COURSES.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Type (Optional)</InputLabel>
              <Select
                value={type}
                label="Type (Optional)"
                onChange={(e) => setType(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                {MATERIAL_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                startIcon={<SearchIcon />}
                disabled={isLoading}
              >
                Search
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={handleClear}
                startIcon={<ClearIcon />}
              >
                Clear
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Active Filters */}
        {(course || type) && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FilterIcon fontSize="small" color="action" sx={{ mr: 1 }} />
            {course && (
              <Chip
                label={`Course: ${course}`}
                size="small"
                onDelete={() => setCourse('')}
              />
            )}
            {type && (
              <Chip
                label={`Type: ${type}`}
                size="small"
                onDelete={() => setType('')}
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner message="Searching materials..." />
      ) : hasSearched ? (
        results.length > 0 ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {results.length} material(s)
              {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
            </Typography>
            {paginatedResults.map((material) => (
              <MaterialCard
                key={material.courseTitle || material.title}
                material={material}
                expanded={expandedMaterial === (material.courseTitle || material.title)}
                onToggleExpand={() => toggleExpand(material.courseTitle || material.title)}
              />
            ))}

            {/* Google-style Pagination */}
            {totalPages > 1 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mt: 4,
                  mb: 2,
                  gap: 1,
                }}
              >
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => {
                    setCurrentPage(page);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                  size="large"
                  siblingCount={2}
                  boundaryCount={1}
                />
                <Typography variant="caption" color="text.disabled">
                  Showing {(currentPage - 1) * RESULTS_PER_PAGE + 1}–
                  {Math.min(currentPage * RESULTS_PER_PAGE, results.length)} of {results.length} results
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <EmptyState
            title="No materials found"
            description="Try adjusting your search query or filters to find more results."
            icon={<SearchIcon sx={{ fontSize: 64 }} />}
          />
        )
      ) : (
        <EmptyState
          title="Start Searching"
          description="Enter a search query to find relevant educational materials."
          icon={<SearchIcon sx={{ fontSize: 64 }} />}
        />
      )}
    </Box>
  );
};

export default SearchMaterials;
