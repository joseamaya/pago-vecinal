import React, { useState, useEffect } from 'react';
import {
  Container,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Box,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';

const UserManagement = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'OWNER',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers();
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError('Error al cargar usuarios');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        role: user.role,
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        role: 'OWNER',
        password: '',
      });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({
      email: '',
      full_name: '',
      phone: '',
      role: 'OWNER',
      password: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersAPI.updateUser(editingUser.id, formData);
      } else {
        await usersAPI.createUser(formData);
      }
      fetchUsers();
      handleCloseDialog();
    } catch (err) {
      setError(editingUser ? 'Error al actualizar usuario' : 'Error al crear usuario');
      console.error('Error saving user:', err);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      try {
        await usersAPI.deleteUser(userId);
        fetchUsers();
      } catch (err) {
        setError('Error al eliminar usuario');
        console.error('Error deleting user:', err);
      }
    }
  };

  const getRoleColor = (role) => {
    return role === 'ADMIN' ? 'primary' : 'secondary';
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          No tienes permisos para acceder a esta página.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Usuarios
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Usuario
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
                <TableCell>Email</TableCell>
                <TableCell>Nombre Completo</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role === 'ADMIN' ? 'Administrador' : 'Propietario'}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Activo' : 'Inactivo'}
                        color={user.is_active ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(user)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(user.id)}
                        disabled={user.id === currentUser?.id}
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

      {/* Dialog for Add/Edit User */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Email"
              type="email"
              fullWidth
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Nombre Completo"
              fullWidth
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Teléfono"
              fullWidth
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Rol</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Rol"
              >
                <MenuItem value="OWNER">Propietario</MenuItem>
                <MenuItem value="ADMIN">Administrador</MenuItem>
              </Select>
            </FormControl>
            {!editingUser && (
              <TextField
                margin="dense"
                label="Contraseña"
                type="password"
                fullWidth
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingUser ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default UserManagement;