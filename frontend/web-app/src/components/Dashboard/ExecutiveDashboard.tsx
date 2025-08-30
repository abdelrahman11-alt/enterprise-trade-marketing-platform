import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Avatar,
  LinearProgress,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  MoreVert,
  Refresh,
  Download,
  Share,
  FilterList,
  DateRange,
  Insights,
  Campaign,
  Analytics,
  MonetizationOn,
  People,
  Store,
  Assessment,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface ExecutiveDashboardProps {
  companyId: string;
  userId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  refreshInterval?: number;
}

interface KPIData {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  target: number;
  unit: string;
  format: 'currency' | 'percentage' | 'number';
  trend: 'up' | 'down' | 'stable';
  change: number;
  changePercentage: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  icon: React.ReactNode;
  color: string;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  companyId,
  userId,
  timeRange,
  refreshInterval = 300000,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for demonstration
  const mockKPIs: KPIData[] = [
    {
      id: 'revenue',
      name: 'Total Revenue',
      value: 2450000,
      previousValue: 2200000,
      target: 2500000,
      unit: '$',
      format: 'currency',
      trend: 'up',
      change: 250000,
      changePercentage: 11.4,
      status: 'good',
      icon: <MonetizationOn />,
      color: theme.palette.success.main,
    },
    {
      id: 'trade_spend',
      name: 'Trade Spend',
      value: 485000,
      previousValue: 520000,
      target: 500000,
      unit: '$',
      format: 'currency',
      trend: 'down',
      change: -35000,
      changePercentage: -6.7,
      status: 'excellent',
      icon: <Campaign />,
      color: theme.palette.primary.main,
    },
    {
      id: 'roi',
      name: 'ROI',
      value: 4.05,
      previousValue: 3.23,
      target: 4.0,
      unit: 'x',
      format: 'number',
      trend: 'up',
      change: 0.82,
      changePercentage: 25.4,
      status: 'excellent',
      icon: <TrendingUp />,
      color: theme.palette.info.main,
    },
  ];

  const mockChartData = [
    { date: '2024-01-01', revenue: 2100000, spend: 420000, roi: 3.8 },
    { date: '2024-01-08', revenue: 2200000, spend: 440000, roi: 3.9 },
    { date: '2024-01-15', revenue: 2350000, spend: 470000, roi: 4.0 },
    { date: '2024-01-22', revenue: 2400000, spend: 480000, roi: 4.1 },
    { date: '2024-01-29', revenue: 2450000, spend: 485000, roi: 4.05 },
  ];

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1000);
  };

  const KPICard: React.FC<{ kpi: KPIData }> = ({ kpi }) => (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(kpi.color, 0.1)} 0%, ${alpha(kpi.color, 0.05)} 100%)`,
        border: `1px solid ${alpha(kpi.color, 0.2)}`,
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box sx={{ color: kpi.color }}>
            {kpi.icon}
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            {kpi.trend === 'up' && <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 16 }} />}
            {kpi.trend === 'down' && <TrendingDown sx={{ color: theme.palette.error.main, fontSize: 16 }} />}
            {kpi.trend === 'stable' && <TrendingFlat sx={{ color: theme.palette.grey[500], fontSize: 16 }} />}
            <Typography
              variant="caption"
              sx={{
                color: kpi.trend === 'up' ? theme.palette.success.main : 
                       kpi.trend === 'down' ? theme.palette.error.main : 
                       theme.palette.grey[500],
                fontWeight: 600,
              }}
            >
              {kpi.changePercentage > 0 ? '+' : ''}{kpi.changePercentage.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
        
        <Typography variant="h4" component="div" gutterBottom sx={{ fontWeight: 700 }}>
          {kpi.format === 'currency' && '$'}
          {kpi.value.toLocaleString()}
          {kpi.format === 'number' && kpi.unit}
          {kpi.format === 'percentage' && '%'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {kpi.name}
        </Typography>
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Target: {kpi.format === 'currency' && '$'}{kpi.target.toLocaleString()}
          </Typography>
          <Chip
            label={kpi.status}
            size="small"
            sx={{
              backgroundColor: kpi.status === 'excellent' ? theme.palette.success.main :
                              kpi.status === 'good' ? theme.palette.info.main :
                              kpi.status === 'fair' ? theme.palette.warning.main :
                              theme.palette.error.main,
              color: 'white',
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Executive Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {format(timeRange.start, 'MMM dd')} - {format(timeRange.end, 'MMM dd, yyyy')}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          
          <IconButton onClick={handleMenuClick}>
            <MoreVert />
          </IconButton>
          
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={handleMenuClose}>
              <Download sx={{ mr: 1 }} />
              Export Data
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              <Share sx={{ mr: 1 }} />
              Share Dashboard
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Loading indicator */}
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {mockKPIs.map((kpi) => (
          <Grid item xs={12} sm={6} md={4} key={kpi.id}>
            <KPICard kpi={kpi} />
          </Grid>
        ))}
      </Grid>

      {/* Main Chart */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Revenue & Trade Spend Trend
              </Typography>
              
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      `$${value.toLocaleString()}`,
                      name === 'revenue' ? 'Revenue' : 'Trade Spend',
                    ]}
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.main}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stackId="2"
                    stroke={theme.palette.secondary.main}
                    fill={theme.palette.secondary.main}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};