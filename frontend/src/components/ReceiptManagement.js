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
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
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
      setPayments(response.data.data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setPayments([]);
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

  const handleDownload = async (receipt) => {
    try {
      const response = await receiptsAPI.downloadReceiptPDF(receipt.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_${receipt.correlative_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error al descargar el recibo');
      console.error('Error downloading receipt:', err);
    }
  };

  const handleRegenerate = async (receipt) => {
    if (window.confirm('¿Estás seguro de que quieres regenerar el PDF de este recibo? Esto sobreescribirá el archivo existente.')) {
      try {
        await receiptsAPI.regenerateReceiptPDF(receipt.id);
        setError('');
        alert('PDF regenerado exitosamente');
      } catch (err) {
        setError('Error al regenerar el PDF del recibo');
        console.error('Error regenerating receipt PDF:', err);
      }
    }
  };

  const handleRegenerateAll = async () => {
    if (window.confirm('¿Estás seguro de que quieres regenerar TODOS los PDFs de recibos? Esto sobreescribirá todos los archivos existentes y puede tomar tiempo.')) {
      try {
        setLoading(true);
        const response = await receiptsAPI.regenerateAllReceiptPDFs();
        setError('');
        alert(`PDFs regenerados exitosamente: ${response.data.updated_count} recibos actualizados`);
        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Errores durante la regeneración:', response.data.errors);
          alert(`Hubo ${response.data.errors.length} errores. Revisa la consola para más detalles.`);
        }
      } catch (err) {
        setError('Error al regenerar los PDFs de los recibos');
        console.error('Error regenerating all receipt PDFs:', err);
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Recibos
        </Typography>
        <Box>
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleRegenerateAll}
              disabled={loading}
              sx={{ mr: 2 }}
            >
              Regenerar Todos los PDFs
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Recibo
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
                        onClick={() => handleDownload(receipt)}
                        title="Descargar Recibo PDF"
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        color="secondary"
                        onClick={() => handleRegenerate(receipt)}
                        title="Regenerar PDF"
                      >
                        <RefreshIcon />
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