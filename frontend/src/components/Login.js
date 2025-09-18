import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Tab,
  Tabs,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'owner',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError('');
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (tabValue === 0) {
        // Login
        result = await login(formData.email, formData.password);
      } else {
        // Register
        result = await register(formData);
      }

      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Pago Vecinal
          </Typography>
          <Typography variant="h6" align="center" color="textSecondary" gutterBottom>
            Sistema de Gestión de Cuotas de Condominio
          </Typography>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBottom: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="auth tabs">
              <Tab label="Iniciar Sesión" />
              <Tab label="Registrarse" />
            </Tabs>
          </Box>

          {error && (
            <Alert severity="error" sx={{ marginBottom: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Correo Electrónico"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleInputChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Contraseña"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
            />

            {tabValue === 1 && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="fullName"
                  label="Nombre Completo"
                  id="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
                <TextField
                  margin="normal"
                  fullWidth
                  name="phone"
                  label="Teléfono"
                  id="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Cargando...' : (tabValue === 0 ? 'Iniciar Sesión' : 'Registrarse')}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;