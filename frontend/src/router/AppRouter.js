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
import AITutor from '../pages/shared/AITutor';
import CourseStream from '../pages/shared/CourseStream';
import CourseAssignments from '../pages/shared/CourseAssignments';
import {
  StudentDashboard,
  SearchMaterials,
  SubmitFeedback,
  MyFeedbacks,
  MyCourses,
  AssignmentSubmit,
  MyGrades,
} from '../pages/student';

// Teacher Pages
import {
  TeacherDashboard,
  UploadMaterial,
  TeacherFeedbacks,
  CourseStudents,
  AssignmentDetail,
} from '../pages/teacher';

// Admin Pages
import {
  AdminDashboard,
  UserManagement,
  AdminFeedbacks,
  CourseManagement,
} from '../pages/admin';

// Landing Page
import LandingPage from '../pages/LandingPage';

// Other Pages
import NotFound from '../pages/NotFound';

// Shared Search component that can be reused
const SharedSearchMaterials = SearchMaterials;

const AppRouter = () => {
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />

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
        <Route path="my-courses" element={<MyCourses />} />
        <Route path="materials" element={<Materials />} />
        <Route path="search" element={<SharedSearchMaterials />} />
        <Route path="profile" element={<Profile />} />
        <Route path="ai-tutor" element={<AITutor />} />
        <Route path="feedback/new" element={<SubmitFeedback />} />
        <Route path="feedbacks" element={<MyFeedbacks />} />
        <Route path="my-grades" element={<MyGrades />} />
        <Route path="courses/:courseId/stream" element={<CourseStream />} />
        <Route path="courses/:courseId/assignments" element={<CourseAssignments />} />
        <Route path="courses/:courseId/assignments/:assignmentId/submit" element={<AssignmentSubmit />} />
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
        <Route path="ai-tutor" element={<AITutor />} />
        <Route path="materials/upload" element={<UploadMaterial />} />
        <Route path="courses" element={<CourseManagement />} />
        <Route path="courses/:courseId/students" element={<CourseStudents />} />
        <Route path="courses/:courseId/stream" element={<CourseStream />} />
        <Route path="courses/:courseId/assignments" element={<CourseAssignments />} />
        <Route path="courses/:courseId/assignments/:assignmentId" element={<AssignmentDetail />} />
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
        <Route path="courses" element={<CourseManagement />} />
        <Route path="courses/:courseId/students" element={<CourseStudents />} />
        <Route path="courses/:courseId/stream" element={<CourseStream />} />
        <Route path="courses/:courseId/assignments" element={<CourseAssignments />} />
        <Route path="courses/:courseId/assignments/:assignmentId" element={<AssignmentDetail />} />
        <Route path="materials/upload" element={<UploadMaterial />} />
        <Route path="search" element={<SharedSearchMaterials />} />
        <Route path="profile" element={<Profile />} />
        <Route path="ai-tutor" element={<AITutor />} />
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
