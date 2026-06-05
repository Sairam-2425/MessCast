import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, LinearProgress, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert,
  TablePagination, CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../lib/axios';
import { BASE_URL } from '../constants';

interface FileItem {
  _id: string;
  fileName: string;
  fileSize: number | null;
  fileMimeType: string;
  fileUrl: string;
  sender: { _id: string; displayName: string };
  createdAt: string;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image')) return <ImageIcon fontSize="small" sx={{ color: '#7C5CFC' }} />;
  if (mime.startsWith('video')) return <VideoFileIcon fontSize="small" sx={{ color: '#00D4FF' }} />;
  if (mime.startsWith('audio')) return <AudioFileIcon fontSize="small" sx={{ color: '#00E5A0' }} />;
  if (mime.includes('pdf')) return <PictureAsPdfIcon fontSize="small" sx={{ color: '#FF4D6A' }} />;
  return <InsertDriveFileIcon fontSize="small" sx={{ color: '#FFB547' }} />;
}

function formatBytes(b: number | null): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Files() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [storageUsedMB, setStorageUsedMB] = useState(0);
  const [storageAlertMB] = useState(500);
  const [fileType, setFileType] = useState('');
  const [uploader, setUploader] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(fileType && { fileType }),
        ...(uploader && { uploader }),
        page: String(page + 1),
        limit: '20',
      });
      const [filesRes, statsRes] = await Promise.all([
        api.get(`/api/admin/files?${params}`),
        api.get('/api/admin/stats'),
      ]);
      setFiles(filesRes.data.files);
      setTotal(filesRes.data.total);
      setStorageUsedMB(statsRes.data.storageUsedMB);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [fileType, uploader, page]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/admin/files/${deleteId}`);
      setFiles((prev) => prev.filter((f) => f._id !== deleteId));
      setDeleteId(null);
      toast.success('File deleted');
    } catch { toast.error('Delete failed'); }
  }

  const storagePct = Math.min((storageUsedMB / storageAlertMB) * 100, 100);

  return (
    <Box>
      <Typography variant="h4" mb={3}>Files</Typography>

      {/* Storage meter */}
      <Box mb={3} p={2} sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="body2">Storage Used</Typography>
          <Typography variant="body2" color={storagePct > 80 ? 'error.main' : 'text.secondary'}>
            {storageUsedMB.toFixed(1)} MB / {storageAlertMB} MB ({storagePct.toFixed(0)}%)
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={storagePct}
          sx={{
            height: 8,
            borderRadius: 4,
            '& .MuiLinearProgress-bar': { bgcolor: storagePct > 80 ? 'error.main' : 'primary.main', borderRadius: 4 },
            bgcolor: 'rgba(255,255,255,0.08)',
          }}
        />
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>File Type</InputLabel>
          <Select value={fileType} label="File Type" onChange={(e) => setFileType(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="image">Images</MenuItem>
            <MenuItem value="video">Videos</MenuItem>
            <MenuItem value="audio">Audio</MenuItem>
            <MenuItem value="pdf">PDF</MenuItem>
            <MenuItem value="text">Text</MenuItem>
          </Select>
        </FormControl>
        <TextField label="Uploader" size="small" value={uploader} onChange={(e) => setUploader(e.target.value)} sx={{ minWidth: 180 }} />
      </Box>

      {loading ? <Box display="flex" justifyContent="center" pt={4}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>File Name</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Uploader</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f._id} hover>
                  <TableCell><FileIcon mime={f.fileMimeType} /></TableCell>
                  <TableCell sx={{ maxWidth: 240 }}><Typography variant="body2" noWrap>{f.fileName}</Typography></TableCell>
                  <TableCell>{formatBytes(f.fileSize)}</TableCell>
                  <TableCell>{f.sender?.displayName ?? '—'}</TableCell>
                  <TableCell>{format(new Date(f.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    {f.fileUrl && (
                      <Tooltip title="Download">
                        <IconButton size="small" component="a" href={`${BASE_URL}${f.fileUrl}`} target="_blank" download>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteId(f._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!files.length && (
                <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary" py={3}>No files found</Typography></TableCell></TableRow>
              )}
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
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent><Alert severity="error">This will permanently delete the file from storage.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
