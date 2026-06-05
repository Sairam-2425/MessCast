import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import api from '../../lib/axios';

interface FileItem {
  _id: string;
  fileName: string;
  fileSize: number | null;
  fileMimeType: string;
  fileUrl: string;
  sender: { _id: string; displayName: string };
  createdAt: string;
}

interface FileStats {
  storageUsedMB: number;
  storageAlertMB: number;
}

function fileIcon(mime: string): keyof typeof Feather.glyphMap {
  if (mime.startsWith('image')) return 'image';
  if (mime.startsWith('video')) return 'video';
  if (mime.startsWith('audio')) return 'music';
  if (mime.includes('pdf')) return 'file-text';
  return 'file';
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminFilesScreen() {
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<FileStats>({ storageUsedMB: 0, storageAlertMB: 500 });
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    try {
      const [filesRes, statsRes] = await Promise.all([
        api.get('/api/admin/files?limit=50'),
        api.get('/api/admin/stats'),
      ]);
      setFiles(filesRes.data.files);
      setStats({ storageUsedMB: statsRes.data.storageUsedMB, storageAlertMB: 500 });
    } catch {}
  }

  useEffect(() => { fetchAll().finally(() => setLoading(false)); }, []);

  async function deleteFile(file: FileItem) {
    Alert.alert('Delete file', `Delete "${file.fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/files/${file._id}`);
            setFiles((prev) => prev.filter((f) => f._id !== file._id));
          } catch {}
        },
      },
    ]);
  }

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={Colors.primary} /></View>;

  const pct = Math.min((stats.storageUsedMB / (stats.storageAlertMB || 1)) * 100, 100);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Files</Text>

      {/* Storage meter */}
      <GlassCard style={styles.storageCard}>
        <Text style={styles.storageLabel}>Storage Used</Text>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct > 80 ? Colors.error : Colors.primary }]} />
        </View>
        <Text style={styles.storageMeta}>{stats.storageUsedMB.toFixed(1)} MB / {stats.storageAlertMB} MB</Text>
      </GlassCard>

      <FlatList
        data={files}
        keyExtractor={(f) => f._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Feather name={fileIcon(item.fileMimeType)} size={20} color={Colors.primary} />
            </View>
            <View style={styles.info}>
              <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
              <Text style={styles.fileMeta}>{formatBytes(item.fileSize)} · {item.sender.displayName} · {format(new Date(item.createdAt), 'MMM d')}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteFile(item)} style={styles.deleteBtn}>
              <Feather name="trash-2" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No files found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  storageCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: Spacing.md, gap: Spacing.sm },
  storageLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  progressBg: { height: 6, backgroundColor: Colors.glassBorder, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  storageMeta: { color: Colors.textTertiary, fontSize: FontSize.xs },
  list: { paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(124,92,252,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  fileName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  fileMeta: { color: Colors.textSecondary, fontSize: FontSize.xs },
  deleteBtn: { padding: Spacing.sm },
  empty: { textAlign: 'center', color: Colors.textTertiary, marginTop: 40 },
});
