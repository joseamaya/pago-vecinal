import React, { useEffect, useState } from 'react';
import { Box, Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FormDialog from '../common/FormDialog';
import { paymentsAPI } from '../../services/api';
import { isNetworkError } from '../../services/notifications';
import { useToast } from '../../contexts/ToastContext';

const BulkUploadDialog = ({ open, onClose, onUploaded }) => {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResults(null);
      setUploading(false);
    }
  }, [open]);

  const handleFileChange = (event) => {
    setFile(event.target.files[0] || null);
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!file) {
      toast.error('Por favor selecciona un archivo Excel');
      return;
    }

    try {
      setUploading(true);
      const response = await paymentsAPI.bulkImportPayments(file);
      setResults(response.data);
      await onUploaded?.();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al subir archivo masivo');
      }
      console.error('Error bulk uploading payments:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleUpload}
      title="Importar pagos desde Excel"
      subtitle="El archivo debe incluir Villa, Fila, Número, Año, Mes, Monto, Fecha de pago y Notas."
      submitLabel="Subir archivo"
      savingLabel="Subiendo…"
      saving={uploading}
      submitDisabled={!file}
      maxWidth="md"
    >
      <Box sx={{ pt: 1 }}>
        <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
          Seleccionar archivo
          <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
        </Button>

        {file && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            Archivo seleccionado: <strong>{file.name}</strong>
          </Typography>
        )}

        {results && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Exitosos
                </Typography>
                <Typography variant="h5" sx={{ color: 'success.main' }}>
                  {results.successful_imports}
                </Typography>
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Fallidos
                </Typography>
                <Typography variant="h5" sx={{ color: 'error.main' }}>
                  {results.failed_imports}
                </Typography>
              </Box>
            </Box>
            {results.errors?.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Errores
                </Typography>
                <List
                  dense
                  sx={{
                    maxHeight: 220,
                    overflow: 'auto',
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    py: 0.5,
                  }}
                >
                  {results.errors.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`Fila ${item.row}: ${item.error}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        )}
      </Box>
    </FormDialog>
  );
};

export default BulkUploadDialog;
