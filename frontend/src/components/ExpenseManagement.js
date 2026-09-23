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
  Grid,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';



const ExpenseManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    expense_date: '',
    description: '',
    amount: '',
    year: '',
    month: '',
  });
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [filters, setFilters] = useState({
    year: '',
    month: '',
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
        expense_date: new Date(expense.expense_date).toISOString().split('T')[0],
        description: expense.description,
        amount: expense.amount.toString(),
        year: expense.year ? expense.year.toString() : '',
        month: expense.month ? expense.month.toString() : '',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        expense_date: '',
        description: '',
        amount: '',
        year: '',
        month: '',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingExpense(null);
    setFormData({
      expense_date: '',
      description: '',
      amount: '',
      year: '',
      month: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('expense_date', new Date(formData.expense_date).toISOString());
      formDataToSend.append('description', formData.description);
      formDataToSend.append('amount', parseFloat(formData.amount));
      if (formData.year) {
        formDataToSend.append('year', parseInt(formData.year));
      }
      if (formData.month) {
        formDataToSend.append('month', parseInt(formData.month));
      }

      if (editingExpense) {
        await expensesAPI.updateExpense(editingExpense.id, formDataToSend);
        toast.success('Gasto actualizado correctamente');
      } else {
        await expensesAPI.createExpense(formDataToSend);
        toast.success('Gasto creado correctamente');
      }
      fetchExpenses();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(editingExpense ? 'Error al actualizar gasto' : 'Error al crear gasto');
      }
      console.error('Error saving expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense) => {
    const confirmed = await confirm({
      title: 'Eliminar gasto',
      message: `¿Estás seguro de que quieres eliminar "${expense.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await expensesAPI.deleteExpense(expense.id);
      toast.success('Gasto eliminado correctamente');
      fetchExpenses();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar gasto');
      }
      console.error('Error deleting expense:', err);
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
      year: '',
      month: '',
    });
    fetchExpenses();
  };

  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      setError('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      const response = await expensesAPI.bulkImportExpenses(bulkImportFile);
      setBulkImportResult(response.data);
      setBulkImportFile(null);
      fetchExpenses(); // Refresh the list
      setError('');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al importar gastos masivamente');
      }
      console.error('Error bulk importing expenses:', err);
    }
  };

  const handleDownloadTemplate = () => {
    // Create a sample Excel template
    const headers = ['Fecha de Gasto', 'Descripción', 'Monto', 'Año', 'Mes'];

    // For now, just show instructions
    toast.info(
      `Descarga la plantilla desde: /templates/plantilla_gastos_administrativos.xlsx. Encabezados esperados: ${headers.join(', ')}`
    );
  };


  const filteredExpenses = expenses.filter(expense => {
    if (filters.year && expense.year && expense.year.toString() !== filters.year) return false;
    if (filters.month && expense.month && expense.month.toString() !== filters.month) return false;
    return true;
  });

  return (
    <PageContainer maxWidth="xl">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Gastos Administrativos
        </Typography>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Nuevo Gasto
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => document.getElementById('bulk-import-input').click()}
            >
              Importar Masivo
            </Button>
            <Button
              variant="text"
              startIcon={<FileDownloadIcon />}
              onClick={handleDownloadTemplate}
            >
              Plantilla Excel
            </Button>
          </Box>
        )}
        <input
          id="bulk-import-input"
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => setBulkImportFile(e.target.files[0])}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {bulkImportFile && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Archivo seleccionado: {bulkImportFile.name}
          <Button
            size="small"
            onClick={handleBulkImport}
            sx={{ ml: 2 }}
          >
            Importar
          </Button>
          <Button
            size="small"
            onClick={() => setBulkImportFile(null)}
            sx={{ ml: 1 }}
          >
            Cancelar
          </Button>
        </Alert>
      )}

      {bulkImportResult && (
        <Alert
          severity={bulkImportResult.failed_imports > 0 ? "warning" : "success"}
          sx={{ mb: 2 }}
          onClose={() => setBulkImportResult(null)}
        >
          <Typography variant="body2">
            Importación completada: {bulkImportResult.successful_imports} exitosos, {bulkImportResult.failed_imports} fallidos
          </Typography>
          {bulkImportResult.errors.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight="bold">Errores:</Typography>
              {bulkImportResult.errors.slice(0, 5).map((error, index) => (
                <Typography key={index} variant="body2" sx={{ fontSize: '0.8rem' }}>
                  Fila {error.row}: {error.error}
                </Typography>
              ))}
              {bulkImportResult.errors.length > 5 && (
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  ... y {bulkImportResult.errors.length - 5} más errores
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Filtros
        </Typography>
        <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Año"
                type="number"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                inputProps={{ min: 2000, max: 2100 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Mes</InputLabel>
                <Select
                  value={filters.month}
                  onChange={(e) => handleFilterChange('month', e.target.value)}
                  label="Mes"
                >
                  <MenuItem value="">
                    <em>Todos</em>
                  </MenuItem>
                  <MenuItem value="1">Enero</MenuItem>
                  <MenuItem value="2">Febrero</MenuItem>
                  <MenuItem value="3">Marzo</MenuItem>
                  <MenuItem value="4">Abril</MenuItem>
                  <MenuItem value="5">Mayo</MenuItem>
                  <MenuItem value="6">Junio</MenuItem>
                  <MenuItem value="7">Julio</MenuItem>
                  <MenuItem value="8">Agosto</MenuItem>
                  <MenuItem value="9">Septiembre</MenuItem>
                  <MenuItem value="10">Octubre</MenuItem>
                  <MenuItem value="11">Noviembre</MenuItem>
                  <MenuItem value="12">Diciembre</MenuItem>
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
                <TableCell>Descripción</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Gasto</TableCell>
                <TableCell>Año</TableCell>
                <TableCell>Mes</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={5} columns={6} />
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      title="No hay gastos administrativos registrados"
                      description="Agrega un gasto o importa un archivo Excel."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>S/ {expense.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(expense.expense_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>{expense.year || '-'}</TableCell>
                    <TableCell>
                      {expense.month ? ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][expense.month - 1] : '-'}
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <>
                          <IconButton
                            color="primary"
                            aria-label={`Editar ${expense.description}`}
                            onClick={() => handleOpenDialog(expense)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            aria-label={`Eliminar ${expense.description}`}
                            onClick={() => handleDelete(expense)}
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
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingExpense ? 'Editar Gasto Administrativo' : 'Nuevo Gasto Administrativo'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  autoFocus={!isMobile}
                  margin="dense"
                  label="Fecha de Gasto"
                  type="date"
                  fullWidth
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="dense"
                  label="Descripción"
                  fullWidth
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el gasto administrativo"
                />
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
                  label="Año (opcional)"
                  type="number"
                  fullWidth
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  inputProps={{ min: 2000, max: 2100 }}
                  helperText="Si no se especifica, se calculará automáticamente"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Mes (opcional)</InputLabel>
                  <Select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    label="Mes (opcional)"
                  >
                    <MenuItem value="">
                      <em>Seleccionar Mes</em>
                    </MenuItem>
                    <MenuItem value="1">Enero</MenuItem>
                    <MenuItem value="2">Febrero</MenuItem>
                    <MenuItem value="3">Marzo</MenuItem>
                    <MenuItem value="4">Abril</MenuItem>
                    <MenuItem value="5">Mayo</MenuItem>
                    <MenuItem value="6">Junio</MenuItem>
                    <MenuItem value="7">Julio</MenuItem>
                    <MenuItem value="8">Agosto</MenuItem>
                    <MenuItem value="9">Septiembre</MenuItem>
                    <MenuItem value="10">Octubre</MenuItem>
                    <MenuItem value="11">Noviembre</MenuItem>
                    <MenuItem value="12">Diciembre</MenuItem>
                  </Select>
                  <Typography variant="caption" color="textSecondary">
                    Si no se especifica, se calculará automáticamente
                  </Typography>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando...' : editingExpense ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
};

export default ExpenseManagement;
