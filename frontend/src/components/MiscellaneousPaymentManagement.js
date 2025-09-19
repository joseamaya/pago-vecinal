import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { miscellaneousPaymentsAPI, propertiesAPI } from '../services/api';

const PAYMENT_TYPES = {
  maintenance: 'Mantenimiento',
  repairs: 'Reparaciones',
  services: 'Servicios',
  penalties: 'Multas',
  other: 'Otros'
};

const PAYMENT_STATUSES = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  completed: 'Completado',
  failed: 'Fallido',
  cancelled: 'Cancelado'
};

const MiscellaneousPaymentManagement = () => {
  const { isAdmin } = useAuth();
  const [miscellaneousPayments, setMiscellaneousPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState({
    property_id: '',
    payment_type: '',
    amount: '',
    payment_date: '',
    description: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [filters, setFilters] = useState({
    property_id: '',
    payment_type: '',
    status: '',
  });

  useEffect(() => {
    fetchMiscellaneousPayments();
  }, [filters]);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchMiscellaneousPayments = async () => {
    try {
      setLoading(true);
      const response = await miscellaneousPaymentsAPI.getMiscellaneousPayments();
      // Sort by payment_date descending (newest first)
      const sortedPayments = response.data.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
      setMiscellaneousPayments(sortedPayments);
      setError('');
    } catch (err) {
      setError('Error al cargar pagos varios');
      console.error('Error fetching miscellaneous payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      setProperties(response.data);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const handleOpenDialog = (payment = null) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        property_id: payment.property_id || '',
        payment_type: payment.payment_type,
        amount: payment.amount.toString(),
        payment_date: new Date(payment.payment_date).toISOString().split('T')[0],
        description: payment.description,
        notes: payment.notes || '',
      });
      setReceiptFile(null);
    } else {
      setEditingPayment(null);
      setFormData({
        property_id: '',
        payment_type: '',
        amount: '',
        payment_date: '',
        description: '',
        notes: '',
      });
      setReceiptFile(null);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingPayment(null);
    setFormData({
      property_id: '',
      payment_type: '',
      amount: '',
      payment_date: '',
      description: '',
      notes: '',
    });
    setReceiptFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('property_id', formData.property_id || '');
      formDataToSend.append('payment_type', formData.payment_type);
      formDataToSend.append('amount', parseFloat(formData.amount));
      formDataToSend.append('payment_date', new Date(formData.payment_date).toISOString());
      formDataToSend.append('description', formData.description);
      formDataToSend.append('notes', formData.notes || '');

      if (receiptFile) {
        formDataToSend.append('receipt_file', receiptFile);
      }

      if (editingPayment) {
        await miscellaneousPaymentsAPI.updateMiscellaneousPayment(editingPayment.id, formDataToSend);
      } else {
        await miscellaneousPaymentsAPI.createMiscellaneousPayment(formDataToSend);
      }
      fetchMiscellaneousPayments();
      handleCloseDialog();
    } catch (err) {
      setError(editingPayment ? 'Error al actualizar pago' : 'Error al crear pago');
      console.error('Error saving miscellaneous payment:', err);
    }
  };

  const handleDelete = async (paymentId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este pago?')) {
      try {
        await miscellaneousPaymentsAPI.deleteMiscellaneousPayment(paymentId);
        fetchMiscellaneousPayments();
      } catch (err) {
        setError('Error al eliminar pago');
        console.error('Error deleting miscellaneous payment:', err);
      }
    }
  };

  const handleApprove = async (paymentId) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'approved');
      await miscellaneousPaymentsAPI.updateMiscellaneousPayment(paymentId, formDataToSend);
      fetchMiscellaneousPayments();
    } catch (err) {
      setError('Error al aprobar pago');
      console.error('Error approving miscellaneous payment:', err);
    }
  };

  const handleReject = async (paymentId) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'rejected');
      await miscellaneousPaymentsAPI.updateMiscellaneousPayment(paymentId, formDataToSend);
      fetchMiscellaneousPayments();
    } catch (err) {
      setError('Error al rechazar pago');
      console.error('Error rejecting miscellaneous payment:', err);
    }
  };

  const handleDownloadReceipt = async (paymentId) => {
    try {
      const response = await miscellaneousPaymentsAPI.downloadMiscellaneousReceipt(paymentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_pago_varios_${paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Error al descargar recibo');
      console.error('Error downloading receipt:', err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({
      ...filters,
      [field]: value,
    });
  };

  const handleApplyFilters = () => {
    fetchMiscellaneousPayments();
  };

  const handleClearFilters = () => {
    setFilters({
      property_id: '',
      payment_type: '',
      status: '',
    });
    fetchMiscellaneousPayments();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPropertyInfo = (propertyId) => {
    if (!propertyId) return 'N/A';
    const property = properties.find(p => p.id === propertyId);
    return property ? `${property.villa} ${property.row_letter}${property.number}` : 'N/A';
  };

  const filteredPayments = miscellaneousPayments.filter(payment => {
    if (filters.property_id && payment.property_id !== filters.property_id) return false;
    if (filters.payment_type && payment.payment_type !== filters.payment_type) return false;
    if (filters.status && payment.status !== filters.status) return false;
    return true;
  });

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Pagos Varios
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Pago Vario
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
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
              <InputLabel>Tipo de Pago</InputLabel>
              <Select
                value={filters.payment_type}
                onChange={(e) => handleFilterChange('payment_type', e.target.value)}
                label="Tipo de Pago"
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                {Object.entries(PAYMENT_TYPES).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
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
                {Object.entries(PAYMENT_STATUSES).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              variant="contained"
              onClick={handleApplyFilters}
              fullWidth
            >
              Aplicar Filtros
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              variant="outlined"
              onClick={handleClearFilters}
              fullWidth
            >
              Limpiar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Propiedad</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Pago</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Recibo</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No hay pagos varios registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{getPropertyInfo(payment.property_id)}</TableCell>
                    <TableCell>{PAYMENT_TYPES[payment.payment_type] || payment.payment_type}</TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell>S/ {payment.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={PAYMENT_STATUSES[payment.status] || payment.status}
                        color={getStatusColor(payment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {payment.generated_receipt_file ? (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<FileDownloadIcon />}
                          onClick={() => handleDownloadReceipt(payment.id)}
                        >
                          Descargar
                        </Button>
                      ) : payment.status === 'approved' ? (
                        <span style={{ color: 'orange' }}>Generando...</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(payment)}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && payment.status === 'pending' && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleApprove(payment.id)}
                            sx={{ ml: 1 }}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => handleReject(payment.id)}
                            sx={{ ml: 1 }}
                          >
                            Rechazar
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(payment.id)}
                          sx={{ ml: 1 }}
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

      {/* Dialog for Add/Edit Payment */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPayment ? 'Editar Pago Vario' : 'Nuevo Pago Vario'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Propiedad (Opcional)</InputLabel>
                  <Select
                    value={formData.property_id}
                    onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                    label="Propiedad (Opcional)"
                  >
                    <MenuItem value="">
                      <em>Sin propiedad específica</em>
                    </MenuItem>
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        {property.villa} {property.row_letter}{property.number} - {property.owner_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Tipo de Pago</InputLabel>
                  <Select
                    value={formData.payment_type}
                    onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                    label="Tipo de Pago"
                    required
                  >
                    {Object.entries(PAYMENT_TYPES).map(([key, label]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Monto"
                  type="number"
                  fullWidth
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Fecha de Pago"
                  type="date"
                  fullWidth
                  required
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  label="Descripción"
                  fullWidth
                  required
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el pago o servicio"
                />
              </Grid>
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
              <Grid item xs={12}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files[0])}
                  style={{ marginTop: 16, marginBottom: 8 }}
                />
                {receiptFile && <Typography variant="body2">{receiptFile.name}</Typography>}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingPayment ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default MiscellaneousPaymentManagement;