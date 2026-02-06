/**
 * Theme Context
 * Provides global theme management with localStorage persistence
 * Supports system preference detection and smooth transitions
 */
import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';

// Theme mode constants
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// Local storage key for theme persistence
const THEME_STORAGE_KEY = 'student-aid-theme';

// Create the context
export const ThemeContext = createContext({
  mode: THEME_MODES.LIGHT,
  isDark: false,
  toggleTheme: () => {},
  setMode: () => {},
  systemPreference: THEME_MODES.LIGHT,
});

/**
 * Get the system's color scheme preference
 * @returns {string} 'dark' or 'light'
 */
const getSystemPreference = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;
  }
  return THEME_MODES.LIGHT;
};

/**
 * Get stored theme from localStorage
 * @returns {string|null} Stored theme mode or null
 */
const getStoredTheme = () => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to read theme from localStorage:', error);
      return null;
    }
  }
  return null;
};

/**
 * Store theme in localStorage
 * @param {string} theme - Theme mode to store
 */
const storeTheme = (theme) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Failed to store theme in localStorage:', error);
    }
  }
};

/**
 * Theme Provider Component
 * Wraps the application and provides theme context to all children
 */
export const ThemeProvider = ({ children }) => {
  // Track system preference
  const [systemPreference, setSystemPreference] = useState(getSystemPreference);
  
  // Initialize mode from localStorage or default to system
  const [mode, setModeState] = useState(() => {
    const stored = getStoredTheme();
    return stored || THEME_MODES.SYSTEM;
  });

  // Calculate if dark mode is active based on mode and system preference
  const isDark = useMemo(() => {
    if (mode === THEME_MODES.SYSTEM) {
      return systemPreference === THEME_MODES.DARK;
    }
    return mode === THEME_MODES.DARK;
  }, [mode, systemPreference]);

  /**
   * Set the theme mode and persist to localStorage
   */
  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    storeTheme(newMode);
  }, []);

  /**
   * Toggle between light and dark modes
   * If currently on system, switches to opposite of system preference
   */
  const toggleTheme = useCallback(() => {
    setMode(isDark ? THEME_MODES.LIGHT : THEME_MODES.DARK);
  }, [isDark, setMode]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      setSystemPreference(e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  // Apply theme class to document root for Tailwind CSS
  useEffect(() => {
    const root = document.documentElement;
    
    // Add transition class for smooth theme switching
    root.classList.add('theme-transition');
    
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // Remove transition class after animation completes
    const timeout = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);

    return () => clearTimeout(timeout);
  }, [isDark]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      mode,
      isDark,
      toggleTheme,
      setMode,
      systemPreference,
    }),
    [mode, isDark, toggleTheme, setMode, systemPreference]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
