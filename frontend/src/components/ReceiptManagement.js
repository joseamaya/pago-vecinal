import React, { useCallback, useEffect, useState } from 'react';
import {
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
  DownloadOutlined as DownloadIcon,
  EditOutlined as EditIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { receiptsAPI, paymentsAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import ResponsiveTable from './common/ResponsiveTable';
import ActionMenu from './common/ActionMenu';
import FormDialog from './common/FormDialog';
import MoneyText from './common/MoneyText';
import EmptyState from './common/EmptyState';
import DataToolbar from './common/DataToolbar';
import TablePagination from './common/TablePagination';
import ErrorState from './common/ErrorState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useTableState } from '../hooks/useTableState';
import { formatCurrency, formatDate, formatPeriod } from '../utils/formatters';

const EMPTY_RECEIPT = { payment_id: '', fee_period: '', notes: '' };

const ReceiptManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [payments, setPayments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [formData, setFormData] = useState(EMPTY_RECEIPT);

  const table = useTableState({ defaultSortBy: 'date', defaultSortDir: 'desc' });
  const { page: tablePage, setPage } = table;

  const loader = useCallback(
    () =>
      receiptsAPI
        .getReceipts(table.page, table.limit, {
          search: table.search || undefined,
          sort_by: table.sortBy || undefined,
          sort_dir: table.sortDir || undefined,
        })
        .then((response) => response.data),
    [table.page, table.limit, table.search, table.sortBy, table.sortDir]
  );

  const { data, loading, refreshing, error, reload } = useAsyncData(
    loader,
    [loader],
    { fallbackError: 'No pudimos cargar los recibos.' }
  );

  const receipts = data?.data || [];
  const pagination = data?.pagination || { total_count: 0, total_pages: 0 };
  const totalPages = Math.max(pagination.total_pages || 1, 1);
  const currentPage = Math.min(table.page, totalPages);

  useEffect(() => {
    if (data && tablePage > totalPages) setPage(totalPages);
  }, [data, tablePage, totalPages, setPage]);

  const refreshFromFirstPage = useCallback(async () => {
    if (tablePage !== 1) {
      setPage(1);
      return;
    }
    await reload();
  }, [tablePage, setPage, reload]);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await paymentsAPI.getPayments(1, 1000);
      setPayments(response.data.data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setPayments([]);
    }
  };

  const handleOpenDialog = (receipt = null) => {
    setFormError('');
    if (receipt) {
      setEditingReceipt(receipt);
      setFormData({
        payment_id: receipt.payment_id,
        fee_period: receipt.fee_period || '',
        notes: receipt.notes || '',
      });
    } else {
      setEditingReceipt(null);
      setFormData(EMPTY_RECEIPT);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingReceipt(null);
    setFormError('');
    setFormData(EMPTY_RECEIPT);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingReceipt) {
        await receiptsAPI.updateReceipt(editingReceipt.id, formData);
        toast.success('Recibo actualizado correctamente');
      } else {
        await receiptsAPI.createReceipt(formData);
        toast.success('Recibo creado correctamente');
      }
      await refreshFromFirstPage();
      handleCloseDialog();
    } catch (err) {
      if (!isNetworkError(err)) {
        setFormError(err.response?.data?.detail || 'No pudimos guardar el recibo.');
      }
      console.error('Error saving receipt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (receipt) => {
    const confirmed = await confirm({
      title: 'Eliminar recibo',
      message: `¿Seguro que quieres eliminar el recibo ${receipt.correlative_number}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await receiptsAPI.deleteReceipt(receipt.id);
      toast.success('Recibo eliminado correctamente');
      await refreshFromFirstPage();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos eliminar el recibo');
      }
      console.error('Error deleting receipt:', err);
    }
  };

  const handleDownload = async (receipt) => {
    try {
      const response = await receiptsAPI.downloadReceiptPDF(receipt.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recibo_${receipt.correlative_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos descargar el recibo');
      }
      console.error('Error downloading receipt:', err);
    }
  };

  const handleRegenerate = async (receipt) => {
    const confirmed = await confirm({
      title: 'Regenerar PDF',
      message: '¿Quieres regenerar el PDF de este recibo? Se sobrescribirá el archivo existente.',
      confirmLabel: 'Regenerar',
      destructive: false,
    });
    if (!confirmed) return;

    try {
      await receiptsAPI.regenerateReceiptPDF(receipt.id);
      toast.success('PDF regenerado correctamente');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos regenerar el PDF');
      }
      console.error('Error regenerating receipt PDF:', err);
    }
  };

  const handleRegenerateAll = async () => {
    const confirmed = await confirm({
      title: 'Regenerar todos los PDFs',
      message: 'Se regenerarán todos los recibos. Esto puede tardar unos minutos.',
      confirmLabel: 'Regenerar todos',
      destructive: false,
    });
    if (!confirmed) return;

    try {
      setRegenerating(true);
      const response = await receiptsAPI.regenerateAllReceiptPDFs();
      toast.success(`PDFs regenerados: ${response.data.updated_count} recibos actualizados`);
      if (response.data.errors?.length > 0) {
        toast.warning(`Hubo ${response.data.errors.length} errores. Revisa la consola.`);
      }
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('No pudimos regenerar los PDFs');
      }
      console.error('Error regenerating all receipt PDFs:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const columns = [
    { key: 'correlative_number', label: 'Recibo', mobile: false },
    { key: 'issue_date', label: 'Emisión', render: (receipt) => formatDate(receipt.issue_date) },
    {
      key: 'total_amount',
      label: 'Monto',
      render: (receipt) => <MoneyText value={receipt.total_amount} variant="body2" />,
    },
    {
      key: 'property',
      label: 'Propiedad',
      render: (receipt) =>
        receipt.property_details
          ? `${receipt.property_details.villa || ''} ${receipt.property_details.row_letter || ''}${receipt.property_details.number ?? ''}`.trim()
          : '—',
    },
    {
      key: 'owner',
      label: 'Propietario',
      render: (receipt) => receipt.owner_details?.name || '—',
    },
    {
      key: 'fee_period',
      label: 'Periodo',
      render: (receipt) => receipt.fee_period || '—',
    },
  ];

  const footer = (
    <TablePagination
      page={currentPage}
      totalPages={totalPages}
      totalCount={pagination.total_count}
      pageSize={table.limit}
      onPageChange={table.setPage}
      onPageSizeChange={table.setLimit}
      disabled={loading || refreshing}
    />
  );

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Cobranzas"
        title="Recibos"
        subtitle="Consulta, descarga y regenera los recibos emitidos."
        actions={
          <>
            {isAdmin && (
              <Button variant="outlined" startIcon={<SyncIcon />} onClick={handleRegenerateAll} disabled={regenerating}>
                Regenerar PDFs
              </Button>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Nuevo recibo
            </Button>
          </>
        }
      />

      <ErrorState message={error} onRetry={reload} />

      <DataToolbar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Buscar por recibo, propiedad o propietario…"
        resultCount={receipts.length}
        totalCount={pagination.total_count}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Ordenar por</InputLabel>
          <Select
            value={table.sortBy}
            label="Ordenar por"
            onChange={(event) =>
              table.setSort(event.target.value, table.sortDir || 'desc')
            }
          >
            <MenuItem value="date">Fecha</MenuItem>
            <MenuItem value="correlative">Recibo</MenuItem>
            <MenuItem value="amount">Monto</MenuItem>
            <MenuItem value="owner">Propietario</MenuItem>
            <MenuItem value="property">Propiedad</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Dirección</InputLabel>
          <Select
            value={table.sortDir || 'desc'}
            label="Dirección"
            onChange={(event) => table.setSort(table.sortBy || 'date', event.target.value)}
          >
            <MenuItem value="asc">Ascendente</MenuItem>
            <MenuItem value="desc">Descendente</MenuItem>
          </Select>
        </FormControl>
      </DataToolbar>

      <ResponsiveTable
        columns={columns}
        rows={receipts}
        loading={loading || refreshing}
        getRowId={(receipt) => receipt.id}
        mobileTitle={(receipt) => `Recibo ${receipt.correlative_number}`}
        mobileSubtitle={(receipt) =>
          `${receipt.property_details?.villa || ''} ${receipt.owner_details?.name ? `· ${receipt.owner_details.name}` : ''}`
        }
        emptyState={
          <EmptyState
            title="No hay recibos registrados"
            description="Los recibos generados aparecerán aquí."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Nuevo recibo
              </Button>
            }
          />
        }
        renderActions={(receipt) => (
          <ActionMenu
            ariaLabel={`Acciones para el recibo ${receipt.correlative_number}`}
            items={[
              {
                label: 'Descargar PDF',
                icon: <DownloadIcon fontSize="small" />,
                onClick: () => handleDownload(receipt),
              },
              {
                label: 'Regenerar PDF',
                icon: <RefreshIcon fontSize="small" />,
                onClick: () => handleRegenerate(receipt),
              },
              { label: 'Editar', icon: <EditIcon fontSize="small" />, onClick: () => handleOpenDialog(receipt) },
              isAdmin && {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => handleDelete(receipt),
              },
            ].filter(Boolean)}
          />
        )}
        footer={footer}
      />

      <FormDialog
        open={open}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        title={editingReceipt ? 'Editar recibo' : 'Nuevo recibo'}
        subtitle={editingReceipt ? editingReceipt.correlative_number : 'Asocia un pago para emitir el recibo.'}
        submitLabel={editingReceipt ? 'Guardar cambios' : 'Crear recibo'}
        saving={saving}
        error={formError}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Pago</InputLabel>
            <Select
              value={formData.payment_id}
              onChange={(event) => setFormData({ ...formData, payment_id: event.target.value })}
              label="Pago"
              required
            >
              {payments.map((payment) => (
                <MenuItem key={payment.id} value={payment.id}>
                  {formatCurrency(payment.amount)}
                  {payment.property_row_letter ? ` · ${payment.property_row_letter}${payment.property_number}` : ''}
                  {payment.fee_month ? ` · ${formatPeriod(payment.fee_month, payment.fee_year)}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Periodo de cuota"
            fullWidth
            value={formData.fee_period}
            onChange={(event) => setFormData({ ...formData, fee_period: event.target.value })}
            placeholder="Ej. Enero 2026"
          />
          <TextField
            label="Notas"
            fullWidth
            multiline
            rows={3}
            value={formData.notes}
            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          />
        </Box>
      </FormDialog>
    </PageContainer>
  );
};

export default ReceiptManagement;
