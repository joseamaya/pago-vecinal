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
  List,
  ListItem,
  ListItemText,
  Divider,
  Checkbox,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { paymentsAPI, feesAPI } from '../services/api';

const PaymentManagement = () => {
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState({
    fee_id: '',
    amount: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchFees();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await paymentsAPI.getPayments();
      console.log('Fetched payments:', response.data);
      setPayments(response.data);
      setError('');
    } catch (err) {
      setError('Error al cargar pagos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFees = async () => {
    try {
      const response = await feesAPI.getFees();
      // Filter out fees that are under agreement
      const availableFees = response.data.filter(fee => fee.status !== 'agreement');
      setFees(availableFees);
    } catch (err) {
      console.error('Error fetching fees:', err);
    }
  };

  const handleOpenDialog = (payment = null) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        fee_id: payment.fee_id,
        amount: payment.amount.toString(),
        notes: payment.notes || '',
      });
      setReceiptFile(null); // Reset file input
    } else {
      setEditingPayment(null);
      setFormData({
        fee_id: '',
        amount: '',
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
      fee_id: '',
      amount: '',
      notes: '',
    });
    setReceiptFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('fee_id', formData.fee_id);
      formDataToSend.append('amount', parseFloat(formData.amount));
      formDataToSend.append('notes', formData.notes || '');

      if (receiptFile) {
        formDataToSend.append('receipt_file', receiptFile);
      }

      if (editingPayment) {
        await paymentsAPI.updatePayment(editingPayment.id, formDataToSend);
      } else {
        await paymentsAPI.createPayment(formDataToSend);
      }
      fetchPayments();
      handleCloseDialog();
    } catch (err) {
      setError(editingPayment ? 'Error al actualizar pago' : 'Error al crear pago');
      console.error('Error saving payment:', err);
    }
  };

  const handleDelete = async (paymentId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este pago?')) {
      try {
        await paymentsAPI.deletePayment(paymentId);
        fetchPayments();
      } catch (err) {
        setError('Error al eliminar pago');
        console.error('Error deleting payment:', err);
      }
    }
  };

  const handleApprove = async (paymentId) => {
    try {
      console.log('Approving payment:', paymentId);
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'approved');
      const response = await paymentsAPI.updatePayment(paymentId, formDataToSend);
      console.log('Approval response:', response.data);

      // Wait a bit for receipt generation to complete
      setTimeout(async () => {
        await fetchPayments();
        console.log('Payments refreshed after approval');
      }, 2000); // 2 second delay
    } catch (err) {
      setError('Error al aprobar pago');
      console.error('Error approving payment:', err);
    }
  };

  const handleReject = async (paymentId) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'rejected');
      await paymentsAPI.updatePayment(paymentId, formDataToSend);
      fetchPayments();
    } catch (err) {
      setError('Error al rechazar pago');
      console.error('Error rejecting payment:', err);
    }
  };

  const handleBulkUploadOpen = () => {
    setBulkUploadOpen(true);
    setBulkFile(null);
    setBulkResults(null);
  };

  const handleBulkUploadClose = () => {
    setBulkUploadOpen(false);
    setBulkFile(null);
    setBulkResults(null);
  };

  const handleBulkFileChange = (e) => {
    setBulkFile(e.target.files[0]);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setError('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      setBulkUploading(true);
      setError('');
      const response = await paymentsAPI.bulkImportPayments(bulkFile);
      setBulkResults(response.data);
      fetchPayments(); // Refresh the payments list
    } catch (err) {
      setError('Error al subir archivo masivo');
      console.error('Error bulk uploading payments:', err);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleSelectPayment = (paymentId) => {
    setSelectedPayments(prev => {
      const newSelected = prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId];
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPayments([]);
      setSelectAll(false);
    } else {
      const pendingPayments = payments.filter(p => p.status === 'pending').map(p => p.id);
      setSelectedPayments(pendingPayments);
      setSelectAll(true);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPayments.length === 0) {
      setError('Por favor selecciona al menos un pago para aprobar');
      return;
    }

    try {
      setError('');
      const response = await paymentsAPI.bulkApprovePayments(selectedPayments);
      console.log('Bulk approval response:', response.data);

      // Refresh payments list
      await fetchPayments();

      // Reset selection
      setSelectedPayments([]);
      setSelectAll(false);

      // Show success message
      setError('');
      alert(`Se aprobaron ${response.data.approved_count} pagos exitosamente`);
    } catch (err) {
      setError('Error al aprobar pagos masivamente');
      console.error('Error bulk approving payments:', err);
    }
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

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return 'Aprobado';
      case 'completed':
        return 'Completado';
      case 'pending':
        return 'Pendiente';
      case 'rejected':
        return 'Rechazado';
      case 'failed':
        return 'Fallido';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getFeeInfo = (feeId) => {
    const fee = fees.find(f => f.id === feeId);
    if (!fee) return 'N/A';
    const property = `${fee.property_row_letter}${fee.property_number}`;
    const period = `${fee.month}/${fee.year}`;
    return `${property} - S/ ${fee.amount.toFixed(2)} - ${period}`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Pagos
        </Typography>
        <Box>
          {isAdmin && selectedPayments.length > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={handleBulkApprove}
              sx={{ mr: 2 }}
            >
              Aprobar Seleccionados ({selectedPayments.length})
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleBulkUploadOpen}
              sx={{ mr: 2 }}
            >
              Subida Masiva
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Pago
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  {isAdmin && payments.some(p => p.status === 'pending') && (
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAll}
                      indeterminate={selectedPayments.length > 0 && selectedPayments.length < payments.filter(p => p.status === 'pending').length}
                    />
                  )}
                </TableCell>
                <TableCell>Cuota</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Pago</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Comprobante</TableCell>
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
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No hay pagos registrados
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell padding="checkbox">
                      {isAdmin && payment.status === 'pending' && (
                        <Checkbox
                          checked={selectedPayments.includes(payment.id)}
                          onChange={() => handleSelectPayment(payment.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>{getFeeInfo(payment.fee_id)}</TableCell>
                    <TableCell>S/ {payment.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(payment.status)}
                        color={getStatusColor(payment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {payment.receipt_file ? (
                        <a href={`http://localhost:8000${payment.receipt_file}`} target="_blank" rel="noopener noreferrer">
                          Ver Comprobante
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {payment.generated_receipt_file ? (
                        <a href={`http://localhost:8000/payments/${payment.id}/download-receipt`} target="_blank" rel="noopener noreferrer">
                          Descargar Recibo
                        </a>
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
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPayment ? 'Editar Pago' : 'Nuevo Pago'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="dense">
              <InputLabel>Cuota</InputLabel>
              <Select
                value={formData.fee_id}
                onChange={(e) => setFormData({ ...formData, fee_id: e.target.value })}
                label="Cuota"
                required
              >
                {fees.map((fee) => (
                  <MenuItem key={fee.id} value={fee.id}>
                    {fee.property_row_letter}{fee.property_number} - S/ {fee.amount.toFixed(2)} - {fee.month}/{fee.year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Monto (S/)"
              type="number"
              fullWidth
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              inputProps={{ step: "0.01" }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files[0])}
              style={{ marginTop: 16, marginBottom: 8 }}
            />
            {receiptFile && <Typography variant="body2">{receiptFile.name}</Typography>}
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
              {editingPayment ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadOpen} onClose={handleBulkUploadClose} maxWidth="md" fullWidth>
        <DialogTitle>Subida Masiva de Pagos</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sube un archivo Excel con los pagos. El formato debe incluir las columnas: Villa, Fila, Número, Año, Mes, Monto, Fecha de Pago, Notas.
          </Typography>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleBulkFileChange}
            style={{ marginBottom: 16 }}
          />

          {bulkFile && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Archivo seleccionado: {bulkFile.name}
            </Typography>
          )}

          {bulkResults && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" color="success.main">
                Pagos exitosos: {bulkResults.successful_imports}
              </Typography>
              <Typography variant="h6" color="error.main">
                Pagos fallidos: {bulkResults.failed_imports}
              </Typography>

              {bulkResults.errors && bulkResults.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6">Errores:</Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {bulkResults.errors.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`Fila ${error.row}: ${error.error}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBulkUploadClose}>Cerrar</Button>
          <Button
            onClick={handleBulkUpload}
            variant="contained"
            disabled={!bulkFile || bulkUploading}
          >
            {bulkUploading ? 'Subiendo...' : 'Subir Archivo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PaymentManagement;