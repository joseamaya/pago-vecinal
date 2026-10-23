import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
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
import { treasurersAPI, propertiesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import StatusChip from './common/StatusChip';
import EmptyState from './common/EmptyState';

const EMPTY_TREASURER = { villa: '', name: '', signature: '' };

const TreasurerConfiguration = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [treasurers, setTreasurers] = useState([]);
  const [villas, setVillas] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreasurer, setEditingTreasurer] = useState(null);
  const [formData, setFormData] = useState(EMPTY_TREASURER);
  const [signatureFile, setSignatureFile] = useState(null);

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
      setError('');
    } catch (err) {
      setError('No pudimos cargar los tesoreros.');
      console.error('Error fetching treasurers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVillas = async () => {
    try {
      const response = await propertiesAPI.getProperties(1, 10000);
      const uniqueVillas = [...new Set(response.data.data.map((property) => property.villa))].sort();
      setVillas(uniqueVillas);
    } catch (err) {
      console.error('Error fetching villas:', err);
    }
  };

  const handleOpenDialog = (treasurer = null) => {
    setFormError('');
    if (treasurer) {
      setEditingTreasurer(treasurer);
      setFormData({
        villa: treasurer.villa,
        name: treasurer.name,
        signature: treasurer.signature || '',
      });
    } else {
      setEditingTreasurer(null);
      setFormData(EMPTY_TREASURER);
    }
    setSignatureFile(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTreasurer(null);
    setFormError('');
    setFormData(EMPTY_TREASURER);
    setSignatureFile(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      let signaturePath = formData.signature;
      if (signatureFile) {
        setUploading(true);
        const uploadResponse = await treasurersAPI.uploadSignature(signatureFile);
        signaturePath = uploadResponse.data.file_path;
        setUploading(false);
      }

      const treasurerData = { ...formData, signature: signaturePath };
      if (editingTreasurer) {
        await treasurersAPI.updateTreasurer(editingTreasurer.villa, treasurerData);
        toast.success('Tesorero actualizado correctamente');
      } else {
        await treasurersAPI.createTreasurer(treasurerData);
        toast.success('Tesorero creado correctamente');
      }
      fetchTreasurers();
      handleCloseDialog();
    } catch (err) {
      setUploading(false);
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el tesorero.');
      }
      console.error('Error saving treasurer:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (villa) => {
    const confirmed = await confirm({
      title: 'Eliminar tesorero',
      message: `¿Seguro que quieres eliminar el tesorero de la villa ${villa}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await treasurersAPI.deleteTreasurer(villa);
      toast.success('Tesorero eliminado correctamente');
      fetchTreasurers();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar el tesorero');
      }
      console.error('Error deleting treasurer:', err);
    }
  };

  const getAvailableVillas = () =>
    villas.filter(
      (villa) =>
        !treasurers.some((treasurer) => treasurer.villa === villa) ||
        editingTreasurer?.villa === villa
    );

  if (!isAdmin) {
    return (
      <PageContainer>
        <Alert severity="error">No tienes permisos para acceder a esta página.</Alert>
      </PageContainer>
    );
  }

  const columns = [
    { key: 'villa', label: 'Villa' },
    { key: 'name', label: 'Tesorero' },
    {
      key: 'signature',
      label: 'Firma',
      render: (treasurer) =>
        treasurer.signature ? (
          <StatusChip label="Firma cargada" tone="success" status="active" />
        ) : (
          <StatusChip label="Sin firma" tone="default" status="inactive" />
        ),
    },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Administración"
        title="Tesoreros por villa"
        subtitle="Configura quién firma los recibos de cada villa."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Nuevo tesorero
          </Button>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={fetchTreasurers}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <ResponsiveTable
        columns={columns}
        rows={treasurers}
        loading={loading}
        getRowId={(treasurer) => treasurer.id}
        mobileTitle={(treasurer) => treasurer.name}
        mobileSubtitle={(treasurer) => `Villa ${treasurer.villa}`}
        emptyState={
          <EmptyState
            title="No hay tesoreros configurados"
            description="Configura un tesorero por villa para las firmas de recibos."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo tesorero
              </Button>
            }
          />
        }
        renderActions={(treasurer) => (
          <ActionMenu
            ariaLabel={`Acciones para el tesorero de ${treasurer.villa}`}
            items={[
              { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(treasurer) },
              {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => handleDelete(treasurer.villa),
              },
            ]}
          />
        )}
      />

      <FormDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingTreasurer ? 'Editar tesorero' : 'Nuevo tesorero'}
        subtitle="La firma se usará en los recibos generados para esta villa."
        submitLabel={editingTreasurer ? 'Guardar cambios' : 'Crear tesorero'}
        saving={saving || uploading}
        error={formError}
        maxWidth="sm"
      >
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={12}>
            <TextField
              select
              fullWidth
              label="Villa"
              value={formData.villa}
              onChange={(event) => setFormData({ ...formData, villa: event.target.value })}
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
          <Grid size={12}>
            <TextField
              fullWidth
              label="Nombre del tesorero"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              required
              disabled={saving}
            />
          </Grid>
          <Grid size={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                disabled={saving || uploading}
              >
                Subir firma
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg"
                  onChange={(event) => setSignatureFile(event.target.files[0])}
                />
              </Button>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {signatureFile
                  ? signatureFile.name
                  : formData.signature
                  ? `Firma actual: ${formData.signature.split('/').pop()}`
                  : 'Sin firma cargada'}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Formato PNG o JPG, máximo 2 MB.
            </Typography>
          </Grid>
        </Grid>
      </FormDialog>
    </PageContainer>
  );
};

export default TreasurerConfiguration;
