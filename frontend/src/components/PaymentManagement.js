import React, { useState, useEffect, useCallback } from 'react';
import { Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { paymentsAPI, propertiesAPI, reportsAPI } from '../services/api';
import { isNetworkError } from '../services/notifications';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDownload } from '../hooks/useDownload';
import { usePaymentFilters } from '../hooks/usePaymentFilters';
import { usePaymentDialog } from '../hooks/usePaymentDialog';
import PageContainer from './common/PageContainer';
import PageHeader from './common/PageHeader';
import FilterBar from './common/FilterBar';
import DataToolbar from './common/DataToolbar';
import ErrorState from './common/ErrorState';
import PaymentTable from './payments/PaymentTable';
import PaymentFormDialog from './payments/PaymentFormDialog';
import BulkUploadDialog from './payments/BulkUploadDialog';
import { MONTHS } from '../utils/months';
import { formatPropertyLabel } from '../utils/formatters';

const PaymentManagement = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { download, downloadFromResponse } = useDownload();
  const [properties, setProperties] = useState([]);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const filters = usePaymentFilters(properties);
  const dialog = usePaymentDialog({
    properties,
    isAdmin,
    onSaved: filters.refresh,
  });

  const fetchProperties = useCallback(async () => {
    try {
      const response = await propertiesAPI.getProperties(1, 10000);
      setProperties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    setSelectedPayments([]);
  }, [
    filters.filters.year,
    filters.filters.month,
    filters.filters.status,
    filters.filters.property,
  ]);

  const handleDelete = async (payment) => {
    const confirmed = await confirm({
      title: 'Eliminar pago',
      message: `¿Estás seguro de que quieres eliminar este pago de S/ ${payment.amount.toFixed(
        2
      )}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await paymentsAPI.deletePayment(payment.id);
      toast.success('Pago eliminado correctamente');
      await filters.refresh();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al eliminar pago');
      }
      console.error('Error deleting payment:', err);
    }
  };

  const handleApprove = async (payment) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'approved');
      await paymentsAPI.updatePayment(payment.id, formDataToSend);
      toast.success('Pago aprobado correctamente');
      await filters.refresh();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al aprobar pago');
      }
      console.error('Error approving payment:', err);
    }
  };

  const handleReject = async (payment) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'rejected');
      await paymentsAPI.updatePayment(payment.id, formDataToSend);
      toast.success('Pago rechazado');
      await filters.refresh();
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al rechazar pago');
      }
      console.error('Error rejecting payment:', err);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPayments.length === 0) {
      toast.error('Por favor selecciona al menos un pago para aprobar');
      return;
    }

    try {
      const response = await paymentsAPI.bulkApprovePayments(selectedPayments);
      await filters.refresh();
      setSelectedPayments([]);
      toast.success(`Se aprobaron ${response.data.approved_count} pagos exitosamente`);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al aprobar pagos masivamente');
      }
      console.error('Error bulk approving payments:', err);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await reportsAPI.getAllPaymentsReport();
      downloadFromResponse(response, 'reporte_pagos_completo.xlsx');
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al exportar el reporte de pagos');
      }
      console.error('Error exporting payments:', err);
    }
  };

  const handleDownload = async (payment) => {
    try {
      const response = await paymentsAPI.downloadGeneratedReceipt(payment.id);
      const correlative =
        payment.receipt_correlative_number ||
        `REC-${new Date().getFullYear()}-${payment.id.slice(-5).toUpperCase()}`;
      download(new Blob([response.data]), `recibo_${correlative}.pdf`);
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Error al descargar el recibo');
      }
      console.error('Error downloading receipt:', err);
    }
  };

  const handleToggleSelect = (paymentId) => {
    setSelectedPayments((previous) =>
      previous.includes(paymentId)
        ? previous.filter((id) => id !== paymentId)
        : [...previous, paymentId]
    );
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        eyebrow="Cobranzas"
        title="Pagos"
        subtitle="Registra pagos, revisa comprobantes y aprueba los pendientes."
        actions={
          <>
            {isAdmin && (
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => setBulkUploadOpen(true)}
              >
                Importar
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportExcel}
              >
                Exportar
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => dialog.handleOpenDialog()}
            >
              Nuevo pago
            </Button>
          </>
        }
      />

      <ErrorState message={filters.error} onRetry={filters.refresh} />

      <DataToolbar
        search={filters.search}
        onSearchChange={filters.setSearch}
        searchPlaceholder="Buscar por propiedad, propietario o notas…"
        resultCount={filters.payments.length}
        totalCount={filters.totalCount}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Ordenar por</InputLabel>
          <Select
            value={filters.sortBy}
            label="Ordenar por"
            onChange={(event) => {
              const value = event.target.value;
              filters.setSort(value, value ? filters.sortDir || 'asc' : '');
            }}
          >
            <MenuItem value="">Estado (predeterminado)</MenuItem>
            <MenuItem value="date">Fecha</MenuItem>
            <MenuItem value="amount">Monto</MenuItem>
            <MenuItem value="status">Estado</MenuItem>
            <MenuItem value="property">Propiedad</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Dirección</InputLabel>
          <Select
            value={filters.sortDir || 'asc'}
            label="Dirección"
            onChange={(event) =>
              filters.setSort(filters.sortBy || 'date', event.target.value)
            }
          >
            <MenuItem value="asc">Ascendente</MenuItem>
            <MenuItem value="desc">Descendente</MenuItem>
          </Select>
        </FormControl>
      </DataToolbar>

      <FilterBar chips={filters.activeFilterChips} onClear={filters.clearFilters}>
        <FormControl fullWidth>
          <InputLabel>Año</InputLabel>
          <Select
            value={filters.filters.year}
            onChange={(event) => filters.setFilter('year', event.target.value)}
            label="Año"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {filters.availableYears.map((year) => (
              <MenuItem key={year} value={year.toString()}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Mes</InputLabel>
          <Select
            value={filters.filters.month}
            onChange={(event) => filters.setFilter('month', event.target.value)}
            label="Mes"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            {MONTHS.map((month) => (
              <MenuItem key={month.value} value={month.value.toString()}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Estado</InputLabel>
          <Select
            value={filters.filters.status}
            onChange={(event) => filters.setFilter('status', event.target.value)}
            label="Estado"
          >
            <MenuItem value="">
              <em>Todos</em>
            </MenuItem>
            <MenuItem value="pending">Pendiente</MenuItem>
            <MenuItem value="approved">Aprobado</MenuItem>
            <MenuItem value="completed">Completado</MenuItem>
            <MenuItem value="partially_paid">Pago parcial</MenuItem>
            <MenuItem value="rejected">Rechazado</MenuItem>
            <MenuItem value="failed">Fallido</MenuItem>
            <MenuItem value="cancelled">Cancelado</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Propiedad</InputLabel>
          <Select
            value={filters.filters.property}
            onChange={(event) => filters.setFilter('property', event.target.value)}
            label="Propiedad"
          >
            <MenuItem value="">
              <em>Todas</em>
            </MenuItem>
            {properties.map((property) => (
              <MenuItem key={property.id} value={property.id}>
                {formatPropertyLabel(property)} · {property.owner_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      <PaymentTable
        payments={filters.payments}
        loading={filters.loading}
        isAdmin={isAdmin}
        selectedPayments={selectedPayments}
        onToggleSelect={handleToggleSelect}
        onSelectAll={setSelectedPayments}
        onClearSelection={() => setSelectedPayments([])}
        onBulkApprove={handleBulkApprove}
        onCreate={() => dialog.handleOpenDialog()}
        onEdit={(payment) => dialog.handleOpenDialog(payment)}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
        onDownload={handleDownload}
        pagination={{
          page: filters.page,
          totalPages: filters.totalPages,
          totalCount: filters.totalCount,
          pageSize: filters.pageSize,
          onPageChange: filters.handlePageChange,
          onPageSizeChange: filters.setPageSize,
        }}
      />

      <PaymentFormDialog dialog={dialog} isAdmin={isAdmin} />

      <BulkUploadDialog
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploaded={filters.refresh}
      />
    </PageContainer>
  );
};

export default PaymentManagement;
