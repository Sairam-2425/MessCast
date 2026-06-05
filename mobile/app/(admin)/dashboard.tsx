import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StatCard } from '../../components/admin/StatCard';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import api from '../../lib/axios';

interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalFiles: number;
  totalConversations: number;
  storageUsedMB: number;
  bannedUsers: number;
  activeToday: number;
}

interface DayData {
  _id: string;
  count: number;
}

// Bar color cycle using the full neon palette
const BAR_COLORS = [
  Colors.primary,
  Colors.secondary,
  Colors.success,
  Colors.warning,
  Colors.error,
  Colors.primary,
  Colors.secondary,
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [messages, setMessages] = useState<DayData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const [statsRes, msgRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/stats/messages'),
      ]);
      setStats(statsRes.data);
      setMessages(msgRes.data);
    } catch {}
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const chartData = messages.slice(-7);
  const maxCount  = Math.max(...chartData.map((x) => x.count), 1);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }}
          tintColor={Colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Platform overview</Text>
        </View>
        {stats?.activeToday !== undefined && (
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>{stats.activeToday} active today</Text>
          </View>
        )}
      </View>

      {/* ── Stats grid ── */}
      <View style={styles.grid}>
        <StatCard label="Total Users"    value={stats?.totalUsers ?? 0}        icon="users"          color={Colors.primary} />
        <StatCard label="Messages"       value={stats?.totalMessages ?? 0}      icon="message-circle" color={Colors.secondary} />
        <StatCard label="Files"          value={stats?.totalFiles ?? 0}         icon="file"           color={Colors.success} />
        <StatCard label="Conversations"  value={stats?.totalConversations ?? 0} icon="message-square" color={Colors.warning} />
        <StatCard label="Storage (MB)"   value={(stats?.storageUsedMB ?? 0).toFixed(1)} icon="database" color={Colors.error} />
        <StatCard label="Banned Users"   value={stats?.bannedUsers ?? 0}        icon="slash"          color={Colors.error} />
      </View>

      {/* ── Bar chart ── */}
      <GlassCard style={styles.chartCard} accent>
        <View style={styles.chartHeader}>
          <Feather name="bar-chart-2" size={16} color={Colors.primary} />
          <Text style={styles.chartTitle}>Messages — Last 7 Days</Text>
        </View>

        {chartData.length === 0 ? (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>No data yet</Text>
          </View>
        ) : (
          <View style={styles.barChart}>
            {chartData.map((d, i) => {
              const pct   = (d.count / maxCount) * 100;
              const color = BAR_COLORS[i % BAR_COLORS.length];
              return (
                <View key={d._id} style={styles.barCol}>
                  {/* Count label above bar */}
                  <Text style={[styles.barCount, { color }]}>{d.count}</Text>

                  {/* Bar */}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(pct, 4)}%`,
                          backgroundColor: color,
                          shadowColor: color,
                        },
                      ]}
                    />
                  </View>

                  {/* Day label */}
                  <Text style={styles.barLabel}>{d._id.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  scroll:    { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    color: Colors.textTertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,229,160,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  activeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },

  chartCard:   { padding: Spacing.lg, gap: Spacing.md },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chartTitle:  { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  chartEmpty:  { height: 120, alignItems: 'center', justifyContent: 'center' },
  chartEmptyText: { color: Colors.textTertiary, fontSize: FontSize.sm },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 },
  barCol:   { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barCount: { fontSize: 9, fontWeight: FontWeight.bold, marginBottom: 3 },
  barTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    borderRadius: Radius.xs,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 4,
  },
  barLabel: { color: Colors.textTertiary, fontSize: 9, marginTop: 5, fontWeight: FontWeight.medium },
});
