import React, { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Grid,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { feeSchedulesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import StatusChip from './common/StatusChip';
import MoneyText from './common/MoneyText';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import EmptyState from './common/EmptyState';
import { formatDate, toInputDate } from '../utils/formatters';

const EMPTY_SCHEDULE = { amount: '', description: '', effective_date: '', end_date: '', due_day: '1' };

const FeeScheduleManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SCHEDULE);

  useEffect(() => {
    fetchFeeSchedules();
  }, []);

  const fetchFeeSchedules = async () => {
    try {
      setLoading(true);
      const response = await feeSchedulesAPI.getFeeSchedules();
      setFeeSchedules(response.data);
      setError('');
    } catch (err) {
      setError('No pudimos cargar los planes de cuotas.');
      console.error('Error fetching fee schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (schedule = null) => {
    setFormError('');
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        amount: schedule.amount.toString(),
        description: schedule.description,
        effective_date: toInputDate(schedule.effective_date),
        end_date: schedule.end_date ? toInputDate(schedule.end_date) : '',
        due_day: schedule.due_day.toString(),
      });
    } else {
      setEditingSchedule(null);
      setFormData(EMPTY_SCHEDULE);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingSchedule(null);
    setFormError('');
    setFormData(EMPTY_SCHEDULE);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        due_day: parseInt(formData.due_day, 10),
        effective_date: new Date(formData.effective_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      if (editingSchedule) {
        await feeSchedulesAPI.updateFeeSchedule(editingSchedule.id, submitData);
        toast.success('Plan de cuotas actualizado correctamente');
      } else {
        await feeSchedulesAPI.createFeeSchedule(submitData);
        toast.success('Plan de cuotas creado correctamente');
      }
      fetchFeeSchedules();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el plan de cuotas.');
      }
      console.error('Error saving fee schedule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (schedule) => {
    const confirmed = await confirm({
      title: 'Eliminar plan de cuotas',
      message: `¿Seguro que quieres eliminar el plan "${schedule.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await feeSchedulesAPI.deleteFeeSchedule(schedule.id);
      toast.success('Plan de cuotas eliminado correctamente');
      fetchFeeSchedules();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar el plan de cuotas');
      }
      console.error('Error deleting fee schedule:', err);
    }
  };

  const columns = [
    { key: 'description', label: 'Descripción', mobile: false },
    {
      key: 'amount',
      label: 'Monto',
      render: (schedule) => <MoneyText value={schedule.amount} variant="body2" />,
    },
    {
      key: 'effective_date',
      label: 'Vigente desde',
      render: (schedule) => formatDate(schedule.effective_date),
    },
    {
      key: 'end_date',
      label: 'Hasta',
      render: (schedule) => (schedule.end_date ? formatDate(schedule.end_date) : 'Sin fin'),
    },
    { key: 'due_day', label: 'Día de vencimiento', render: (schedule) => `Día ${schedule.due_day}` },
    {
      key: 'status',
      label: 'Estado',
      render: (schedule) => (
        <StatusChip
          label={schedule.is_active ? 'Activo' : 'Inactivo'}
          tone={schedule.is_active ? 'success' : 'default'}
          status="active"
        />
      ),
    },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Administración"
        title="Planes de cuotas"
        subtitle="Define montos, vigencia y día de vencimiento de las cuotas."
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Nuevo plan
            </Button>
          )
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={fetchFeeSchedules}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <ResponsiveTable
        columns={columns}
        rows={feeSchedules}
        loading={loading}
        getRowId={(schedule) => schedule.id}
        mobileTitle={(schedule) => schedule.description}
        mobileSubtitle={(schedule) => `S/ ${Number(schedule.amount).toFixed(2)} · Día ${schedule.due_day}`}
        emptyState={
          <EmptyState
            title="No hay planes de cuotas"
            description="Crea un plan para definir montos y vencimientos."
            action={
              isAdmin && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                  Nuevo plan
                </Button>
              )
            }
          />
        }
        renderActions={
          isAdmin
            ? (schedule) => (
                <ActionMenu
                  ariaLabel={`Acciones para ${schedule.description}`}
                  items={[
                    { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(schedule) },
                    {
                      label: 'Eliminar',
                      icon: <DeleteIcon fontSize="small" />,
                      color: 'error',
                      onClick: () => handleDelete(schedule),
                    },
                  ]}
                />
              )
            : undefined
        }
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingSchedule ? 'Editar plan de cuotas' : 'Nuevo plan de cuotas'}
        subtitle="Los montos se aplican a las cuotas generadas desde la fecha de vigencia."
        submitLabel={editingSchedule ? 'Guardar cambios' : 'Crear plan'}
        saving={saving}
        error={formError}
        maxWidth="sm"
      >
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={12}>
            <TextField
              autoFocus
              label="Descripción"
              fullWidth
              required
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              placeholder="Ej. Cuota de mantenimiento"
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
              inputProps={{ step: '0.01', min: 0 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Día de vencimiento (1-31)"
              type="number"
              fullWidth
              required
              value={formData.due_day}
              onChange={(event) => setFormData({ ...formData, due_day: event.target.value })}
              inputProps={{ min: 1, max: 31 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Vigente desde"
              type="date"
              fullWidth
              required
              value={formData.effective_date}
              onChange={(event) => setFormData({ ...formData, effective_date: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Hasta (opcional)"
              type="date"
              fullWidth
              value={formData.end_date}
              onChange={(event) => setFormData({ ...formData, end_date: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
        </Grid>
      </FormDialog>
    </PageContainer>
  );
};

export default FeeScheduleManagement;
