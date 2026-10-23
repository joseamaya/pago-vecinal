import React from 'react';
import { Box, Button, Pagination, Paper, Typography } from '@mui/material';
import {
  Add as AddIcon,
  CheckCircleOutline as ApproveIcon,
  DeleteOutline as DeleteIcon,
  Download as DownloadIcon,
  EditOutlined as EditIcon,
  HighlightOffOutlined as RejectIcon,
} from '@mui/icons-material';
import ResponsiveTable from '../common/ResponsiveTable';
import ActionMenu from '../common/ActionMenu';
import StatusChip from '../common/StatusChip';
import MoneyText from '../common/MoneyText';
import EmptyState from '../common/EmptyState';
import { formatCurrency, formatDate, formatPeriod } from '../../utils/formatters';

const PaymentTable = ({
  payments = [],
  loading = false,
  isAdmin = false,
  selectedPayments = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkApprove,
  onCreate,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  onDownload,
  pagination = {},
}) => {
  const { page = 1, totalPages = 1, totalCount = 0, pageSize = 20, onPageChange } = pagination;
  const pendingIds = payments
    .filter((payment) => payment.status === 'pending')
    .map((payment) => payment.id);
  const allSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedPayments.includes(id));

  const handleSelectAll = () => {
    onSelectAll(allSelected ? [] : pendingIds);
  };

  const columns = [
    {
      key: 'fee',
      label: 'Cuota',
      mobile: false,
      render: (payment) =>
        payment.property_row_letter && payment.property_number && payment.fee_month
          ? `${payment.property_row_letter}${payment.property_number} · ${formatPeriod(
              payment.fee_month,
              payment.fee_year
            )}`
          : '—',
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (payment) => <MoneyText value={payment.amount} variant="body2" />,
    },
    {
      key: 'payment_date',
      label: 'Fecha de pago',
      render: (payment) => formatDate(payment.payment_date),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (payment) => <StatusChip status={payment.status} />,
    },
    {
      key: 'receipt',
      label: 'Recibo',
      render: (payment) =>
        payment.status === 'approved' || payment.status === 'completed' ? (
          <Button
            size="small"
            variant="text"
            startIcon={<DownloadIcon />}
            onClick={() => onDownload?.(payment)}
          >
            PDF
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <Box>
      {isAdmin && selectedPayments.length > 0 && (
        <Paper
          sx={{
            p: 1.5,
            pl: 2.5,
            mb: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            borderColor: 'success.main',
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(94, 125, 69, 0.08)'
                : 'rgba(157, 178, 132, 0.12)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {selectedPayments.length}{' '}
            {selectedPayments.length === 1 ? 'pago seleccionado' : 'pagos seleccionados'}
          </Typography>
          <Button size="small" color="inherit" onClick={onClearSelection}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<ApproveIcon />}
            onClick={onBulkApprove}
          >
            Aprobar seleccionados
          </Button>
        </Paper>
      )}

      <ResponsiveTable
        columns={columns}
        rows={payments}
        loading={loading}
        getRowId={(payment) => payment.id}
        selectable={isAdmin}
        selectedIds={selectedPayments}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={handleSelectAll}
        isSelectable={(payment) => payment.status === 'pending'}
        mobileTitle={(payment) =>
          payment.property_row_letter && payment.property_number && payment.fee_month
            ? `${payment.property_row_letter}${payment.property_number} · ${formatPeriod(
                payment.fee_month,
                payment.fee_year
              )}`
            : 'Pago'
        }
        mobileSubtitle={(payment) =>
          `${formatCurrency(payment.amount)} · ${formatDate(payment.payment_date)}`
        }
        emptyState={
          <EmptyState
            title="No hay pagos registrados"
            description="Registra un pago o ajusta los filtros."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
                Nuevo pago
              </Button>
            }
          />
        }
        renderActions={(payment) => (
          <ActionMenu
            ariaLabel={`Acciones para el pago de ${formatCurrency(payment.amount)}`}
            items={[
              (payment.status === 'approved' || payment.status === 'completed') && {
                label: 'Descargar recibo',
                icon: <DownloadIcon fontSize="small" />,
                onClick: () => onDownload?.(payment),
              },
              {
                label: 'Editar',
                icon: <EditIcon fontSize="small" />,
                onClick: () => onEdit?.(payment),
              },
              isAdmin &&
                payment.status === 'pending' && {
                  label: 'Aprobar',
                  icon: <ApproveIcon fontSize="small" />,
                  color: 'success',
                  onClick: () => onApprove?.(payment),
                },
              isAdmin &&
                payment.status === 'pending' && {
                  label: 'Rechazar',
                  icon: <RejectIcon fontSize="small" />,
                  color: 'error',
                  onClick: () => onReject?.(payment),
                },
              isAdmin && { divider: true },
              isAdmin && {
                label: 'Eliminar',
                icon: <DeleteIcon fontSize="small" />,
                color: 'error',
                onClick: () => onDelete?.(payment),
              },
            ].filter(Boolean)}
          />
        )}
        header={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mostrando {payments.length > 0 ? (page - 1) * pageSize + 1 : 0}–
              {Math.min(page * pageSize, totalCount)} de {totalCount} pagos
            </Typography>
            {isAdmin && selectedPayments.length > 0 && (
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                {selectedPayments.length} seleccionados
              </Typography>
            )}
          </Box>
        }
        footer={
          totalPages > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, newPage) => onPageChange?.(newPage)}
                color="primary"
              />
            </Box>
          ) : null
        }
      />
    </Box>
  );
};

export default PaymentTable;
