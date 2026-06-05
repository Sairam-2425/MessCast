import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAdminAuthStore } from './store/adminAuthStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Conversations from './pages/Conversations';
import ConversationDetail from './pages/ConversationDetail';
import Files from './pages/Files';
import Settings from './pages/Settings';

const DRAWER_WIDTH = 240;

export default function App() {
  const { hydrate, user } = useAdminAuthStore();

  useEffect(() => { hydrate(); }, []);

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <Sidebar width={DRAWER_WIDTH} />
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  ml: `${DRAWER_WIDTH}px`,
                  p: 3,
                  bgcolor: 'background.default',
                  minHeight: '100vh',
                }}
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                  <Route path="/conversations" element={<Conversations />} />
                  <Route path="/conversations/:id" element={<ConversationDetail />} />
                  <Route path="/files" element={<Files />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Box>
            </Box>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
