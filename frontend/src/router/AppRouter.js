/**
 * App Router Configuration
 * Defines all application routes with role-based protection
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components';
import { DashboardLayout } from '../layouts';

// Auth Pages
import { Login, Register, ForgotPassword, ResetPassword } from '../pages/auth';

//Shared Pages
import Materials from '../pages/shared/Materials';
import Profile from '../pages/shared/Profile';
import {
  StudentDashboard,
  SearchMaterials,
  SubmitFeedback,
  MyFeedbacks,
} from '../pages/student';

// Teacher Pages
import {
  TeacherDashboard,
  UploadMaterial,
  TeacherFeedbacks,
} from '../pages/teacher';

// Admin Pages
import {
  AdminDashboard,
  UserManagement,
  AdminFeedbacks,
} from '../pages/admin';

// Other Pages
import NotFound from '../pages/NotFound';

// Shared Search component that can be reused
const SharedSearchMaterials = SearchMaterials;

const AppRouter = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="materials" element={<Materials />} />
        <Route path="search" element={<SharedSearchMaterials />} />
        <Route path="profile" element={<Profile />} />
        <Route path="feedback/new" element={<SubmitFeedback />} />
        <Route path="feedbacks" element={<MyFeedbacks />} />
      </Route>

      {/* Teacher Routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/teacher/dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="materials" element={<Materials />} />
        <Route path="profile" element={<Profile />} />
        <Route path="materials/upload" element={<UploadMaterial />} />
        <Route path="feedbacks" element={<TeacherFeedbacks />} />
        <Route path="search" element={<SharedSearchMaterials />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="materials" element={<Materials />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="feedbacks" element={<AdminFeedbacks />} />
        <Route path="materials/upload" element={<UploadMaterial />} />
        <Route path="search" element={<SharedSearchMaterials />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Root redirect - redirect to login or appropriate dashboard */}
      <Route path="/" element={<RootRedirect />} />

      {/* 404 - Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

/**
 * Root Redirect Component
 * Redirects to appropriate dashboard based on user role or login page
 */
const RootRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  if (user && token) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return <Navigate to="/login" replace />;
};

export default AppRouter;
