import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import api from '../../lib/axios';

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

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxSizeStr, setMaxSizeStr] = useState('');
  const [alertMbStr, setAlertMbStr] = useState('');

  useEffect(() => {
    api.get('/api/admin/settings')
      .then(({ data }) => {
        setSettings(data);
        setMaxSizeStr(String(data.maxFileSizeMB));
        setAlertMbStr(String(data.storageAlertMB));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleMime(mime: string) {
    if (!settings) return;
    const exists = settings.allowedMimeTypes.includes(mime);
    setSettings({
      ...settings,
      allowedMimeTypes: exists
        ? settings.allowedMimeTypes.filter((m) => m !== mime)
        : [...settings.allowedMimeTypes, mime],
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch('/api/admin/settings', {
        ...settings,
        maxFileSizeMB: Number(maxSizeStr) || 10,
        storageAlertMB: Number(alertMbStr) || 500,
      });
      Alert.alert('Saved', 'Settings updated successfully');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={Colors.primary} /></View>;
  if (!settings) return null;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
    >
      <Text style={styles.title}>App Settings</Text>

      {/* General */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>General</Text>
        <GlassInput
          label="Max file size (MB)"
          value={maxSizeStr}
          onChangeText={setMaxSizeStr}
          keyboardType="numeric"
        />
        <GlassInput
          label="Storage alert threshold (MB)"
          value={alertMbStr}
          onChangeText={setAlertMbStr}
          keyboardType="numeric"
        />
      </GlassCard>

      {/* Toggles */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>Registration Enabled</Text>
          <Switch
            value={settings.registrationEnabled}
            onValueChange={(v) => setSettings({ ...settings, registrationEnabled: v })}
            trackColor={{ true: Colors.primary, false: Colors.glassBorder }}
            thumbColor="#fff"
          />
        </View>
        <View style={[styles.toggle, styles.toggleBorder]}>
          <Text style={styles.toggleLabel}>File Sharing Enabled</Text>
          <Switch
            value={settings.fileSharingEnabled}
            onValueChange={(v) => setSettings({ ...settings, fileSharingEnabled: v })}
            trackColor={{ true: Colors.primary, false: Colors.glassBorder }}
            thumbColor="#fff"
          />
        </View>
      </GlassCard>

      {/* File types */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Allowed File Types</Text>
        {Object.entries(MIME_LABELS).map(([mime, label], i) => (
          <View key={mime} style={[styles.toggle, i > 0 && styles.toggleBorder]}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch
              value={settings.allowedMimeTypes.includes(mime)}
              onValueChange={() => toggleMime(mime)}
              trackColor={{ true: Colors.primary, false: Colors.glassBorder }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </GlassCard>

      <NeonButton label="Save Settings" onPress={save} loading={saving} fullWidth style={styles.saveBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  title: { color: Colors.textPrimary, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, paddingTop: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator, paddingTop: Spacing.sm, marginTop: Spacing.sm },
  toggleLabel: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  saveBtn: { marginBottom: Spacing.md },
});
