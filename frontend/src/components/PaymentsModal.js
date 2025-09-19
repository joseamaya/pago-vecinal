import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Box,
  Alert,
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { paymentsAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';

const PaymentsModal = ({ open, onClose, fee }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && fee) {
      fetchPayments();
    }
  }, [open, fee]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await paymentsAPI.getPayments(1, 100, { fee_id: fee.id });
      setPayments(response.data.data);
    } catch (err) {
      setError('Error al cargar los pagos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (paymentId) => {
    try {
      const response = await paymentsAPI.downloadGeneratedReceipt(paymentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_pago_${paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al descargar el recibo');
      console.error('Error downloading receipt:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Pagos de la Cuota - {fee ? `${fee.year}/${fee.month}` : ''}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {fee && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Propiedad:</strong> {fee.property_villa} {fee.property_row_letter}{fee.property_number} - {fee.property_owner_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Monto Total:</strong> S/ {fee.amount.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Monto Pagado:</strong> S/ {(fee.paid_amount || 0).toFixed(2)}
            </Typography>
          </Box>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Fecha de Pago</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Notas</TableCell>
                <TableCell>Recibo PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={3} columns={5} />
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay pagos registrados para esta cuota
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>S/ {payment.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(payment.status)}
                        color={getStatusColor(payment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{payment.notes || '-'}</TableCell>
                    <TableCell>
                      {payment.generated_receipt_file ? (
                        <IconButton
                          color="primary"
                          onClick={() => handleDownloadReceipt(payment.id)}
                          title="Descargar Recibo PDF"
                        >
                          <DownloadIcon />
                        </IconButton>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No disponible
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentsModal;