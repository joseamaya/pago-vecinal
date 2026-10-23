import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete,
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
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { propertiesAPI, ownersAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import EmptyState from './common/EmptyState';
import DataToolbar from './common/DataToolbar';
import TablePagination from './common/TablePagination';
import ErrorState from './common/ErrorState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useTableState } from '../hooks/useTableState';
import { useFormValidation } from '../hooks/useFormValidation';
import { integer, required } from '../utils/validators';
import { formatPropertyLabel } from '../utils/formatters';

const EMPTY_PROPERTY = {
  row_letter: '',
  number: '',
  villa: '',
  owner_ids: [],
  primary_owner_id: '',
};

const PROPERTY_SCHEMA = {
  villa: required('Ingresa la villa.'),
  row_letter: required('Ingresa la fila.'),
  number: [required('Ingresa el número.'), integer('Ingresa un número entero.')],
};

const PropertyManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PROPERTY);
  const [owners, setOwners] = useState([]);
  const { errors, validateField, validateAll, clearError, setErrors } = useFormValidation(
    formData,
    PROPERTY_SCHEMA
  );

  const handleFieldChange = (field) => (event) => {
    setFormData((previous) => ({ ...previous, [field]: event.target.value }));
    clearError(field);
  };

  const handleFieldBlur = (field) => () => validateField(field);

  const table = useTableState({ defaultSortBy: 'villa', defaultSortDir: 'asc' });
  const { page: tablePage, setPage } = table;

  const loader = useCallback(
    () =>
      propertiesAPI
        .getProperties(table.page, table.limit, {
          search: table.search || undefined,
          sort_by: table.sortBy || undefined,
          sort_dir: table.sortDir || undefined,
        })
        .then((response) => response.data),
    [table.page, table.limit, table.search, table.sortBy, table.sortDir]
  );

  const { data, loading, refreshing, error, reload } = useAsyncData(
    loader,
    [loader],
    { fallbackError: 'No pudimos cargar las propiedades.' }
  );

  const properties = data?.data || [];
  const pagination = data?.pagination || { total_pages: 1, total_count: 0 };
  const totalPages = Math.max(pagination.total_pages || 1, 1);
  const currentPage = Math.min(table.page, totalPages);

  useEffect(() => {
    if (data && tablePage > totalPages) setPage(totalPages);
  }, [data, tablePage, totalPages, setPage]);

  const refreshFromFirstPage = useCallback(async () => {
    if (tablePage !== 1) {
      setPage(1);
      return;
    }
    await reload();
  }, [tablePage, setPage, reload]);

  const loadOwners = async () => {
    try {
      const response = await ownersAPI.getOwners();
      setOwners(
        (response.data || []).filter((owner) => owner.is_active !== false)
      );
    } catch (err) {
      console.error('Error fetching owners:', err);
    }
  };

  const selectedOwners = owners.filter((owner) =>
    formData.owner_ids.includes(owner.id)
  );

  const handleOpenDialog = (property = null) => {
    setFormError('');
    setErrors({});
    loadOwners();
    if (property) {
      setEditingProperty(property);
      setFormData({
        row_letter: property.row_letter,
        number: property.number.toString(),
        villa: property.villa,
        owner_ids: (property.owners || []).map((owner) => owner.id),
        primary_owner_id: property.primary_owner_id || '',
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
    setErrors({});
    setFormData(EMPTY_PROPERTY);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validateAll()) return;
    setSaving(true);
    try {
      const submitData = {
        row_letter: formData.row_letter,
        number: parseInt(formData.number, 10),
        villa: formData.villa,
        owner_ids: formData.owner_ids,
        primary_owner_id: formData.primary_owner_id || null,
      };
      if (editingProperty) {
        await propertiesAPI.updateProperty(editingProperty.id, submitData);
        toast.success('Propiedad actualizada correctamente');
      } else {
        await propertiesAPI.createProperty(submitData);
        toast.success('Propiedad creada correctamente');
      }
      await refreshFromFirstPage();
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
      await refreshFromFirstPage();
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
      await refreshFromFirstPage();
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

      <ErrorState message={error} onRetry={reload} />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por villa, fila, número o propietario…"
        resultCount={properties.length}
        totalCount={pagination.total_count}
      >
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Ordenar por</InputLabel>
          <Select
            value={table.sortBy}
            label="Ordenar por"
            onChange={(event) =>
              table.setSort(event.target.value, table.sortDir || 'asc')
            }
          >
            <MenuItem value="villa">Villa</MenuItem>
            <MenuItem value="row_letter">Fila</MenuItem>
            <MenuItem value="number">Número</MenuItem>
            <MenuItem value="owner_name">Propietario</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Dirección</InputLabel>
          <Select
            value={table.sortDir || 'asc'}
            label="Dirección"
            onChange={(event) => table.setSort(table.sortBy || 'villa', event.target.value)}
          >
            <MenuItem value="asc">Ascendente</MenuItem>
            <MenuItem value="desc">Descendente</MenuItem>
          </Select>
        </FormControl>
      </DataToolbar>

      <ResponsiveTable
        columns={columns}
        rows={properties}
        loading={loading || refreshing}
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
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={pagination.total_count}
            pageSize={table.limit}
            onPageChange={table.setPage}
            onPageSizeChange={table.setLimit}
            disabled={loading || refreshing}
          />
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
              name="villa"
              label="Villa"
              fullWidth
              required
              value={formData.villa}
              onChange={handleFieldChange('villa')}
              onBlur={handleFieldBlur('villa')}
              error={Boolean(errors.villa)}
              helperText={errors.villa}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              name="row_letter"
              label="Fila"
              fullWidth
              required
              value={formData.row_letter}
              onChange={(event) => {
                setFormData((previous) => ({
                  ...previous,
                  row_letter: event.target.value.toUpperCase(),
                }));
                clearError('row_letter');
              }}
              onBlur={handleFieldBlur('row_letter')}
              error={Boolean(errors.row_letter)}
              helperText={errors.row_letter}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              name="number"
              label="Número"
              type="number"
              fullWidth
              required
              value={formData.number}
              onChange={handleFieldChange('number')}
              onBlur={handleFieldBlur('number')}
              error={Boolean(errors.number)}
              helperText={errors.number}
            />
          </Grid>
          <Grid size={12}>
            <Autocomplete
              multiple
              options={owners}
              value={selectedOwners}
              getOptionLabel={(owner) =>
                owner.phone ? `${owner.full_name} · ${owner.phone}` : owner.full_name
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(event, newOwners) => {
                const ownerIds = newOwners.map((owner) => owner.id);
                setFormData((previous) => ({
                  ...previous,
                  owner_ids: ownerIds,
                  primary_owner_id: ownerIds.includes(previous.primary_owner_id)
                    ? previous.primary_owner_id
                    : ownerIds[0] || '',
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Propietarios"
                  placeholder="Buscar propietario…"
                />
              )}
            />
          </Grid>
          <Grid size={12}>
            <FormControl fullWidth disabled={selectedOwners.length === 0}>
              <InputLabel id="property-primary-owner-label">Propietario principal</InputLabel>
              <Select
                labelId="property-primary-owner-label"
                value={formData.primary_owner_id || ''}
                label="Propietario principal"
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    primary_owner_id: event.target.value,
                  }))
                }
              >
                {selectedOwners.length === 0 && (
                  <MenuItem value="">
                    <em>Sin propietario</em>
                  </MenuItem>
                )}
                {selectedOwners.map((owner) => (
                  <MenuItem key={owner.id} value={owner.id}>
                    {owner.full_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
