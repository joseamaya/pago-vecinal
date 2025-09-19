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
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';

const Dashboard = () => {
  const { user, isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    properties: 0,
    fees: 0,
    payments: 0,
    receipts: 0,
    total_debt: 0,
    pending_fees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [ownerData, setOwnerData] = useState({
    debtSummary: null,
    propertyReport: null,
    expensesReport: null,
  });
  const [ownerDataLoading, setOwnerDataLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    if (isOwner) {
      fetchOwnerData();
    }
  }, [isOwner]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const statsRes = await dashboardAPI.getStats();

      setStats({
        properties: statsRes.data.properties || 0,
        fees: statsRes.data.fees || 0,
        payments: statsRes.data.payments || 0,
        receipts: statsRes.data.receipts || 0,
        total_debt: statsRes.data.total_debt || 0,
        pending_fees: statsRes.data.pending_fees || 0,
        agreements: statsRes.data.agreements || 0,
        expenses: statsRes.data.expenses || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnerData = async () => {
    try {
      setOwnerDataLoading(true);
      const [debtRes, propertyRes, expensesRes] = await Promise.all([
        dashboardAPI.getOwnerDebtSummary(),
        dashboardAPI.getOwnerPropertyReport(),
        dashboardAPI.getOwnerExpensesReport(),
      ]);

      setOwnerData({
        debtSummary: debtRes.data,
        propertyReport: propertyRes.data,
        expensesReport: expensesRes.data,
      });
    } catch (error) {
      console.error('Error fetching owner data:', error);
    } finally {
      setOwnerDataLoading(false);
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36 }}>
          {loading ? (
            <LoadingSpinner size={24} showMessage={false} />
          ) : (
            <Typography variant="h4" component="div" color={color}>
              {value}
            </Typography>
          )}
        </Box>
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
        {isAdmin && (
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Cuotas"
              value={stats.fees}
              icon={<FeeIcon color="warning" fontSize="large" />}
              color="warning.main"
              onClick={() => navigate('/fees')}
            />
          </Grid>
        )}
        {isOwner && (
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Deuda Pendiente"
              value={`S/ ${stats.total_debt?.toFixed(2) || '0.00'}`}
              icon={<FeeIcon color="error" fontSize="large" />}
              color="error.main"
            />
          </Grid>
        )}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pagos"
            value={stats.payments}
            icon={<PaymentIcon color="secondary" fontSize="large" />}
            color="secondary.main"
            onClick={() => navigate('/payments')}
          />
        </Grid>
        {isAdmin && (
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Recibos"
              value={stats.receipts}
              icon={<ReceiptIcon color="success" fontSize="large" />}
              color="success.main"
              onClick={() => navigate('/receipts')}
            />
          </Grid>
        )}
        {isOwner && (
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Convenios"
              value={stats.agreements}
              icon={<ReceiptIcon color="info" fontSize="large" />}
              color="info.main"
              onClick={() => navigate('/agreements')}
            />
          </Grid>
        )}
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
          {isOwner && (
            <>
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<HomeIcon />}
                  sx={{ height: 80, flexDirection: 'column' }}
                  onClick={() => navigate('/properties')}
                >
                  Mis Propiedades
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
                  Mis Cuotas
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
              {isOwner ? 'Mis Pagos' : 'Ver Pagos'}
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
              {isOwner ? 'Mis Recibos' : 'Ver Recibos'}
            </Button>
          </Grid>
          {isOwner && (
            <Grid item xs={12} sm={6} md={2.4}>
              <Button
                variant="contained"
                color="info"
                fullWidth
                startIcon={<ReceiptIcon />}
                sx={{ height: 80, flexDirection: 'column' }}
                onClick={() => navigate('/agreements')}
              >
                Mis Convenios
              </Button>
            </Grid>
          )}
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

      {/* Owner Sections */}
      {isOwner && (
        <>
          {/* Debt Summary */}
          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Resumen de Deuda
            </Typography>
            {ownerDataLoading ? (
              <LoadingSpinner message="Cargando resumen de deuda..." />
            ) : ownerData.debtSummary ? (
              <Box>
                <Typography variant="h5" color="error" gutterBottom>
                  Deuda Total: S/ {ownerData.debtSummary.total_debt?.toFixed(2) || '0.00'}
                </Typography>
                {ownerData.debtSummary.properties?.map((prop, index) => (
                  <Box key={index} mb={2} p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="subtitle1">
                      Propiedad: {prop.property.villa} {prop.property.row_letter}{prop.property.number}
                    </Typography>
                    <Typography variant="body2">
                      Cuotas pendientes: {prop.pending_fees} | Monto: S/ {prop.debt_amount?.toFixed(2)}
                    </Typography>
                    {prop.fees?.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="body2" fontWeight="bold">Detalles:</Typography>
                        {prop.fees.map((fee, feeIndex) => (
                          <Typography key={feeIndex} variant="body2" sx={{ ml: 2 }}>
                            {fee.month}/{fee.year}: S/ {fee.amount?.toFixed(2)} - Vence: {new Date(fee.due_date).toLocaleDateString()}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography>No hay información de deuda disponible.</Typography>
            )}
          </Paper>

          {/* Property Report */}
          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Reporte de Propiedades
            </Typography>
            {ownerDataLoading ? (
              <LoadingSpinner message="Cargando reporte de propiedades..." />
            ) : ownerData.propertyReport ? (
              <Box>
                {ownerData.propertyReport.properties?.map((prop, index) => (
                  <Box key={index} mb={2} p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="subtitle1">
                      {prop.property.villa} {prop.property.row_letter}{prop.property.number}
                    </Typography>
                    <Typography variant="body2">
                      Total cuotas: {prop.fees_summary.total_fees} | Pagado: S/ {prop.fees_summary.paid_amount?.toFixed(2)} | Pendiente: S/ {prop.fees_summary.pending_amount?.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      Pagos realizados: {prop.payments} | Convenios: {prop.agreements}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography>No hay información de propiedades disponible.</Typography>
            )}
          </Paper>

          {/* Expenses Report */}
          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Reporte de Gastos Comunitarios
            </Typography>
            {ownerDataLoading ? (
              <LoadingSpinner message="Cargando reporte de gastos..." />
            ) : ownerData.expensesReport ? (
              <Box>
                <Typography variant="h5" gutterBottom>
                  Total Gastos: S/ {ownerData.expensesReport.total_expenses?.toFixed(2) || '0.00'}
                </Typography>
                {Object.entries(ownerData.expensesReport.expense_types || {}).map(([type, data]) => (
                  <Box key={type} mb={2} p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                      {type.replace('_', ' ')}: {data.count} gastos | Total: S/ {data.total_amount?.toFixed(2)}
                    </Typography>
                    {data.expenses?.slice(0, 3).map((expense, expIndex) => (
                      <Typography key={expIndex} variant="body2" sx={{ ml: 2 }}>
                        {expense.description}: S/ {expense.amount?.toFixed(2)} - {new Date(expense.expense_date).toLocaleDateString()}
                      </Typography>
                    ))}
                    {data.expenses?.length > 3 && (
                      <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                        ... y {data.expenses.length - 3} más
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography>No hay información de gastos disponible.</Typography>
            )}
          </Paper>
        </>
      )}

      {/* Recent Activity - Only for Admin */}
      {isAdmin && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Actividad Reciente
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Aquí se mostrarán las actividades recientes del sistema...
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default Dashboard;