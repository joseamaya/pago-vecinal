import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import { Payment as PaymentIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { agreementsAPI } from '../services/api';

const InstallmentPayment = () => {
  const { isAdmin } = useAuth();
  const [nextInstallment, setNextInstallment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    payment_reference: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchNextInstallment();
  }, []);

  const fetchNextInstallment = async () => {
    try {
      setLoading(true);
      const response = await agreementsAPI.getNextPendingInstallment();
      setNextInstallment(response.data);
      setError('');

      // Auto-fill amount if installment exists
      if (response.data && response.data.installment) {
        setFormData(prev => ({
          ...prev,
          amount: response.data.installment.amount.toString()
        }));
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setNextInstallment(null);
        setError('');
      } else {
        setError('Error al cargar la próxima cuota pendiente');
        console.error('Error fetching next installment:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setFormData({
      amount: nextInstallment?.installment?.amount?.toString() || '',
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
        fetchNextInstallment(); // Refresh to get the next installment
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

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1">
            Pago de Cuotas de Convenio
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            🔄 Se muestra automáticamente la cuota pendiente más antigua para facilitar el pago
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Cargando...</Typography>
        </Paper>
      ) : !nextInstallment ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No hay cuotas pendientes de pago
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Todas las cuotas de tus convenios están al día
          </Typography>
        </Paper>
      ) : (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                Próxima Cuota a Pagar
              </Typography>
              <Chip
                label={getStatusLabel(nextInstallment.installment.status)}
                color={getStatusColor(nextInstallment.installment.status)}
                size="small"
              />
            </Box>

            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Convenio
                </Typography>
                <Typography variant="body1">
                  {nextInstallment.agreement.agreement_number}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Propiedad
                </Typography>
                <Typography variant="body1">
                  {nextInstallment.agreement.property_villa} {nextInstallment.agreement.property_row_letter}{nextInstallment.agreement.property_number}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Cuota N°
                </Typography>
                <Typography variant="body1">
                  {nextInstallment.installment.installment_number}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Monto
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  S/ {nextInstallment.installment.amount.toFixed(2)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Fecha de Vencimiento
                </Typography>
                <Typography variant="body1">
                  {new Date(nextInstallment.installment.due_date).toLocaleDateString('es-ES')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Propietario
                </Typography>
                <Typography variant="body1">
                  {nextInstallment.agreement.property_owner_name}
                </Typography>
              </Grid>
            </Grid>

            <Box display="flex" justifyContent="center">
              <Button
                variant="contained"
                startIcon={<PaymentIcon />}
                onClick={handleOpenDialog}
                size="large"
              >
                Pagar Esta Cuota
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Pagar Cuota Más Antigua - {nextInstallment?.agreement?.agreement_number}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                ¡Pago procesado exitosamente!
              </Alert>
            )}

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

export default InstallmentPayment;