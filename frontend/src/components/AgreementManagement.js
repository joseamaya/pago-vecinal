import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Box,
  Alert,
  Grid,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { agreementsAPI, propertiesAPI, feesAPI } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';
import LoadingSkeleton from './common/LoadingSkeleton';

const AgreementManagement = () => {
  const { isAdmin } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [properties, setProperties] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(null);
  const [formData, setFormData] = useState({
    property_id: '',
    fee_ids: [],
    monthly_amount: '',
    installments_count: '',
    start_date: '',
    notes: '',
  });
  const [totalDebt, setTotalDebt] = useState(0);
  const [calculatedInstallments, setCalculatedInstallments] = useState('');
  const [filters, setFilters] = useState({
    property_id: '',
    status: '',
  });

  const fetchAgreements = useCallback(async () => {
    try {
      setLoading(true);
      const filterParams = {};
      if (filters.property_id) filterParams.property_id = filters.property_id;
      if (filters.status) filterParams.status = filters.status;

      const response = await agreementsAPI.getAgreements(filterParams);
      setAgreements(response.data);
      setError('');
    } catch (err) {
      setError('Error al cargar convenios');
      console.error('Error fetching agreements:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  useEffect(() => {
    fetchProperties();
    fetchFees();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      setProperties(response.data);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchFees = async () => {
    try {
      const response = await feesAPI.getFees({ status: 'pending' });
      setFees(response.data);
    } catch (err) {
      console.error('Error fetching fees:', err);
    }
  };

  const handleOpenDialog = (agreement = null) => {
    if (agreement) {
      setEditingAgreement(agreement);
      setFormData({
        property_id: agreement.property_id,
        fee_ids: agreement.fee_ids,
        monthly_amount: agreement.monthly_amount.toString(),
        installments_count: agreement.installments_count.toString(),
        start_date: new Date(agreement.start_date).toISOString().split('T')[0],
        notes: agreement.notes || '',
      });
      setTotalDebt(agreement.total_debt);
      setCalculatedInstallments(agreement.installments_count.toString());
    } else {
      setEditingAgreement(null);
      setFormData({
        property_id: '',
        fee_ids: [],
        monthly_amount: '',
        installments_count: '',
        start_date: '',
        notes: '',
      });
      setTotalDebt(0);
      setCalculatedInstallments('');
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingAgreement(null);
    setFormData({
      property_id: '',
      fee_ids: [],
      monthly_amount: '',
      installments_count: '',
      start_date: '',
      notes: '',
    });
    setTotalDebt(0);
    setCalculatedInstallments('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (totalDebt === 0) {
      setError('Debe seleccionar al menos una cuota');
      return;
    }

    if (parseFloat(formData.monthly_amount) <= 0) {
      setError('El monto mensual debe ser mayor a 0');
      return;
    }

    if (parseFloat(formData.monthly_amount) > totalDebt) {
      setError('El monto mensual no puede ser mayor a la deuda total');
      return;
    }

    try {
      const submitData = {
        ...formData,
        monthly_amount: parseFloat(formData.monthly_amount),
        installments_count: parseInt(calculatedInstallments),
        start_date: new Date(formData.start_date).toISOString(),
      };

      if (editingAgreement) {
        await agreementsAPI.updateAgreement(editingAgreement.id, submitData);
      } else {
        await agreementsAPI.createAgreement(submitData);
      }
      fetchAgreements();
      handleCloseDialog();
    } catch (err) {
      setError(editingAgreement ? 'Error al actualizar convenio' : 'Error al crear convenio');
      console.error('Error saving agreement:', err);
    }
  };

  const handleDelete = async (agreementId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este convenio?')) {
      try {
        await agreementsAPI.deleteAgreement(agreementId);
        fetchAgreements();
      } catch (err) {
        setError('Error al eliminar convenio');
        console.error('Error deleting agreement:', err);
      }
    }
  };

  const handleDownloadPDF = async (agreementId, agreementNumber) => {
    try {
      const response = await agreementsAPI.downloadAgreementPDF(agreementId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `convenio_${agreementNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al descargar PDF');
      console.error('Error downloading PDF:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'primary';
      case 'cancelled':
        return 'error';
      case 'defaulted':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
      case 'defaulted':
        return 'Incumplido';
      default:
        return status;
    }
  };

  const getInstallmentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getInstallmentStatusLabel = (status) => {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'pending':
        return 'Pendiente';
      case 'overdue':
        return 'Vencido';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getPropertyInfo = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? `${property.villa} ${property.row_letter}${property.number}` : 'N/A';
  };

  const getPropertyFees = (propertyId) => {
    return fees.filter(fee => fee.property_id === propertyId);
  };

  const handleFilterChange = (field, value) => {
    setFilters({
      ...filters,
      [field]: value,
    });
  };

  const handleApplyFilters = () => {
    fetchAgreements();
  };

  const handleClearFilters = () => {
    setFilters({
      property_id: '',
      status: '',
    });
    fetchAgreements();
  };

  const calculateTotalPaid = (installments) => {
    return installments
      .filter(inst => inst.status === 'paid')
      .reduce((total, inst) => total + inst.amount, 0);
  };

  const calculatePendingAmount = (agreement) => {
    const totalPaid = calculateTotalPaid(agreement.installments);
    return agreement.total_debt - totalPaid;
  };

  const calculateTotalDebt = (selectedFeeIds) => {
    return fees
      .filter(fee => selectedFeeIds.includes(fee.id))
      .reduce((total, fee) => total + fee.amount, 0);
  };

  const calculateInstallmentsCount = (totalDebt, monthlyAmount) => {
    if (monthlyAmount <= 0) return '';
    return Math.ceil(totalDebt / monthlyAmount);
  };

  const handleFeeSelection = (feeId) => {
    const newSelectedFees = formData.fee_ids.includes(feeId)
      ? formData.fee_ids.filter(id => id !== feeId)
      : [...formData.fee_ids, feeId];

    const newTotalDebt = calculateTotalDebt(newSelectedFees);
    const newCalculatedInstallments = calculateInstallmentsCount(newTotalDebt, parseFloat(formData.monthly_amount) || 0);

    setFormData({ ...formData, fee_ids: newSelectedFees });
    setTotalDebt(newTotalDebt);
    setCalculatedInstallments(newCalculatedInstallments);
  };

  const handleMonthlyAmountChange = (value) => {
    const monthlyAmount = parseFloat(value) || 0;
    const newCalculatedInstallments = calculateInstallmentsCount(totalDebt, monthlyAmount);

    setFormData({ ...formData, monthly_amount: value });
    setCalculatedInstallments(newCalculatedInstallments);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Convenios
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Convenio
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filtros
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Propiedad</InputLabel>
              <Select
                value={filters.property_id}
                onChange={(e) => handleFilterChange('property_id', e.target.value)}
                label="Propiedad"
              >
                <MenuItem value="">
                  <em>Todas</em>
                </MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {property.villa} {property.row_letter}{property.number} - {property.owner_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Estado"
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                <MenuItem value="active">Activo</MenuItem>
                <MenuItem value="completed">Completado</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
                <MenuItem value="defaulted">Incumplido</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                onClick={handleApplyFilters}
                fullWidth
              >
                Aplicar Filtros
              </Button>
              <Button
                variant="outlined"
                onClick={handleClearFilters}
                fullWidth
              >
                Limpiar
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {loading ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <LoadingSpinner message="Cargando convenios..." />
            </Paper>
          </Grid>
        ) : agreements.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography>No hay convenios registrados</Typography>
            </Paper>
          </Grid>
        ) : (
          agreements.map((agreement) => (
            <Grid item xs={12} key={agreement.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      Convenio {agreement.agreement_number}
                    </Typography>
                    <Box display="flex" gap={1}>
                      <Chip
                        label={getStatusLabel(agreement.status)}
                        color={getStatusColor(agreement.status)}
                        size="small"
                      />
                      <IconButton
                        color="primary"
                        onClick={() => handleDownloadPDF(agreement.id, agreement.agreement_number)}
                        title="Descargar PDF"
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(agreement)}
                        title="Editar"
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(agreement.id)}
                          title="Eliminar"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Propiedad
                      </Typography>
                      <Typography variant="body1">
                        {getPropertyInfo(agreement.property_id)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Deuda Total
                      </Typography>
                      <Typography variant="body1">
                        S/ {agreement.total_debt.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Monto Mensual
                      </Typography>
                      <Typography variant="body1">
                        S/ {agreement.monthly_amount.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Cuotas
                      </Typography>
                      <Typography variant="body1">
                        {agreement.installments_count}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Fecha Inicio
                      </Typography>
                      <Typography variant="body1">
                        {new Date(agreement.start_date).toLocaleDateString('es-ES')}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Fecha Fin
                      </Typography>
                      <Typography variant="body1">
                        {new Date(agreement.end_date).toLocaleDateString('es-ES')}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Total Pagado
                      </Typography>
                      <Typography variant="body1">
                        S/ {calculateTotalPaid(agreement.installments).toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Pendiente
                      </Typography>
                      <Typography variant="body1">
                        S/ {calculatePendingAmount(agreement).toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Ver Detalle de Cuotas</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Cuota</TableCell>
                              <TableCell>Monto</TableCell>
                              <TableCell>Fecha Vencimiento</TableCell>
                              <TableCell>Estado</TableCell>
                              <TableCell>Fecha Pago</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {agreement.installments.map((installment) => (
                              <TableRow key={installment.id}>
                                <TableCell>{installment.installment_number}</TableCell>
                                <TableCell>S/ {installment.amount.toFixed(2)}</TableCell>
                                <TableCell>
                                  {new Date(installment.due_date).toLocaleDateString('es-ES')}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={getInstallmentStatusLabel(installment.status)}
                                    color={getInstallmentStatusColor(installment.status)}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  {installment.paid_date
                                    ? new Date(installment.paid_date).toLocaleDateString('es-ES')
                                    : '-'
                                  }
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog for Add/Edit Agreement */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAgreement ? 'Editar Convenio' : 'Nuevo Convenio'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              {/* Property Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Propiedad</InputLabel>
                  <Select
                    value={formData.property_id}
                    onChange={(e) => {
                      setFormData({ ...formData, property_id: e.target.value, fee_ids: [] });
                      setTotalDebt(0);
                      setCalculatedInstallments('');
                    }}
                    label="Propiedad"
                    required
                  >
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        {property.villa} {property.row_letter}{property.number} - {property.owner_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Fee Selection with Checkboxes */}
              {formData.property_id && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Seleccionar Cuotas
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                    {getPropertyFees(formData.property_id).length === 0 ? (
                      <Typography color="text.secondary">
                        No hay cuotas pendientes para esta propiedad
                      </Typography>
                    ) : (
                      getPropertyFees(formData.property_id).map((fee) => (
                        <Box key={fee.id} display="flex" alignItems="center" sx={{ mb: 1 }}>
                          <Checkbox
                            checked={formData.fee_ids.includes(fee.id)}
                            onChange={() => handleFeeSelection(fee.id)}
                          />
                          <Box sx={{ ml: 1, flex: 1 }}>
                            <Typography variant="body2">
                              <strong>{fee.month}/{fee.year}</strong> - S/ {fee.amount.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Vencimiento: {new Date(fee.due_date).toLocaleDateString('es-ES')}
                            </Typography>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Paper>

                  {/* Total Debt Display */}
                  {totalDebt > 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <strong>Deuda Total Seleccionada: S/ {totalDebt.toFixed(2)}</strong>
                    </Alert>
                  )}
                </Grid>
              )}

              {/* Monthly Amount */}
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Monto Mensual"
                  type="number"
                  fullWidth
                  required
                  value={formData.monthly_amount}
                  onChange={(e) => handleMonthlyAmountChange(e.target.value)}
                  inputProps={{ min: 0.01, step: 0.01 }}
                  helperText={totalDebt > 0 ? `Máximo recomendado: S/ ${totalDebt.toFixed(2)}` : ''}
                />
              </Grid>

              {/* Auto-calculated Installments */}
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Número de Cuotas (Calculado)"
                  type="number"
                  fullWidth
                  value={calculatedInstallments}
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Calculado automáticamente basado en deuda total / monto mensual"
                />
              </Grid>

              {/* Start Date */}
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Fecha de Inicio"
                  type="date"
                  fullWidth
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  label="Notas"
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingAgreement ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default AgreementManagement;