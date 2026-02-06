/**
 * Theme Toggle Component
 * Animated toggle switch for light/dark theme with accessibility support
 */
import React from 'react';
import {
  IconButton,
  Tooltip,
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  SettingsBrightness as SystemIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTheme, THEME_MODES } from '../../hooks/useTheme';

/**
 * Simple toggle button for switching between light and dark themes
 */
export const ThemeToggleButton = ({ size = 'medium', sx = {} }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggleTheme}
        size={size}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        sx={{
          color: 'inherit',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': {
            transform: 'rotate(30deg)',
          },
          ...sx,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Sun icon */}
          <LightModeIcon
            sx={{
              position: 'absolute',
              transition: 'all 0.3s ease-in-out',
              opacity: isDark ? 0 : 1,
              transform: isDark ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)',
            }}
          />
          {/* Moon icon */}
          <DarkModeIcon
            sx={{
              position: 'absolute',
              transition: 'all 0.3s ease-in-out',
              opacity: isDark ? 1 : 0,
              transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
            }}
          />
        </Box>
      </IconButton>
    </Tooltip>
  );
};

/**
 * Theme toggle with dropdown menu for light/dark/system options
 */
export const ThemeToggleMenu = ({ size = 'medium', sx = {} }) => {
  const { mode, isDark, setMode } = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    handleClose();
  };

  const menuItems = [
    { mode: THEME_MODES.LIGHT, label: 'Light', icon: <LightModeIcon /> },
    { mode: THEME_MODES.DARK, label: 'Dark', icon: <DarkModeIcon /> },
    { mode: THEME_MODES.SYSTEM, label: 'System', icon: <SystemIcon /> },
  ];

  return (
    <>
      <Tooltip title="Theme settings">
        <IconButton
          onClick={handleClick}
          size={size}
          aria-label="Theme settings"
          aria-controls={open ? 'theme-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            color: 'inherit',
            transition: 'transform 0.3s ease-in-out',
            '&:hover': {
              transform: 'rotate(30deg)',
            },
            ...sx,
          }}
        >
          {isDark ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'theme-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {menuItems.map((item) => (
          <MenuItem
            key={item.mode}
            onClick={() => handleModeSelect(item.mode)}
            selected={mode === item.mode}
          >
            <ListItemIcon
              sx={{
                color: mode === item.mode ? 'primary.main' : 'inherit',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
            {mode === item.mode && (
              <CheckIcon
                fontSize="small"
                sx={{ ml: 1, color: 'primary.main' }}
              />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

/**
 * Custom animated toggle switch with sun/moon icons
 */
export const ThemeToggleSwitch = ({ showLabel = false }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {showLabel && (
        <LightModeIcon
          sx={{
            fontSize: 18,
            color: isDark ? 'grey.500' : 'warning.main',
            transition: 'color 0.3s ease',
          }}
        />
      )}
      <Box
        component="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        sx={{
          position: 'relative',
          width: 56,
          height: 28,
          borderRadius: 14,
          border: 'none',
          cursor: 'pointer',
          backgroundColor: isDark ? 'primary.dark' : 'grey.300',
          transition: 'background-color 0.3s ease',
          padding: 0,
          overflow: 'hidden',
          '&:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
          '&:hover': {
            backgroundColor: isDark ? 'primary.main' : 'grey.400',
          },
        }}
      >
        {/* Track background with stars/sun rays */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            background: isDark
              ? 'linear-gradient(to right, #1e3a5f, #0f172a)'
              : 'linear-gradient(to right, #60a5fa, #3b82f6)',
            opacity: 0.3,
            transition: 'opacity 0.3s ease',
          }}
        />
        
        {/* Toggle thumb */}
        <Box
          sx={{
            position: 'absolute',
            top: 2,
            left: isDark ? 'calc(100% - 26px)' : 2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'left 0.3s ease, transform 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          {/* Sun/Moon icon inside thumb */}
          {isDark ? (
            <DarkModeIcon sx={{ fontSize: 16, color: 'primary.dark' }} />
          ) : (
            <LightModeIcon sx={{ fontSize: 16, color: 'warning.main' }} />
          )}
        </Box>
      </Box>
      {showLabel && (
        <DarkModeIcon
          sx={{
            fontSize: 18,
            color: isDark ? 'primary.light' : 'grey.500',
            transition: 'color 0.3s ease',
          }}
        />
      )}
    </Box>
  );
};

// Default export
export default ThemeToggleButton;
