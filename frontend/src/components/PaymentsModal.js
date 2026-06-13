import React, { useState, useEffect, useCallback } from 'react';
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
  Download as DownloadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { paymentsAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';
import { getStatusColor, getStatusLabel } from '../utils/statusMappings';

const PaymentsModal = ({ open, onClose, fee }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async () => {
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
  }, [fee]);

  useEffect(() => {
    if (open && fee) {
      fetchPayments();
    }
  }, [open, fee, fetchPayments]);

  const handleDownload = async (payment) => {
    try {
      const response = await paymentsAPI.downloadGeneratedReceipt(payment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const correlative = payment.receipt_correlative_number || `REC-${new Date().getFullYear()}-${payment.id.slice(-5).toUpperCase()}`;
      link.setAttribute('download', `recibo_${correlative}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error al descargar el recibo');
      console.error('Error downloading receipt:', err);
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
                <TableCell>Descargar Recibo PDF</TableCell>
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
                      {(payment.status === 'approved' || payment.status === 'completed') && (
                        <IconButton
                          color="primary"
                          onClick={() => handleDownload(payment)}
                          title="Descargar Recibo PDF"
                        >
                          <DownloadIcon />
                        </IconButton>
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