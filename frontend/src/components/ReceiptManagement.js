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
  IconButton,
  Box,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { receiptsAPI, paymentsAPI } from '../services/api';

const ReceiptManagement = () => {
  const { isAdmin } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [formData, setFormData] = useState({
    payment_id: '',
    fee_period: '',
    notes: '',
  });

  useEffect(() => {
    fetchReceipts();
    fetchPayments();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await receiptsAPI.getReceipts();
      setReceipts(response.data);
      setError('');
    } catch (err) {
      setError('Error al cargar recibos');
      console.error('Error fetching receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await paymentsAPI.getPayments();
      setPayments(response.data);
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  const handleOpenDialog = (receipt = null) => {
    if (receipt) {
      setEditingReceipt(receipt);
      setFormData({
        payment_id: receipt.payment_id,
        fee_period: receipt.fee_period || '',
        notes: receipt.notes || '',
      });
    } else {
      setEditingReceipt(null);
      setFormData({
        payment_id: '',
        fee_period: '',
        notes: '',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingReceipt(null);
    setFormData({
      payment_id: '',
      fee_period: '',
      notes: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingReceipt) {
        await receiptsAPI.updateReceipt(editingReceipt.id, formData);
      } else {
        await receiptsAPI.createReceipt(formData);
      }
      fetchReceipts();
      handleCloseDialog();
    } catch (err) {
      setError(editingReceipt ? 'Error al actualizar recibo' : 'Error al crear recibo');
      console.error('Error saving receipt:', err);
    }
  };

  const handleDelete = async (receiptId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este recibo?')) {
      try {
        await receiptsAPI.deleteReceipt(receiptId);
        fetchReceipts();
      } catch (err) {
        setError('Error al eliminar recibo');
        console.error('Error deleting receipt:', err);
      }
    }
  };

  const handlePrint = (receipt) => {
    // Simple print functionality - in a real app, this would generate a PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo ${receipt.correlative_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .details { margin-bottom: 20px; }
            .amount { font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Pago Vecinal</h1>
            <h2>Recibo de Pago</h2>
          </div>
          <div class="details">
            <p><strong>Número de Recibo:</strong> ${receipt.correlative_number}</p>
            <p><strong>Fecha de Emisión:</strong> ${new Date(receipt.issue_date).toLocaleDateString('es-ES')}</p>
            <p><strong>Propiedad:</strong> ${receipt.property_details?.villa || ''} ${receipt.property_details?.row_letter || ''}${receipt.property_details?.number || ''}</p>
            <p><strong>Propietario:</strong> ${receipt.owner_details?.name || ''}</p>
            <p><strong>Período:</strong> ${receipt.fee_period || ''}</p>
            <p class="amount"><strong>Monto Total: S/</strong> ${receipt.total_amount?.toFixed(2) || '0.00'}</p>
            ${receipt.notes ? `<p><strong>Notas:</strong> ${receipt.notes}</p>` : ''}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getPaymentInfo = (paymentId) => {
    const payment = payments.find(p => p.id === paymentId);
    return payment ? `S/ ${payment.amount.toFixed(2)}` : 'N/A';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Recibos
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Recibo
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
                <TableCell>Número de Recibo</TableCell>
                <TableCell>Fecha de Emisión</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Propiedad</TableCell>
                <TableCell>Propietario</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No hay recibos registrados
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>{receipt.correlative_number}</TableCell>
                    <TableCell>
                      {new Date(receipt.issue_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>S/ {receipt.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {receipt.property_details?.villa} {receipt.property_details?.row_letter}{receipt.property_details?.number}
                    </TableCell>
                    <TableCell>{receipt.owner_details?.name}</TableCell>
                    <TableCell>{receipt.fee_period || '-'}</TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handlePrint(receipt)}
                        title="Imprimir Recibo"
                      >
                        <PrintIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(receipt)}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(receipt.id)}
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

      {/* Dialog for Add/Edit Receipt */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingReceipt ? 'Editar Recibo' : 'Nuevo Recibo'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="dense">
              <InputLabel>Pago</InputLabel>
              <Select
                value={formData.payment_id}
                onChange={(e) => setFormData({ ...formData, payment_id: e.target.value })}
                label="Pago"
                required
              >
                {payments.map((payment) => (
                  <MenuItem key={payment.id} value={payment.id}>
                    Pago S/ {payment.amount.toFixed(2)} - {new Date(payment.due_date).toLocaleDateString('es-ES')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              label="Período de Cuota"
              fullWidth
              value={formData.fee_period}
              onChange={(e) => setFormData({ ...formData, fee_period: e.target.value })}
              placeholder="Ej: Enero 2024"
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
              {editingReceipt ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default ReceiptManagement;