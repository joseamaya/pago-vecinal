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
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI, propertiesAPI } from '../services/api';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

const ReportsManagement = () => {
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
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
      setProperties(response.data);
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
          response = await reportsAPI.getPropertyPaymentHistory(propertyId, selectedYear, selectedFormat);
          filename = `historial_pagos_${selectedYear}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'outstanding-fees':
          response = await reportsAPI.getOutstandingFeesReport(selectedFormat);
          filename = `cuotas_pendientes.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'monthly-summary':
          response = await reportsAPI.getMonthlyPaymentSummary(selectedYear, selectedMonth, selectedFormat);
          filename = `resumen_mensual_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'monthly-fees':
          response = await reportsAPI.getMonthlyFeesReport(startYear, startMonth, endYear, endMonth, selectedFormat);
          filename = `cuotas_mensuales_${startYear}_${startMonth.toString().padStart(2, '0')}_a_${endYear}_${endMonth.toString().padStart(2, '0')}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'annual-statement':
          response = await reportsAPI.getAnnualPropertyStatement(propertyId, selectedYear, selectedFormat);
          filename = `estado_anual_${selectedYear}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'expenses':
          response = await reportsAPI.getExpensesReport(selectedFormat);
          filename = `reporte_gastos_administrativos.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        default:
          throw new Error('Tipo de reporte desconocido');
      }

      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
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
      title: 'Cuotas Pendientes - Reporte General',
      description: 'Lista todas las cuotas pendientes de todas las propiedades.',
      type: 'outstanding-fees',
      requiresProperty: false,
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
      title: 'Reporte de Cuotas Mensuales',
      description: 'Lista todas las cuotas generadas en un rango de períodos específico.',
      type: 'monthly-fees',
      requiresProperty: false,
      adminOnly: true,
    },
    {
      title: 'Estado Anual por Propiedad',
      description: 'Estado anual detallado de cuotas y pagos para una propiedad.',
      type: 'annual-statement',
      requiresProperty: true,
      adminOnly: false, // Owners can see their own statements
    },
    {
      title: 'Reporte de Gastos Administrativos',
      description: 'Lista completa de todos los gastos administrativos realizados.',
      type: 'expenses',
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

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filtros de Reporte
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Año"
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              inputProps={{ min: 2020, max: new Date().getFullYear() + 1 }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Mes</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label="Mes"
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
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Formato</InputLabel>
              <Select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                label="Formato"
              >
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="excel">Excel</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {isAdmin && (
            <Grid item xs={12} md={4}>
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

        {/* Period Range Filters for Monthly Fees Report */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Rango de Períodos (para Reporte de Cuotas Mensuales)
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
      </Paper>

      {/* Reports Grid */}
      <Grid container spacing={3}>
        {reports.map((report) => {
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
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() => downloadReport(report.type, selectedProperty)}
                    disabled={loading || !canAccess || !canGenerate}
                  >
                    {loading ? 'Generando...' : 'Descargar PDF'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
};

export default ReportsManagement;