import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Box,
  Alert,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { treasurersAPI, propertiesAPI } from '../services/api';

const TreasurerConfiguration = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [treasurers, setTreasurers] = useState([]);
  const [villas, setVillas] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreasurer, setEditingTreasurer] = useState(null);
  const [formData, setFormData] = useState({
    villa: '',
    name: '',
    signature: '',
  });

  useEffect(() => {
    if (isAdmin) {
      fetchTreasurers();
      fetchVillas();
    }
  }, [isAdmin]);

  const fetchTreasurers = async () => {
    try {
      setLoading(true);
      const response = await treasurersAPI.getTreasurers();
      setTreasurers(response.data);
    } catch (err) {
      setError('Error al cargar los tesoreros');
      console.error('Error fetching treasurers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVillas = async () => {
    try {
      const response = await propertiesAPI.getProperties();
      const uniqueVillas = [...new Set(response.data.map(p => p.villa))].sort();
      setVillas(uniqueVillas);
    } catch (err) {
      console.error('Error fetching villas:', err);
    }
  };

  const handleOpenDialog = (treasurer = null) => {
    if (treasurer) {
      setEditingTreasurer(treasurer);
      setFormData({
        villa: treasurer.villa,
        name: treasurer.name,
        signature: treasurer.signature || '',
      });
    } else {
      setEditingTreasurer(null);
      setFormData({
        villa: '',
        name: '',
        signature: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTreasurer(null);
    setFormData({
      villa: '',
      name: '',
      signature: '',
    });
  };

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingTreasurer) {
        await treasurersAPI.updateTreasurer(editingTreasurer.villa, formData);
        setSuccess('Tesorero actualizado exitosamente');
      } else {
        await treasurersAPI.createTreasurer(formData);
        setSuccess('Tesorero creado exitosamente');
      }
      fetchTreasurers();
      handleCloseDialog();
    } catch (err) {
      setError('Error al guardar el tesorero');
      console.error('Error saving treasurer:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (villa) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el tesorero de la villa ${villa}?`)) {
      try {
        await treasurersAPI.deleteTreasurer(villa);
        setSuccess('Tesorero eliminado exitosamente');
        fetchTreasurers();
      } catch (err) {
        setError('Error al eliminar el tesorero');
        console.error('Error deleting treasurer:', err);
      }
    }
  };

  const getAvailableVillas = () => {
    const configuredVillas = treasurers.map(t => t.villa);
    return villas.filter(villa => !configuredVillas.includes(villa) || (editingTreasurer && editingTreasurer.villa === villa));
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          No tienes permisos para acceder a esta página.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Configuración de Tesoreros por Villa
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Tesorero
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Villa</TableCell>
                <TableCell>Nombre del Tesorero</TableCell>
                <TableCell>Firma</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : treasurers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No hay tesoreros configurados
                  </TableCell>
                </TableRow>
              ) : (
                treasurers.map((treasurer) => (
                  <TableRow key={treasurer.id}>
                    <TableCell>{treasurer.villa}</TableCell>
                    <TableCell>{treasurer.name}</TableCell>
                    <TableCell>{treasurer.signature || '-'}</TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(treasurer)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(treasurer.villa)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog for Add/Edit Treasurer */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTreasurer ? 'Editar Tesorero' : 'Nuevo Tesorero'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Villa"
                  value={formData.villa}
                  onChange={(e) => handleInputChange('villa', e.target.value)}
                  required
                  disabled={saving}
                  helperText="Selecciona la villa para este tesorero"
                >
                  {getAvailableVillas().map((villa) => (
                    <MenuItem key={villa} value={villa}>
                      {villa}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre del Tesorero"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  disabled={saving}
                  helperText="Nombre completo del tesorero"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Firma del Tesorero"
                  value={formData.signature}
                  onChange={(e) => handleInputChange('signature', e.target.value)}
                  disabled={saving}
                  helperText="Texto que representa la firma (opcional)"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando...' : (editingTreasurer ? 'Actualizar' : 'Crear')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default TreasurerConfiguration;