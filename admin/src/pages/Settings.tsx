import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Switch, FormControlLabel,
  Button, CircularProgress, Alert, Divider, Snackbar,
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../lib/axios';

interface AppSettings {
  maxFileSizeMB: number;
  fileSharingEnabled: boolean;
  registrationEnabled: boolean;
  storageAlertMB: number;
  allowedMimeTypes: string[];
}

const MIME_LABELS: Record<string, string> = {
  'image/jpeg':  'JPEG Images',
  'image/png':   'PNG Images',
  'image/gif':   'GIF Images',
  'image/webp':  'WebP Images',
  'application/pdf': 'PDF Documents',
  'application/msword': 'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.ms-excel': 'Excel (.xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
  'text/plain':  'Text Files',
  'video/mp4':   'MP4 Videos',
  'audio/mpeg':  'MP3 Audio',
  'audio/m4a':   'M4A Audio',
  'audio/mp4':   'MP4 Audio',
  'audio/aac':   'AAC Audio',
  'audio/x-m4a': 'Voice Notes (iOS)',
  'audio/webm':  'WebM Audio',
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/admin/settings')
      .then(({ data }) => setSettings(data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  function toggleMime(mime: string) {
    if (!settings) return;
    setSettings({
      ...settings,
      allowedMimeTypes: settings.allowedMimeTypes.includes(mime)
        ? settings.allowedMimeTypes.filter((m) => m !== mime)
        : [...settings.allowedMimeTypes, mime],
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch('/api/admin/settings', settings);
      toast.success('Settings saved successfully');
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  }

  if (loading) return <Box display="flex" justifyContent="center" pt={8}><CircularProgress /></Box>;
  if (!settings) return <Alert severity="error">Failed to load settings</Alert>;

  return (
    <Box>
      <Typography variant="h4" mb={3}>Settings</Typography>

      {/* General */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>General</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Max File Size (MB)"
              type="number"
              value={settings.maxFileSizeMB}
              onChange={(e) => setSettings({ ...settings, maxFileSizeMB: Number(e.target.value) })}
              sx={{ width: 200 }}
              inputProps={{ min: 1, max: 500 }}
            />
            <TextField
              label="Storage Alert (MB)"
              type="number"
              value={settings.storageAlertMB}
              onChange={(e) => setSettings({ ...settings, storageAlertMB: Number(e.target.value) })}
              sx={{ width: 200 }}
              inputProps={{ min: 100 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Feature toggles */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Features</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={<Switch checked={settings.registrationEnabled} onChange={(e) => setSettings({ ...settings, registrationEnabled: e.target.checked })} />}
              label="Registration Enabled"
            />
            <Divider />
            <FormControlLabel
              control={<Switch checked={settings.fileSharingEnabled} onChange={(e) => setSettings({ ...settings, fileSharingEnabled: e.target.checked })} />}
              label="File Sharing Enabled"
            />
          </Box>
        </CardContent>
      </Card>

      {/* File types */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Allowed File Types</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {Object.entries(MIME_LABELS).map(([mime, label], i) => (
              <React.Fragment key={mime}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.allowedMimeTypes.includes(mime)}
                      onChange={() => toggleMime(mime)}
                      size="small"
                    />
                  }
                  label={label}
                />
                {i < Object.keys(MIME_LABELS).length - 1 && <Divider sx={{ opacity: 0.3 }} />}
              </React.Fragment>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Button variant="contained" size="large" onClick={save} disabled={saving}>
        {saving ? <CircularProgress size={22} color="inherit" /> : 'Save Settings'}
      </Button>
    </Box>
  );
}
