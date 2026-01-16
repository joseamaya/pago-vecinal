import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Box,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI, propertiesAPI } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import TableChartIcon from '@mui/icons-material/TableChart';

const ReportsManagement = () => {
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (isAdmin) {
      fetchProperties();
    }
  }, [isAdmin]);

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const downloadReport = async (reportType, propertyId = null) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let response;
      let filename;

      switch (reportType) {
        case 'property-history':
          response = await reportsAPI.getPropertyPaymentHistory(propertyId, startDate, endDate, selectedFormat);
          filename = `historial_pagos.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'monthly-summary':
          response = await reportsAPI.getMonthlyPaymentSummary(startDate, endDate, selectedFormat);
          filename = `resumen_pagos.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'payments-summary':
          response = await reportsAPI.getPaymentsSummary(startDate, endDate, selectedFormat);
          filename = `resumen_pagos_fecha.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'monthly-fees':
          response = await reportsAPI.getMonthlyFeesReport(startYear, startMonth, endYear, endMonth, selectedFormat);
          filename = `cuotas_mensuales_${startYear}_${startMonth.toString().padStart(2, '0')}_a_${endYear}_${endMonth.toString().padStart(2, '0')}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'paid-fees-summary':
          response = await reportsAPI.getPaidFeesSummary(startYear, startMonth, endYear, endMonth, selectedFormat);
          filename = `resumen_cuotas_pagadas_${startYear}_${startMonth.toString().padStart(2, '0')}_a_${endYear}_${endMonth.toString().padStart(2, '0')}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'fee-payment-matrix':
          response = await reportsAPI.getFeePaymentMatrix(startYear, startMonth, endYear, endMonth, selectedFormat);
          filename = `matriz_pagos_cuotas_${startYear}_${startMonth.toString().padStart(2, '0')}_a_${endYear}_${endMonth.toString().padStart(2, '0')}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        default:
          throw new Error('Tipo de reporte desconocido');
      }

      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
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

  const reports = [
    {
      title: 'Historial de Pagos por Propiedad',
      description: 'Muestra todos los pagos realizados y cuotas pendientes para una propiedad específica.',
      type: 'property-history',
      requiresProperty: true,
      adminOnly: true,
    },
    {
      title: 'Resumen de Pagos Mensual',
      description: 'Resumen de todos los pagos realizados en un mes específico.',
      type: 'monthly-summary',
      requiresProperty: false,
      adminOnly: true,
    },
    {
      title: 'Resumen de Pagos',
      description: 'Resumen de pagos por mes según fechas.',
      type: 'payments-summary',
      requiresProperty: false,
      adminOnly: true,
    },
    {
      title: 'Reporte de Cuotas Mensuales',
      description: 'Lista todas las cuotas generadas en un rango de períodos específico.',
      type: 'monthly-fees',
      requiresProperty: false,
      adminOnly: true,
    },
    {
      title: 'Resumen de Cuotas Pagadas',
      description: 'Resumen mensual de cuotas pagadas por período.',
      type: 'paid-fees-summary',
      requiresProperty: false,
      adminOnly: true,
    },
    {
      title: 'Matriz de Pagos de Cuotas',
      description: 'Matriz de pagos por propiedad y mes con colores.',
      type: 'fee-payment-matrix',
      requiresProperty: false,
      adminOnly: true,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Gestión de Reportes
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Payment Reports Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Reportes de Pagos
        </Typography>
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Filtros
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Año"
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Fecha Inicio"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Fecha Fin"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          {isAdmin && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Propiedad</InputLabel>
                <Select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  label="Propiedad"
                >
                  <MenuItem value="">
                    <em>Seleccionar propiedad</em>
                  </MenuItem>
                  {properties.map((property) => (
                    <MenuItem key={property.id} value={property.id}>
                      Villa {property.villa} - {property.row_letter}{property.number} - {property.owner_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {reports.filter(r => ['property-history', 'monthly-summary', 'payments-summary'].includes(r.type)).map((report) => {
            const canAccess = !report.adminOnly || isAdmin;
            const canGenerate = !report.requiresProperty || selectedProperty || !isAdmin;

            return (
              <Grid item xs={12} md={6} key={report.type}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {report.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {report.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => downloadReport(report.type, selectedProperty)}
                      disabled={loading || !canAccess || !canGenerate}
                    >
                      {loading ? (
                        <LoadingSpinner buttonVariant size={20} message="Generando..." showMessage />
                      ) : (
                        <>
                          <TableChartIcon sx={{ mr: 1 }} />
                          Descargar Excel
                        </>
                      )}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Fee Reports Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Reportes de Cuotas
        </Typography>
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Filtros
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Año Inicial"
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
              inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Mes Inicial</InputLabel>
              <Select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                label="Mes Inicial"
              >
                <MenuItem value={1}>Enero</MenuItem>
                <MenuItem value={2}>Febrero</MenuItem>
                <MenuItem value={3}>Marzo</MenuItem>
                <MenuItem value={4}>Abril</MenuItem>
                <MenuItem value={5}>Mayo</MenuItem>
                <MenuItem value={6}>Junio</MenuItem>
                <MenuItem value={7}>Julio</MenuItem>
                <MenuItem value={8}>Agosto</MenuItem>
                <MenuItem value={9}>Septiembre</MenuItem>
                <MenuItem value={10}>Octubre</MenuItem>
                <MenuItem value={11}>Noviembre</MenuItem>
                <MenuItem value={12}>Diciembre</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Año Final"
              type="number"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value))}
              inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Mes Final</InputLabel>
              <Select
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                label="Mes Final"
              >
                <MenuItem value={1}>Enero</MenuItem>
                <MenuItem value={2}>Febrero</MenuItem>
                <MenuItem value={3}>Marzo</MenuItem>
                <MenuItem value={4}>Abril</MenuItem>
                <MenuItem value={5}>Mayo</MenuItem>
                <MenuItem value={6}>Junio</MenuItem>
                <MenuItem value={7}>Julio</MenuItem>
                <MenuItem value={8}>Agosto</MenuItem>
                <MenuItem value={9}>Septiembre</MenuItem>
                <MenuItem value={10}>Octubre</MenuItem>
                <MenuItem value={11}>Noviembre</MenuItem>
                <MenuItem value={12}>Diciembre</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {reports.filter(r => ['monthly-fees', 'paid-fees-summary', 'fee-payment-matrix'].includes(r.type)).map((report) => {
            const canAccess = !report.adminOnly || isAdmin;
            const canGenerate = true; // No property required for fee reports

            return (
              <Grid item xs={12} md={6} key={report.type}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {report.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {report.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => downloadReport(report.type)}
                      disabled={loading || !canAccess || !canGenerate}
                    >
                      {loading ? (
                        <LoadingSpinner buttonVariant size={20} message="Generando..." showMessage />
                      ) : (
                        <>
                          <TableChartIcon sx={{ mr: 1 }} />
                          Descargar Excel
                        </>
                      )}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
    </Container>
  );
};

export default ReportsManagement;