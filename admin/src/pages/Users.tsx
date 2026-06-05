import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Avatar, IconButton, Tooltip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import api from '../lib/axios';
import { BASE_URL } from '../constants';

interface AdminUser {
  _id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  isBanned: boolean;
  createdAt: string;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [bannedFilter, setBannedFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        ...(roleFilter && { role: roleFilter }),
        ...(bannedFilter && { isBanned: bannedFilter }),
        page: String(page + 1),
        limit: '20',
      });
      const { data } = await api.get(`/api/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [search, roleFilter, bannedFilter, page]);

  async function toggleBan(id: string, isBanned: boolean) {
    try {
      await api.patch(`/api/admin/users/${id}/ban`);
      setUsers((prev) => prev.map((u) => u._id === id ? { ...u, isBanned: !isBanned } : u));
      toast.success(isBanned ? 'User unbanned' : 'User banned');
    } catch { toast.error('Action failed'); }
  }

  async function handleEdit() {
    if (!editUser) return;
    setEditLoading(true);
    try {
      await api.patch(`/api/admin/users/${editUser._id}`, { displayName: editName, email: editEmail });
      setUsers((prev) => prev.map((u) => u._id === editUser._id ? { ...u, displayName: editName, email: editEmail } : u));
      setEditUser(null);
      toast.success('User updated');
    } catch { toast.error('Update failed'); } finally { setEditLoading(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/admin/users/${deleteId}`);
      setUsers((prev) => prev.filter((u) => u._id !== deleteId));
      setDeleteId(null);
      toast.success('User deleted');
    } catch { toast.error('Delete failed'); }
  }

  const columns: GridColDef[] = [
    {
      field: 'avatar',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: (p: GridRenderCellParams<AdminUser>) => (
        <Avatar src={p.row.avatarUrl ? `${BASE_URL}${p.row.avatarUrl}` : undefined} sx={{ width: 32, height: 32, bgcolor: '#7C5CFC' }}>
          {p.row.displayName[0]}
        </Avatar>
      ),
    },
    { field: 'displayName', headerName: 'Name', flex: 1, renderCell: (p) => <span style={{ cursor: 'pointer', color: '#7C5CFC' }} onClick={() => navigate(`/users/${p.row._id}`)}>{p.value}</span> },
    { field: 'email', headerName: 'Email', flex: 1.5 },
    {
      field: 'role',
      headerName: 'Role',
      width: 100,
      renderCell: (p) => <Chip label={p.value} size="small" color={p.value === 'admin' ? 'primary' : 'default'} />,
    },
    {
      field: 'isBanned',
      headerName: 'Status',
      width: 100,
      renderCell: (p) => p.value ? <Chip label="Banned" size="small" color="error" /> : <Chip label="Active" size="small" color="success" />,
    },
    { field: 'createdAt', headerName: 'Joined', width: 120, renderCell: (p) => format(new Date(p.value), 'MMM d, yyyy') },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      sortable: false,
      renderCell: (p: GridRenderCellParams<AdminUser>) => (
        <Box>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditUser(p.row); setEditName(p.row.displayName); setEditEmail(p.row.email); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={p.row.isBanned ? 'Unban' : 'Ban'}><IconButton size="small" onClick={() => toggleBan(p.row._id, p.row.isBanned)} color={p.row.isBanned ? 'success' : 'error'}>{p.row.isBanned ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}</IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(p.row._id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" mb={3}>Users</Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField label="Search" size="small" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 220 }} />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Role</InputLabel>
          <Select value={roleFilter} label="Role" onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={bannedFilter} label="Status" onChange={(e) => setBannedFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="false">Active</MenuItem>
            <MenuItem value="true">Banned</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <DataGrid
        rows={users}
        columns={columns}
        getRowId={(r) => r._id}
        rowCount={total}
        paginationMode="server"
        paginationModel={{ page, pageSize: 20 }}
        onPaginationModelChange={({ page: p }) => setPage(p)}
        loading={loading}
        autoHeight
        sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
      />

      {/* Edit dialog */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Display Name" value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth />
          <TextField label="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" disabled={editLoading}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent><Alert severity="error">This will permanently delete the user and all their data.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
