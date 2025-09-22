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
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { treasurersAPI } from '../services/api';

const TreasurerConfiguration = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    signature: '',
  });

  useEffect(() => {
    if (isAdmin) {
      fetchTreasurer();
    }
  }, [isAdmin]);

  const fetchTreasurer = async () => {
    try {
      setLoading(true);
      const response = await treasurersAPI.getTreasurer();
      setFormData({
        name: response.data.name || '',
        signature: response.data.signature || '',
      });
    } catch (err) {
      // If no treasurer configured yet, that's fine - form will be empty
      if (err.response?.status !== 404) {
        setError('Error al cargar la configuración del tesorero');
        console.error('Error fetching treasurer:', err);
      }
    } finally {
      setLoading(false);
    }
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
      await treasurersAPI.updateTreasurer(formData);
      setSuccess('Configuración del tesorero guardada exitosamente');
    } catch (err) {
      setError('Error al guardar la configuración del tesorero');
      console.error('Error saving treasurer:', err);
    } finally {
      setSaving(false);
    }
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
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Configuración del Tesorero
        </Typography>
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

      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Configure los datos del tesorero que aparecerán en los recibos de pago.
        </Typography>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre del Tesorero"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                disabled={loading || saving}
                helperText="Nombre completo del tesorero"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Firma del Tesorero"
                value={formData.signature}
                onChange={(e) => handleInputChange('signature', e.target.value)}
                disabled={loading || saving}
                helperText="Texto que representa la firma (opcional)"
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || saving}
              sx={{ minWidth: 120 }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default TreasurerConfiguration;