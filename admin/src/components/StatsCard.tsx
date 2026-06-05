import React from 'react';
import { Card, CardContent, Typography, Box, SvgIconProps } from '@mui/material';

interface StatsCardProps {
  label: string;
  value: string | number;
  Icon: React.ComponentType<SvgIconProps>;
  color?: string;
  subtitle?: string;
}

export function StatsCard({ label, value, Icon, color = '#7C5CFC', subtitle }: StatsCardProps) {
  return (
    <Card sx={{ flex: 1, minWidth: 160 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: `${color}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ color }} />
          </Box>
        </Box>
        <Typography variant="h4" fontWeight={700} mb={0.5}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}
