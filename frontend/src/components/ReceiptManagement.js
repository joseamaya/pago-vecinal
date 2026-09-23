import React, { useState, useEffect } from 'react';
import {
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
  TablePagination,
  useMediaQuery,
  useTheme,
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
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';

const ReceiptManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 20,
    total_count: 0,
    total_pages: 0,
  });
  const [formData, setFormData] = useState({
    payment_id: '',
    fee_period: '',
    notes: '',
  });

  useEffect(() => {
    fetchReceipts();
    fetchPayments();
  }, []);

  const fetchReceipts = async (page = 1, limit = 20) => {
    try {
      setLoading(true);
      const response = await receiptsAPI.getReceipts(page, limit);
      setReceipts(response.data.data);
      setPagination({
        page: response.data.pagination.page - 1, // Material-UI uses 0-based indexing
        limit: response.data.pagination.limit,
        total_count: response.data.pagination.total_count,
        total_pages: response.data.pagination.total_pages,
      });
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

  const handlePageChange = (event, newPage) => {
    fetchReceipts(newPage + 1, pagination.limit); // Convert back to 1-based indexing
  };

  const handleRowsPerPageChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setPagination(prev => ({ ...prev, limit: newLimit, page: 0 }));
    fetchReceipts(1, newLimit);
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
    setSaving(true);
    try {
      if (editingReceipt) {
        await receiptsAPI.updateReceipt(editingReceipt.id, formData);
        toast.success('Recibo actualizado correctamente');
      } else {
        await receiptsAPI.createReceipt(formData);
        toast.success('Recibo creado correctamente');
      }
      fetchReceipts();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(editingReceipt ? 'Error al actualizar recibo' : 'Error al crear recibo');
      }
      console.error('Error saving receipt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (receipt) => {
    const confirmed = await confirm({
      title: 'Eliminar recibo',
      message: `¿Estás seguro de que quieres eliminar el recibo ${receipt.correlative_number}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await receiptsAPI.deleteReceipt(receipt.id);
      toast.success('Recibo eliminado correctamente');
      fetchReceipts();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar recibo');
      }
      console.error('Error deleting receipt:', err);
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
      if (!isNetworkError(err)) {
        toast.error('Error al descargar el recibo');
      }
      console.error('Error downloading receipt:', err);
    }
  };

  const handleRegenerate = async (receipt) => {
    const confirmed = await confirm({
      title: 'Regenerar PDF',
      message: '¿Estás seguro de que quieres regenerar el PDF de este recibo? Esto sobreescribirá el archivo existente.',
      confirmLabel: 'Regenerar',
      destructive: false,
    });
    if (!confirmed) return;

    try {
      await receiptsAPI.regenerateReceiptPDF(receipt.id);
      toast.success('PDF regenerado exitosamente');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al regenerar el PDF del recibo');
      }
      console.error('Error regenerating receipt PDF:', err);
    }
  };

  const handleRegenerateAll = async () => {
    const confirmed = await confirm({
      title: 'Regenerar todos los PDFs',
      message: '¿Estás seguro de que quieres regenerar TODOS los PDFs de recibos? Esto sobreescribirá todos los archivos existentes y puede tomar tiempo.',
      confirmLabel: 'Regenerar todos',
      destructive: false,
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const response = await receiptsAPI.regenerateAllReceiptPDFs();
      toast.success(`PDFs regenerados exitosamente: ${response.data.updated_count} recibos actualizados`);
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Errores durante la regeneración:', response.data.errors);
        toast.warning(`Hubo ${response.data.errors.length} errores. Revisa la consola para más detalles.`);
      }
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al regenerar los PDFs de los recibos');
      }
      console.error('Error regenerating all receipt PDFs:', err);
    } finally {
      setLoading(false);
    }
  };


  return (
    <PageContainer>
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
                <LoadingSkeleton type="table" rows={5} columns={7} />
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      title="No hay recibos registrados"
                      description="Los recibos generados aparecerán aquí."
                    />
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
                        aria-label={`Descargar recibo ${receipt.correlative_number}`}
                        title="Descargar Recibo PDF"
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        color="secondary"
                        onClick={() => handleRegenerate(receipt)}
                        aria-label={`Regenerar PDF del recibo ${receipt.correlative_number}`}
                        title="Regenerar PDF"
                      >
                        <RefreshIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(receipt)}
                        aria-label={`Editar recibo ${receipt.correlative_number}`}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(receipt)}
                          aria-label={`Eliminar recibo ${receipt.correlative_number}`}
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
        <TablePagination
          component="div"
          count={pagination.total_count}
          page={pagination.page}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      </Paper>

      {/* Dialog for Add/Edit Receipt */}
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
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
            <Button onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando...' : editingReceipt ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
};

export default ReceiptManagement;
