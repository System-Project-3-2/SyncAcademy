/**
 * Pagination Control Component
 * Reusable MUI-based pagination with page size control
 */
import React from 'react';
import {
  Box,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';

const PaginationControl = ({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onLimitChange,
  showPageSize = true,
  pageSizeOptions = [10, 20, 50, 100],
  sx = {},
}) => {
  if (total === 0) return null;

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mt: 3,
        py: 2,
        px: 1,
        ...sx,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Showing {startItem}–{endItem} of {total}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {showPageSize && onLimitChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Per page:
            </Typography>
            <FormControl size="small" variant="outlined">
              <Select
                value={limit}
                onChange={(e) => onLimitChange(e.target.value)}
                sx={{
                  minWidth: 70,
                  '& .MuiSelect-select': { py: 0.5 },
                }}
              >
                {pageSizeOptions.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, newPage) => onPageChange(newPage)}
          color="primary"
          shape="rounded"
          showFirstButton
          showLastButton
          size="medium"
          siblingCount={1}
          boundaryCount={1}
        />
      </Box>
    </Box>
  );
};

export default PaginationControl;
