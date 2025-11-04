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
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';

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
    year: '',
    month: '',
    description: '',
    notes: '',
    beneficiary: '',
    beneficiary_details: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [filters, setFilters] = useState({
    expense_type: '',
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
        expense_type: expense.expense_type,
        amount: expense.amount.toString(),
        expense_date: new Date(expense.expense_date).toISOString().split('T')[0],
        year: expense.year.toString(),
        month: expense.month.toString(),
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
        year: '',
        month: '',
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
      year: '',
      month: '',
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
      formDataToSend.append('year', parseInt(formData.year));
      formDataToSend.append('month', parseInt(formData.month));
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
      setError('Error al importar gastos masivamente');
      console.error('Error bulk importing expenses:', err);
    }
  };

  const handleDownloadTemplate = () => {
    // Create a sample Excel template
    const headers = ['Tipo de Gasto', 'Monto', 'Fecha de Gasto', 'Año', 'Mes', 'Beneficiario', 'Descripción', 'Detalles del Beneficiario', 'Notas'];
    const sampleData = [
      ['maintenance', '150.50', '2024-01-15', '2024', '1', 'Proveedor ABC', 'Mantenimiento de jardín', 'Detalles adicionales', 'Notas opcionales'],
      ['utilities', '200.00', '2024-01-20', '2024', '1', 'Empresa Eléctrica', 'Pago de luz', '', ''],
      ['supplies', '75.25', '2024-01-25', '2024', '1', 'Tienda XYZ', 'Compra de materiales', 'Factura #12345', 'Urgente']
    ];

    // For now, just show an alert with instructions
    alert('Descarga la plantilla desde: /templates/plantilla_gastos_administrativos.xlsx\n\nEncabezados esperados:\n' + headers.join(', '));
  };


  const filteredExpenses = expenses.filter(expense => {
    if (filters.expense_type && expense.expense_type !== filters.expense_type) return false;
    if (filters.year && expense.year.toString() !== filters.year) return false;
    if (filters.month && expense.month.toString() !== filters.month) return false;
    return true;
  });

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
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
                <TableCell>Tipo</TableCell>
                <TableCell>Beneficiario</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha de Gasto</TableCell>
                <TableCell>Año</TableCell>
                <TableCell>Mes</TableCell>
                <TableCell>Recibo</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={5} columns={10} />
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
                    <TableCell>{expense.year}</TableCell>
                    <TableCell>
                      {['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][expense.month] || expense.month}
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
                      ) : (
                        <span style={{ color: 'orange' }}>Generando...</span>
                      )}
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
                  label="Año"
                  type="number"
                  fullWidth
                  required
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  inputProps={{ min: 2000, max: 2100 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Mes</InputLabel>
                  <Select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    label="Mes"
                    required
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
                </FormControl>
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