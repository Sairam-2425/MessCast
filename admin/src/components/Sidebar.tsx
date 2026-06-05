import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Avatar,
  Divider,
  Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAdminAuthStore } from '../store/adminAuthStore';

interface SidebarProps { width: number; }

const NAV_ITEMS = [
  { label: 'Dashboard',      path: '/',               icon: <DashboardIcon /> },
  { label: 'Users',          path: '/users',          icon: <PeopleIcon /> },
  { label: 'Conversations',  path: '/conversations',  icon: <ChatIcon /> },
  { label: 'Files',          path: '/files',          icon: <FolderIcon /> },
  { label: 'Settings',       path: '/settings',       icon: <SettingsIcon /> },
];

export function Sidebar({ width }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAdminAuthStore();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography
          variant="h5"
          sx={{
            color: 'primary.main',
            letterSpacing: 3,
            fontWeight: 800,
            textShadow: '0 0 20px rgba(124,92,252,0.5)',
          }}
        >
          MESSCAST
        </Typography>
        <Typography variant="caption" color="text.secondary">Admin Panel</Typography>
      </Box>

      <Divider />

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1, py: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItemButton
              key={item.path}
              onClick={() => navigate(item.path)}
              selected={active}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'rgba(124,92,252,0.15)',
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: active ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {/* User profile */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 14 }}>
          {user?.displayName[0].toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap fontWeight={600}>{user?.displayName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography>
        </Box>
        <Tooltip title="Logout">
          <ListItemButton onClick={logout} sx={{ borderRadius: 2, p: 0.5, minWidth: 0 }}>
            <LogoutIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </ListItemButton>
        </Tooltip>
      </Box>
    </Drawer>
  );
}
