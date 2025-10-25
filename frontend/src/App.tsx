import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallBanner from './components/PWAInstallBanner';
import OfflineIndicator from './components/OfflineIndicator';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddWorkout from './pages/AddWorkout';
import WorkoutDetail from './pages/WorkoutDetail';
import Photos from './pages/Photos';
import Coach from './pages/Coach';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
};

// Public Route component (redirect to dashboard if logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" /> : <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
          
          {/* PWA Components */}
          <OfflineIndicator />
          <PWAInstallBanner />
          
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/add-workout" element={
              <ProtectedRoute>
                <Layout>
                  <AddWorkout />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/workout/:id" element={
              <ProtectedRoute>
                <Layout>
                  <WorkoutDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/photos" element={
              <ProtectedRoute>
                <Layout>
                  <Photos />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/coach" element={
              <ProtectedRoute>
                <Layout>
                  <Coach />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
