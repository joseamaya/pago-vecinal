import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  VisibilityOffOutlined as VisibilityOffIcon,
  VisibilityOutlined as VisibilityIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import SectionCard from './common/SectionCard';
import StatusChip from './common/StatusChip';
import { getInitials } from '../utils/formatters';

const Profile = () => {
  const { user, isAdmin, refreshUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setProfile({
      full_name: user?.full_name || '',
      phone: user?.phone || '',
    });
  }, [user]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await usersAPI.updateUser(user.id, {
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim() || null,
      });
      await refreshUser();
      toast.success('Perfil actualizado correctamente');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos actualizar tu perfil');
      }
      console.error('Error updating profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');

    if (!password.current) {
      setPasswordError('Ingresa tu contraseña actual.');
      return;
    }
    if (password.next.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setSavingPassword(true);
    try {
      await usersAPI.changePassword({
        current_password: password.current,
        new_password: password.next,
      });
      setPassword({ current: '', next: '', confirm: '' });
      toast.success('Contraseña actualizada correctamente');
    } catch (err) {
      if (!isNetworkError(err)) {
        const detail = err.response?.data?.detail;
        setPasswordError(typeof detail === 'string' ? detail : 'No pudimos cambiar la contraseña.');
      }
      console.error('Error changing password:', err);
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordType = showPasswords ? 'text' : 'password';
  const passwordAdornment = {
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          edge="end"
          size="small"
          onClick={() => setShowPasswords((current) => !current)}
          aria-label={showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        >
          {showPasswords ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
        </IconButton>
      </InputAdornment>
    ),
  };

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        subtitle="Actualiza tus datos de contacto y la seguridad de tu cuenta."
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Tu cuenta" contentSx={{ textAlign: 'center', py: 4 }}>
            <Avatar
              sx={{
                width: 84,
                height: 84,
                mx: 'auto',
                mb: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontSize: '1.6rem',
              }}
            >
              {getInitials(user?.full_name || user?.email || '')}
            </Avatar>
            <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
              {user?.full_name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {user?.email}
            </Typography>
            <StatusChip
              label={isAdmin ? 'Administrador' : 'Propietario'}
              tone={isAdmin ? 'primary' : 'secondary'}
              status={user?.role}
            />
            <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider', textAlign: 'left' }}>
              <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                Contacto
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {user?.phone || 'Sin teléfono registrado'}
              </Typography>
            </Box>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <SectionCard title="Datos personales" subtitle="Se usan para identificarte en la comunidad.">
              <Box component="form" onSubmit={handleProfileSubmit}>
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <TextField
                      label="Nombre completo"
                      fullWidth
                      required
                      value={profile.full_name}
                      onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Teléfono"
                      fullWidth
                      value={profile.phone}
                      onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Correo electrónico"
                      fullWidth
                      value={user?.email || ''}
                      InputProps={{ readOnly: true }}
                      helperText="El correo se usa para iniciar sesión."
                    />
                  </Grid>
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
                  <Button type="submit" variant="contained" disabled={savingProfile || !profile.full_name.trim()}>
                    {savingProfile ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </Box>
              </Box>
            </SectionCard>

            <SectionCard
              title="Cambiar contraseña"
              subtitle="Usa al menos 6 caracteres."
              icon={<LockIcon />}
            >
              {passwordError && (
                <Alert severity="error" sx={{ mb: 2.5 }}>
                  {passwordError}
                </Alert>
              )}
              <Box component="form" onSubmit={handlePasswordSubmit}>
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <TextField
                      label="Contraseña actual"
                      type={passwordType}
                      fullWidth
                      required
                      autoComplete="current-password"
                      value={password.current}
                      onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))}
                      InputProps={passwordAdornment}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Nueva contraseña"
                      type={passwordType}
                      fullWidth
                      required
                      autoComplete="new-password"
                      value={password.next}
                      onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Confirmar nueva contraseña"
                      type={passwordType}
                      fullWidth
                      required
                      autoComplete="new-password"
                      value={password.confirm}
                      onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={savingPassword || !password.current || !password.next || !password.confirm}
                  >
                    {savingPassword ? 'Actualizando…' : 'Cambiar contraseña'}
                  </Button>
                </Box>
              </Box>
            </SectionCard>
          </Box>
        </Grid>
      </Grid>
    </PageContainer>
  );
};

export default Profile;
