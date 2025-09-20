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
  Print as PrintIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { paymentsAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';

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

  const handlePrintReceipt = (payment) => {
    // Create receipt data for printing
    const receiptData = {
      correlative_number: payment.receipt_correlative_number || `REC-${new Date().getFullYear()}-${payment.id.slice(-5).toUpperCase()}`,
      issue_date: payment.receipt_issue_date ? new Date(payment.receipt_issue_date) : new Date(),
      payment_date: new Date(payment.payment_date),
      total_amount: payment.amount,
      property_details: {
        villa: fee.property_villa,
        row_letter: fee.property_row_letter,
        number: fee.property_number,
        owner_name: fee.property_owner_name
      },
      fee_period: `${fee.month}/${fee.year}`,
      notes: payment.notes || ''
    };

    // Open print window with HTML content
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo de Pago - ${receiptData.correlative_number}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 20px;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header h2 {
              margin: 5px 0;
              font-size: 16px;
              color: #666;
            }
            .details {
              margin-bottom: 20px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 5px 0;
            }
            .detail-label {
              font-weight: bold;
              min-width: 150px;
            }
            .amount {
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              margin: 20px 0;
              padding: 10px;
              border: 2px solid #000;
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            .property-info {
              margin: 20px 0;
              padding: 15px;
              background-color: #f5f5f5;
              border-radius: 5px;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PAGO VECINAL</h1>
            <h2>Sistema de Gestión de Cuotas de Condominio</h2>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Número de Recibo:</span>
              <span>${receiptData.correlative_number}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fecha de Emisión:</span>
              <span>${receiptData.issue_date.toLocaleDateString('es-ES')} ${receiptData.issue_date.toLocaleTimeString('es-ES')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Período:</span>
              <span>${receiptData.fee_period}</span>
            </div>
          </div>

          <div class="property-info">
            <h3>Información de la Propiedad</h3>
            <div class="detail-row">
              <span class="detail-label">Villa:</span>
              <span>${receiptData.property_details.villa}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fila - Número:</span>
              <span>${receiptData.property_details.row_letter}${receiptData.property_details.number}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Propietario:</span>
              <span>${receiptData.property_details.owner_name}</span>
            </div>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Fecha del Pago:</span>
              <span>${receiptData.payment_date.toLocaleDateString('es-ES')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Estado:</span>
              <span>COMPLETADO</span>
            </div>
            ${receiptData.notes ? `
            <div class="detail-row">
              <span class="detail-label">Notas:</span>
              <span>${receiptData.notes}</span>
            </div>
            ` : ''}
          </div>

          <div class="amount">
            MONTO PAGADO: S/ ${receiptData.total_amount.toFixed(2)}
          </div>

          <div class="footer">
            <p>Este recibo es válido como comprobante de pago.</p>
            <p>¡Gracias por su pago!</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
                <TableCell>Imprimir Recibo</TableCell>
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
                          onClick={() => handlePrintReceipt(payment)}
                          title="Imprimir Recibo"
                        >
                          <PrintIcon />
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