/**
 * Main App Component
 * Root component that sets up providers and routing
 * Includes integrated dark/light theme support with MUI and Tailwind
 */
import React, { useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, ThemeProvider } from './context';
import { useTheme } from './hooks/useTheme';
import { AppRouter } from './router';
import './App.css';

/**
 * Create MUI theme with dark/light mode support
 * @param {boolean} isDark - Whether dark mode is active
 * @returns {Object} MUI theme object
 */
const createAppTheme = (isDark) => createTheme({
  palette: {
    mode: isDark ? 'dark' : 'light',
    primary: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b5cf6',
      light: '#a78bfa',
      dark: '#7c3aed',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      50: '#ecfdf5',
      100: '#d1fae5',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      100: '#fef3c7',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: '#0ea5e9',
      light: '#38bdf8',
      dark: '#0284c7',
    },
    background: {
      default: isDark ? '#0f172a' : '#f8fafc',
      paper: isDark ? '#1e293b' : '#ffffff',
    },
    grey: {
      50: isDark ? '#1e293b' : '#f8fafc',
      100: isDark ? '#334155' : '#f1f5f9',
      200: isDark ? '#475569' : '#e2e8f0',
      300: isDark ? '#64748b' : '#cbd5e1',
      400: isDark ? '#94a3b8' : '#94a3b8',
      500: isDark ? '#cbd5e1' : '#64748b',
      600: isDark ? '#e2e8f0' : '#475569',
      700: isDark ? '#f1f5f9' : '#334155',
      800: isDark ? '#f8fafc' : '#1e293b',
      900: isDark ? '#ffffff' : '#0f172a',
    },
    text: {
      primary: isDark ? '#f8fafc' : '#0f172a',
      secondary: isDark ? '#94a3b8' : '#475569',
    },
    divider: isDark ? '#334155' : '#e2e8f0',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          transition: 'background-color 0.3s ease, color 0.3s ease',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: isDark 
              ? '0 4px 14px rgba(59, 130, 246, 0.25)' 
              : '0 4px 14px rgba(59, 130, 246, 0.3)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'box-shadow 0.2s ease',
            '&.Mui-focused': {
              boxShadow: isDark 
                ? '0 0 0 3px rgba(96, 165, 250, 0.15)' 
                : '0 0 0 3px rgba(59, 130, 246, 0.1)',
            },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          transition: 'background-color 0.3s ease',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.3s ease',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: isDark ? '1px solid #334155' : 'none',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

/**
 * Toast configuration with theme-aware styling
 */
const getToastOptions = (isDark) => ({
  duration: 4000,
  position: 'top-right',
  style: {
    borderRadius: '10px',
    background: isDark ? '#1e293b' : '#333',
    color: '#fff',
    border: isDark ? '1px solid #334155' : 'none',
  },
  success: {
    iconTheme: {
      primary: '#10b981',
      secondary: '#fff',
    },
  },
  error: {
    iconTheme: {
      primary: '#ef4444',
      secondary: '#fff',
    },
  },
});

/**
 * Inner App component that uses theme context
 * Separated to allow access to theme context
 */
const AppContent = () => {
  const { isDark } = useTheme();
  
  // Memoize theme to prevent unnecessary re-renders
  const muiTheme = useMemo(() => createAppTheme(isDark), [isDark]);
  const toastOptions = useMemo(() => getToastOptions(isDark), [isDark]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster toastOptions={toastOptions} />
        </AuthProvider>
      </BrowserRouter>
    </MuiThemeProvider>
  );
};

/**
 * Main App component
 * Wraps everything in ThemeProvider first so theme context is available
 */
function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

