import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import FolderIcon from '@mui/icons-material/Folder';
import ForumIcon from '@mui/icons-material/Forum';
import BlockIcon from '@mui/icons-material/Block';
import StorageIcon from '@mui/icons-material/Storage';
import { StatsCard } from '../components/StatsCard';
import api from '../lib/axios';

interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalFiles: number;
  totalConversations: number;
  storageUsedMB: number;
  bannedUsers: number;
  activeToday: number;
}

const PIE_COLORS = ['#7C5CFC', '#00D4FF', '#00E5A0', '#FFB547', '#FF4D6A', '#A855F7'];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [msgData, setMsgData] = useState<{ _id: string; count: number }[]>([]);
  const [fileData, setFileData] = useState<{ _id: string; count: number }[]>([]);
  const [regData, setRegData] = useState<{ _id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/stats'),
      api.get('/api/admin/stats/messages'),
      api.get('/api/admin/stats/files'),
      api.get('/api/admin/stats/registrations'),
    ]).then(([s, m, f, r]) => {
      setStats(s.data);
      setMsgData(m.data);
      setFileData(f.data.map((d: { _id: string; count: number }) => ({ name: d._id?.split('/').pop() ?? d._id, value: d.count })));
      setRegData(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box display="flex" justifyContent="center" pt={8}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" mb={3}>Dashboard</Typography>

      {/* Stats row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={4} lg={2}><StatsCard label="Users"         value={stats?.totalUsers ?? 0}        Icon={PeopleIcon}  color="#7C5CFC" /></Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}><StatsCard label="Messages"      value={stats?.totalMessages ?? 0}     Icon={ChatIcon}    color="#00D4FF" /></Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}><StatsCard label="Files"         value={stats?.totalFiles ?? 0}        Icon={FolderIcon}  color="#00E5A0" /></Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}><StatsCard label="Conversations" value={stats?.totalConversations ?? 0} Icon={ForumIcon}  color="#FFB547" /></Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}><StatsCard label="Storage MB"    value={(stats?.storageUsedMB ?? 0).toFixed(1)} Icon={StorageIcon} color="#A855F7" /></Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}><StatsCard label="Banned"        value={stats?.bannedUsers ?? 0}       Icon={BlockIcon}   color="#FF4D6A" /></Grid>
      </Grid>

      {/* Charts row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Messages per Day (30 days)</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={msgData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'rgba(240,240,255,0.5)' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(240,240,255,0.5)' }} />
                  <Tooltip contentStyle={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} />
                  <Line type="monotone" dataKey="count" stroke="#7C5CFC" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>File Types</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={fileData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name }) => name}>
                    {fileData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Registrations */}
      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>Registrations per Day (30 days)</Typography>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'rgba(240,240,255,0.5)' }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: 'rgba(240,240,255,0.5)' }} />
              <Tooltip contentStyle={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} />
              <Bar dataKey="count" fill="#00D4FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
