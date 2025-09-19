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
import { expensesAPI } from '../services/api';

const EXPENSE_TYPES = {
  maintenance: 'Mantenimiento',
  cleaning: 'Limpieza',
  repairs: 'Reparaciones',
  services: 'Servicios',
  utilities: 'Servicios Públicos',
  supplies: 'Suministros',
  insurance: 'Seguros',
  legal: 'Servicios Legales',
  administrative: 'Administrativos',
  other: 'Otros'
};

const EXPENSE_STATUSES = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  completed: 'Completado',
  failed: 'Fallido',
  cancelled: 'Cancelado'
};

const ExpenseManagement = () => {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    expense_type: '',
    amount: '',
    expense_date: '',
    description: '',
    notes: '',
    beneficiary: '',
    beneficiary_details: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [filters, setFilters] = useState({
    expense_type: '',
    status: '',
  });

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await expensesAPI.getExpenses();
      // Sort by expense_date descending (newest first)
      const sortedExpenses = response.data.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
      setExpenses(sortedExpenses);
      setError('');
    } catch (err) {
      setError('Error al cargar gastos administrativos');
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        expense_type: expense.expense_type,
        amount: expense.amount.toString(),
        expense_date: new Date(expense.expense_date).toISOString().split('T')[0],
        description: expense.description,
        notes: expense.notes || '',
        beneficiary: expense.beneficiary,
        beneficiary_details: expense.beneficiary_details || '',
      });
      setReceiptFile(null);
    } else {
      setEditingExpense(null);
      setFormData({
        expense_type: '',
        amount: '',
        expense_date: '',
        description: '',
        notes: '',
        beneficiary: '',
        beneficiary_details: '',
      });
      setReceiptFile(null);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingExpense(null);
    setFormData({
      expense_type: '',
      amount: '',
      expense_date: '',
      description: '',
      notes: '',
      beneficiary: '',
      beneficiary_details: '',
    });
    setReceiptFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('expense_type', formData.expense_type);
      formDataToSend.append('amount', parseFloat(formData.amount));
      formDataToSend.append('expense_date', new Date(formData.expense_date).toISOString());
      formDataToSend.append('description', formData.description);
      formDataToSend.append('notes', formData.notes || '');
      formDataToSend.append('beneficiary', formData.beneficiary);
      formDataToSend.append('beneficiary_details', formData.beneficiary_details || '');

      if (receiptFile) {
        formDataToSend.append('receipt_file', receiptFile);
      }

      if (editingExpense) {
        await expensesAPI.updateExpense(editingExpense.id, formDataToSend);
      } else {
        await expensesAPI.createExpense(formDataToSend);
      }
      fetchExpenses();
      handleCloseDialog();
    } catch (err) {
      setError(editingExpense ? 'Error al actualizar gasto' : 'Error al crear gasto');
      console.error('Error saving expense:', err);
    }
  };

  const handleDelete = async (expenseId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
      try {
        await expensesAPI.deleteExpense(expenseId);
        fetchExpenses();
      } catch (err) {
        setError('Error al eliminar gasto');
        console.error('Error deleting expense:', err);
      }
    }
  };

  const handleApprove = async (expenseId) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'approved');
      await expensesAPI.updateExpense(expenseId, formDataToSend);
      fetchExpenses();
    } catch (err) {
      setError('Error al aprobar gasto');
      console.error('Error approving expense:', err);
    }
  };

  const handleReject = async (expenseId) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'rejected');
      await expensesAPI.updateExpense(expenseId, formDataToSend);
      fetchExpenses();
    } catch (err) {
      setError('Error al rechazar gasto');
      console.error('Error rejecting expense:', err);
    }
  };

  const handleDownloadReceipt = async (expenseId) => {
    try {
      const response = await expensesAPI.downloadExpenseReceipt(expenseId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_gasto_administrativo_${expenseId}.pdf`);
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
    fetchExpenses();
  };

  const handleClearFilters = () => {
    setFilters({
      expense_type: '',
      status: '',
    });
    fetchExpenses();
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

  const filteredExpenses = expenses.filter(expense => {
    if (filters.expense_type && expense.expense_type !== filters.expense_type) return false;
    if (filters.status && expense.status !== filters.status) return false;
    return true;
  });

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Gastos Administrativos
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Gasto
          </Button>
        )}
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
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Tipo de Gasto</InputLabel>
              <Select
                value={filters.expense_type}
                onChange={(e) => handleFilterChange('expense_type', e.target.value)}
                label="Tipo de Gasto"
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                {Object.entries(EXPENSE_TYPES).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
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
                {Object.entries(EXPENSE_STATUSES).map(([key, label]) => (
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
                <TableCell>Tipo</TableCell>
                <TableCell>Beneficiario</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Gasto</TableCell>
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
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No hay gastos administrativos registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{EXPENSE_TYPES[expense.expense_type] || expense.expense_type}</TableCell>
                    <TableCell>{expense.beneficiary}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>S/ {expense.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(expense.expense_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={EXPENSE_STATUSES[expense.status] || expense.status}
                        color={getStatusColor(expense.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {expense.generated_receipt_file ? (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<FileDownloadIcon />}
                          onClick={() => handleDownloadReceipt(expense.id)}
                        >
                          Descargar
                        </Button>
                      ) : expense.status === 'approved' ? (
                        <span style={{ color: 'orange' }}>Generando...</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <>
                          <IconButton
                            color="primary"
                            onClick={() => handleOpenDialog(expense)}
                          >
                            <EditIcon />
                          </IconButton>
                          {expense.status === 'pending' && (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleApprove(expense.id)}
                                sx={{ ml: 1 }}
                              >
                                Aprobar
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => handleReject(expense.id)}
                                sx={{ ml: 1 }}
                              >
                                Rechazar
                              </Button>
                            </>
                          )}
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(expense.id)}
                            sx={{ ml: 1 }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog for Add/Edit Expense */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingExpense ? 'Editar Gasto Administrativo' : 'Nuevo Gasto Administrativo'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Tipo de Gasto</InputLabel>
                  <Select
                    value={formData.expense_type}
                    onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                    label="Tipo de Gasto"
                    required
                  >
                    {Object.entries(EXPENSE_TYPES).map(([key, label]) => (
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
                  label="Fecha de Gasto"
                  type="date"
                  fullWidth
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Beneficiario"
                  fullWidth
                  required
                  value={formData.beneficiary}
                  onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
                  placeholder="Nombre del tercero que recibe el pago"
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
                  placeholder="Describe el gasto administrativo"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  label="Detalles del Beneficiario"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.beneficiary_details}
                  onChange={(e) => setFormData({ ...formData, beneficiary_details: e.target.value })}
                  placeholder="Información adicional sobre el beneficiario (opcional)"
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
              {editingExpense ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default ExpenseManagement;