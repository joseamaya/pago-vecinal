import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Paper, Grid, Card, CardContent, CardActions,
  Button, TextField, MenuItem, Alert, FormControl, InputLabel, Select,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI, propertiesAPI } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

const MONTHS = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

const ReportsManagement = () => {
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    if (isAdmin) fetchProperties();
  }, [isAdmin]);

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const triggerDownload = async (apiCall, filename) => {
    setLoading(true);
    setError('');
    setSuccess('');
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

      setSuccess('Reporte descargado exitosamente');
    } catch (err) {
      setError('Error al descargar el reporte');
      console.error('Error downloading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const ReportCard = ({ title, description, onClick, disabled, icon }) => (
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </CardContent>
        <CardActions>
          <Button fullWidth variant="contained" onClick={onClick} disabled={disabled || loading}>
            {loading ? (
              <LoadingSpinner buttonVariant size={20} message="Generando..." showMessage />
            ) : (
              <>{icon || <TableChartIcon sx={{ mr: 1 }} />} Descargar</>
            )}
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );

  const renderReport = (report) => {
    const canAccess = !report.adminOnly || isAdmin;

    const getOnClick = () => {
      switch (report.type) {
        case 'property-history':
          return () => triggerDownload(
            reportsAPI.getPropertyPaymentHistory(selectedProperty || null, payStartYear, payStartMonth, payEndYear, payEndMonth, 'excel'),
            `historial_pagos_${payStartYear}_${String(payStartMonth).padStart(2, '0')}_a_${payEndYear}_${String(payEndMonth).padStart(2, '0')}`
          );
        case 'monthly-summary':
          return () => triggerDownload(
            reportsAPI.getMonthlyPaymentSummary(payStartYear, payStartMonth, payEndYear, payEndMonth),
            `resumen_pagos_${payStartYear}_${String(payStartMonth).padStart(2, '0')}_a_${payEndYear}_${String(payEndMonth).padStart(2, '0')}`
          );
        case 'payments-summary':
          return () => triggerDownload(
            reportsAPI.getPaymentsSummary(payStartYear, payStartMonth, payEndYear, payEndMonth),
            `resumen_pagos_${payStartYear}_${String(payStartMonth).padStart(2, '0')}_a_${payEndYear}_${String(payEndMonth).padStart(2, '0')}`
          );
        case 'monthly-fees':
          return () => triggerDownload(
            reportsAPI.getMonthlyFeesReport(startYear, startMonth, endYear, endMonth),
            `cuotas_mensuales_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
        case 'paid-fees-summary':
          return () => triggerDownload(
            reportsAPI.getPaidFeesSummary(startYear, startMonth, endYear, endMonth),
            `resumen_cuotas_pagadas_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
        case 'fee-payment-matrix':
          return () => triggerDownload(
            reportsAPI.getFeePaymentMatrix(startYear, startMonth, endYear, endMonth),
            `matriz_pagos_cuotas_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
        case 'fee-contribution-summary':
          return () => triggerDownload(
            reportsAPI.getFeeContributionSummary(startYear, startMonth, endYear, endMonth),
            `resumen_contribucion_cuotas_${startYear}_${String(startMonth).padStart(2, '0')}_a_${endYear}_${String(endMonth).padStart(2, '0')}`
          );
        case 'expenses-by-period':
          return () => triggerDownload(
            reportsAPI.getExpensesByPeriodRangeReport(expenseStartYear, expenseStartMonth, expenseEndYear, expenseEndMonth),
            `reporte_gastos_${expenseStartYear}_${String(expenseStartMonth).padStart(2, '0')}_a_${expenseEndYear}_${String(expenseEndMonth).padStart(2, '0')}`
          );
        case 'detailed-expenses':
          return () => triggerDownload(
            reportsAPI.getDetailedExpensesReport(expenseStartYear, expenseStartMonth, expenseEndYear, expenseEndMonth),
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
        case 'annual-statement':
          return () => triggerDownload(
            reportsAPI.getAnnualPropertyStatement(statementYear, selectedProperty || null),
            `estado_anual_${statementYear}`
          );
        default:
          return () => {};
      }
    };

    return (
      <ReportCard
        key={report.type}
        title={report.title}
        description={report.description}
        onClick={getOnClick()}
        disabled={!canAccess}
      />
    );
  };

  const monthSelect = (value, onChange, label) => (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select value={value} onChange={(e) => onChange(e.target.value)} label={label}>
        {MONTHS.map((m) => (
          <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const yearField = (value, onChange, label) => (
    <TextField
      fullWidth label={label} type="number" value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || new Date().getFullYear())}
      inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
    />
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>Gestión de Reportes</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Payment Reports */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Reportes de Pagos</Typography>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Filtros por Período de Cuota</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>{yearField(payStartYear, setPayStartYear, 'Año Inicial')}</Grid>
          <Grid item xs={12} md={3}>{monthSelect(payStartMonth, setPayStartMonth, 'Mes Inicial')}</Grid>
          <Grid item xs={12} md={3}>{yearField(payEndYear, setPayEndYear, 'Año Final')}</Grid>
          <Grid item xs={12} md={3}>{monthSelect(payEndMonth, setPayEndMonth, 'Mes Final')}</Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Propiedad</InputLabel>
              <Select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} label="Propiedad">
                <MenuItem value=""><em>Todas</em></MenuItem>
                {properties.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    Villa {p.villa} - {p.row_letter}{p.number} - {p.owner_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            {yearField(statementYear, setStatementYear, 'Año Estado Anual')}
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {[
            { type: 'property-history', title: 'Historial de Pagos por Propiedad', description: 'Pagos realizados y cuotas pendientes. Sin selección = todas las propiedades.' },
            { type: 'monthly-summary', title: 'Resumen de Pagos por Período', description: 'Todos los pagos realizados para cuotas de un rango de períodos.' },
            { type: 'payments-summary', title: 'Resumen de Pagos Agrupado', description: 'Pagos agrupados por mes y monto en el rango de períodos.' },
            { type: 'all-payments', title: 'Todos los Pagos', description: 'Lista completa de todos los pagos registrados.' },
            { type: 'annual-statement', title: 'Estado Anual por Propiedad', description: 'Resumen anual de cuotas y pagos. Sin selección = todas las propiedades (admin).' },
          ].map((r) => {
            if (r.type === 'annual-statement') {
              const canAccess = isAdmin || (!isAdmin && selectedProperty);
              return (
                <ReportCard
                  key={r.type}
                  title={r.title}
                  description={r.description}
                  onClick={() => triggerDownload(
                    reportsAPI.getAnnualPropertyStatement(statementYear, selectedProperty || null),
                    `estado_anual_${statementYear}`
                  )}
                  disabled={!canAccess || loading}
                  icon={<PictureAsPdfIcon sx={{ mr: 1 }} />}
                />
              );
            }
            return renderReport({ ...r, adminOnly: true });
          })}
        </Grid>
      </Paper>

      {/* Fee Reports */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Reportes de Cuotas</Typography>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Filtros</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>{yearField(startYear, setStartYear, 'Año Inicial')}</Grid>
          <Grid item xs={12} md={3}>{monthSelect(startMonth, setStartMonth, 'Mes Inicial')}</Grid>
          <Grid item xs={12} md={3}>{yearField(endYear, setEndYear, 'Año Final')}</Grid>
          <Grid item xs={12} md={3}>{monthSelect(endMonth, setEndMonth, 'Mes Final')}</Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {[
            { type: 'monthly-fees', title: 'Cuotas Mensuales', description: 'Lista de cuotas generadas en un rango de períodos.' },
            { type: 'paid-fees-summary', title: 'Resumen de Cuotas Pagadas', description: 'Cuotas pagadas vs gastos por período, con ingreso neto.' },
            { type: 'fee-payment-matrix', title: 'Matriz de Pagos', description: 'Matriz de pagos por propiedad y mes con código de colores.' },
            { type: 'fee-contribution-summary', title: 'Contribución de Cuotas', description: '% de aporte por propiedad en el período.' },
            { type: 'outstanding-fees', title: 'Cuotas Pendientes', description: 'Todas las cuotas pendientes de pago en todo el condominio.' },
            { type: 'traffic-light', title: 'Semáforo de Cuotas', description: 'Estado de morosidad: verde (0-1), amarillo (2), rojo (3+).' },
          ].map((r) => (
            r.type === 'outstanding-fees' || r.type === 'traffic-light'
              ? <ReportCard key={r.type} title={r.title} description={r.description}
                  onClick={() => triggerDownload(
                    r.type === 'outstanding-fees' ? reportsAPI.getOutstandingFeesReport() : reportsAPI.getTrafficLightReport(),
                    r.type === 'outstanding-fees' ? 'cuotas_pendientes' : 'reporte_semaforo_cuotas'
                  )}
                  disabled={!isAdmin} />
              : renderReport({ ...r, adminOnly: true })
          ))}
        </Grid>
      </Paper>

      {/* Expense Reports */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Reportes de Gastos Administrativos</Typography>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Filtros</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>{yearField(expenseStartYear, setExpenseStartYear, 'Año Inicial')}</Grid>
          <Grid item xs={12} md={3}>{monthSelect(expenseStartMonth, setExpenseStartMonth, 'Mes Inicial')}</Grid>
          <Grid item xs={12} md={3}>{yearField(expenseEndYear, setExpenseEndYear, 'Año Final')}</Grid>
          <Grid item xs={12} md={3}>{monthSelect(expenseEndMonth, setExpenseEndMonth, 'Mes Final')}</Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {[
            { type: 'expenses-by-period', title: 'Gastos por Rango de Períodos', description: 'Lista de gastos administrativos en un rango.' },
            { type: 'detailed-expenses', title: 'Gastos Detallados por Mes', description: 'Resumen mensual con detalle individual de gastos.' },
            { type: 'all-expenses', title: 'Todos los Gastos', description: 'Lista completa de todos los gastos registrados.' },
          ].map((r) => (
            r.type === 'all-expenses'
              ? <ReportCard key={r.type} title={r.title} description={r.description}
                  onClick={() => triggerDownload(reportsAPI.getExpensesReport(), 'reporte_gastos_administrativos')}
                  disabled={!isAdmin} />
              : renderReport({ ...r, adminOnly: true })
          ))}
        </Grid>
      </Paper>
    </Container>
  );
};

export default ReportsManagement;
