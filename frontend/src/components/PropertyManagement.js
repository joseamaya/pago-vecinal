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
  IconButton,
  Box,
  Alert,
  Pagination,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { propertiesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';

const PropertyManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formData, setFormData] = useState({
    row_letter: '',
    number: '',
    villa: '',
    owner_name: '',
    owner_phone: '',
  });

  useEffect(() => {
    fetchProperties(1);
  }, []);

  const fetchProperties = async (page = 1) => {
    try {
      setLoading(true);
      const response = await propertiesAPI.getProperties(page, 20);
      setProperties(response.data.data);
      setTotalPages(response.data.pagination.total_pages);
      setCurrentPage(page);
      setError('');
    } catch (err) {
      setError('Error al cargar propiedades');
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, page) => {
    fetchProperties(page);
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
    setSaving(true);
    try {
      const submitData = {
        ...formData,
        number: parseInt(formData.number),
      };

      if (editingProperty) {
        await propertiesAPI.updateProperty(editingProperty.id, submitData);
        toast.success('Propiedad actualizada correctamente');
      } else {
        await propertiesAPI.createProperty(submitData);
        toast.success('Propiedad creada correctamente');
      }
      fetchProperties(currentPage);
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(editingProperty ? 'Error al actualizar propiedad' : 'Error al crear propiedad');
      }
      console.error('Error saving property:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (property) => {
    const confirmed = await confirm({
      title: 'Eliminar propiedad',
      message: `¿Estás seguro de que quieres eliminar ${property.villa} ${property.row_letter}${property.number}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await propertiesAPI.deleteProperty(property.id);
      toast.success('Propiedad eliminada correctamente');
      fetchProperties(currentPage);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar propiedad');
      }
      console.error('Error deleting property:', err);
    }
  };

  const handleBulkImport = async () => {
    if (!selectedFile) {
      setError('Por favor selecciona un archivo Excel');
      return;
    }

    setImporting(true);
    try {
      const response = await propertiesAPI.bulkImportProperties(selectedFile);
      const { imported, updated, errors } = response.data;
      toast.success(
        `Importación completada. Importadas: ${imported}. Actualizadas: ${updated}. Errores: ${errors.length}.`
      );
      if (errors.length > 0) {
        console.error('Errores de importación:', errors);
      }
      fetchProperties(1); // Go back to first page after bulk import
      setBulkImportOpen(false);
      setSelectedFile(null);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al importar propiedades');
      }
      console.error('Error bulk importing properties:', err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageContainer>
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
                  <TableCell colSpan={6}>
                    <EmptyState
                      title="No hay propiedades registradas"
                      description="Agrega una propiedad o importa un archivo Excel."
                    />
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
                        aria-label={`Editar ${property.villa} ${property.row_letter}${property.number}`}
                        onClick={() => handleOpenDialog(property)}
                      >
                        <EditIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton
                          color="error"
                          aria-label={`Eliminar ${property.villa} ${property.row_letter}${property.number}`}
                          onClick={() => handleDelete(property)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Dialog for Add/Edit Property */}
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingProperty ? 'Editar Propiedad' : 'Nueva Propiedad'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus={!isMobile}
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
            <Button onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Guardando...' : editingProperty ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Importar Propiedades desde Excel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            El archivo Excel debe tener las columnas: villa, row_letter, number, owner_name, owner_phone (opcional).
            La primera fila es el encabezado y se ignorará.
          </Typography>
          <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
            Seleccionar archivo
            <input
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />
          </Button>
          {selectedFile && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Archivo seleccionado: {selectedFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkImportOpen(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={handleBulkImport}
            variant="contained"
            disabled={!selectedFile || importing}
          >
            {importing ? 'Importando...' : 'Importar'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default PropertyManagement;
