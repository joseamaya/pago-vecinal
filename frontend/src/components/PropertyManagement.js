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
  IconButton,
  Box,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { propertiesAPI } from '../services/api';
import LoadingSkeleton from './common/LoadingSkeleton';

const PropertyManagement = () => {
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [formData, setFormData] = useState({
    row_letter: '',
    number: '',
    villa: '',
    owner_name: '',
    owner_phone: '',
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await propertiesAPI.getProperties();
      setProperties(response.data);
      setError('');
    } catch (err) {
      setError('Error al cargar propiedades');
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleOpenDialog = (property = null) => {
    if (property) {
      setEditingProperty(property);
      setFormData({
        row_letter: property.row_letter,
        number: property.number.toString(),
        villa: property.villa,
        owner_name: property.owner_name,
        owner_phone: property.owner_phone || '',
      });
    } else {
      setEditingProperty(null);
      setFormData({
        row_letter: '',
        number: '',
        villa: '',
        owner_name: '',
        owner_phone: '',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingProperty(null);
    setFormData({
      row_letter: '',
      number: '',
      villa: '',
      owner_name: '',
      owner_phone: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        number: parseInt(formData.number),
      };

      if (editingProperty) {
        await propertiesAPI.updateProperty(editingProperty.id, submitData);
      } else {
        await propertiesAPI.createProperty(submitData);
      }
      fetchProperties();
      handleCloseDialog();
    } catch (err) {
      setError(editingProperty ? 'Error al actualizar propiedad' : 'Error al crear propiedad');
      console.error('Error saving property:', err);
    }
  };

  const handleDelete = async (propertyId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta propiedad?')) {
      try {
        await propertiesAPI.deleteProperty(propertyId);
        fetchProperties();
      } catch (err) {
        setError('Error al eliminar propiedad');
        console.error('Error deleting property:', err);
      }
    }
  };

  const handleBulkImport = async () => {
    if (!selectedFile) {
      setError('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      const response = await propertiesAPI.bulkImportProperties(selectedFile);
      const { imported, errors } = response.data;
      alert(`Importación completada. Propiedades importadas: ${imported}. Errores: ${errors.length}`);
      if (errors.length > 0) {
        console.error('Errores de importación:', errors);
      }
      fetchProperties();
      setBulkImportOpen(false);
      setSelectedFile(null);
    } catch (err) {
      setError('Error al importar propiedades');
      console.error('Error bulk importing properties:', err);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Propiedades
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={() => setBulkImportOpen(true)}
            sx={{ mr: 1 }}
          >
            Importar Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nueva Propiedad
          </Button>
        </Box>
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
                <TableCell>Villa</TableCell>
                <TableCell>Fila</TableCell>
                <TableCell>Número</TableCell>
                <TableCell>Propietario</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingSkeleton type="table" rows={5} columns={6} />
              ) : properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No hay propiedades registradas
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>{property.villa}</TableCell>
                    <TableCell>{property.row_letter}</TableCell>
                    <TableCell>{property.number}</TableCell>
                    <TableCell>{property.owner_name}</TableCell>
                    <TableCell>{property.owner_phone || '-'}</TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(property)}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(property.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog for Add/Edit Property */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingProperty ? 'Editar Propiedad' : 'Nueva Propiedad'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Villa"
              fullWidth
              required
              value={formData.villa}
              onChange={(e) => setFormData({ ...formData, villa: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Fila (Letra)"
              fullWidth
              required
              value={formData.row_letter}
              onChange={(e) => setFormData({ ...formData, row_letter: e.target.value.toUpperCase() })}
            />
            <TextField
              margin="dense"
              label="Número"
              type="number"
              fullWidth
              required
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Nombre del Propietario"
              fullWidth
              required
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Teléfono del Propietario"
              fullWidth
              value={formData.owner_phone}
              onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingProperty ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar Propiedades desde Excel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            El archivo Excel debe tener las columnas: villa, row_letter, number, owner_name, owner_phone (opcional).
            La primera fila es el encabezado y se ignorará.
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            style={{ marginBottom: 16 }}
          />
          {selectedFile && (
            <Typography variant="body2">
              Archivo seleccionado: {selectedFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkImportOpen(false)}>Cancelar</Button>
          <Button onClick={handleBulkImport} variant="contained" disabled={!selectedFile}>
            Importar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PropertyManagement;