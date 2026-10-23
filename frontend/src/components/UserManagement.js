import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import StatusChip from './common/StatusChip';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import EmptyState from './common/EmptyState';
import DataToolbar from './common/DataToolbar';
import TablePagination from './common/TablePagination';
import ErrorState from './common/ErrorState';
import { useTableState } from '../hooks/useTableState';

const EMPTY_USER = { email: '', full_name: '', phone: '', role: 'owner', password: '' };

const UserManagement = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_USER);
  const table = useTableState();
  const { page: tablePage, setPage } = table;

  const filteredUsers = useMemo(() => {
    const term = table.search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.phone, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [users, table.search]);

  const totalPages = Math.max(Math.ceil(filteredUsers.length / table.limit), 1);
  const currentPage = Math.min(table.page, totalPages);
  const visibleUsers = useMemo(
    () =>
      filteredUsers.slice(
        (currentPage - 1) * table.limit,
        currentPage * table.limit
      ),
    [filteredUsers, currentPage, table.limit]
  );

  useEffect(() => {
    if (tablePage > totalPages) setPage(totalPages);
  }, [tablePage, totalPages, setPage]);

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
      setError('No pudimos cargar los usuarios.');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    setFormError('');
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        role: String(user.role || 'owner').toLowerCase(),
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData(EMPTY_USER);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingUser(null);
    setFormError('');
    setFormData(EMPTY_USER);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingUser) {
        await usersAPI.updateUser(editingUser.id, formData);
        toast.success('Usuario actualizado correctamente');
      } else {
        await usersAPI.createUser(formData);
        toast.success('Usuario creado correctamente');
      }
      fetchUsers();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el usuario.');
      }
      console.error('Error saving user:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    const confirmed = await confirm({
      title: 'Eliminar usuario',
      message: `¿Seguro que quieres eliminar a ${user.full_name}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await usersAPI.deleteUser(user.id);
      toast.success('Usuario eliminado correctamente');
      fetchUsers();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar el usuario');
      }
      console.error('Error deleting user:', err);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <Alert severity="error">No tienes permisos para acceder a esta página.</Alert>
      </PageContainer>
    );
  }

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (user) => user.email,
    },
    {
      key: 'full_name',
      label: 'Nombre completo',
      render: (user) => user.full_name,
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (user) => user.phone || '—',
    },
    {
      key: 'role',
      label: 'Rol',
      render: (user) => (
        <StatusChip
          label={String(user.role).toLowerCase() === 'admin' ? 'Administrador' : 'Propietario'}
          tone={String(user.role).toLowerCase() === 'admin' ? 'primary' : 'secondary'}
          status={user.role}
        />
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (user) => (
        <StatusChip label={user.is_active ? 'Activo' : 'Inactivo'} tone={user.is_active ? 'success' : 'default'} status="active" />
      ),
    },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        subtitle="Administra los accesos de administradores y propietarios."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Nuevo usuario
          </Button>
        }
      />

      <ErrorState message={error} onRetry={fetchUsers} />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por nombre, correo, teléfono o rol…"
        resultCount={filteredUsers.length}
        totalCount={users.length}
      />

      <ResponsiveTable
        columns={columns}
        rows={visibleUsers}
        loading={loading}
        getRowId={(user) => user.id}
        mobileTitle={(user) => user.full_name}
        mobileSubtitle={(user) => user.email}
        emptyState={
          <EmptyState
            title="No hay usuarios registrados"
            description="Crea el primer usuario para empezar."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo usuario
              </Button>
            }
          />
        }
        renderActions={(user) => (
          <ActionMenu
            ariaLabel={`Acciones para ${user.full_name}`}
            items={[
              { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(user) },
              {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                disabled: user.id === currentUser?.id,
                onClick: () => handleDelete(user),
              },
            ]}
          />
        )}
        footer={
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={filteredUsers.length}
            pageSize={table.limit}
            onPageChange={table.setPage}
            onPageSizeChange={table.setLimit}
            disabled={loading}
          />
        }
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle={editingUser ? editingUser.email : 'Crea un acceso para un administrador o propietario.'}
        submitLabel={editingUser ? 'Guardar cambios' : 'Crear usuario'}
        saving={saving}
        error={formError}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            autoFocus
            label="Correo electrónico"
            type="email"
            fullWidth
            required
            value={formData.email}
            onChange={(event) => setFormData({ ...formData, email: event.target.value })}
          />
          <TextField
            label="Nombre completo"
            fullWidth
            required
            value={formData.full_name}
            onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
          />
          <TextField
            label="Teléfono"
            fullWidth
            value={formData.phone}
            onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Rol</InputLabel>
            <Select
              value={formData.role}
              onChange={(event) => setFormData({ ...formData, role: event.target.value })}
              label="Rol"
            >
              <MenuItem value="owner">Propietario</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
            </Select>
          </FormControl>
          {!editingUser && (
            <TextField
              label="Contraseña inicial"
              type="password"
              fullWidth
              required
              value={formData.password}
              onChange={(event) => setFormData({ ...formData, password: event.target.value })}
              helperText="Mínimo 6 caracteres. El usuario podrá cambiarla luego."
            />
          )}
        </Box>
      </FormDialog>
    </PageContainer>
  );
};

export default UserManagement;
