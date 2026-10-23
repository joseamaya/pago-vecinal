import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  Pagination,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { propertiesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import EmptyState from './common/EmptyState';
import { formatPropertyLabel } from '../utils/formatters';

const EMPTY_PROPERTY = { row_letter: '', number: '', villa: '', owner_name: '', owner_phone: '' };

const PropertyManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formData, setFormData] = useState(EMPTY_PROPERTY);

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
      setError('No pudimos cargar las propiedades.');
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (property = null) => {
    setFormError('');
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
      setFormData(EMPTY_PROPERTY);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingProperty(null);
    setFormError('');
    setFormData(EMPTY_PROPERTY);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const submitData = { ...formData, number: parseInt(formData.number, 10) };
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
        setFormError(err.response?.data?.detail || 'No pudimos guardar la propiedad.');
      }
      console.error('Error saving property:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (property) => {
    const confirmed = await confirm({
      title: 'Eliminar propiedad',
      message: `¿Seguro que quieres eliminar ${formatPropertyLabel(property)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await propertiesAPI.deleteProperty(property.id);
      toast.success('Propiedad eliminada correctamente');
      fetchProperties(currentPage);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar la propiedad');
      }
      console.error('Error deleting property:', err);
    }
  };

  const handleBulkImport = async (event) => {
    event?.preventDefault?.();
    if (!selectedFile) return;

    setImporting(true);
    try {
      const response = await propertiesAPI.bulkImportProperties(selectedFile);
      const { imported, updated, errors } = response.data;
      toast.success(`Importación completa: ${imported} creadas, ${updated} actualizadas, ${errors.length} errores.`);
      if (errors.length > 0) console.error('Errores de importación:', errors);
      fetchProperties(1);
      setBulkImportOpen(false);
      setSelectedFile(null);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos importar las propiedades');
      }
      console.error('Error bulk importing properties:', err);
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    { key: 'villa', label: 'Villa', mobile: false },
    { key: 'row_letter', label: 'Fila' },
    { key: 'number', label: 'Número' },
    { key: 'owner_name', label: 'Propietario' },
    { key: 'owner_phone', label: 'Teléfono', render: (property) => property.owner_phone || '—' },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Administración"
        title="Propiedades"
        subtitle="Registra las viviendas y a sus propietarios."
        actions={
          isAdmin && (
            <>
              <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => setBulkImportOpen(true)}>
                Importar Excel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nueva propiedad
              </Button>
            </>
          )
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => fetchProperties(currentPage)}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <ResponsiveTable
        columns={columns}
        rows={properties}
        loading={loading}
        getRowId={(property) => property.id}
        mobileTitle={(property) => formatPropertyLabel(property)}
        mobileSubtitle={(property) => property.owner_name}
        emptyState={
          <EmptyState
            title="No hay propiedades registradas"
            description="Agrega una propiedad o importa un archivo Excel."
            action={
              isAdmin && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                  Nueva propiedad
                </Button>
              )
            }
          />
        }
        renderActions={
          isAdmin
            ? (property) => (
                <ActionMenu
                  ariaLabel={`Acciones para ${formatPropertyLabel(property)}`}
                  items={[
                    { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(property) },
                    {
                      label: 'Eliminar',
                      icon: <DeleteIcon fontSize="small" />,
                      color: 'error',
                      onClick: () => handleDelete(property),
                    },
                  ]}
                />
              )
            : undefined
        }
        footer={
          totalPages > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(event, page) => fetchProperties(page)}
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
        title={editingProperty ? 'Editar propiedad' : 'Nueva propiedad'}
        subtitle={editingProperty ? formatPropertyLabel(editingProperty) : 'Registra la vivienda y los datos de contacto.'}
        submitLabel={editingProperty ? 'Guardar cambios' : 'Crear propiedad'}
        saving={saving}
        error={formError}
        maxWidth="sm"
      >
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              autoFocus
              label="Villa"
              fullWidth
              required
              value={formData.villa}
              onChange={(event) => setFormData({ ...formData, villa: event.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Fila"
              fullWidth
              required
              value={formData.row_letter}
              onChange={(event) => setFormData({ ...formData, row_letter: event.target.value.toUpperCase() })}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Número"
              type="number"
              fullWidth
              required
              value={formData.number}
              onChange={(event) => setFormData({ ...formData, number: event.target.value })}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Nombre del propietario"
              fullWidth
              required
              value={formData.owner_name}
              onChange={(event) => setFormData({ ...formData, owner_name: event.target.value })}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Teléfono del propietario"
              fullWidth
              value={formData.owner_phone}
              onChange={(event) => setFormData({ ...formData, owner_phone: event.target.value })}
            />
          </Grid>
        </Grid>
      </FormDialog>

      <FormDialog
        open={bulkImportOpen}
        onClose={() => {
          setBulkImportOpen(false);
          setSelectedFile(null);
        }}
        onSubmit={handleBulkImport}
        title="Importar propiedades desde Excel"
        subtitle="La primera fila se toma como encabezado."
        submitLabel="Importar"
        savingLabel="Importando…"
        saving={importing}
        submitDisabled={!selectedFile}
        maxWidth="sm"
      >
        <Box sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            Columnas requeridas: <strong>villa, row_letter, number, owner_name</strong>. La columna{' '}
            <strong>owner_phone</strong> es opcional.
          </Typography>
          <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
            Seleccionar archivo
            <input
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={(event) => setSelectedFile(event.target.files[0])}
            />
          </Button>
          {selectedFile && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Archivo seleccionado: <strong>{selectedFile.name}</strong>
            </Typography>
          )}
        </Box>
      </FormDialog>
    </PageContainer>
  );
};

export default PropertyManagement;
