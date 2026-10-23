import React, { useEffect, useMemo, useState } from 'react';
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
  CheckCircleOutline as ApproveIcon,
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteIcon,
  DownloadOutlined as DownloadIcon,
  EditOutlined as EditIcon,
  HighlightOffOutlined as RejectIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { miscellaneousPaymentsAPI, propertiesAPI } from '../services/api';
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
import { formatCurrency, formatDate, formatPropertyLabel, toInputDate } from '../utils/formatters';

const PAYMENT_TYPES = {
  maintenance: 'Mantenimiento',
  repairs: 'Reparaciones',
  services: 'Servicios',
  penalties: 'Multas',
  other: 'Otros',
};

const EMPTY_PAYMENT = {
  property_id: '',
  payment_type: '',
  amount: '',
  payment_date: '',
  description: '',
  notes: '',
};

const MiscellaneousPaymentManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [miscellaneousPayments, setMiscellaneousPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PAYMENT);
  const [receiptFile, setReceiptFile] = useState(null);
  const [filters, setFilters] = useState({ property_id: '', payment_type: '', status: '' });

  useEffect(() => {
    fetchMiscellaneousPayments();
    fetchProperties();
  }, []);

  const fetchMiscellaneousPayments = async () => {
    try {
      setLoading(true);
      const response = await miscellaneousPaymentsAPI.getMiscellaneousPayments();
      setMiscellaneousPayments(
        response.data.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      );
      setError('');
    } catch (err) {
      setError('No pudimos cargar los pagos varios.');
      console.error('Error fetching miscellaneous payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await propertiesAPI.getProperties(1, 10000);
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const handleOpenDialog = (payment = null) => {
    setFormError('');
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        property_id: payment.property_id || '',
        payment_type: payment.payment_type,
        amount: payment.amount.toString(),
        payment_date: toInputDate(payment.payment_date),
        description: payment.description,
        notes: payment.notes || '',
      });
    } else {
      setEditingPayment(null);
      setFormData(EMPTY_PAYMENT);
    }
    setReceiptFile(null);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingPayment(null);
    setFormError('');
    setFormData(EMPTY_PAYMENT);
    setReceiptFile(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = new FormData();
      payload.append('property_id', formData.property_id || '');
      payload.append('payment_type', formData.payment_type);
      payload.append('amount', parseFloat(formData.amount));
      payload.append('payment_date', new Date(formData.payment_date).toISOString());
      payload.append('description', formData.description);
      payload.append('notes', formData.notes || '');
      if (receiptFile) payload.append('receipt_file', receiptFile);

      if (editingPayment) {
        await miscellaneousPaymentsAPI.updateMiscellaneousPayment(editingPayment.id, payload);
        toast.success('Pago actualizado correctamente');
      } else {
        await miscellaneousPaymentsAPI.createMiscellaneousPayment(payload);
        toast.success('Pago creado correctamente');
      }
      fetchMiscellaneousPayments();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el pago.');
      }
      console.error('Error saving miscellaneous payment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (payment) => {
    const confirmed = await confirm({
      title: 'Eliminar pago',
      message: `¿Seguro que quieres eliminar el pago "${payment.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await miscellaneousPaymentsAPI.deleteMiscellaneousPayment(payment.id);
      toast.success('Pago eliminado correctamente');
      fetchMiscellaneousPayments();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar el pago');
      }
      console.error('Error deleting miscellaneous payment:', err);
    }
  };

  const changeStatus = async (payment, status) => {
    try {
      const payload = new FormData();
      payload.append('status', status);
      await miscellaneousPaymentsAPI.updateMiscellaneousPayment(payment.id, payload);
      toast.success(status === 'approved' ? 'Pago aprobado correctamente' : 'Pago rechazado');
      fetchMiscellaneousPayments();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(status === 'approved' ? 'No pudimos aprobar el pago' : 'No pudimos rechazar el pago');
      }
      console.error('Error updating miscellaneous payment status:', err);
    }
  };

  const handleDownloadReceipt = async (payment) => {
    try {
      const response = await miscellaneousPaymentsAPI.downloadMiscellaneousReceipt(payment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_pago_varios_${payment.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos descargar el recibo');
      }
      console.error('Error downloading receipt:', err);
    }
  };

  const filteredPayments = useMemo(
    () =>
      miscellaneousPayments.filter((payment) => {
        if (filters.property_id && payment.property_id !== filters.property_id) return false;
        if (filters.payment_type && payment.payment_type !== filters.payment_type) return false;
        if (filters.status && payment.status !== filters.status) return false;
        return true;
      }),
    [miscellaneousPayments, filters]
  );

  const activeFilterChips = [
    filters.property_id && {
      key: 'property',
      label: properties.find((property) => property.id === filters.property_id)
        ? formatPropertyLabel(properties.find((property) => property.id === filters.property_id))
        : 'Propiedad',
      onRemove: () => setFilters((current) => ({ ...current, property_id: '' })),
    },
    filters.payment_type && {
      key: 'type',
      label: PAYMENT_TYPES[filters.payment_type] || filters.payment_type,
      onRemove: () => setFilters((current) => ({ ...current, payment_type: '' })),
    },
    filters.status && {
      key: 'status',
      label: filters.status,
      onRemove: () => setFilters((current) => ({ ...current, status: '' })),
    },
  ].filter(Boolean);

  const totalFiltered = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const columns = [
    {
      key: 'property',
      label: 'Propiedad',
      render: (payment) => {
        const property = properties.find((item) => item.id === payment.property_id);
        return property ? formatPropertyLabel(property) : '—';
      },
    },
    { key: 'payment_type', label: 'Tipo', render: (payment) => PAYMENT_TYPES[payment.payment_type] || payment.payment_type },
    { key: 'description', label: 'Descripción' },
    {
      key: 'amount',
      label: 'Monto',
      render: (payment) => <MoneyText value={payment.amount} variant="body2" />,
    },
    { key: 'payment_date', label: 'Fecha', render: (payment) => formatDate(payment.payment_date) },
    { key: 'status', label: 'Estado', render: (payment) => <StatusChip status={payment.status} /> },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Cobranzas"
        title="Pagos varios"
        subtitle="Registra pagos por mantenimiento, servicios y otros conceptos."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Nuevo pago
          </Button>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={fetchMiscellaneousPayments}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <FilterBar
        chips={activeFilterChips}
        onClear={() => setFilters({ property_id: '', payment_type: '', status: '' })}
      >
        <FormControl fullWidth>
          <InputLabel>Propiedad</InputLabel>
          <Select
            value={filters.property_id}
            onChange={(event) => setFilters((current) => ({ ...current, property_id: event.target.value }))}
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
        <FormControl fullWidth>
          <InputLabel>Tipo</InputLabel>
          <Select
            value={filters.payment_type}
            onChange={(event) => setFilters((current) => ({ ...current, payment_type: event.target.value }))}
            label="Tipo"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {Object.entries(PAYMENT_TYPES).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Estado</InputLabel>
          <Select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            label="Estado"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            <MenuItem value="pending">Pendiente</MenuItem>
            <MenuItem value="approved">Aprobado</MenuItem>
            <MenuItem value="rejected">Rechazado</MenuItem>
            <MenuItem value="completed">Completado</MenuItem>
            <MenuItem value="cancelled">Cancelado</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <ResponsiveTable
        columns={columns}
        rows={filteredPayments}
        loading={loading}
        getRowId={(payment) => payment.id}
        mobileTitle={(payment) => payment.description}
        mobileSubtitle={(payment) =>
          `${PAYMENT_TYPES[payment.payment_type] || payment.payment_type} · ${formatCurrency(payment.amount)}`
        }
        emptyState={
          <EmptyState
            title="No hay pagos varios"
            description="Registra un pago o ajusta los filtros."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo pago
              </Button>
            }
          />
        }
        renderActions={(payment) => (
          <ActionMenu
            ariaLabel={`Acciones para ${payment.description}`}
            items={[
              payment.status === 'approved' && {
                label: 'Descargar recibo',
                icon: <DownloadIcon fontSize="small" />,
                onClick: () => handleDownloadReceipt(payment),
              },
              { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(payment) },
              isAdmin &&
                payment.status === 'pending' && {
                  label: 'Aprobar',
                  icon: <ApproveIcon fontSize="small" />,
                  color: 'success',
                  onClick: () => changeStatus(payment, 'approved'),
                },
              isAdmin &&
                payment.status === 'pending' && {
                  label: 'Rechazar',
                  icon: <RejectIcon fontSize="small" />,
                  color: 'error',
                  onClick: () => changeStatus(payment, 'rejected'),
                },
              isAdmin && { divider: true },
              isAdmin && {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => handleDelete(payment),
              },
            ].filter(Boolean)}
          />
        )}
        footer={
          filteredPayments.length > 0 ? (
            <Box sx={{ px: 2.5, py: 1.75, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filteredPayments.length} pagos
              </Typography>
              <MoneyText value={totalFiltered} variant="caption" />
            </Box>
          ) : null
        }
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingPayment ? 'Editar pago vario' : 'Nuevo pago vario'}
        subtitle="Registra el concepto, el monto y la fecha del pago."
        submitLabel={editingPayment ? 'Guardar cambios' : 'Crear pago'}
        saving={saving}
        error={formError}
        maxWidth="md"
      >
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Propiedad (opcional)</InputLabel>
              <Select
                value={formData.property_id}
                onChange={(event) => setFormData({ ...formData, property_id: event.target.value })}
                label="Propiedad (opcional)"
              >
                <MenuItem value="">
                  <em>Sin propiedad específica</em>
                </MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {formatPropertyLabel(property)} · {property.owner_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Tipo de pago</InputLabel>
              <Select
                value={formData.payment_type}
                onChange={(event) => setFormData({ ...formData, payment_type: event.target.value })}
                label="Tipo de pago"
              >
                {Object.entries(PAYMENT_TYPES).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Fecha de pago"
              type="date"
              fullWidth
              required
              value={formData.payment_date}
              onChange={(event) => setFormData({ ...formData, payment_date: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Descripción"
              fullWidth
              required
              multiline
              rows={2}
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              placeholder="Describe el pago o servicio"
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Notas"
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
            />
          </Grid>
          <Grid size={12}>
            <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
              Adjuntar recibo (opcional)
              <input type="file" hidden accept="image/*" onChange={(event) => setReceiptFile(event.target.files[0])} />
            </Button>
            {receiptFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {receiptFile.name}
              </Typography>
            )}
          </Grid>
        </Grid>
      </FormDialog>
    </PageContainer>
  );
};

export default MiscellaneousPaymentManagement;
