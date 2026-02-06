/**
 * useTheme Hook
 * Custom hook for accessing theme context with convenience methods
 */
import { useContext, useMemo } from 'react';
import { ThemeContext, THEME_MODES } from '../context/ThemeContext';

/**
 * Hook to access theme context
 * @returns {Object} Theme context with mode, isDark, toggleTheme, setMode
 * @throws {Error} If used outside ThemeProvider
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

/**
 * Hook to get theme-aware class names
 * @returns {Function} Function that returns appropriate class based on theme
 */
export const useThemeClasses = () => {
  const { isDark } = useTheme();

  /**
   * Returns the appropriate class string based on current theme
   * @param {string} lightClass - Classes for light mode
   * @param {string} darkClass - Classes for dark mode
   * @returns {string} The appropriate class string
   */
  const getThemeClass = useMemo(
    () => (lightClass, darkClass) => {
      return isDark ? darkClass : lightClass;
    },
    [isDark]
  );

  return getThemeClass;
};

/**
 * Hook to get theme-aware values
 * @returns {Function} Function that returns appropriate value based on theme
 */
export const useThemeValue = () => {
  const { isDark } = useTheme();

  /**
   * Returns the appropriate value based on current theme
   * @param {any} lightValue - Value for light mode
   * @param {any} darkValue - Value for dark mode
   * @returns {any} The appropriate value
   */
  const getThemeValue = useMemo(
    () => (lightValue, darkValue) => {
      return isDark ? darkValue : lightValue;
    },
    [isDark]
  );

  return getThemeValue;
};

export { THEME_MODES };
export default useTheme;
