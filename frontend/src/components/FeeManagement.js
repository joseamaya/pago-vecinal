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
  Checkbox,
  ListItemText,
  OutlinedInput,
  Grid,
  Pagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { feesAPI, propertiesAPI, feeSchedulesAPI, reportsAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';
import PaymentsModal from './PaymentsModal';

const FeeManagement = () => {
  const { isAdmin } = useAuth();
  const [fees, setFees] = useState([]);
  const [properties, setProperties] = useState([]);
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [formData, setFormData] = useState({
    property_id: '',
    fee_schedule_id: '',
    due_date: '',
    notes: '',
  });
  const [generateFormData, setGenerateFormData] = useState({
    year: new Date().getFullYear(),
    months: [new Date().getMonth() + 1], // Array of selected months
    feeScheduleIds: [], // Array of selected fee schedule IDs
  });
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: '',
    status: '',
    property: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [selectedFeeForPayments, setSelectedFeeForPayments] = useState(null);

  const fetchFees = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const filterParams = {};
      if (filters.year) filterParams.year = parseInt(filters.year);
      if (filters.month) filterParams.month = parseInt(filters.month);
      if (filters.status) filterParams.status = filters.status;
      if (filters.property) filterParams.property_id = filters.property;
      filterParams.sort_by_period = true; // Always sort by period

      const response = await feesAPI.getFees(filterParams, page, pageSize);
      setFees(response.data.data);
      setTotalPages(response.data.pagination.total_pages);
      setTotalCount(response.data.pagination.total_count);
      setCurrentPage(page);
      setError('');
    } catch (err) {
      setError('Error al cargar cuotas');
      console.error('Error fetching fees:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  useEffect(() => {
    fetchProperties();
    fetchFeeSchedules();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      setProperties(response.data);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchFeeSchedules = async () => {
    try {
      const response = await feeSchedulesAPI.getFeeSchedules();
      setFeeSchedules(response.data);
    } catch (err) {
      console.error('Error fetching fee schedules:', err);
    }
  };

  const handleOpenDialog = (fee = null) => {
    if (fee) {
      setEditingFee(fee);
      setFormData({
        property_id: fee.property_id,
        fee_schedule_id: fee.fee_schedule_id,
        due_date: new Date(fee.due_date).toISOString().split('T')[0],
        notes: fee.notes || '',
      });
    } else {
      setEditingFee(null);
      setFormData({
        property_id: '',
        fee_schedule_id: '',
        due_date: '',
        reference: '',
        notes: '',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingFee(null);
    setFormData({
      property_id: '',
      fee_schedule_id: '',
      due_date: '',
      notes: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        due_date: new Date(formData.due_date).toISOString(),
      };

      if (editingFee) {
        await feesAPI.updateFee(editingFee.id, submitData);
      } else {
        await feesAPI.createFee(submitData);
      }
      fetchFees(currentPage);
      handleCloseDialog();
    } catch (err) {
      setError(editingFee ? 'Error al actualizar cuota' : 'Error al crear cuota');
      console.error('Error saving fee:', err);
    }
  };

  const handleDelete = async (feeId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta cuota?')) {
      try {
        await feesAPI.deleteFee(feeId);
        fetchFees(currentPage);
      } catch (err) {
        setError('Error al eliminar cuota');
        console.error('Error deleting fee:', err);
      }
    }
  };

  const handleGenerateFees = () => {
    setGenerateOpen(true);
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await feesAPI.generateFees(
        true,
        generateFormData.year,
        generateFormData.months,
        generateFormData.feeScheduleIds.length > 0 ? generateFormData.feeScheduleIds : null
      );
      alert(response.data.message);
      fetchFees(currentPage);
      setGenerateOpen(false);
    } catch (err) {
      setError('Error al generar cuotas');
      console.error('Error generating fees:', err);
    }
  };

  const handleGenerateClose = () => {
    setGenerateOpen(false);
    setGenerateFormData({
      year: new Date().getFullYear(),
      months: [new Date().getMonth() + 1],
      feeScheduleIds: [],
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'partially_paid':
        return 'info';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
      case 'agreement':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'pending':
        return 'Pendiente';
      case 'partially_paid':
        return 'Pago Parcial';
      case 'failed':
        return 'Fallido';
      case 'cancelled':
        return 'Cancelado';
      case 'agreement':
        return 'Convenio';
      default:
        return status;
    }
  };

  const getPropertyInfo = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? `${property.villa} ${property.row_letter}${property.number}` : 'N/A';
  };

  const monthsOptions = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  const handleMonthsChange = (event) => {
    const { value } = event.target;
    setGenerateFormData({
      ...generateFormData,
      months: typeof value === 'string' ? value.split(',').map(Number) : value,
    });
  };

  const handleFeeSchedulesChange = (event) => {
    const { value } = event.target;
    setGenerateFormData({
      ...generateFormData,
      feeScheduleIds: typeof value === 'string' ? value.split(',') : value,
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters({
      ...filters,
      [field]: value,
    });
  };

  const handleApplyFilters = () => {
    setCurrentPage(1); // Reset to first page when filters change
    fetchFees(1);
  };

  const handleClearFilters = () => {
    setFilters({
      year: new Date().getFullYear(),
      month: '',
      status: '',
      property: '',
    });
    setCurrentPage(1); // Reset to first page
    fetchFees(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchFees(newPage);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await reportsAPI.getFilteredFeesReport(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cuotas_filtradas_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al descargar el reporte Excel');
      console.error('Error downloading Excel report:', err);
    }
  };

  const handleViewPayments = (fee) => {
    setSelectedFeeForPayments(fee);
    setPaymentsModalOpen(true);
  };

  const handleClosePaymentsModal = () => {
    setPaymentsModalOpen(false);
    setSelectedFeeForPayments(null);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Cuotas
        </Typography>
        <Box>
          {isAdmin && (
            <>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleGenerateFees}
                sx={{ mr: 2 }}
              >
                Generar Cuotas
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
                sx={{ mr: 2 }}
              >
                Descargar Excel
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nueva Cuota
          </Button>
        </Box>
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
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="Año"
              type="number"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              inputProps={{ min: 2020, max: 2030 }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Mes</InputLabel>
              <Select
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                label="Mes"
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                {monthsOptions.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    {month.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
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
                <MenuItem value="pending">Pendiente</MenuItem>
                <MenuItem value="partially_paid">Pago Parcial</MenuItem>
                <MenuItem value="completed">Completado</MenuItem>
                <MenuItem value="failed">Fallido</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
                <MenuItem value="agreement">Convenio</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Propiedad</InputLabel>
              <Select
                value={filters.property}
                onChange={(e) => handleFilterChange('property', e.target.value)}
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

      <Paper>
        {/* Pagination Info */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Mostrando {fees.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount} cuotas
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Propiedad</TableCell>
                <TableCell>Monto Total</TableCell>
                <TableCell>Monto Pagado</TableCell>
                <TableCell>Monto Pendiente</TableCell>
                <TableCell>Año</TableCell>
                <TableCell>Mes</TableCell>
                <TableCell>Fecha de Vencimiento</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={5} columns={9} />
              ) : fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No hay cuotas registradas
                  </TableCell>
                </TableRow>
              ) : (
                fees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell>{getPropertyInfo(fee.property_id)}</TableCell>
                    <TableCell>S/ {fee.amount.toFixed(2)}</TableCell>
                    <TableCell>S/ {(fee.paid_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>S/ {(fee.remaining_amount || fee.amount).toFixed(2)}</TableCell>
                    <TableCell>{fee.year}</TableCell>
                    <TableCell>{fee.month}</TableCell>
                    <TableCell>
                      {new Date(fee.due_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(fee.status)}
                        color={getStatusColor(fee.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {(fee.status === 'completed' || fee.status === 'partially_paid') && (
                        <IconButton
                          color="info"
                          onClick={() => handleViewPayments(fee)}
                          title="Ver Pagos"
                        >
                          <ViewIcon />
                        </IconButton>
                      )}
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(fee)}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(fee.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(event, page) => handlePageChange(page)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Dialog for Add/Edit Fee */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingFee ? 'Editar Cuota' : 'Nueva Cuota'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="dense">
              <InputLabel>Propiedad</InputLabel>
              <Select
                value={formData.property_id}
                onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
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
            <FormControl fullWidth margin="dense">
              <InputLabel>Plan de Cuotas</InputLabel>
              <Select
                value={formData.fee_schedule_id}
                onChange={(e) => setFormData({ ...formData, fee_schedule_id: e.target.value })}
                label="Plan de Cuotas"
                required
              >
                {feeSchedules.map((schedule) => (
                  <MenuItem key={schedule.id} value={schedule.id}>
                    {schedule.description} - S/ {schedule.amount.toFixed(2)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Fecha de Vencimiento"
              type="date"
              fullWidth
              required
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              margin="dense"
              label="Notas"
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingFee ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog for Generate Fees */}
      <Dialog open={generateOpen} onClose={handleGenerateClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Generar Cuotas
        </DialogTitle>
        <form onSubmit={handleGenerateSubmit}>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selecciona el año, los meses y los planes de cuotas para generar las cuotas. Se generarán cuotas para todas las propiedades usando los planes seleccionados.
            </Typography>
            <TextField
              margin="dense"
              label="Año"
              type="number"
              fullWidth
              required
              value={generateFormData.year}
              onChange={(e) => setGenerateFormData({ ...generateFormData, year: parseInt(e.target.value) })}
              inputProps={{ min: 2020, max: 2030 }}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Meses</InputLabel>
              <Select
                multiple
                value={generateFormData.months}
                onChange={handleMonthsChange}
                input={<OutlinedInput label="Meses" />}
                renderValue={(selected) => selected.map(month => monthsOptions.find(m => m.value === month)?.label).join(', ')}
              >
                {monthsOptions.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    <Checkbox checked={generateFormData.months.indexOf(month.value) > -1} />
                    <ListItemText primary={month.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense">
              <InputLabel>Planes de Cuotas</InputLabel>
              <Select
                multiple
                value={generateFormData.feeScheduleIds}
                onChange={handleFeeSchedulesChange}
                input={<OutlinedInput label="Planes de Cuotas" />}
                renderValue={(selected) => selected.map(id => {
                  const schedule = feeSchedules.find(s => s.id === id);
                  return schedule ? schedule.description : id;
                }).join(', ')}
              >
                {feeSchedules.map((schedule) => (
                  <MenuItem key={schedule.id} value={schedule.id}>
                    <Checkbox checked={generateFormData.feeScheduleIds.indexOf(schedule.id) > -1} />
                    <ListItemText primary={`${schedule.description} - S/ ${schedule.amount.toFixed(2)}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Si no seleccionas ningún plan de cuotas, se usarán todos los planes activos.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleGenerateClose}>Cancelar</Button>
            <Button type="submit" variant="contained">
              Generar Cuotas
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Payments Modal */}
      <PaymentsModal
        open={paymentsModalOpen}
        onClose={handleClosePaymentsModal}
        fee={selectedFeeForPayments}
      />
    </Container>
  );
};

export default FeeManagement;