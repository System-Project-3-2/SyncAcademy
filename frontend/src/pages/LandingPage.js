/**
 * Landing Page Component
 * Professional, modern, student-friendly landing page
 * Fully responsive with dark/light theme support
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Paper,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  useMediaQuery,
  alpha,
  Divider,
} from '@mui/material';
import {
  School as SchoolIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Analytics as AnalyticsIcon,
  SmartToy as SmartToyIcon,
  Security as SecurityIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckIcon,
  PersonAdd as PersonAddIcon,
  Login as LoginIcon,
  School,
  Work,
  AdminPanelSettings,
  AutoAwesome,
  SupportAgent,
  Forum,
  LibraryBooks,
  AppRegistration as EnrollmentIcon,
} from '@mui/icons-material';
import { useTheme as useAppTheme } from '../hooks/useTheme';
import { ThemeToggleButton } from '../components/common/ThemeToggle';
import { statsService } from '../services';

// ══════════════════════════════════════════════════════════════════════
// HEADER / NAVIGATION
// ══════════════════════════════════════════════════════════════════════
const Header = () => {
  const { isDark } = useAppTheme();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Benefits', href: '#benefits' },
  ];

  const scrollToSection = (href) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileOpen(false);
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        backdropFilter: 'blur(12px)',
        bgcolor: isDark ? alpha('#0f172a', 0.9) : alpha('#ffffff', 0.9),
        borderBottom: '1px solid',
        borderColor: isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.08),
        transition: 'all 0.3s ease',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1900, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.5,
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                color: 'white',
              }}
            >
              <SchoolIcon sx={{ fontSize: 24 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: isDark
                  ? 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)'
                  : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SyncAcademy
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {navLinks.map((link) => (
                <Button
                  key={link.label}
                  onClick={() => scrollToSection(link.href)}
                  sx={{
                    color: 'text.primary',
                    fontWeight: 500,
                    px: 2,
                    '&:hover': {
                      bgcolor: isDark ? alpha('#ffffff', 0.05) : alpha('#000000', 0.05),
                    },
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ThemeToggleButton size="small" />
            
            {!isMobile && (
              <>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  sx={{
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  Login
                </Button>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  sx={{
                    fontWeight: 600,
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
                    },
                  }}
                >
                  Register
                </Button>
              </>
            )}

            {isMobile && (
              <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{ color: 'text.primary' }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </Container>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: 'background.paper',
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Menu</Typography>
          <IconButton onClick={() => setMobileOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List>
          {navLinks.map((link) => (
            <ListItem key={link.label} disablePadding>
              <ListItemButton onClick={() => scrollToSection(link.href)}>
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            fullWidth
            startIcon={<LoginIcon />}
          >
            Login
          </Button>
          <Button
            component={RouterLink}
            to="/register"
            variant="contained"
            fullWidth
            startIcon={<PersonAddIcon />}
          >
            Register
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// HERO SECTION
// ══════════════════════════════════════════════════════════════════════
const HeroSection = ({ heroStats }) => {
  const { isDark } = useAppTheme();
  const theme = useTheme();

  const statItems = useMemo(
    () => [
      { value: heroStats.materials.toLocaleString(), label: 'Study Materials' },
      { value: heroStats.students.toLocaleString(), label: 'Students' },
      { value: heroStats.teachers.toLocaleString(), label: 'Teachers' },
    ],
    [heroStats]
  );

  return (
    <Box
      id="home"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        pt: { xs: 10, md: 8 },
        pb: { xs: 8, md: 10 },
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)'
          : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorations */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          right: '-5%',
          width: { xs: 200, md: 400 },
          height: { xs: 200, md: 400 },
          borderRadius: '50%',
          background: alpha('#ffffff', 0.05),
          filter: 'blur(60px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '10%',
          left: '-5%',
          width: { xs: 150, md: 300 },
          height: { xs: 150, md: 300 },
          borderRadius: '50%',
          background: alpha('#8b5cf6', 0.1),
          filter: 'blur(60px)',
        }}
      />

      <Container maxWidth={false} sx={{ maxWidth: 1920, mx: 'auto' }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ color: 'white' }}>
              <Typography
                variant="overline"
                sx={{
                  display: 'inline-block',
                  px: 2,
                  py: 0.5,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: alpha('#ffffff', 0.15),
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
              >
                🎓 Academic Excellence Platform
              </Typography>

              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                  lineHeight: 1.1,
                  mb: 2,
                  letterSpacing: '-0.02em',
                }}
              >
                Empower Your
                <br />
                <Box
                  component="span"
                  sx={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Academic Journey
                </Box>
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 400,
                  mb: 4,
                  opacity: 0.9,
                  lineHeight: 1.6,
                  maxWidth: 500,
                }}
              >
                A comprehensive platform connecting students, teachers, and administrators.
                Use RAG-powered tutoring, AI quiz generation, enrollment workflows, and actionable analytics.
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.dark',
                    fontWeight: 700,
                    px: 4,
                    py: 1.5,
                    '&:hover': {
                      bgcolor: alpha('#ffffff', 0.9),
                      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                    },
                  }}
                >
                  Get Started Free
                </Button>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    '&:hover': {
                      bgcolor: alpha('#ffffff', 0.1),
                      borderColor: 'white',
                    },
                  }}
                >
                  Sign In
                </Button>
              </Box>

              {/* Stats */}
              <Box sx={{ display: 'flex', gap: 4, mt: 5, flexWrap: 'wrap' }}>
                {statItems.map((stat) => (
                  <Box key={stat.label}>
                    <Typography variant="h4" fontWeight={800}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              {/* Illustration placeholder - Academic themed cards */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 450,
                }}
              >
                {/* Main card */}
                <Paper
                  elevation={20}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor: isDark ? '#1e293b' : 'white',
                    transform: 'rotate(-2deg)',
                    transition: 'transform 0.3s ease',
                    '&:hover': { transform: 'rotate(0deg) scale(1.02)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <LibraryBooks />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={700} color="text.primary">
                        Course Materials
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Access anywhere, anytime
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['PDF', 'DOCX', 'PPTX'].map((type) => (
                      <Box
                        key={type}
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {type}
                      </Box>
                    ))}
                  </Box>
                </Paper>

                {/* Floating card 1 */}
                <Paper
                  elevation={10}
                  sx={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: isDark ? '#1e293b' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <CheckIcon fontSize="small" />
                  </Box>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    Smart Search
                  </Typography>
                </Paper>

                {/* Floating card 2 */}
                <Paper
                  elevation={10}
                  sx={{
                    position: 'absolute',
                    bottom: -10,
                    left: -20,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: isDark ? '#1e293b' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: 'secondary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <Forum fontSize="small" />
                  </Box>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    Instant Feedback
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// FEATURES SECTION
// ══════════════════════════════════════════════════════════════════════
const FeaturesSection = () => {
  const { isDark } = useAppTheme();

  const features = [
    {
      icon: <SmartToyIcon sx={{ fontSize: 32 }} />,
      title: 'RAG Tutor Chatbot',
      description: 'Ask questions and get contextual answers grounded in your uploaded course materials.',
      color: '#3b82f6',
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 32 }} />,
      title: 'Spider Chart Analytics',
      description: 'Track quiz and assignment performance using visual spider-chart analytics in dashboards.',
      color: '#8b5cf6',
    },
    {
      icon: <AutoAwesome sx={{ fontSize: 32 }} />,
      title: 'AI Quiz Generator',
      description: 'Generate high-quality quiz questions from your course content to accelerate assessment creation.',
      color: '#10b981',
    },
    {
      icon: <EnrollmentIcon sx={{ fontSize: 32 }} />,
      title: 'Course Enrollment',
      description: 'Students can join courses with enrollment flows while teachers manage rosters efficiently.',
      color: '#f59e0b',
    },
    {
      icon: <SearchIcon sx={{ fontSize: 32 }} />,
      title: 'Semantic Search',
      description: 'Find precise study resources with AI-powered semantic retrieval across all materials.',
      color: '#ef4444',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 32 }} />,
      title: 'Secure Access',
      description: 'Protected authentication with role-based permissions and data security.',
      color: '#06b6d4',
    },
  ];

  return (
    <Box
      id="features"
      sx={{
        py: { xs: 8, md: 12 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1920, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            Features
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              mb: 2,
              color: 'text.primary',
            }}
          >
            Everything You Need
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              fontWeight: 400,
            }}
          >
            Powerful tools designed to enhance your academic experience and streamline collaboration.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={feature.title}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: isDark
                      ? `0 20px 40px ${alpha('#000', 0.3)}`
                      : `0 20px 40px ${alpha('#000', 0.1)}`,
                    borderColor: feature.color,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: alpha(feature.color, 0.1),
                    color: feature.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom color="text.primary">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// HOW IT WORKS SECTION
// ══════════════════════════════════════════════════════════════════════
const HowItWorksSection = () => {
  const { isDark } = useAppTheme();

  const roles = [
    {
      role: 'Students',
      icon: <School sx={{ fontSize: 40 }} />,
      color: '#3b82f6',
      steps: [
        'Register with your academic email',
        'Enroll in your courses',
        'Learn with RAG tutor and semantic material search',
        'Track progress with dashboard analytics',
      ],
    },
    {
      role: 'Teachers',
      icon: <Work sx={{ fontSize: 40 }} />,
      color: '#8b5cf6',
      steps: [
        'Create your teacher account',
        'Upload course materials (PDF, DOCX, PPTX)',
        'Generate assessments with AI quiz generator',
        'Monitor class analytics and learning trends',
      ],
    },
    {
      role: 'Administrators',
      icon: <AdminPanelSettings sx={{ fontSize: 40 }} />,
      color: '#ef4444',
      steps: [
        'Manage all users and roles',
        'Oversee courses and enrollments',
        'Maintain platform-wide materials and communication',
        'Review system-wide analytics and activity',
      ],
    },
  ];

  return (
    <Box
      id="how-it-works"
      sx={{
        py: { xs: 8, md: 12 },
        bgcolor: isDark ? alpha('#1e293b', 0.5) : alpha('#f1f5f9', 0.5),
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1920, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'secondary.main',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            How It Works
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              mb: 2,
              color: 'text.primary',
            }}
          >
            Simple for Everyone
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              fontWeight: 400,
            }}
          >
            Clear workflows designed for each role in the academic ecosystem.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {roles.map((item) => (
            <Grid item xs={12} md={4} key={item.role}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: item.color,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 3,
                    bgcolor: alpha(item.color, 0.1),
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="h5" fontWeight={700} gutterBottom color="text.primary">
                  {item.role}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {item.steps.map((step, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        mb: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          bgcolor: alpha(item.color, 0.1),
                          color: item.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {step}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// BENEFITS SECTION
// ══════════════════════════════════════════════════════════════════════
const BenefitsSection = () => {
  const { isDark } = useAppTheme();
  const theme = useTheme();

  const benefits = [
    {
      icon: <SupportAgent />,
      title: 'Contextual AI Help',
      description: 'RAG chatbot responses stay aligned with actual course materials.',
    },
    {
      icon: <AnalyticsIcon />,
      title: 'Clear Performance Insights',
      description: 'Spider-chart dashboards make strengths and gaps immediately visible.',
    },
    {
      icon: <AutoAwesome />,
      title: 'Faster Assessment Creation',
      description: 'AI quiz generation reduces manual preparation workload for teachers.',
    },
    {
      icon: <EnrollmentIcon />,
      title: 'Smooth Course Participation',
      description: 'Enrollment and course access flows keep learning organized from day one.',
    },
  ];

  return (
    <Box
      id="benefits"
      sx={{
        py: { xs: 8, md: 12 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1920, mx: 'auto' }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={5}>
            <Typography
              variant="overline"
              sx={{
                color: 'success.main',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              Benefits
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                mb: 2,
                color: 'text.primary',
              }}
            >
              Why Students Love Us
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                mb: 4,
                lineHeight: 1.8,
              }}
            >
              SyncAcademy transforms how you access academic resources and communicate with educators. 
              Experience a streamlined, modern approach to academic support.
            </Typography>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ fontWeight: 600 }}
            >
              Join Now
            </Button>
          </Grid>

          <Grid item xs={12} md={7}>
            <Grid container spacing={2}>
              {benefits.map((benefit, index) => (
                <Grid item xs={12} sm={6} key={benefit.title}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: isDark ? alpha('#1e293b', 0.5) : alpha('#f8fafc', 1),
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      gap: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {benefit.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                        {benefit.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {benefit.description}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// CTA SECTION
// ══════════════════════════════════════════════════════════════════════
const CTASection = () => {
  const { isDark } = useAppTheme();

  return (
    <Box
      sx={{
        py: { xs: 8, md: 10 },
        background: isDark
          ? 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)'
          : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <Box
        sx={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: alpha('#ffffff', 0.05),
        }}
      />

      <Container maxWidth={false} sx={{ maxWidth: 1920, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', color: 'white', position: 'relative' }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              mb: 2,
              fontSize: { xs: '2rem', md: '2.75rem' },
            }}
          >
            Ready to Excel in Your Studies?
          </Typography>
          <Typography
            variant="h6"
            sx={{
              mb: 4,
              opacity: 0.9,
              fontWeight: 400,
              maxWidth: 500,
              mx: 'auto',
            }}
          >
            Join thousands of students and educators already using SyncAcademy.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                bgcolor: 'white',
                color: 'primary.dark',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                '&:hover': {
                  bgcolor: alpha('#ffffff', 0.9),
                },
              }}
            >
              Create Free Account
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'white',
                color: 'white',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                '&:hover': {
                  bgcolor: alpha('#ffffff', 0.1),
                  borderColor: 'white',
                },
              }}
            >
              Sign In
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// FOOTER
// ══════════════════════════════════════════════════════════════════════
const Footer = () => {
  const { isDark } = useAppTheme();

  return (
    <Box
      component="footer"
      sx={{
        py: 4,
        bgcolor: isDark ? '#0f172a' : '#1e293b',
        color: 'white',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1920, mx: 'auto' }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SchoolIcon />
              <Typography variant="h6" fontWeight={700}>
                SyncAcademy
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Empowering academic excellence through technology.
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'center' }, gap: 3 }}>
              {['About', 'Privacy', 'Terms'].map((link) => (
                <Typography
                  key={link}
                  variant="body2"
                  sx={{
                    cursor: 'pointer',
                    opacity: 0.7,
                    '&:hover': { opacity: 1 },
                    transition: 'opacity 0.2s',
                  }}
                >
                  {link}
                </Typography>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography
              variant="body2"
              sx={{
                opacity: 0.7,
                textAlign: { xs: 'left', md: 'right' },
              }}
            >
              © {new Date().getFullYear()} SyncAcademy. All rights reserved.
            </Typography>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════════════
// MAIN LANDING PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════
const LandingPage = () => {
  const [heroStats, setHeroStats] = useState({
    materials: 0,
    students: 0,
    teachers: 0,
  });

  useEffect(() => {
    const fetchLandingStats = async () => {
      try {
        const data = await statsService.getPublicLandingStats();
        setHeroStats({
          materials: Number(data.materials) || 0,
          students: Number(data.students) || 0,
          teachers: Number(data.teachers) || 0,
        });
      } catch (error) {
        console.warn('Failed to load public landing stats:', error?.message || error);
      }
    };

    fetchLandingStats();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <HeroSection heroStats={heroStats} />
      <FeaturesSection />
      <HowItWorksSection />
      <BenefitsSection />
      <CTASection />
      <Footer />
    </Box>
  );
};

export default LandingPage;
