import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  AssessmentOutlined as ReportsIcon,
  CalendarMonthOutlined as CalendarIcon,
  DownloadOutlined as DownloadIcon,
  PictureAsPdfOutlined as PdfIcon,
  TableChartOutlined as TableIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI, propertiesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import SectionCard from './common/SectionCard';
import { MONTHS } from '../utils/months';
import { formatPropertyLabel } from '../utils/formatters';

const ReportCard = ({ title, description, onClick, disabled, icon, pdf }) => (
  <Card
    sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      '&:hover': { borderColor: 'primary.light' },
    }}
  >
    <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, pb: 1.5 }}>
      <Box
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          borderRadius: 2.5,
          mb: 1.75,
          color: pdf ? theme.palette.error.main : theme.palette.primary.main,
          bgcolor: alpha(
            pdf ? theme.palette.error.main : theme.palette.primary.main,
            theme.palette.mode === 'light' ? 0.1 : 0.16
          ),
        })}
      >
        {icon || (pdf ? <PdfIcon fontSize="small" /> : <TableIcon fontSize="small" />)}
      </Box>
      <Typography variant="h6" sx={{ fontSize: '1rem', mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
        {description}
      </Typography>
    </CardContent>
    <Box sx={{ px: 2, pb: 2 }}>
      <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={onClick} disabled={disabled}>
        Descargar
      </Button>
    </Box>
  </Card>
);

const PeriodRange = ({ startYear, setStartYear, startMonth, setStartMonth, endYear, setEndYear, endMonth, setEndMonth }) => (
  <Grid container spacing={2}>
    <Grid size={{ xs: 6, md: 3 }}>
      <TextField
        fullWidth
        label="Año inicial"
        type="number"
        value={startYear}
        onChange={(event) => setStartYear(parseInt(event.target.value, 10) || new Date().getFullYear())}
        inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
      />
    </Grid>
    <Grid size={{ xs: 6, md: 3 }}>
      <FormControl fullWidth>
        <InputLabel>Mes inicial</InputLabel>
        <Select value={startMonth} onChange={(event) => setStartMonth(event.target.value)} label="Mes inicial">
          {MONTHS.map((month) => (
            <MenuItem key={month.value} value={month.value}>
              {month.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 6, md: 3 }}>
      <TextField
        fullWidth
        label="Año final"
        type="number"
        value={endYear}
        onChange={(event) => setEndYear(parseInt(event.target.value, 10) || new Date().getFullYear())}
        inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
      />
    </Grid>
    <Grid size={{ xs: 6, md: 3 }}>
      <FormControl fullWidth>
        <InputLabel>Mes final</InputLabel>
        <Select value={endMonth} onChange={(event) => setEndMonth(event.target.value)} label="Mes final">
          {MONTHS.map((month) => (
            <MenuItem key={month.value} value={month.value}>
              {month.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  </Grid>
);

const ReportsManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState('');
  const [statementYear, setStatementYear] = useState(new Date().getFullYear());

  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);

  const [payStartYear, setPayStartYear] = useState(new Date().getFullYear());
  const [payStartMonth, setPayStartMonth] = useState(1);
  const [payEndYear, setPayEndYear] = useState(new Date().getFullYear());
  const [payEndMonth, setPayEndMonth] = useState(new Date().getMonth() + 1);

  const [expenseStartYear, setExpenseStartYear] = useState(new Date().getFullYear());
  const [expenseStartMonth, setExpenseStartMonth] = useState(1);
  const [expenseEndYear, setExpenseEndYear] = useState(new Date().getFullYear());
  const [expenseEndMonth, setExpenseEndMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties(1, 1000);
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const triggerDownload = async (apiCall, filename) => {
    setLoading(true);
    try {
      const response = await apiCall;
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const isPdf = contentType.includes('pdf');
      const ext = isPdf ? 'pdf' : 'xlsx';
      const fullName = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;

      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fullName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Reporte descargado correctamente');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos descargar el reporte');
      }
      console.error('Error downloading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    const now = new Date();
    let startY = now.getFullYear();
    let startM = 1;
    let endY = now.getFullYear();
    let endM = now.getMonth() + 1;

    if (preset === 'month') {
      startM = endM;
    } else if (preset === 'quarter') {
      startM = Math.floor(now.getMonth() / 3) * 3 + 1;
    }

    const setters = [
      [setPayStartYear, startY],
      [setPayStartMonth, startM],
      [setPayEndYear, endY],
      [setPayEndMonth, endM],
      [setStartYear, startY],
      [setStartMonth, startM],
      [setEndYear, endY],
      [setEndMonth, endM],
      [setExpenseStartYear, startY],
      [setExpenseStartMonth, startM],
      [setExpenseEndYear, endY],
      [setExpenseEndMonth, endM],
    ];
    setters.forEach(([setter, value]) => setter(value));
  };

  const getOnClick = (report) => {
    switch (report.type) {
      case 'property-history':
        return () =>
          triggerDownload(
            reportsAPI.getPropertyPaymentHistory(
              selectedProperty || null,
              payStartYear,
              payStartMonth,
              payEndYear,
              payEndMonth,
              'excel'
            ),
            `historial_pagos_${payStartYear}_${String(payStartMonth).padStart(2, '0')}_a_${payEndYear}_${String(payEndMonth).padStart(2, '0')}`
          );
      case 'monthly-summary':
        return () =>
          triggerDownload(
            reportsAPI.getMonthlyPaymentSummary(payStartYear, payStartMonth, payEndYear, payEndMonth),
            `resumen_pagos_${payStartYear}_${String(payStartMonth).padStart(2, '0')}_a_${payEndYear}_${String(payEndMonth).padStart(2, '0')}`
          );
      case 'payments-summary':
        return () =>
          triggerDownload(
            reportsAPI.getPaymentsSummary(payStartYear, payStartMonth, payEndYear, payEndMonth),
            `resumen_pagos_${payStartYear}_${String(payStartMonth).padStart(2, '0')}_a_${payEndYear}_${String(payEndMonth).padStart(2, '0')}`
          );
      case 'monthly-fees':
        return () =>
          triggerDownload(
            reportsAPI.getMonthlyFeesReport(startYear, startMonth, endYear, endMonth),
            `cuotas_mensuales_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
      case 'paid-fees-summary':
        return () =>
          triggerDownload(
            reportsAPI.getPaidFeesSummary(startYear, startMonth, endYear, endMonth),
            `resumen_cuotas_pagadas_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
      case 'fee-payment-matrix':
        return () =>
          triggerDownload(
            reportsAPI.getFeePaymentMatrix(startYear, startMonth, endYear, endMonth),
            `matriz_pagos_cuotas_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
      case 'fee-contribution-summary':
        return () =>
          triggerDownload(
            reportsAPI.getFeeContributionSummary(startYear, startMonth, endYear, endMonth),
            `resumen_contribucion_cuotas_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
      case 'expenses-by-period':
        return () =>
          triggerDownload(
            reportsAPI.getExpensesByPeriodRangeReport(
              expenseStartYear,
              expenseStartMonth,
              expenseEndYear,
              expenseEndMonth
            ),
            `reporte_gastos_${expenseStartYear}_${String(expenseStartMonth).padStart(2, '0')}_a_${expenseEndYear}_${String(expenseEndMonth).padStart(2, '0')}`
          );
      case 'detailed-expenses':
        return () =>
          triggerDownload(
            reportsAPI.getDetailedExpensesReport(
              expenseStartYear,
              expenseStartMonth,
              expenseEndYear,
              expenseEndMonth
            ),
            `reporte_gastos_detallado_${expenseStartYear}_${String(expenseStartMonth).padStart(2, '0')}_a_${expenseEndYear}_${String(expenseEndMonth).padStart(2, '0')}`
          );
      case 'outstanding-fees':
        return () => triggerDownload(reportsAPI.getOutstandingFeesReport(), 'cuotas_pendientes');
      case 'all-payments':
        return () => triggerDownload(reportsAPI.getAllPaymentsReport(), 'reporte_pagos_completo');
      case 'all-expenses':
        return () => triggerDownload(reportsAPI.getExpensesReport(), 'reporte_gastos_administrativos');
      case 'traffic-light':
        return () => triggerDownload(reportsAPI.getTrafficLightReport(), 'reporte_semaforo_cuotas');
      default:
        return () => {};
    }
  };

  const paymentReports = [
    {
      type: 'property-history',
      title: 'Historial por propiedad',
      description: 'Pagos realizados y cuotas pendientes. Sin propiedad seleccionada incluye todas.',
    },
    { type: 'monthly-summary', title: 'Pagos por periodo', description: 'Pagos realizados en el rango de periodos.' },
    { type: 'payments-summary', title: 'Pagos agrupados', description: 'Pagos agrupados por mes y monto.' },
    { type: 'all-payments', title: 'Todos los pagos', description: 'Lista completa de pagos registrados.' },
  ];

  const feeReports = [
    { type: 'monthly-fees', title: 'Cuotas mensuales', description: 'Cuotas generadas en el rango de periodos.' },
    { type: 'paid-fees-summary', title: 'Cuotas pagadas', description: 'Cuotas pagadas vs gastos, con ingreso neto.' },
    { type: 'fee-payment-matrix', title: 'Matriz de pagos', description: 'Pagos por propiedad y mes con código de colores.' },
    { type: 'fee-contribution-summary', title: 'Contribución por cuota', description: 'Porcentaje de aporte por propiedad.' },
    { type: 'outstanding-fees', title: 'Cuotas pendientes', description: 'Todas las cuotas pendientes del condominio.' },
    { type: 'traffic-light', title: 'Semáforo de cuotas', description: 'Estado de morosidad: verde, amarillo y rojo.' },
  ];

  const expenseReports = [
    { type: 'expenses-by-period', title: 'Gastos por periodo', description: 'Gastos administrativos en el rango.' },
    { type: 'detailed-expenses', title: 'Gastos detallados', description: 'Resumen mensual con detalle de cada gasto.' },
    { type: 'all-expenses', title: 'Todos los gastos', description: 'Lista completa de gastos registrados.' },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Finanzas"
        title="Reportes"
        subtitle="Descarga reportes en Excel o PDF para el periodo que necesites."
        actions={
          <Button
            variant="outlined"
            startIcon={<CalendarIcon />}
            onClick={() => applyPreset('month')}
          >
            Este mes
          </Button>
        }
      />

      <SectionCard
        title="Rango rápido"
        subtitle="Aplica el mismo periodo a todos los reportes."
        icon={<CalendarIcon />}
        sx={{ mb: 3 }}
        contentSx={{ display: 'flex', gap: 1, flexWrap: 'wrap', py: 2 }}
      >
        <Button variant="outlined" size="small" onClick={() => applyPreset('month')}>
          Este mes
        </Button>
        <Button variant="outlined" size="small" onClick={() => applyPreset('quarter')}>
          Este trimestre
        </Button>
        <Button variant="outlined" size="small" onClick={() => applyPreset('year')}>
          Este año
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', color: 'text.secondary' }}>
          <ReportsIcon fontSize="small" />
          <Typography variant="caption">Los reportes se descargan al instante</Typography>
        </Box>
      </SectionCard>

      <SectionCard
        title="Reportes de pagos"
        subtitle="Filtra por periodo de cuota y propiedad."
        icon={<ReportsIcon />}
        sx={{ mb: 3 }}
      >
        <PeriodRange
          startYear={payStartYear}
          setStartYear={setPayStartYear}
          startMonth={payStartMonth}
          setStartMonth={setPayStartMonth}
          endYear={payEndYear}
          setEndYear={setPayEndYear}
          endMonth={payEndMonth}
          setEndMonth={setPayEndMonth}
        />
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Propiedad</InputLabel>
              <Select
                value={selectedProperty}
                onChange={(event) => setSelectedProperty(event.target.value)}
                label="Propiedad"
              >
                <MenuItem value="">
                  <em>Todas las propiedades</em>
                </MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {formatPropertyLabel(property)} · {property.owner_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Año del estado anual"
              type="number"
              value={statementYear}
              onChange={(event) => setStatementYear(parseInt(event.target.value, 10) || new Date().getFullYear())}
              inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {isAdmin &&
            paymentReports.map((report) => (
              <Grid key={report.type} size={{ xs: 12, sm: 6, lg: 3 }}>
                <ReportCard
                  title={report.title}
                  description={report.description}
                  onClick={getOnClick(report)}
                  disabled={loading}
                />
              </Grid>
            ))}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <ReportCard
              title="Estado anual por propiedad"
              description="Resumen anual de cuotas y pagos. Sin propiedad incluye todas."
              pdf
              onClick={() =>
                triggerDownload(
                  reportsAPI.getAnnualPropertyStatement(statementYear, selectedProperty || null),
                  `estado_anual_${statementYear}`
                )
              }
              disabled={loading || (!isAdmin && !selectedProperty)}
            />
          </Grid>
        </Grid>
      </SectionCard>

      {isAdmin && (
      <SectionCard
        title="Reportes de cuotas"
        subtitle="Analiza la emisión y el avance de cobranza."
        icon={<TableIcon />}
        sx={{ mb: 3 }}
      >
        <PeriodRange
          startYear={startYear}
          setStartYear={setStartYear}
          startMonth={startMonth}
          setStartMonth={setStartMonth}
          endYear={endYear}
          setEndYear={setEndYear}
          endMonth={endMonth}
          setEndMonth={setEndMonth}
        />
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {feeReports.map((report) => {
            const adminOnly = ['outstanding-fees', 'traffic-light', 'fee-payment-matrix'].includes(report.type);
            return (
              <Grid key={report.type} size={{ xs: 12, sm: 6, lg: 4 }}>
                <ReportCard
                  title={report.title}
                  description={report.description}
                  onClick={getOnClick(report)}
                  disabled={loading || (adminOnly && !isAdmin)}
                />
              </Grid>
            );
          })}
        </Grid>
      </SectionCard>

      )}

      {isAdmin && (
      <SectionCard
        title="Reportes de gastos"
        subtitle="Revisa los gastos administrativos de la comunidad."
        icon={<TableIcon />}
      >
        <PeriodRange
          startYear={expenseStartYear}
          setStartYear={setExpenseStartYear}
          startMonth={expenseStartMonth}
          setStartMonth={setExpenseStartMonth}
          endYear={expenseEndYear}
          setEndYear={setExpenseEndYear}
          endMonth={expenseEndMonth}
          setEndMonth={setExpenseEndMonth}
        />
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {expenseReports.map((report) => (
            <Grid key={report.type} size={{ xs: 12, sm: 6, lg: 4 }}>
              <ReportCard
                title={report.title}
                description={report.description}
                onClick={getOnClick(report)}
                disabled={loading || !isAdmin}
              />
            </Grid>
          ))}
        </Grid>
      </SectionCard>
      )}
    </PageContainer>
  );
};

export default ReportsManagement;
