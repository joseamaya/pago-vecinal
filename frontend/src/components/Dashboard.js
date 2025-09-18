import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Home as HomeIcon,
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
  MonetizationOn as FeeIcon,
  Schedule as ScheduleIcon,
  Assessment as ReportsIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { propertiesAPI, feesAPI, paymentsAPI, receiptsAPI, reportsAPI } from '../services/api';

const Dashboard = () => {
  const { user, isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    properties: 0,
    fees: 0,
    payments: 0,
    receipts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({
    paymentsOverTime: [],
    feesByStatus: [],
    propertiesByVilla: [],
  });
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [propertiesRes, feesRes, paymentsRes, receiptsRes] = await Promise.all([
        propertiesAPI.getProperties(),
        feesAPI.getFees(),
        paymentsAPI.getPayments(),
        receiptsAPI.getReceipts(),
      ]);

      setStats({
        properties: propertiesRes.data.length,
        fees: feesRes.data.length,
        payments: paymentsRes.data.length,
        receipts: receiptsRes.data.length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, onClick }) => (
    <Card sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          {icon}
          <Typography variant="h6" component="div" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" color={color}>
          {loading ? '...' : value}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Bienvenido de vuelta, {user?.full_name}
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Propiedades"
            value={stats.properties}
            icon={<HomeIcon color="primary" fontSize="large" />}
            color="primary.main"
            onClick={() => navigate('/properties')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Cuotas"
            value={stats.fees}
            icon={<FeeIcon color="warning" fontSize="large" />}
            color="warning.main"
            onClick={() => navigate('/fees')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pagos"
            value={stats.payments}
            icon={<PaymentIcon color="secondary" fontSize="large" />}
            color="secondary.main"
            onClick={() => navigate('/payments')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Recibos"
            value={stats.receipts}
            icon={<ReceiptIcon color="success" fontSize="large" />}
            color="success.main"
            onClick={() => navigate('/receipts')}
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Acciones Rápidas
        </Typography>
        <Grid container spacing={2}>
          {isAdmin && (
            <>
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<PeopleIcon />}
                  sx={{ height: 80, flexDirection: 'column' }}
                  onClick={() => navigate('/users')}
                >
                  Gestionar Usuarios
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<HomeIcon />}
                  sx={{ height: 80, flexDirection: 'column' }}
                  onClick={() => navigate('/properties')}
                >
                  Gestionar Propiedades
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  variant="contained"
                  color="info"
                  fullWidth
                  startIcon={<ScheduleIcon />}
                  sx={{ height: 80, flexDirection: 'column' }}
                  onClick={() => navigate('/fee-schedules')}
                >
                  Planes de Cuotas
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  variant="contained"
                  color="warning"
                  fullWidth
                  startIcon={<FeeIcon />}
                  sx={{ height: 80, flexDirection: 'column' }}
                  onClick={() => navigate('/fees')}
                >
                  Gestionar Cuotas
                </Button>
              </Grid>
            </>
          )}
          <Grid item xs={12} sm={6} md={2.4}>
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              startIcon={<PaymentIcon />}
              sx={{ height: 80, flexDirection: 'column' }}
              onClick={() => navigate('/payments')}
            >
              Ver Pagos
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Button
              variant="contained"
              color="success"
              fullWidth
              startIcon={<ReceiptIcon />}
              sx={{ height: 80, flexDirection: 'column' }}
              onClick={() => navigate('/receipts')}
            >
              Ver Recibos
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Button
              variant="contained"
              color="info"
              fullWidth
              startIcon={<ReportsIcon />}
              sx={{ height: 80, flexDirection: 'column' }}
              onClick={() => navigate('/reports')}
            >
              Reportes
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Recent Activity */}
      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Actividad Reciente
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Aquí se mostrarán las actividades recientes del sistema...
        </Typography>
      </Paper>
    </Container>
  );
};

export default Dashboard;