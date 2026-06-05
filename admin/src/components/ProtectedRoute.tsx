import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminAuthStore';

interface Props { children: React.ReactNode; }

export function ProtectedRoute({ children }: Props) {
  const user = useAdminAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
