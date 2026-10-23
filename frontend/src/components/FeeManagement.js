import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  DownloadOutlined as DownloadIcon,
  EditOutlined as EditIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { feesAPI, propertiesAPI, feeSchedulesAPI, reportsAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import FilterBar from './common/FilterBar';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import StatusChip from './common/StatusChip';
import MoneyText from './common/MoneyText';
import EmptyState from './common/EmptyState';
import PaymentsModal from './PaymentsModal';
import { MONTHS } from '../utils/months';
import { formatDate, formatPeriod, formatPropertyLabel, toInputDate } from '../utils/formatters';

const FeeManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [fees, setFees] = useState([]);
  const [properties, setProperties] = useState([]);
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [formData, setFormData] = useState({
    property_id: '',
    fee_schedule_id: '',
    due_date: '',
    notes: '',
  });
  const [generateFormData, setGenerateFormData] = useState({
    year: new Date().getFullYear(),
    months: [new Date().getMonth() + 1], // Array of selected months
    feeScheduleIds: [], // Array of selected fee schedule IDs
  });
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: '',
    status: '',
    property: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [selectedFeeForPayments, setSelectedFeeForPayments] = useState(null);
  const [generatingFees, setGeneratingFees] = useState(false);

  const fetchFees = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const filterParams = {};
      if (filters.year) filterParams.year = parseInt(filters.year);
      if (filters.month) filterParams.month = parseInt(filters.month);
      if (filters.status) filterParams.status = filters.status;
      if (filters.property) filterParams.property_id = filters.property;
      filterParams.sort_by_period = true; // Always sort by period

      const response = await feesAPI.getFees(filterParams, page, pageSize);
      setFees(response.data.data);
      setTotalPages(response.data.pagination.total_pages);
      setTotalCount(response.data.pagination.total_count);
      setCurrentPage(page);
      setError('');
    } catch (err) {
      setError('Error al cargar cuotas');
      console.error('Error fetching fees:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  useEffect(() => {
    fetchProperties();
    if (isAdmin) fetchFeeSchedules();
  }, [isAdmin]);

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties(1, 10000); // Get all properties without pagination
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchFeeSchedules = async () => {
    try {
      const response = await feeSchedulesAPI.getFeeSchedules();
      setFeeSchedules(response.data);
    } catch (err) {
      console.error('Error fetching fee schedules:', err);
    }
  };

  const handleOpenDialog = (fee = null) => {
    if (fee) {
      setEditingFee(fee);
      setFormData({
        property_id: fee.property_id,
        fee_schedule_id: fee.fee_schedule_id,
        due_date: toInputDate(fee.due_date),
        notes: fee.notes || '',
      });
    } else {
      setEditingFee(null);
      setFormData({
        property_id: '',
        fee_schedule_id: '',
        due_date: '',
        reference: '',
        notes: '',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingFee(null);
    setFormData({
      property_id: '',
      fee_schedule_id: '',
      due_date: '',
      notes: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitData = {
        ...formData,
        due_date: new Date(formData.due_date).toISOString(),
      };

      if (editingFee) {
        await feesAPI.updateFee(editingFee.id, submitData);
        toast.success('Cuota actualizada correctamente');
      } else {
        await feesAPI.createFee(submitData);
        toast.success('Cuota creada correctamente');
      }
      fetchFees(currentPage);
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(editingFee ? 'Error al actualizar cuota' : 'Error al crear cuota');
      }
      console.error('Error saving fee:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fee) => {
    const confirmed = await confirm({
      title: 'Eliminar cuota',
      message: `¿Estás seguro de que quieres eliminar la cuota de ${getPropertyInfo(fee.property_id)} (${fee.month}/${fee.year})? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await feesAPI.deleteFee(fee.id);
      toast.success('Cuota eliminada correctamente');
      fetchFees(currentPage);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar cuota');
      }
      console.error('Error deleting fee:', err);
    }
  };

  const handleGenerateFees = () => {
    setGenerateOpen(true);
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    setGeneratingFees(true);
    try {
      const response = await feesAPI.generateFees(
        true,
        generateFormData.year,
        generateFormData.months,
        generateFormData.feeScheduleIds.length > 0 ? generateFormData.feeScheduleIds : null
      );
      toast.success(response.data.message || 'Cuotas generadas correctamente');
      fetchFees(currentPage);
      setGenerateOpen(false);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al generar cuotas');
      }
      console.error('Error generating fees:', err);
    } finally {
      setGeneratingFees(false);
    }
  };

  const handleGenerateClose = () => {
    setGenerateOpen(false);
    setGenerateFormData({
      year: new Date().getFullYear(),
      months: [new Date().getMonth() + 1],
      feeScheduleIds: [],
    });
  };

  const getPropertyInfo = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? `${property.villa} ${property.row_letter}${property.number}` : 'N/A';
  };

const handleMonthsChange = (event) => {
    const { value } = event.target;
    setGenerateFormData({
      ...generateFormData,
      months: typeof value === 'string' ? value.split(',').map(Number) : value,
    });
  };

  const handleFeeSchedulesChange = (event) => {
    const { value } = event.target;
    setGenerateFormData({
      ...generateFormData,
      feeScheduleIds: typeof value === 'string' ? value.split(',') : value,
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters({
      ...filters,
      [field]: value,
    });
  };

  const handleClearFilters = () => {
    setFilters({
      year: new Date().getFullYear(),
      month: '',
      status: '',
      property: '',
    });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchFees(newPage);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await reportsAPI.getFilteredFeesReport({
        ...filters,
        property_id: filters.property,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cuotas_filtradas_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al descargar el reporte Excel');
      }
      console.error('Error downloading Excel report:', err);
    }
  };

  const handleDownloadTrafficLightReport = async () => {
    try {
      const response = await reportsAPI.getTrafficLightReport();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_semaforo_cuotas_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al descargar el reporte semáforo');
      }
      console.error('Error downloading traffic light report:', err);
    }
  };

  const handleViewPayments = (fee) => {
    setSelectedFeeForPayments(fee);
    setPaymentsModalOpen(true);
  };

  const handleClosePaymentsModal = () => {
    setPaymentsModalOpen(false);
    setSelectedFeeForPayments(null);
  };

  const availableYears = Array.from(
    { length: Math.max(new Date().getFullYear() - 2019, 1) },
    (_, index) => new Date().getFullYear() - index
  );

  const columns = [
    {
      key: 'property',
      label: 'Propiedad',
      mobile: false,
      render: (fee) => getPropertyInfo(fee.property_id),
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (fee) => <MoneyText value={fee.amount} variant="body2" />,
    },
    {
      key: 'paid_amount',
      label: 'Pagado',
      render: (fee) => <MoneyText value={fee.paid_amount} variant="body2" sx={{ color: 'success.main' }} />,
    },
    {
      key: 'remaining_amount',
      label: 'Pendiente',
      render: (fee) => (
        <MoneyText value={fee.remaining_amount ?? fee.amount} variant="body2" sx={{ color: 'error.main' }} />
      ),
    },
    {
      key: 'period',
      label: 'Periodo',
      render: (fee) => formatPeriod(fee.month, fee.year),
    },
    {
      key: 'due_date',
      label: 'Vencimiento',
      render: (fee) => formatDate(fee.due_date),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (fee) => <StatusChip status={fee.status} />,
    },
  ];

  const activeFilterChips = [
    filters.year && {
      key: 'year',
      label: `Año ${filters.year}`,
      onRemove: () => setFilters((current) => ({ ...current, year: '' })),
    },
    filters.month && {
      key: 'month',
      label: MONTHS.find((month) => month.value.toString() === filters.month.toString())?.label,
      onRemove: () => setFilters((current) => ({ ...current, month: '' })),
    },
    filters.status && {
      key: 'status',
      label: filters.status,
      onRemove: () => setFilters((current) => ({ ...current, status: '' })),
    },
    filters.property && {
      key: 'property',
      label: getPropertyInfo(filters.property),
      onRemove: () => setFilters((current) => ({ ...current, property: '' })),
    },
  ].filter(Boolean);

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Cobranzas"
        title="Cuotas"
        subtitle="Genera, revisa y da seguimiento a las cuotas de cada propiedad."
        actions={
          <>
            <ActionMenu
              ariaLabel="Más acciones de cuotas"
              buttonSx={{ border: 1, borderColor: 'divider', borderRadius: 2.5 }}
              items={[
                {
                  label: 'Exportar Excel',
                  icon: <DownloadIcon fontSize="small" />,
                  onClick: handleDownloadExcel,
                },
                isAdmin && {
                  label: 'Reporte semáforo',
                  icon: <DownloadIcon fontSize="small" />,
                  onClick: handleDownloadTrafficLightReport,
                },
              ].filter(Boolean)}
            />
            {isAdmin && (
              <>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                  Nueva cuota
                </Button>
                <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleGenerateFees}>
                  Generar cuotas
                </Button>
              </>
            )}
          </>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => fetchFees(currentPage)}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <FilterBar
        chips={activeFilterChips}
        onClear={handleClearFilters}
      >
        <FormControl fullWidth>
          <InputLabel>Año</InputLabel>
          <Select
            value={filters.year}
            onChange={(event) => handleFilterChange('year', event.target.value)}
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
            onChange={(event) => handleFilterChange('month', event.target.value)}
            label="Mes"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {MONTHS.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Estado</InputLabel>
          <Select
            value={filters.status}
            onChange={(event) => handleFilterChange('status', event.target.value)}
            label="Estado"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            <MenuItem value="pending">Pendiente</MenuItem>
            <MenuItem value="partially_paid">Pago parcial</MenuItem>
            <MenuItem value="completed">Completado</MenuItem>
            <MenuItem value="failed">Fallido</MenuItem>
            <MenuItem value="cancelled">Cancelado</MenuItem>
            <MenuItem value="agreement">En convenio</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Propiedad</InputLabel>
          <Select
            value={filters.property}
            onChange={(event) => handleFilterChange('property', event.target.value)}
            label="Propiedad"
          >
            <MenuItem value="">
              <em>Todas</em>
            </MenuItem>
            {properties.map((property) => (
              <MenuItem key={property.id} value={property.id}>
                {formatPropertyLabel(property)} · {property.owner_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      <ResponsiveTable
        columns={columns}
        rows={fees}
        loading={loading}
        getRowId={(fee) => fee.id}
        mobileTitle={(fee) => getPropertyInfo(fee.property_id)}
        mobileSubtitle={(fee) => `${formatPeriod(fee.month, fee.year)} · ${formatDate(fee.due_date)}`}
        emptyState={
          <EmptyState
            title="No hay cuotas registradas"
            description="Genera cuotas o crea una manualmente para empezar."
            action={
              isAdmin && (
                <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleGenerateFees}>
                  Generar cuotas
                </Button>
              )
            }
          />
        }
        renderActions={(fee) => (
          <ActionMenu
            ariaLabel={`Acciones para la cuota ${formatPeriod(fee.month, fee.year)}`}
            items={[
              (fee.status === 'completed' || fee.status === 'partially_paid') && {
                label: 'Ver pagos',
                icon: <ViewIcon fontSize="small" />,
                onClick: () => handleViewPayments(fee),
              },
              {
                label: 'Editar',
                icon: <EditIcon fontSize="small" />,
                onClick: () => handleOpenDialog(fee),
              },
              isAdmin && {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => handleDelete(fee),
              },
            ].filter(Boolean)}
          />
        )}
        header={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mostrando {fees.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, totalCount)} de {totalCount} cuotas
            </Typography>
            {isAdmin && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filters.year || 'Todos los años'}
              </Typography>
            )}
          </Box>
        }
        footer={
          totalPages > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(event, page) => handlePageChange(page)}
                color="primary"
              />
            </Box>
          ) : null
        }
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingFee ? 'Editar cuota' : 'Nueva cuota'}
        subtitle={
          editingFee
            ? `${getPropertyInfo(editingFee.property_id)} · ${formatPeriod(editingFee.month, editingFee.year)}`
            : 'Selecciona la propiedad y el plan de cuotas.'
        }
        submitLabel={editingFee ? 'Guardar cambios' : 'Crear cuota'}
        saving={saving}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Propiedad</InputLabel>
            <Select
              value={formData.property_id}
              onChange={(event) => setFormData({ ...formData, property_id: event.target.value })}
              label="Propiedad"
              required
            >
              {properties.map((property) => (
                <MenuItem key={property.id} value={property.id}>
                  {formatPropertyLabel(property)} · {property.owner_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Plan de cuotas</InputLabel>
            <Select
              value={formData.fee_schedule_id}
              onChange={(event) => setFormData({ ...formData, fee_schedule_id: event.target.value })}
              label="Plan de cuotas"
              required
            >
              {feeSchedules.map((schedule) => (
                <MenuItem key={schedule.id} value={schedule.id}>
                  {schedule.description} · S/ {Number(schedule.amount).toFixed(2)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Fecha de vencimiento"
            type="date"
            fullWidth
            required
            value={formData.due_date}
            onChange={(event) => setFormData({ ...formData, due_date: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Notas"
            fullWidth
            multiline
            rows={3}
            value={formData.notes}
            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          />
        </Box>
      </FormDialog>

      <FormDialog
        open={generateOpen}
        onClose={handleGenerateClose}
        onSubmit={handleGenerateSubmit}
        title="Generar cuotas"
        subtitle="Se generarán cuotas para todas las propiedades con los planes seleccionados."
        submitLabel="Generar cuotas"
        savingLabel="Generando…"
        saving={generatingFees}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Año"
            type="number"
            fullWidth
            required
            disabled={generatingFees}
            value={generateFormData.year}
            onChange={(event) =>
              setGenerateFormData({ ...generateFormData, year: parseInt(event.target.value, 10) })
            }
            inputProps={{ min: 2020, max: 2035 }}
          />
          <FormControl fullWidth>
            <InputLabel>Meses</InputLabel>
            <Select
              multiple
              disabled={generatingFees}
              value={generateFormData.months}
              onChange={handleMonthsChange}
              input={<OutlinedInput label="Meses" />}
              renderValue={(selected) =>
                selected.map((month) => MONTHS.find((item) => item.value === month)?.label).join(', ')
              }
            >
              {MONTHS.map((month) => (
                <MenuItem key={month.value} value={month.value}>
                  <Checkbox checked={generateFormData.months.indexOf(month.value) > -1} />
                  <ListItemText primary={month.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Planes de cuotas</InputLabel>
            <Select
              multiple
              disabled={generatingFees}
              value={generateFormData.feeScheduleIds}
              onChange={handleFeeSchedulesChange}
              input={<OutlinedInput label="Planes de cuotas" />}
              renderValue={(selected) =>
                selected
                  .map((id) => feeSchedules.find((schedule) => schedule.id === id)?.description)
                  .filter(Boolean)
                  .join(', ')
              }
            >
              {feeSchedules.map((schedule) => (
                <MenuItem key={schedule.id} value={schedule.id}>
                  <Checkbox checked={generateFormData.feeScheduleIds.indexOf(schedule.id) > -1} />
                  <ListItemText primary={`${schedule.description} · S/ ${Number(schedule.amount).toFixed(2)}`} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Si no seleccionas planes, se usarán todos los planes activos.
          </Typography>
        </Box>
      </FormDialog>

      <PaymentsModal
        open={paymentsModalOpen}
        onClose={handleClosePaymentsModal}
        fee={selectedFeeForPayments}
      />
    </PageContainer>
  );
};

export default FeeManagement;
