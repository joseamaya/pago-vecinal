import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  Skeleton,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  AssessmentOutlined as ReportsIcon,
  EventRepeatOutlined as ScheduleIcon,
  HomeOutlined as HomeIcon,
  MonetizationOnOutlined as FeeIcon,
  PaymentsOutlined as PaymentIcon,
  ReceiptLongOutlined as ReceiptIcon,
  StorefrontOutlined as StoreIcon,
} from '@mui/icons-material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import SectionCard from './common/SectionCard';
import StatCard from './common/StatCard';
import StatusChip from './common/StatusChip';
import MoneyText from './common/MoneyText';
import EmptyState from './common/EmptyState';
import { formatCurrency, formatDate, formatLongDate, formatPeriod, formatMonth, formatNumber, formatPropertyLabel } from '../utils/formatters';

const PIE_COLORS = ['#A9502F', '#3D7382', '#5E7D45', '#A8761F', '#6E5A43'];

const Dashboard = () => {
  const { user, isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [recent, setRecent] = useState([]);
  const [ownerData, setOwnerData] = useState({
    debtSummary: null,
    propertyReport: null,
    expensesReport: null,
  });
  const [loading, setLoading] = useState(true);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, trendsRes, recentRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getTrends(12),
        dashboardAPI.getRecentActivity(6),
      ]);
      setStats(statsRes.data);
      setTrends(trendsRes.data.series || []);
      setRecent(recentRes.data.activity || []);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('No pudimos cargar el resumen. Vuelve a intentarlo en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOwnerData = useCallback(async () => {
    setOwnerLoading(true);
    try {
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
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setOwnerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    if (isOwner) fetchOwnerData();
  }, [fetchDashboard, fetchOwnerData, isOwner]);

  const firstName = user?.full_name?.trim().split(' ')[0] || 'vecino';
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const chartLabels = trends.map((item) => `${formatMonth(item.month).slice(0, 3)} ${String(item.year).slice(2)}`);
  const collectedSeries = trends.map((item) => item.collected);
  const expensesSeries = trends.map((item) => item.expenses);

  const expensePie = useMemo(() => {
    const entries = Object.entries(ownerData.expensesReport?.expense_types || {});
    return entries
      .map(([label, data], index) => ({
        id: label,
        label,
        value: Number(data.total_amount) || 0,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [ownerData.expensesReport]);

  const properties = ownerData.propertyReport?.properties || [];
  const debtByProperty = useMemo(() => {
    const map = new Map();
    (ownerData.debtSummary?.properties || []).forEach((entry) => {
      map.set(entry.property.id, entry);
    });
    return map;
  }, [ownerData.debtSummary]);

  const debtEvolution = useMemo(() => {
    const buckets = new Map();
    (ownerData.debtSummary?.properties || []).forEach((entry) => {
      (entry.fees || []).forEach((fee) => {
        if (!fee.month || !fee.year) return;
        const key = `${fee.year}-${String(fee.month).padStart(2, '0')}`;
        buckets.set(key, (buckets.get(key) || 0) + (Number(fee.amount) || 0));
      });
    });

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        const [year, month] = key.split('-').map(Number);
        return {
          key,
          label: `${formatMonth(month).slice(0, 3)} ${String(year).slice(2)}`,
          value: Number(value.toFixed(2)),
        };
      });
  }, [ownerData.debtSummary]);

  const quickActions = isAdmin
    ? [
        { label: 'Registrar pago', icon: PaymentIcon, path: '/payments' },
        { label: 'Generar cuotas', icon: ScheduleIcon, path: '/fees' },
        { label: 'Propiedades', icon: HomeIcon, path: '/properties' },
        { label: 'Reportes', icon: ReportsIcon, path: '/reports' },
      ]
    : [
        { label: 'Mis cuotas', icon: FeeIcon, path: '/fees' },
        { label: 'Mis pagos', icon: PaymentIcon, path: '/payments' },
        { label: 'Mis recibos', icon: ReceiptIcon, path: '/receipts' },
        { label: 'Reportes', icon: ReportsIcon, path: '/reports' },
      ];

  if (!isAdmin && !isOwner) {
    return (
      <PageContainer>
        <Alert severity="warning">No tienes un rol asignado para ver el dashboard.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow={greeting}
        title={`Hola, ${firstName}`}
        subtitle={`Este es el estado de tu comunidad al ${formatLongDate(new Date())}.`}
        actions={
          <>
            <Button variant="outlined" startIcon={<ReportsIcon />} onClick={() => navigate('/reports')}>
              Reportes
            </Button>
            <Button
              variant="contained"
              startIcon={isAdmin ? <PaymentIcon /> : <FeeIcon />}
              onClick={() => navigate(isAdmin ? '/payments' : '/fees')}
            >
              {isAdmin ? 'Registrar pago' : 'Ver mis cuotas'}
            </Button>
          </>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={fetchDashboard}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {(isAdmin
          ? [
              {
                title: 'Recaudado este mes',
                value: formatCurrency(stats?.collected_this_month),
                icon: <PaymentIcon />,
                color: 'primary',
                helper: formatPeriod(stats?.period?.month, stats?.period?.year),
              },
              {
                title: 'Pendiente de cobro',
                value: formatCurrency(stats?.total_debt),
                icon: <FeeIcon />,
                color: 'warning',
                helper: `${stats?.pending_fees ?? 0} cuotas por cobrar`,
              },
              {
                title: 'Tasa de recaudación',
                value: `${(stats?.collection_rate ?? 0).toFixed(1)}%`,
                icon: <ReportsIcon />,
                color: 'success',
                helper: 'del total emitido',
              },
              {
                title: 'Propiedades',
                value: stats?.properties ?? 0,
                icon: <HomeIcon />,
                color: 'info',
                helper: 'en administración',
              },
            ]
          : [
              {
                title: 'Deuda pendiente',
                value: formatCurrency(stats?.total_debt),
                icon: <FeeIcon />,
                color: 'error',
                helper: `${stats?.pending_fees ?? 0} cuotas pendientes`,
              },
              {
                title: 'Pagado este mes',
                value: formatCurrency(stats?.collected_this_month),
                icon: <PaymentIcon />,
                color: 'success',
                helper: formatPeriod(stats?.period?.month, stats?.period?.year),
              },
              {
                title: 'Tasa de pago',
                value: `${(stats?.collection_rate ?? 0).toFixed(1)}%`,
                icon: <ReportsIcon />,
                color: 'info',
                helper: 'de tus cuotas emitidas',
              },
              {
                title: 'Propiedades',
                value: stats?.properties ?? 0,
                icon: <HomeIcon />,
                color: 'secondary',
                helper: 'a tu nombre',
              },
            ]
        ).map((item, index) => (
          <Grid
            key={item.title}
            size={{ xs: 6, md: 3 }}
            sx={{
              animation: 'fade-up 420ms ease both',
              animationDelay: `${index * 60}ms`,
            }}
          >
            <StatCard {...item} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Grid
        container
        spacing={2.5}
        sx={{ mb: 3, animation: 'fade-up 420ms ease both', animationDelay: '240ms' }}
      >
        <Grid size={{ xs: 12, lg: 8 }}>
          <SectionCard
            title="Ingresos y gastos"
            subtitle="Últimos 12 meses"
            action={
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/reports')}>
                Ver reportes
              </Button>
            }
            contentSx={{ px: { xs: 1, sm: 2 }, py: 2 }}
          >
            {loading ? (
              <Skeleton variant="rounded" height={300} />
            ) : trends.length === 0 ? (
              <EmptyState
                title="Todavía no hay movimientos"
                description="Cuando se registren pagos y gastos verás la evolución mensual aquí."
              />
            ) : (
              <BarChart
                height={300}
                series={[
                  { data: collectedSeries, label: 'Recaudado', color: theme.palette.primary.main },
                  { data: expensesSeries, label: 'Gastos', color: alpha(theme.palette.info.main, 0.85) },
                ]}
                xAxis={[{ scaleType: 'band', data: chartLabels, tickLabelStyle: { fontSize: 11 } }]}
                yAxis={[
                  {
                    valueFormatter: (value) =>
                      value >= 1000 ? `S/ ${formatNumber(value / 1000)}k` : `S/ ${formatNumber(value)}`,
                    tickLabelStyle: { fontSize: 11 },
                  },
                ]}
                grid={{ horizontal: true }}
                margin={{ left: 68, right: 16, top: 24, bottom: 36 }}
                borderRadius={6}
                slotProps={{ legend: { direction: 'row', position: { vertical: 'top', horizontal: 'right' } } }}
              />
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="Estado de cobranza" subtitle="Acumulado del condominio">
            {loading ? (
              <Skeleton variant="rounded" height={240} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                  <Typography variant="h2" sx={{ lineHeight: 1 }}>
                    {(stats?.collection_rate ?? 0).toFixed(0)}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', pb: 0.5 }}>
                    cobrado
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(stats?.collection_rate ?? 0, 100)}
                  sx={{ height: 10, borderRadius: 6, bgcolor: 'action.hover' }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Pendiente de cobro
                    </Typography>
                    <MoneyText value={stats?.total_debt} variant="body2" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Cuotas por cobrar
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {stats?.pending_fees ?? 0}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Gastos del mes
                    </Typography>
                    <MoneyText value={stats?.expenses_this_month} variant="body2" />
                  </Box>
                </Box>
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {isOwner && (
        <Grid
          container
          spacing={2.5}
          sx={{ mb: 3, animation: 'fade-up 420ms ease both', animationDelay: '300ms' }}
        >
          <Grid size={12}>
            <SectionCard
              title="Evolución de deuda"
              subtitle="Cuotas pendientes agrupadas por periodo"
              contentSx={{ px: { xs: 1, sm: 2 }, py: 2 }}
            >
              {ownerLoading ? (
                <Skeleton variant="rounded" height={240} />
              ) : debtEvolution.length === 0 ? (
                <EmptyState
                  title="Sin deuda pendiente"
                  description="Cuando tengas cuotas pendientes verás aquí su evolución."
                  icon={<FeeIcon />}
                />
              ) : (
                <LineChart
                  height={240}
                  series={[
                    {
                      data: debtEvolution.map((item) => item.value),
                      label: 'Deuda pendiente',
                      color: theme.palette.error.main,
                      area: true,
                    },
                  ]}
                  xAxis={[
                    {
                      scaleType: 'point',
                      data: debtEvolution.map((item) => item.label),
                      tickLabelStyle: { fontSize: 11 },
                    },
                  ]}
                  yAxis={[
                    {
                      valueFormatter: (value) =>
                        value >= 1000
                          ? `S/ ${formatNumber(value / 1000)}k`
                          : `S/ ${formatNumber(value)}`,
                      tickLabelStyle: { fontSize: 11 },
                    },
                  ]}
                  grid={{ horizontal: true }}
                  margin={{ left: 68, right: 16, top: 24, bottom: 36 }}
                  slotProps={{
                    legend: {
                      direction: 'row',
                      position: { vertical: 'top', horizontal: 'right' },
                    },
                  }}
                />
              )}
            </SectionCard>
          </Grid>
        </Grid>
      )}

      {isOwner && (
        <Grid
          container
          spacing={2.5}
          sx={{ mb: 3, animation: 'fade-up 420ms ease both', animationDelay: '360ms' }}
        >
          <Grid size={{ xs: 12, lg: 7 }}>
            <SectionCard
              title="Tus propiedades"
              subtitle="Avance de pago y próxima cuota"
              action={
                isAdmin && (
                  <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/properties')}>
                    Ver todas
                  </Button>
                )
              }
              contentSx={{ py: 1 }}
            >
              {ownerLoading ? (
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Skeleton variant="rounded" height={76} />
                  <Skeleton variant="rounded" height={76} />
                </Box>
              ) : properties.length === 0 ? (
                <EmptyState
                  title="Sin propiedades asignadas"
                  description="Cuando el administrador registre tu propiedad, aparecerá aquí."
                />
              ) : (
                properties.map((entry) => {
                  const debt = debtByProperty.get(entry.property.id);
                  const nextFee = [...(debt?.fees || [])].sort(
                    (a, b) => new Date(a.due_date) - new Date(b.due_date)
                  )[0];
                  const total = entry.fees_summary.total_amount || 0;
                  const paid = entry.fees_summary.paid_amount || 0;
                  const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

                  return (
                    <Box key={entry.property.id} sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="subtitle2">
                            {formatPropertyLabel(entry.property)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {entry.fees_summary.pending_fees} cuotas pendientes
                            {nextFee ? ` · vence ${formatDate(nextFee.due_date)}` : ''}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Pendiente
                          </Typography>
                          <MoneyText value={entry.fees_summary.pending_amount} variant="body2" sx={{ color: 'error.main' }} />
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{ height: 6, borderRadius: 4, bgcolor: 'action.hover' }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                          {formatCurrency(paid)} pagado de {formatCurrency(total)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <SectionCard title="Gastos comunitarios" subtitle="Distribución por categoría">
              {ownerLoading ? (
                <Skeleton variant="rounded" height={260} />
              ) : expensePie.length === 0 ? (
                <EmptyState
                  title="Sin gastos registrados"
                  description="Los gastos de la comunidad se mostrarán aquí."
                  icon={<StoreIcon />}
                />
              ) : (
                <>
                  <PieChart
                    height={200}
                    series={[
                      {
                        data: expensePie,
                        innerRadius: 52,
                        paddingAngle: 2,
                        cornerRadius: 4,
                        highlightScope: { highlight: 'item', fade: 'global' },
                      },
                    ]}
                    slotProps={{ legend: { direction: 'column', position: { vertical: 'middle', horizontal: 'right' } } }}
                    margin={{ right: 120 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Total del periodo
                    </Typography>
                    <MoneyText value={ownerData.expensesReport?.total_expenses} variant="body2" />
                  </Box>
                </>
              )}
            </SectionCard>
          </Grid>
        </Grid>
      )}

      <Grid
        container
        spacing={2.5}
        sx={{ animation: 'fade-up 420ms ease both', animationDelay: '420ms' }}
      >
        <Grid size={{ xs: 12, lg: 8 }}>
          <SectionCard
            title="Movimientos recientes"
            subtitle="Últimos pagos registrados"
            action={
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/payments')}>
                Ver todos
              </Button>
            }
            contentSx={{ py: 0.5 }}
          >
            {loading ? (
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant="text" height={52} />
                <Skeleton variant="text" height={52} />
                <Skeleton variant="text" height={52} />
              </Box>
            ) : recent.length === 0 ? (
              <EmptyState
                title="Sin movimientos recientes"
                description="Los pagos confirmados aparecerán en esta sección."
              />
            ) : (
              <List disablePadding>
                {recent.map((item) => (
                  <ListItem
                    key={item.id}
                    divider
                    sx={{ px: 0, py: 1.5, gap: 1.5, '&:last-of-type': { borderBottom: 0 } }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 38,
                        height: 38,
                        borderRadius: 2.5,
                        bgcolor: 'action.hover',
                        color: 'primary.main',
                        flexShrink: 0,
                      }}
                    >
                      <PaymentIcon fontSize="small" />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {formatPropertyLabel(item.property, 'Pago de cuota')}
                        {item.period ? ` · ${formatPeriod(item.period.month, item.period.year)}` : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(item.date)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      <StatusChip status={item.status} />
                    </Box>
                    <MoneyText value={item.amount} variant="body2" sx={{ minWidth: { xs: 70, sm: 90 }, textAlign: 'right' }} />
                  </ListItem>
                ))}
              </List>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="Accesos rápidos" contentSx={{ pt: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.label}
                    variant="outlined"
                    color="inherit"
                    onClick={() => navigate(action.path)}
                    sx={(theme) => ({
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 1,
                      py: 1.75,
                      px: 1.75,
                      minHeight: 88,
                      borderRadius: 2.5,
                      borderColor: theme.palette.divider,
                      color: 'text.primary',
                      '&:hover': { borderColor: theme.palette.primary.light, bgcolor: theme.palette.action.hover },
                    })}
                  >
                    <Icon fontSize="small" sx={{ color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'left' }}>
                      {action.label}
                    </Typography>
                  </Button>
                );
              })}
            </Box>
          </SectionCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
};

export default Dashboard;
