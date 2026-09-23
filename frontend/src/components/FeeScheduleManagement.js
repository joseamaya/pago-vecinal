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
  Chip,
  IconButton,
  Box,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { feeSchedulesAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';

const FeeScheduleManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    effective_date: '',
    end_date: '',
    due_day: '',
  });

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
      setError('Error al cargar planes de cuotas');
      console.error('Error fetching fee schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (schedule = null) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        amount: schedule.amount.toString(),
        description: schedule.description,
        effective_date: new Date(schedule.effective_date).toISOString().split('T')[0],
        end_date: schedule.end_date ? new Date(schedule.end_date).toISOString().split('T')[0] : '',
        due_day: schedule.due_day.toString(),
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        amount: '',
        description: '',
        effective_date: '',
        end_date: '',
        due_day: '1',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingSchedule(null);
    setFormData({
      amount: '',
      description: '',
      effective_date: '',
      end_date: '',
      due_day: '1',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        due_day: parseInt(formData.due_day),
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
      toast.error(editingSchedule ? 'Error al actualizar plan de cuotas' : 'Error al crear plan de cuotas');
      console.error('Error saving fee schedule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (schedule) => {
    const confirmed = await confirm({
      title: 'Eliminar plan de cuotas',
      message: `¿Estás seguro de que quieres eliminar el plan "${schedule.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await feeSchedulesAPI.deleteFeeSchedule(schedule.id);
      toast.success('Plan de cuotas eliminado correctamente');
      fetchFeeSchedules();
    } catch (err) {
      toast.error('Error al eliminar plan de cuotas');
      console.error('Error deleting fee schedule:', err);
    }
  };

  return (
    <PageContainer>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Planes de Cuotas
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Plan
          </Button>
        )}
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
                <TableCell>Descripción</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Fecha Efectiva</TableCell>
                <TableCell>Fecha Fin</TableCell>
                <TableCell>Día de Vencimiento</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={5} columns={7} />
              ) : feeSchedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      title="No hay planes de cuotas registrados"
                      description="Crea un plan para definir montos y vencimientos."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                feeSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{schedule.description}</TableCell>
                    <TableCell>S/ {schedule.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(schedule.effective_date).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      {schedule.end_date ? new Date(schedule.end_date).toLocaleDateString('es-ES') : '-'}
                    </TableCell>
                    <TableCell>{schedule.due_day}</TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.is_active ? 'Activo' : 'Inactivo'}
                        color={schedule.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <>
                          <IconButton
                            color="primary"
                            aria-label={`Editar ${schedule.description}`}
                            onClick={() => handleOpenDialog(schedule)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            aria-label={`Eliminar ${schedule.description}`}
                            onClick={() => handleDelete(schedule)}
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

      {/* Dialog for Add/Edit Fee Schedule */}
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingSchedule ? 'Editar Plan de Cuotas' : 'Nuevo Plan de Cuotas'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus={!isMobile}
              margin="dense"
              label="Descripción"
              fullWidth
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Monto (S/)"
              type="number"
              fullWidth
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              inputProps={{ step: "0.01" }}
            />
            <TextField
              margin="dense"
              label="Fecha Efectiva"
              type="date"
              fullWidth
              required
              value={formData.effective_date}
              onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              margin="dense"
              label="Fecha de Fin (opcional)"
              type="date"
              fullWidth
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              margin="dense"
              label="Día de Vencimiento (1-31)"
              type="number"
              fullWidth
              required
              value={formData.due_day}
              onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
              inputProps={{ min: 1, max: 31 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando...' : editingSchedule ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
};

export default FeeScheduleManagement;
