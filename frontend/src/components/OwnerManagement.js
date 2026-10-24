import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { ownersAPI, usersAPI } from '../services/api';
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
import { useFormValidation } from '../hooks/useFormValidation';
import { email, minLength, phone, required } from '../utils/validators';

const EMPTY_OWNER = { full_name: '', phone: '', email: '', user_id: '', is_active: true };

const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const OwnerManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [owners, setOwners] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(null);
  const [formData, setFormData] = useState(EMPTY_OWNER);
  const schema = useMemo(
    () => ({
      full_name: [
        required('Ingresa el nombre del propietario.'),
        minLength(3, 'Ingresa el nombre del propietario.'),
      ],
      phone: phone(),
      email: email(),
    }),
    []
  );
  const { errors, validateField, validateAll, clearError, setErrors } = useFormValidation(
    formData,
    schema
  );
  const handleFieldChange = (field) => (event) => {
    setFormData((previous) => ({ ...previous, [field]: event.target.value }));
    clearError(field);
  };
  const handleFieldBlur = (field) => () => validateField(field);
  const table = useTableState();
  const { page: tablePage, setPage } = table;

  const filteredOwners = useMemo(() => {
    const term = normalizeSearchText(table.search.trim());
    if (!term) return owners;
    return owners.filter((owner) =>
      [owner.full_name, owner.phone, owner.email]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value).includes(term))
    );
  }, [owners, table.search]);

  const totalPages = Math.max(Math.ceil(filteredOwners.length / table.limit), 1);
  const currentPage = Math.min(table.page, totalPages);
  const visibleOwners = useMemo(
    () =>
      filteredOwners.slice(
        (currentPage - 1) * table.limit,
        currentPage * table.limit
      ),
    [filteredOwners, currentPage, table.limit]
  );

  useEffect(() => {
    if (tablePage > totalPages) setPage(totalPages);
  }, [tablePage, totalPages, setPage]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ownersResponse, usersResponse] = await Promise.all([
        ownersAPI.getOwners(),
        usersAPI.getUsers(),
      ]);
      setOwners(ownersResponse.data);
      setUsers(usersResponse.data);
      setError('');
    } catch (err) {
      setError('No pudimos cargar los propietarios.');
      console.error('Error fetching owners:', err);
    } finally {
      setLoading(false);
    }
  };

  const linkedUserIds = useMemo(
    () =>
      new Set(
        owners
          .filter((owner) => owner.id !== editingOwner?.id)
          .map((owner) => owner.user_id)
          .filter(Boolean)
      ),
    [owners, editingOwner]
  );

  const ownerUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          String(user.role).toLowerCase() === 'owner' &&
          (user.is_active !== false || user.id === editingOwner?.user_id) &&
          !linkedUserIds.has(user.id)
      ),
    [users, linkedUserIds, editingOwner]
  );

  const linkedUserFor = (owner) =>
    users.find((user) => user.id === owner.user_id);

  const handleOpenDialog = (owner = null) => {
    setFormError('');
    setErrors({});
    if (owner) {
      setEditingOwner(owner);
      setFormData({
        full_name: owner.full_name,
        phone: owner.phone || '',
        email: owner.email || '',
        user_id: owner.user_id || '',
        is_active: owner.is_active !== false,
      });
    } else {
      setEditingOwner(null);
      setFormData(EMPTY_OWNER);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingOwner(null);
    setFormError('');
    setErrors({});
    setFormData(EMPTY_OWNER);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validateAll()) return;
    setSaving(true);
    try {
      const payload = {
        full_name: formData.full_name,
        phone: formData.phone || null,
        email: formData.email || null,
        user_id: formData.user_id || null,
        is_active: formData.is_active,
      };
      if (editingOwner) {
        await ownersAPI.updateOwner(editingOwner.id, payload);
        toast.success('Propietario actualizado correctamente');
      } else {
        await ownersAPI.createOwner(payload);
        toast.success('Propietario creado correctamente');
      }
      fetchData();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el propietario.');
      }
      console.error('Error saving owner:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (owner) => {
    const confirmed = await confirm({
      title: 'Eliminar propietario',
      message: `¿Seguro que quieres eliminar a ${owner.full_name}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await ownersAPI.deleteOwner(owner.id);
      toast.success('Propietario eliminado correctamente');
      fetchData();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error(err.response?.data?.detail || 'No pudimos eliminar el propietario');
      }
      console.error('Error deleting owner:', err);
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
      key: 'full_name',
      label: 'Propietario',
      render: (owner) => owner.full_name,
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (owner) => owner.phone || '—',
    },
    {
      key: 'email',
      label: 'Email',
      render: (owner) => owner.email || '—',
    },
    {
      key: 'user',
      label: 'Cuenta vinculada',
      render: (owner) => {
        const linkedUser = linkedUserFor(owner);
        if (!linkedUser) return '—';
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <span>{linkedUser.full_name}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{linkedUser.email}</span>
          </Box>
        );
      },
    },
    {
      key: 'status',
      label: 'Estado',
      render: (owner) => (
        <StatusChip label={owner.is_active ? 'Activo' : 'Inactivo'} tone={owner.is_active ? 'success' : 'default'} status="active" />
      ),
    },
  ];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Administración"
        title="Propietarios"
        subtitle="Registra los datos de los propietarios y vincula sus cuentas de acceso."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Nuevo propietario
          </Button>
        }
      />

      <ErrorState message={error} onRetry={fetchData} />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por nombre, teléfono o email…"
        resultCount={filteredOwners.length}
        totalCount={owners.length}
      />

      <ResponsiveTable
        columns={columns}
        rows={visibleOwners}
        loading={loading}
        getRowId={(owner) => owner.id}
        mobileTitle={(owner) => owner.full_name}
        mobileSubtitle={(owner) => owner.phone || 'Sin teléfono'}
        emptyState={
          <EmptyState
            title="No hay propietarios registrados"
            description="Registra el primer propietario para asignarlo a una propiedad."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo propietario
              </Button>
            }
          />
        }
        renderActions={(owner) => (
          <ActionMenu
            ariaLabel={`Acciones para ${owner.full_name}`}
            items={[
              { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(owner) },
              {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => handleDelete(owner),
              },
            ]}
          />
        )}
        footer={
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={filteredOwners.length}
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
        title={editingOwner ? 'Editar propietario' : 'Nuevo propietario'}
        subtitle={
          editingOwner
            ? 'Actualiza los datos o la cuenta vinculada.'
            : 'Registra los datos del propietario. La cuenta es opcional.'
        }
        submitLabel={editingOwner ? 'Guardar cambios' : 'Crear propietario'}
        saving={saving}
        error={formError}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            autoFocus
            name="full_name"
            label="Nombre completo"
            fullWidth
            required
            value={formData.full_name}
            onChange={handleFieldChange('full_name')}
            onBlur={handleFieldBlur('full_name')}
            error={Boolean(errors.full_name)}
            helperText={errors.full_name}
          />
          <TextField
            name="phone"
            label="Teléfono"
            fullWidth
            value={formData.phone}
            onChange={handleFieldChange('phone')}
            onBlur={handleFieldBlur('phone')}
            error={Boolean(errors.phone)}
            helperText={errors.phone}
          />
          <TextField
            name="email"
            label="Email"
            type="email"
            fullWidth
            value={formData.email}
            onChange={handleFieldChange('email')}
            onBlur={handleFieldBlur('email')}
            error={Boolean(errors.email)}
            helperText={errors.email}
          />
          <FormControl fullWidth>
            <InputLabel>Cuenta vinculada</InputLabel>
            <Select
              value={formData.user_id || ''}
              onChange={(event) =>
                setFormData({ ...formData, user_id: event.target.value })
              }
              label="Cuenta vinculada"
            >
              <MenuItem value="">
                <em>Sin cuenta vinculada</em>
              </MenuItem>
              {ownerUsers.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.full_name} · {user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active !== false}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))
                }
              />
            }
            label="Propietario activo"
          />
        </Box>
      </FormDialog>
    </PageContainer>
  );
};

export default OwnerManagement;
