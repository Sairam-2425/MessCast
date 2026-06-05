import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, List, ListItem, ListItemAvatar, Avatar, ListItemText,
  IconButton, Tooltip, Button, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../lib/axios';
import { BASE_URL } from '../constants';

interface AdminMsg {
  _id: string;
  content: string | null;
  type: 'text' | 'file';
  fileName: string | null;
  deletedForAll: boolean;
  sender: { _id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export default function ConversationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AdminMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConv, setDeleteConv] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/conversations/${id}/messages?limit=100`)
      .then(({ data }) => setMessages(data.messages))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  async function deleteMsg() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/admin/messages/${deleteId}`);
      setMessages((prev) => prev.filter((m) => m._id !== deleteId));
      setDeleteId(null);
      toast.success('Message deleted');
    } catch { toast.error('Failed'); }
  }

  async function deleteConversation() {
    try {
      await api.delete(`/api/admin/conversations/${id}`);
      toast.success('Conversation deleted');
      navigate('/conversations');
    } catch { toast.error('Failed'); }
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/conversations')}>Back</Button>
        <Typography variant="h4" flex={1}>Conversation Messages</Typography>
        <Button variant="contained" color="error" onClick={() => setDeleteConv(true)}>Delete Conversation</Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" pt={4}><CircularProgress /></Box>
      ) : (
        <List>
          {messages.map((m) => (
            <ListItem
              key={m._id}
              divider
              secondaryAction={
                <Tooltip title="Delete"><IconButton edge="end" size="small" color="error" onClick={() => setDeleteId(m._id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              }
            >
              <ListItemAvatar>
                <Avatar src={m.sender.avatarUrl ? `${BASE_URL}${m.sender.avatarUrl}` : undefined} sx={{ bgcolor: '#7C5CFC', width: 36, height: 36 }}>
                  {m.sender.displayName[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box>
                    <Typography variant="body2" component="span" sx={{ color: '#7C5CFC', fontWeight: 600, mr: 1 }}>{m.sender.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary">{format(new Date(m.createdAt), 'MMM d, h:mm a')}</Typography>
                  </Box>
                }
                secondary={m.deletedForAll ? '🚫 Deleted' : m.type === 'file' ? `📎 ${m.fileName}` : m.content}
              />
            </ListItem>
          ))}
          {!messages.length && <Typography color="text.secondary" textAlign="center" py={4}>No messages</Typography>}
        </List>
      )}

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Delete Message</DialogTitle>
        <DialogContent><Alert severity="warning">Permanently delete this message?</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={deleteMsg} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConv} onClose={() => setDeleteConv(false)} maxWidth="xs">
        <DialogTitle>Delete Conversation</DialogTitle>
        <DialogContent><Alert severity="error">This will permanently delete the entire conversation and all messages.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConv(false)}>Cancel</Button>
          <Button onClick={deleteConversation} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
