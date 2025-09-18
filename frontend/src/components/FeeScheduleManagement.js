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
  Chip,
  IconButton,
  Box,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { feeSchedulesAPI } from '../services/api';

const FeeScheduleManagement = () => {
  const { isAdmin } = useAuth();
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    effective_date: '',
    end_date: '',
    generation_day: '',
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
        generation_day: schedule.generation_day.toString(),
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        amount: '',
        description: '',
        effective_date: '',
        end_date: '',
        generation_day: '1',
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
      generation_day: '1',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        generation_day: parseInt(formData.generation_day),
        effective_date: new Date(formData.effective_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      if (editingSchedule) {
        await feeSchedulesAPI.updateFeeSchedule(editingSchedule.id, submitData);
      } else {
        await feeSchedulesAPI.createFeeSchedule(submitData);
      }
      fetchFeeSchedules();
      handleCloseDialog();
    } catch (err) {
      setError(editingSchedule ? 'Error al actualizar plan de cuotas' : 'Error al crear plan de cuotas');
      console.error('Error saving fee schedule:', err);
    }
  };

  const handleDelete = async (scheduleId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este plan de cuotas?')) {
      try {
        await feeSchedulesAPI.deleteFeeSchedule(scheduleId);
        fetchFeeSchedules();
      } catch (err) {
        setError('Error al eliminar plan de cuotas');
        console.error('Error deleting fee schedule:', err);
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
                <TableCell>Día de Generación</TableCell>
                <TableCell>Estado</TableCell>
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
              ) : feeSchedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No hay planes de cuotas registrados
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
                    <TableCell>{schedule.generation_day}</TableCell>
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
                            onClick={() => handleOpenDialog(schedule)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(schedule.id)}
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
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSchedule ? 'Editar Plan de Cuotas' : 'Nuevo Plan de Cuotas'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
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
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              margin="dense"
              label="Fecha de Fin (opcional)"
              type="date"
              fullWidth
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              margin="dense"
              label="Día de Generación (1-31)"
              type="number"
              fullWidth
              required
              value={formData.generation_day}
              onChange={(e) => setFormData({ ...formData, generation_day: e.target.value })}
              inputProps={{ min: 1, max: 31 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingSchedule ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default FeeScheduleManagement;