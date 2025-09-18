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
  Chip,
  IconButton,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { agreementsAPI } from '../services/api';

const AgreementPayments = () => {
  const { isAdmin } = useAuth();
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [formData, setFormData] = useState({
    installment_id: '',
    amount: '',
    payment_reference: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchInstallments();
  }, []);

  const fetchInstallments = async () => {
    try {
      setLoading(true);
      const response = await agreementsAPI.getAgreements();
      // Flatten all installments from all agreements
      const allInstallments = [];
      response.data.forEach(agreement => {
        if (agreement.installments && agreement.installments.length > 0) {
          agreement.installments.forEach(installment => {
            allInstallments.push({
              ...installment,
              agreement_number: agreement.agreement_number,
              property_info: `${agreement.property_villa} ${agreement.property_row_letter}${agreement.property_number}`,
              property_owner_name: agreement.property_owner_name,
              agreement_id: agreement.id
            });
          });
        }
      });
      // Sort by due date descending (most recent first)
      allInstallments.sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
      setInstallments(allInstallments);
      setError('');
    } catch (err) {
      setError('Error al cargar cuotas de convenios');
      console.error('Error fetching installments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (installment = null) => {
    if (installment) {
      setSelectedInstallment(installment);
      setFormData({
        installment_id: installment.id,
        amount: installment.amount.toString(),
        payment_reference: '',
        notes: '',
      });
    } else {
      setSelectedInstallment(null);
      setFormData({
        installment_id: '',
        amount: '',
        payment_reference: '',
        notes: '',
      });
    }
    setReceiptFile(null);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setSelectedInstallment(null);
    setFormData({
      installment_id: '',
      amount: '',
      payment_reference: '',
      notes: '',
    });
    setReceiptFile(null);
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');

      const formDataToSend = new FormData();
      formDataToSend.append('amount', parseFloat(formData.amount));
      formDataToSend.append('payment_reference', formData.payment_reference || '');
      formDataToSend.append('notes', formData.notes || '');

      if (receiptFile) {
        formDataToSend.append('receipt_file', receiptFile);
      }

      await agreementsAPI.payNextInstallment(formDataToSend);

      setSuccess(true);
      setTimeout(() => {
        handleCloseDialog();
        fetchInstallments(); // Refresh to update the list
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar el pago');
      console.error('Error processing payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
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

  const getStatusLabel = (status) => {
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

  const getInstallmentInfo = (installment) => {
    return `${installment.property_info} - Cuota ${installment.installment_number} - S/ ${installment.amount.toFixed(2)}`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Pagos de Convenios
        </Typography>
        <Button
          variant="contained"
          startIcon={<PaymentIcon />}
          onClick={() => handleOpenDialog(null)}
        >
          Nuevo Pago
        </Button>
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
                <TableCell>Convenio</TableCell>
                <TableCell>Cuota</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Vencimiento</TableCell>
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
                  <TableCell colSpan={9} align="center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : installments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No hay cuotas de convenios registradas
                  </TableCell>
                </TableRow>
              ) : (
                installments.map((installment) => (
                  <TableRow key={installment.id}>
                    <TableCell>{installment.agreement_number}</TableCell>
                    <TableCell>{getInstallmentInfo(installment)}</TableCell>
                    <TableCell>S/ {installment.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(installment.due_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      {installment.paid_date
                        ? new Date(installment.paid_date).toLocaleDateString('es-ES')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(installment.status)}
                        color={getStatusColor(installment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {installment.receipt_file ? (
                        <a href={`http://localhost:8000${installment.receipt_file}`} target="_blank" rel="noopener noreferrer">
                          Ver Comprobante
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {installment.status === 'paid' ? (
                        <a href={`http://localhost:8000/agreements/${installment.agreement_id}/installments/${installment.id}/download-receipt`} target="_blank" rel="noopener noreferrer">
                          Descargar Recibo
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(installment)}
                      >
                        <EditIcon />
                      </IconButton>
                      {installment.status === 'pending' && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<PaymentIcon />}
                          onClick={() => handleOpenDialog(installment)}
                          sx={{ ml: 1 }}
                        >
                          Pagar
                        </Button>
                      )}
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => {
                            if (window.confirm('¿Estás seguro de que quieres eliminar esta cuota?')) {
                              // Handle delete
                            }
                          }}
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

      {/* Payment Dialog */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedInstallment ? `Pagar Cuota - ${selectedInstallment.agreement_number} (Cuota ${selectedInstallment.installment_number})` : 'Nuevo Pago'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                ¡Pago procesado exitosamente!
              </Alert>
            )}

            <FormControl fullWidth margin="dense">
              <InputLabel>Cuota de Convenio</InputLabel>
              <Select
                value={formData.installment_id}
                onChange={(e) => {
                  const installmentId = e.target.value;
                  const installment = installments.find(inst => inst.id === installmentId);
                  setFormData({
                    ...formData,
                    installment_id: installmentId,
                    amount: installment ? installment.amount.toString() : '',
                  });
                }}
                label="Cuota de Convenio"
                required
              >
                {installments
                  .filter(inst => inst.status === 'pending')
                  .map((installment) => (
                    <MenuItem key={installment.id} value={installment.id}>
                      {installment.agreement_number} - {installment.property_info} - Cuota {installment.installment_number} - S/ {installment.amount.toFixed(2)} - Vence: {new Date(installment.due_date).toLocaleDateString('es-ES')}
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
              InputProps={{
                readOnly: true,
              }}
              helperText="💰 Monto auto-completado con el valor exacto de la cuota (no editable)"
            />

            <TextField
              margin="dense"
              label="Referencia de Pago"
              fullWidth
              value={formData.payment_reference}
              onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
              placeholder="Número de operación, comprobante, etc."
            />

            <input
              type="file"
              accept="image/*,.pdf"
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
            <Button onClick={handleCloseDialog} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || success}
              startIcon={<ReceiptIcon />}
            >
              {submitting ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default AgreementPayments;