import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, CircularProgress, Select, MenuItem, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, TablePagination,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../lib/axios';

interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  groupName: string | null;
  members: { _id: string; displayName: string }[];
  updatedAt: string;
}

export default function Conversations() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(typeFilter && { type: typeFilter }), page: String(page + 1), limit: '20' });
      const { data } = await api.get(`/api/admin/conversations?${params}`);
      setConversations(data.conversations);
      setTotal(data.total);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [typeFilter, page]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/admin/conversations/${deleteId}`);
      setConversations((prev) => prev.filter((c) => c._id !== deleteId));
      setDeleteId(null);
      toast.success('Conversation deleted');
    } catch { toast.error('Delete failed'); }
  }

  return (
    <Box>
      <Typography variant="h4" mb={3}>Conversations</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="direct">Direct</MenuItem>
            <MenuItem value="group">Group</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? <Box display="flex" justifyContent="center" pt={4}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Name / Members</TableCell>
                <TableCell>Members</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conversations.map((c) => (
                <TableRow key={c._id} hover>
                  <TableCell><Chip label={c.type} size="small" color={c.type === 'group' ? 'primary' : 'secondary'} /></TableCell>
                  <TableCell>
                    {c.type === 'group' ? c.groupName : c.members.map((m) => m.displayName).join(' & ')}
                  </TableCell>
                  <TableCell>{c.members.length}</TableCell>
                  <TableCell>{format(new Date(c.updatedAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Tooltip title="View"><IconButton size="small" onClick={() => navigate(`/conversations/${c._id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(c._id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            rowsPerPage={20}
            rowsPerPageOptions={[20]}
            page={page}
            onPageChange={(_, p) => setPage(p)}
          />
        </TableContainer>
      )}

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Delete Conversation</DialogTitle>
        <DialogContent><Alert severity="error">This will permanently delete the conversation and all messages.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
