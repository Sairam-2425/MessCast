import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Avatar, Chip, Button, Alert,
  CircularProgress, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../lib/axios';
import { BASE_URL } from '../constants';

interface Detail {
  user: { _id: string; displayName: string; email: string; avatarUrl: string | null; role: 'user' | 'admin'; isBanned: boolean; isOnline: boolean; lastSeen: string | null; createdAt: string; };
  msgCount: number;
  fileCount: number;
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<'ban' | 'role' | 'delete' | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/users/${id}`)
      .then(({ data }) => setDetail(data))
      .catch(() => toast.error('Failed to load user'))
      .finally(() => setLoading(false));
  }, [id]);

  async function performAction(action: 'ban' | 'role' | 'delete') {
    if (!detail) return;
    setActing(true);
    try {
      if (action === 'ban') {
        await api.patch(`/api/admin/users/${id}/ban`);
        const { data } = await api.get(`/api/admin/users/${id}`);
        setDetail(data);
        toast.success(detail.user.isBanned ? 'User unbanned' : 'User banned');
      } else if (action === 'role') {
        await api.patch(`/api/admin/users/${id}/role`, { role: detail.user.role === 'admin' ? 'user' : 'admin' });
        const { data } = await api.get(`/api/admin/users/${id}`);
        setDetail(data);
        toast.success('Role updated');
      } else {
        await api.delete(`/api/admin/users/${id}`);
        toast.success('User deleted');
        navigate('/users');
      }
    } catch { toast.error('Action failed'); } finally { setActing(false); setConfirm(null); }
  }

  if (loading) return <Box display="flex" justifyContent="center" pt={8}><CircularProgress /></Box>;
  if (!detail) return <Alert severity="error">User not found</Alert>;

  const { user } = detail;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/users')} sx={{ mb: 2 }}>Back</Button>
      <Typography variant="h4" mb={3}>User Detail</Typography>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                src={user.avatarUrl ? `${BASE_URL}${user.avatarUrl}` : undefined}
                sx={{ width: 80, height: 80, bgcolor: '#7C5CFC', fontSize: 28, mx: 'auto', mb: 2 }}
              >
                {user.displayName[0]}
              </Avatar>
              <Typography variant="h6" mb={0.5}>{user.displayName}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>{user.email}</Typography>
              <Box display="flex" justifyContent="center" gap={1}>
                <Chip label={user.role} size="small" color={user.role === 'admin' ? 'primary' : 'default'} />
                {user.isBanned && <Chip label="Banned" size="small" color="error" />}
                <Chip label={user.isOnline ? 'Online' : 'Offline'} size="small" color={user.isOnline ? 'success' : 'default'} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" mb={2}>Account Info</Typography>
              {[
                ['Joined', format(new Date(user.createdAt), 'MMM d, yyyy')],
                ['Messages Sent', detail.msgCount],
                ['Files Sent', detail.fileCount],
                ['Last Seen', user.lastSeen ? format(new Date(user.lastSeen), 'MMM d, h:mm a') : 'Never'],
              ].map(([label, val]) => (
                <Box key={label as string} display="flex" justifyContent="space-between" py={0.5} borderBottom="1px solid rgba(255,255,255,0.05)">
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2">{val}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>Actions</Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Button variant="outlined" color={user.isBanned ? 'success' : 'error'} onClick={() => setConfirm('ban')}>
              {user.isBanned ? 'Unban User' : 'Ban User'}
            </Button>
            <Button variant="outlined" onClick={() => setConfirm('role')}>
              {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
            </Button>
            <Button variant="contained" color="error" onClick={() => setConfirm('delete')}>Delete Account</Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs">
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent><Alert severity="warning">Are you sure you want to proceed?</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button onClick={() => confirm && performAction(confirm)} color="error" variant="contained" disabled={acting}>
            {acting ? <CircularProgress size={18} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
