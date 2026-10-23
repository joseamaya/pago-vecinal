import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  FileDownload as FileDownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import FilterBar from './common/FilterBar';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import MoneyText from './common/MoneyText';
import EmptyState from './common/EmptyState';
import { downloadBlob } from '../utils/downloadBlob';
import { MONTHS } from '../utils/months';
import { formatDate, formatMonth, formatPeriod, toInputDate } from '../utils/formatters';

const EMPTY_EXPENSE = { expense_date: '', description: '', amount: '', year: '', month: '' };

const ExpenseManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState(EMPTY_EXPENSE);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [filters, setFilters] = useState({ year: '', month: '' });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await expensesAPI.getExpenses();
      setExpenses(response.data.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date)));
      setError('');
    } catch (err) {
      setError('No pudimos cargar los gastos administrativos.');
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (expense = null) => {
    setFormError('');
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        expense_date: toInputDate(expense.expense_date),
        description: expense.description,
        amount: expense.amount.toString(),
        year: expense.year ? expense.year.toString() : '',
        month: expense.month ? expense.month.toString() : '',
      });
    } else {
      setEditingExpense(null);
      setFormData(EMPTY_EXPENSE);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingExpense(null);
    setFormError('');
    setFormData(EMPTY_EXPENSE);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = new FormData();
      payload.append('expense_date', new Date(formData.expense_date).toISOString());
      payload.append('description', formData.description);
      payload.append('amount', parseFloat(formData.amount));
      if (formData.year) payload.append('year', parseInt(formData.year, 10));
      if (formData.month) payload.append('month', parseInt(formData.month, 10));

      if (editingExpense) {
        await expensesAPI.updateExpense(editingExpense.id, payload);
        toast.success('Gasto actualizado correctamente');
      } else {
        await expensesAPI.createExpense(payload);
        toast.success('Gasto creado correctamente');
      }
      fetchExpenses();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el gasto.');
      }
      console.error('Error saving expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense) => {
    const confirmed = await confirm({
      title: 'Eliminar gasto',
      message: `¿Seguro que quieres eliminar "${expense.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await expensesAPI.deleteExpense(expense.id);
      toast.success('Gasto eliminado correctamente');
      fetchExpenses();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar el gasto');
      }
      console.error('Error deleting expense:', err);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      setError('Selecciona un archivo Excel para importar.');
      return;
    }

    try {
      const response = await expensesAPI.bulkImportExpenses(bulkImportFile);
      setBulkImportResult(response.data);
      setBulkImportFile(null);
      fetchExpenses();
      setError('');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos importar los gastos');
      }
      console.error('Error bulk importing expenses:', err);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await expensesAPI.downloadTemplate();
      downloadBlob(response.data, 'plantilla_gastos_administrativos.xlsx');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos descargar la plantilla');
      }
      console.error('Error downloading expenses template:', err);
    }
  };

  const availableYears = useMemo(
    () =>
      [...new Set(expenses.map((expense) => expense.year).filter(Boolean))]
        .sort((a, b) => b - a)
        .map(String),
    [expenses]
  );

  const filteredExpenses = expenses.filter((expense) => {
    if (filters.year && String(expense.year ?? '') !== filters.year) return false;
    if (filters.month && String(expense.month ?? '') !== filters.month) return false;
    return true;
  });

  const activeFilterChips = [
    filters.year && {
      key: 'year',
      label: `Año ${filters.year}`,
      onRemove: () => setFilters((current) => ({ ...current, year: '' })),
    },
    filters.month && {
      key: 'month',
      label: formatMonth(filters.month),
      onRemove: () => setFilters((current) => ({ ...current, month: '' })),
    },
  ].filter(Boolean);

  const columns = [
    { key: 'description', label: 'Descripción', mobile: false },
    {
      key: 'amount',
      label: 'Monto',
      render: (expense) => <MoneyText value={expense.amount} variant="body2" />,
    },
    { key: 'expense_date', label: 'Fecha', render: (expense) => formatDate(expense.expense_date) },
    {
      key: 'period',
      label: 'Periodo',
      render: (expense) =>
        expense.year || expense.month ? formatPeriod(expense.month, expense.year) : '—',
    },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Finanzas"
        title="Gastos administrativos"
        subtitle="Registra y controla los gastos de la comunidad."
        actions={
          isAdmin && (
            <>
              <Button variant="text" startIcon={<FileDownloadIcon />} onClick={handleDownloadTemplate}>
                Plantilla
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => document.getElementById('bulk-import-input').click()}
              >
                Importar
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo gasto
              </Button>
            </>
          )
        }
      />

      <input
        id="bulk-import-input"
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={(event) => setBulkImportFile(event.target.files[0])}
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={fetchExpenses}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {bulkImportFile && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Archivo seleccionado: <strong>{bulkImportFile.name}</strong>
          <Button size="small" onClick={handleBulkImport} sx={{ ml: 2 }}>
            Importar
          </Button>
          <Button size="small" onClick={() => setBulkImportFile(null)} sx={{ ml: 1 }}>
            Cancelar
          </Button>
        </Alert>
      )}

      {bulkImportResult && (
        <Alert
          severity={bulkImportResult.failed_imports > 0 ? 'warning' : 'success'}
          sx={{ mb: 2.5 }}
          onClose={() => setBulkImportResult(null)}
        >
          Importación completada: {bulkImportResult.successful_imports} exitosos, {bulkImportResult.failed_imports} fallidos.
          {bulkImportResult.errors?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {bulkImportResult.errors.slice(0, 3).map((item, index) => (
                <Typography key={index} variant="caption" sx={{ display: 'block' }}>
                  Fila {item.row}: {item.error}
                </Typography>
              ))}
            </Box>
          )}
        </Alert>
      )}

      <FilterBar
        chips={activeFilterChips}
        onClear={() => setFilters({ year: '', month: '' })}
      >
        <FormControl fullWidth>
          <InputLabel>Año</InputLabel>
          <Select
            value={filters.year}
            onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
            label="Año"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {availableYears.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Mes</InputLabel>
          <Select
            value={filters.month}
            onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
            label="Mes"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {MONTHS.map((month) => (
              <MenuItem key={month.value} value={month.value.toString()}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      <ResponsiveTable
        columns={columns}
        rows={filteredExpenses}
        loading={loading}
        getRowId={(expense) => expense.id}
        mobileTitle={(expense) => expense.description}
        mobileSubtitle={(expense) =>
          `${formatDate(expense.expense_date)}${expense.year ? ` · ${formatPeriod(expense.month, expense.year)}` : ''}`
        }
        emptyState={
          <EmptyState
            title="No hay gastos registrados"
            description="Agrega un gasto o importa un archivo Excel."
            action={
              isAdmin && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                  Nuevo gasto
                </Button>
              )
            }
          />
        }
        renderActions={
          isAdmin
            ? (expense) => (
                <ActionMenu
                  ariaLabel={`Acciones para ${expense.description}`}
                  items={[
                    { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(expense) },
                    {
                      label: 'Eliminar',
                      icon: <DeleteIcon fontSize="small" />,
                      color: 'error',
                      onClick: () => handleDelete(expense),
                    },
                  ]}
                />
              )
            : undefined
        }
        footer={
          filteredExpenses.length > 0 ? (
            <Box sx={{ px: 2.5, py: 1.75, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filteredExpenses.length} gastos · Total{' '}
                {filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toLocaleString('es-PE', {
                  style: 'currency',
                  currency: 'PEN',
                })}
              </Typography>
            </Box>
          ) : null
        }
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingExpense ? 'Editar gasto' : 'Nuevo gasto'}
        subtitle="Registra el monto, la fecha y el periodo del gasto."
        submitLabel={editingExpense ? 'Guardar cambios' : 'Crear gasto'}
        saving={saving}
        error={formError}
        maxWidth="md"
      >
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              autoFocus
              label="Fecha del gasto"
              type="date"
              fullWidth
              required
              value={formData.expense_date}
              onChange={(event) => setFormData({ ...formData, expense_date: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Descripción"
              fullWidth
              required
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              placeholder="Ej. Mantenimiento de áreas comunes"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Monto (S/)"
              type="number"
              fullWidth
              required
              value={formData.amount}
              onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
              inputProps={{ min: 0.01, step: 0.01 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Año"
              type="number"
              fullWidth
              value={formData.year}
              onChange={(event) => setFormData({ ...formData, year: event.target.value })}
              inputProps={{ min: 2000, max: 2100 }}
              helperText="Opcional"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Mes</InputLabel>
              <Select
                value={formData.month}
                onChange={(event) => setFormData({ ...formData, month: event.target.value })}
                label="Mes"
              >
                <MenuItem value="">
                  <em>Automático</em>
                </MenuItem>
                {MONTHS.map((month) => (
                  <MenuItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </FormDialog>
    </PageContainer>
  );
};

export default ExpenseManagement;
