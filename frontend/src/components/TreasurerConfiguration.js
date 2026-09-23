import React, { useState, useEffect } from 'react';
import {
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
import { treasurersAPI, propertiesAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';

const TreasurerConfiguration = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [treasurers, setTreasurers] = useState([]);
  const [villas, setVillas] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreasurer, setEditingTreasurer] = useState(null);
  const [formData, setFormData] = useState({
    villa: '',
    name: '',
    signature: '',
  });
  const [signatureFile, setSignatureFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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
    setSignatureFile(null);
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

    try {
      let signaturePath = formData.signature;

      // Upload signature file if selected
      if (signatureFile) {
        setUploading(true);
        const uploadResponse = await treasurersAPI.uploadSignature(signatureFile);
        signaturePath = uploadResponse.data.file_path;
        setUploading(false);
      }

      const treasurerData = {
        ...formData,
        signature: signaturePath,
      };

      if (editingTreasurer) {
        await treasurersAPI.updateTreasurer(editingTreasurer.villa, treasurerData);
        toast.success('Tesorero actualizado exitosamente');
      } else {
        await treasurersAPI.createTreasurer(treasurerData);
        toast.success('Tesorero creado exitosamente');
      }
      fetchTreasurers();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al guardar el tesorero');
      }
      console.error('Error saving treasurer:', err);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async (villa) => {
    const confirmed = await confirm({
      title: 'Eliminar tesorero',
      message: `¿Estás seguro de que quieres eliminar el tesorero de la villa ${villa}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await treasurersAPI.deleteTreasurer(villa);
      toast.success('Tesorero eliminado exitosamente');
      fetchTreasurers();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar el tesorero');
      }
      console.error('Error deleting treasurer:', err);
    }
  };

  const getAvailableVillas = () => {
    const configuredVillas = treasurers.map(t => t.villa);
    return villas.filter(villa => !configuredVillas.includes(villa) || (editingTreasurer && editingTreasurer.villa === villa));
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <Alert severity="error">
          No tienes permisos para acceder a esta página.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
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
                <LoadingSkeleton type="table" rows={5} columns={4} />
              ) : treasurers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      title="No hay tesoreros configurados"
                      description="Configura un tesorero por villa para las firmas de recibos."
                    />
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
                        aria-label={`Editar tesorero de ${treasurer.villa}`}
                        onClick={() => handleOpenDialog(treasurer)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        aria-label={`Eliminar tesorero de ${treasurer.villa}`}
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
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
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
                <Box display="flex" alignItems="center" gap={2}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadIcon />}
                    disabled={saving || uploading}
                  >
                    Subir Firma
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => setSignatureFile(e.target.files[0])}
                    />
                  </Button>
                  {signatureFile && (
                    <Typography variant="body2">
                      {signatureFile.name}
                    </Typography>
                  )}
                  {formData.signature && !signatureFile && (
                    <Typography variant="body2" color="textSecondary">
                      Firma actual: {formData.signature.split('/').pop()}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="textSecondary">
                  Selecciona una imagen para la firma del tesorero (opcional)
                </Typography>
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
    </PageContainer>
  );
};

export default TreasurerConfiguration;
