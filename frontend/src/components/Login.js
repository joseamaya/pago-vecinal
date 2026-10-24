import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutlined as CheckIcon,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  VisibilityOffOutlined as VisibilityOffIcon,
  VisibilityOutlined as VisibilityIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const FEATURES = [
  'Cuotas y pagos siempre al día',
  'Recibos disponibles al instante',
  'Reportes claros para toda la comunidad',
];

const initialState = {
  email: '',
  password: '',
};

const Login = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await login(formData.email.trim(), formData.password);

      if (!result.success) {
        setError(result.error || 'No pudimos iniciar sesión. Inténtalo nuevamente.');
      }
    } catch (err) {
      setError('Ocurrió un error inesperado. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' }, minHeight: '100vh' }}>
      <Box
        sx={(theme) => ({
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          overflow: 'hidden',
          color: '#FFF6EF',
          background: `linear-gradient(150deg, ${theme.palette.primary.dark} 0%, #6E2F1B 52%, #3E2116 100%)`,
        })}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            border: '1px solid rgba(255, 235, 220, 0.18)',
            top: -180,
            right: -160,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 380,
            height: 380,
            borderRadius: '50%',
            border: '1px solid rgba(255, 235, 220, 0.12)',
            bottom: -140,
            left: -120,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 46,
              height: 46,
              borderRadius: 2.5,
              bgcolor: 'rgba(255, 246, 239, 0.14)',
              border: '1px solid rgba(255, 246, 239, 0.28)',
              fontFamily: '"Fraunces", serif',
              fontWeight: 600,
              fontSize: '1.15rem',
            }}
          >
            PV
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              Pago Vecinal
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,246,239,0.7)' }}>
              Gestión condominal
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', maxWidth: 520 }}>
          <Typography variant="h2" sx={{ fontSize: { md: '2.9rem', lg: '3.4rem' }, mb: 2 }}>
            La comunidad,
            <br />
            en orden.
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,246,239,0.78)', maxWidth: 420, mb: 4 }}>
            Administra cuotas, pagos y recibos sin planillas sueltas ni dudas a fin de mes.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {FEATURES.map((feature) => (
              <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <CheckIcon sx={{ fontSize: 19, color: 'rgba(255,246,239,0.85)' }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,246,239,0.85)' }}>
                  {feature}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography variant="caption" sx={{ position: 'relative', color: 'rgba(255,246,239,0.55)' }}>
          © {new Date().getFullYear()} Pago Vecinal
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 5 },
          py: { xs: 4, sm: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.25, mb: 4 }}>
            <Box
              sx={(theme) => ({
                display: 'grid',
                placeItems: 'center',
                width: 42,
                height: 42,
                borderRadius: 2.5,
                bgcolor: theme.palette.primary.main,
                color: '#FFF',
                fontFamily: '"Fraunces", serif',
                fontWeight: 600,
              })}
            >
              PV
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Pago Vecinal
            </Typography>
          </Box>

          <Typography variant="h3" sx={{ mb: 1 }}>
            Bienvenido de vuelta
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Ingresa con tu correo para gestionar tu comunidad.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              id="email"
              name="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              autoFocus
              margin="normal"
              value={formData.email}
              onChange={handleInputChange}
              error={Boolean(errors.email)}
              helperText={errors.email}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              id="password"
              name="password"
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              margin="normal"
              value={formData.password}
              onChange={handleInputChange}
              error={Boolean(errors.password)}
              helperText={errors.password}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((current) => !current)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2, height: 48 }}
            >
              {loading ? 'Procesando…' : 'Entrar'}
            </Button>
          </Box>

          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 1 }}>
            ¿Problemas para ingresar? Contacta al administrador de tu villa.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
